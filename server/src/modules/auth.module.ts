/**
 * FR-AUTH-02/03/05: email-format validation, argon2 verification, expiring
 * JWTs, and lockout after 5 consecutive failures (15-minute window). Both
 * success and failure append audit rows (FR-AUTH-07).
 */
import argon2 from "argon2"
import { eq, sql } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { db } from "../db/client.js"
import { accounts } from "../db/schema.js"
import { writeAudit } from "../lib/audit.js"
import { unauthorized } from "../lib/errors.js"
import { nowIso } from "../lib/http.js"
import type { TokenClaims } from "../plugins/auth.js"
import { isValidUniversityEmail } from "@shared/utils/validation"

const LOCKOUT_THRESHOLD = 5
const LOCKOUT_MINUTES = 15

const loginBody = z.object({
  email: z.string().refine(isValidUniversityEmail, {
    message:
      "That doesn't look like a Sunderland account. Students use a 6-character code @student.sunderland.ac.uk; staff use firstname.lastname@sunderland.ac.uk.",
  }),
  password: z.string().min(1, "Password is required."),
})

export const authModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()

  app.post(
    "/auth/login",
    {
      config: { public: true },
      schema: { tags: ["auth"], body: loginBody },
    },
    async (req) => {
      const email = req.body.email.trim().toLowerCase()
      const account = await db.query.accounts.findFirst({
        where: eq(sql`lower(${accounts.email})`, email),
      })

      const fail = async (detail: string) => {
        await writeAudit(db, "login_failed", req.body.email.trim(), detail)
        throw unauthorized("Invalid email or password.")
      }

      if (!account || account.password_hash === null) {
        return fail("Login attempted for an unrecognised account.")
      }
      if (!account.active) {
        return fail("Login attempted on a retired account.")
      }
      if (account.locked_until && account.locked_until > nowIso()) {
        await writeAudit(db, "login_failed", account.email, "Login attempted on a locked account.")
        throw unauthorized("Account locked after repeated failures. Try again later.")
      }

      const passwordOk = await argon2.verify(account.password_hash, req.body.password)
      if (!passwordOk) {
        const failures = account.failed_login_count + 1
        const lock = failures >= LOCKOUT_THRESHOLD
        await db
          .update(accounts)
          .set({
            failed_login_count: lock ? 0 : failures,
            locked_until: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null,
          })
          .where(eq(accounts.account_id, account.account_id))
        if (lock) {
          await writeAudit(db, "account_locked", account.email, `Account locked after ${LOCKOUT_THRESHOLD} failed logins.`)
          throw unauthorized("Account locked after repeated failures. Try again later.")
        }
        return fail(`Failed login attempt (${failures} of ${LOCKOUT_THRESHOLD} before lockout).`)
      }

      await db
        .update(accounts)
        .set({ failed_login_count: 0, locked_until: null })
        .where(eq(accounts.account_id, account.account_id))
      await writeAudit(db, "login", account.email, `${account.role} login succeeded.`)

      const claims: TokenClaims = {
        sub: account.account_id,
        role: account.role as TokenClaims["role"],
        ref_id: account.student_id ?? account.supervisor_id ?? null,
        email: account.email,
        display_name: account.display_name,
      }
      const token = await app.jwt.sign(claims)
      return {
        token,
        session: {
          account_id: account.account_id,
          email: account.email,
          role: claims.role,
          ref_id: claims.ref_id,
          display_name: account.display_name,
        },
      }
    },
  )
}
