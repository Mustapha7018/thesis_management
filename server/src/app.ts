import fastifyCors from "@fastify/cors"
import fastifySwagger from "@fastify/swagger"
import fastifySwaggerUi from "@fastify/swagger-ui"
import Fastify from "fastify"
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { config } from "./config.js"
import { AppError } from "./lib/errors.js"
import { auth } from "./plugins/auth.js"
import { accountsModule } from "./modules/accounts.module.js"
import { agileModule } from "./modules/agile.module.js"
import { allocationModule } from "./modules/allocation.module.js"
import { authModule } from "./modules/auth.module.js"
import { cohortModule } from "./modules/cohort.module.js"
import { dashboardModule } from "./modules/dashboard.module.js"
import { jobsModule } from "./modules/jobs.module.js"
import { meetingsModule } from "./modules/meetings.module.js"
import { preferenceWindowModule } from "./modules/preference-window.module.js"
import { profileModule } from "./modules/profile.module.js"
import { researchAreasModule } from "./modules/research-areas.module.js"

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    // Base64 attachments (3 MB file ≈ 4.1 MB encoded) arrive as JSON bodies.
    bodyLimit: 16 * 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.setErrorHandler((rawErr, req, reply) => {
    const err = rawErr as Error & { statusCode?: number; payload?: unknown }
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: { message: err.message, details: err.payload } })
    }
    // Zod/fastify validation errors carry a 4xx statusCode.
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ error: { message: err.message, details: err.payload } })
    }
    req.log.error(err)
    return reply.status(500).send({ error: { message: "Internal server error." } })
  })

  await app.register(fastifyCors, { origin: config.CORS_ORIGIN })

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Thesis Management API",
        description: "Versioned REST API (FR-API-01) — the only writer to the portal database.",
        version: "1.0.0",
      },
      components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      },
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  })
  await app.register(fastifySwaggerUi, { routePrefix: "/api/docs" })

  await app.register(auth)

  app.get("/health", { config: { public: true }, schema: { hide: true } }, async () => ({ status: "ok" }))

  await app.register(
    async (v1) => {
      await v1.register(authModule)
      await v1.register(accountsModule)
      await v1.register(researchAreasModule)
      await v1.register(preferenceWindowModule)
      await v1.register(profileModule)
      await v1.register(allocationModule)
      await v1.register(jobsModule)
      await v1.register(agileModule)
      await v1.register(meetingsModule)
      await v1.register(dashboardModule)
      await v1.register(cohortModule)
    },
    { prefix: "/api/v1" },
  )

  return app
}
