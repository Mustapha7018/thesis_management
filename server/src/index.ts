import { migrate } from "drizzle-orm/node-postgres/migrator"
import { sql } from "drizzle-orm"
import { fileURLToPath } from "node:url"
import { buildApp } from "./app.js"
import { config } from "./config.js"
import { db, pool } from "./db/client.js"
import { seedDatabase } from "./seed.js"

// Production boot: apply committed SQL migrations, then seed once if empty.
if (config.RUN_MIGRATIONS) {
  const migrationsFolder = fileURLToPath(new URL("../src/db/migrations", import.meta.url))
  await migrate(db, { migrationsFolder })
}
if (config.AUTO_SEED) {
  const existing = await db.execute(sql`SELECT count(*)::int AS count FROM accounts`)
  if ((existing.rows[0] as { count: number }).count === 0) {
    const result = await seedDatabase(db)
    console.log(`Auto-seeded ${result.students} students, ${result.accounts} accounts.`)
  }
}

const app = await buildApp()

// Drain HTTP first, then release DB connections (clean restarts under a supervisor/host).
async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down")
  await app.close()
  await pool.end()
  process.exit(0)
}
process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
