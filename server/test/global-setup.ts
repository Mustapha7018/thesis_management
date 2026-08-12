/**
 * Creates + migrates + seeds the dedicated test database before the suite
 * runs. Tests then mutate it freely; destructive suites reseed themselves.
 */
import { execSync } from "node:child_process"
import pg from "pg"

const TEST_DB = "thesis_management_test"
const TEST_DB_URL = `postgres://localhost:5432/${TEST_DB}`

export default async function setup() {
  const admin = new pg.Client({ connectionString: "postgres://localhost:5432/postgres" })
  await admin.connect()
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB])
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${TEST_DB}`)
  }
  await admin.end()

  execSync("npx drizzle-kit push --force", {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
  })

  process.env.DATABASE_URL = TEST_DB_URL
  process.env.JWT_SECRET = "test-secret-at-least-16-chars"
  process.env.DEMO_PASSWORD = "Password123!"

  const { db, pool } = await import("../src/db/client.js")
  const { seedDatabase } = await import("../src/seed.js")
  await seedDatabase(db)
  await pool.end()
}
