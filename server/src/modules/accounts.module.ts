/**
 * Admin user management (FR-AUTH-01/06). Guards live server-side so they
 * hold against any client: staff email format, case-insensitive uniqueness,
 * no self-retire/self-delete, and the last active admin can never be
 * retired or deleted.
 */
import argon2 from "argon2"
import { and, eq, ne } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { config } from "../config.js"
import { db } from "../db/client.js"
import { accounts, allocations, allocationRuns, supervisors } from "../db/schema.js"
import { writeAudit } from "../lib/audit.js"
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js"
import { listQuerySchema, nowIso, paginate } from "../lib/http.js"
import { requireRole } from "../plugins/auth.js"
import { isStaffEmail } from "@shared/utils/validation"

type AccountRow = typeof accounts.$inferSelect

const toUserRow = (a: AccountRow) => ({
  account_id: a.account_id,
  email: a.email,
  role: a.role,
  display_name: a.display_name,
  active: a.active,
})

async function assertEmailAvailable(email: string, excludeAccountId?: string) {
  const needle = email.toLowerCase()
  const rows = await db.select().from(accounts)
  const taken = rows.some((a) => a.email.toLowerCase() === needle && a.account_id !== excludeAccountId)
  if (taken) throw conflict(`An account with email ${email} already exists.`)
}

async function assertNotLastActiveAdmin(accountId: string) {
  const others = await db
    .select({ id: accounts.account_id })
    .from(accounts)
    .where(and(eq(accounts.role, "admin"), eq(accounts.active, true), ne(accounts.account_id, accountId)))
  if (others.length === 0) throw badRequest("Cannot retire or delete the last active admin.")
}

async function findAdmin(accountId: string): Promise<AccountRow> {
  const account = await db.query.accounts.findFirst({ where: eq(accounts.account_id, accountId) })
  if (!account || account.role !== "admin") throw notFound("Admin account not found.")
  return account
}

export const accountsModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()
  const adminOnly = { preHandler: requireRole("admin") }

  app.get(
    "/admin/users",
    {
      ...adminOnly,
      schema: {
        tags: ["admin"],
        querystring: listQuerySchema.extend({
          role: z.enum(["student", "supervisor", "admin"]).optional(),
          search: z.string().optional(),
        }),
      },
    },
    async (req) => {
      let rows = await db.select().from(accounts)
      if (req.query.role) rows = rows.filter((a) => a.role === req.query.role)
      const needle = req.query.search?.trim().toLowerCase()
      if (needle) {
        rows = rows.filter(
          (a) => a.display_name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle),
        )
      }
      return paginate(rows.map(toUserRow), req.query.page, req.query.limit)
    },
  )

  app.patch(
    "/admin/users/:accountId",
    {
      ...adminOnly,
      schema: {
        tags: ["admin"],
        params: z.object({ accountId: z.string() }),
        body: z.object({ active: z.boolean() }),
      },
    },
    async (req) => {
      const account = await db.query.accounts.findFirst({ where: eq(accounts.account_id, req.params.accountId) })
      if (!account) throw notFound("User not found.")
      if (account.role === "admin") {
        if (!req.body.active) {
          if (account.account_id === req.user.sub) throw forbidden("You cannot retire your own account.")
          await assertNotLastActiveAdmin(account.account_id)
        }
      }
      await db.update(accounts).set({ active: req.body.active }).where(eq(accounts.account_id, account.account_id))
      await writeAudit(db, "role_change", req.user.email, `${req.body.active ? "Reactivated" : "Retired"} user ${account.email}.`)
      return toUserRow({ ...account, active: req.body.active })
    },
  )

  app.post(
    "/admin/admins",
    {
      ...adminOnly,
      schema: {
        tags: ["admin"],
        body: z.object({ displayName: z.string().min(1), email: z.string() }),
      },
    },
    async (req, reply) => {
      const email = req.body.email.trim()
      if (!isStaffEmail(email)) throw badRequest("Admin email must be firstname.lastname@sunderland.ac.uk.")
      await assertEmailAvailable(email)

      const existing = await db.select({ id: accounts.account_id }).from(accounts).where(eq(accounts.role, "admin"))
      const maxSuffix = existing.reduce((max, { id }) => Math.max(max, Number(id.replace("admin-", "")) || 0), 0)
      const row: typeof accounts.$inferInsert = {
        account_id: `admin-${maxSuffix + 1}`,
        email,
        role: "admin",
        display_name: req.body.displayName.trim(),
        active: true,
        password_hash: await argon2.hash(config.DEMO_PASSWORD),
        created_at: nowIso(),
      }
      await db.insert(accounts).values(row)
      await writeAudit(db, "account_created", req.user.email, `Created admin account ${email}.`)
      return reply.status(201).send(toUserRow(row as AccountRow))
    },
  )

  app.patch(
    "/admin/admins/:accountId",
    {
      ...adminOnly,
      schema: {
        tags: ["admin"],
        params: z.object({ accountId: z.string() }),
        body: z.object({
          displayName: z.string().min(1).optional(),
          email: z.string().optional(),
          active: z.boolean().optional(),
        }),
      },
    },
    async (req) => {
      const account = await findAdmin(req.params.accountId)
      const patch: Partial<typeof accounts.$inferInsert> = {}

      if (req.body.email !== undefined) {
        const email = req.body.email.trim()
        if (!isStaffEmail(email)) throw badRequest("Admin email must be firstname.lastname@sunderland.ac.uk.")
        await assertEmailAvailable(email, account.account_id)
        patch.email = email
      }
      if (req.body.displayName !== undefined) patch.display_name = req.body.displayName.trim()
      if (req.body.active !== undefined) {
        if (!req.body.active) {
          if (account.account_id === req.user.sub) throw forbidden("You cannot retire your own account.")
          await assertNotLastActiveAdmin(account.account_id)
        }
        patch.active = req.body.active
      }

      await db.update(accounts).set(patch).where(eq(accounts.account_id, account.account_id))
      const detail =
        req.body.active !== undefined
          ? `${req.body.active ? "Reactivated" : "Retired"} user ${account.email}.`
          : `Updated admin account ${account.email}${patch.email && patch.email !== account.email ? ` (email now ${patch.email})` : ""}.`
      await writeAudit(db, "role_change", req.user.email, detail)
      return toUserRow({ ...account, ...patch } as AccountRow)
    },
  )

  app.delete(
    "/admin/admins/:accountId",
    {
      ...adminOnly,
      schema: { tags: ["admin"], params: z.object({ accountId: z.string() }) },
    },
    async (req, reply) => {
      const account = await findAdmin(req.params.accountId)
      if (account.account_id === req.user.sub) throw forbidden("You cannot delete your own account.")
      await assertNotLastActiveAdmin(account.account_id)
      await db.delete(accounts).where(eq(accounts.account_id, account.account_id))
      await writeAudit(db, "account_deleted", req.user.email, `Deleted admin account ${account.email}.`)
      return reply.status(204).send()
    },
  )

  app.get(
    "/admin/supervisors",
    {
      ...adminOnly,
      schema: {
        tags: ["admin"],
        querystring: listQuerySchema.extend({ search: z.string().optional() }),
      },
    },
    async (req) => {
      const [supers, publishedRun] = await Promise.all([
        db.select().from(supervisors),
        db.query.allocationRuns.findFirst({ where: eq(allocationRuns.published, true) }),
      ])
      const counts = new Map<number, number>()
      if (publishedRun) {
        const rows = await db.select().from(allocations).where(eq(allocations.run_id, publishedRun.run_id))
        for (const a of rows) counts.set(a.supervisor_id, (counts.get(a.supervisor_id) ?? 0) + 1)
      }
      let rows = supers.map((s) => ({
        supervisor_id: s.supervisor_id,
        name: `${s.title} ${s.first_name} ${s.last_name}`,
        email: s.email,
        seniority: s.seniority,
        quota_min: s.quota_min,
        quota_max: s.quota_max,
        allocated_count: counts.get(s.supervisor_id) ?? 0,
      }))
      const needle = req.query.search?.trim().toLowerCase()
      if (needle) {
        rows = rows.filter((r) => r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle))
      }
      return paginate(rows, req.query.page, req.query.limit)
    },
  )
}
