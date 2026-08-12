import { eq } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { db } from "../db/client.js"
import { researchAreas } from "../db/schema.js"
import { conflict } from "../lib/errors.js"
import { requireRole } from "../plugins/auth.js"

export const researchAreasModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()

  app.get("/research-areas", { schema: { tags: ["reference"] } }, async () => {
    return db.select().from(researchAreas).orderBy(researchAreas.area_id)
  })

  app.post(
    "/research-areas",
    {
      preHandler: requireRole("admin"),
      schema: {
        tags: ["admin"],
        body: z.object({
          code: z.string().min(1).regex(/^[A-Z0-9_]+$/),
          name: z.string().min(1),
          description: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const existing = await db.query.researchAreas.findFirst({ where: eq(researchAreas.code, req.body.code) })
      if (existing) throw conflict(`Area code "${req.body.code}" already exists.`)
      const [area] = await db
        .insert(researchAreas)
        .values({ code: req.body.code, name: req.body.name, description: req.body.description ?? null })
        .returning()
      return reply.status(201).send(area)
    },
  )
}
