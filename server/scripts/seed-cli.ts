import { db, pool } from "../src/db/client.js"
import { seedDatabase } from "../src/seed.js"

const result = await seedDatabase(db)
console.log(`Seeded ${result.students} students, ${result.accounts} accounts (all login-capable).`)
await pool.end()
