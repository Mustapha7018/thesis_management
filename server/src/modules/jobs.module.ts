import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { notFound } from "../lib/errors.js"
import { requireRole } from "../plugins/auth.js"
import { cancelJob, getJob } from "../ga/job-registry.js"

export const jobsModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()
  const adminOnly = { preHandler: requireRole("admin") }

  app.get(
    "/allocation-jobs/:jobId",
    { ...adminOnly, schema: { tags: ["allocation"], params: z.object({ jobId: z.string() }) } },
    async (req) => {
      const job = getJob(req.params.jobId)
      if (!job) throw notFound("Job not found.")
      return job
    },
  )

  app.delete(
    "/allocation-jobs/:jobId",
    { ...adminOnly, schema: { tags: ["allocation"], params: z.object({ jobId: z.string() }) } },
    async (req) => {
      const job = cancelJob(req.params.jobId)
      if (!job) throw notFound("Job not found.")
      return job
    },
  )
}
