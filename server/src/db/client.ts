import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { config } from "../config.js"
import * as schema from "./schema.js"

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.PG_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

export const db = drizzle(pool, { schema })

export type Db = typeof db
