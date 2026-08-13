import "dotenv/config"
import { z } from "zod"

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().default("postgres://localhost:5432/thesis_management"),
  /** Max PostgreSQL connections in the pool (size for concurrency targets, NFR-PERF-03). */
  PG_POOL_MAX: z.coerce.number().int().min(1).default(10),
  JWT_SECRET: z.string().min(16).default("dev-only-secret-change-in-production"),
  /** Access-token lifetime, e.g. "12h" (FR-AUTH-03: tokens must expire). */
  JWT_TTL: z.string().default("12h"),
  /** Shared password for all seeded demo accounts (hashed with argon2 at seed time). */
  DEMO_PASSWORD: z.string().default("Password123!"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  /** Enables POST /admin/reset-demo (dev/demo convenience; disable in production). */
  ALLOW_DEMO_RESET: z.coerce.boolean().default(true),
})

export const config = envSchema.parse(process.env)
