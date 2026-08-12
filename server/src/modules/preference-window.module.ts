import { desc, eq } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { db } from "../db/client.js"
import { auditLog, preferenceWindow } from "../db/schema.js"
import { listQuerySchema, paginate } from "../lib/http.js"
import { writeAudit } from "../lib/audit.js"
import { requireRole } from "../plugins/auth.js"

export async function getWindow() {
  const row = await db.query.preferenceWindow.findFirst({ where: eq(preferenceWindow.id, 1) })
  if (!row) throw new Error("Preference window row missing — reseed the database.")
  const { id: _id, ...window } = row
  return window
}

export const preferenceWindowModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()

  app.get("/preference-window", { schema: { tags: ["reference"] } }, async () => getWindow())

  app.put(
    "/preference-window",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["admin"],
        body: z.object({
          is_open: z.boolean().optional(),
          opens_at: z.string().optional(),
          closes_at: z.string().optional(),
        }),
      },
    },
    async (req) => {
      await db.update(preferenceWindow).set(req.body).where(eq(preferenceWindow.id, 1))
      const window = await getWindow()
      await writeAudit(db, "role_change", req.user.email, `Preference window set to ${window.is_open ? "open" : "closed"}.`)
      return window
    },
  )

  app.get(
    "/admin/audit-log",
    {
      preHandler: requireRole("admin"),
      schema: { tags: ["admin"], querystring: listQuerySchema },
    },
    async (req) => {
      const rows = await db.select().from(auditLog).orderBy(desc(auditLog.occurred_at), desc(auditLog.entry_id))
      return paginate(rows, req.query.page, req.query.limit)
    },
  )

  app.post(
    "/admin/reset-demo",
    { preHandler: requireRole("admin"), schema: { tags: ["admin"] } },
    async (req) => {
      const { config } = await import("../config.js")
      if (!config.ALLOW_DEMO_RESET) {
        const { forbidden } = await import("../lib/errors.js")
        throw forbidden("Demo reset is disabled on this deployment.")
      }
      const { seedDatabase } = await import("../seed.js")
      const result = await seedDatabase(db)
      req.log.info(result, "demo data reset")
      return { ok: true }
    },
  )
}
