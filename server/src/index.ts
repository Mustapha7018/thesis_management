import { buildApp } from "./app.js"
import { config } from "./config.js"
import { pool } from "./db/client.js"

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
