/**
 * Seeds the database from the checked-in synthetic dataset fixtures and demo
 * seeds (web/src/lib/data). Idempotent: wipes every table and re-inserts, so
 * it also backs POST /admin/reset-demo. Login-capable demo accounts get an
 * argon2 hash of DEMO_PASSWORD; directory-only students have no hash and
 * cannot authenticate (FR-AUTH-03: no plaintext credential ever stored).
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import argon2 from "argon2"
import { sql } from "drizzle-orm"
import { config } from "./config.js"
import type { Db } from "./db/client.js"
import * as t from "./db/schema.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, "../../web/src/lib/data")

function load<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(DATA_DIR, relativePath), "utf-8")) as T
}

interface SeedUserRow {
  account_id: string
  email: string
  role: string
  display_name: string
  active: boolean
}
interface SeedDemoAccount extends SeedUserRow {
  ref_id: number | null
}

export async function seedDatabase(db: Db): Promise<{ students: number; accounts: number }> {
  const fixtures = {
    researchAreas: load<(typeof t.researchAreas.$inferInsert)[]>("fixtures/research-areas.json"),
    supervisors: load<(typeof t.supervisors.$inferInsert)[]>("fixtures/supervisors.json"),
    supervisorExpertise: load<(typeof t.supervisorExpertise.$inferInsert)[]>("fixtures/supervisor-expertise.json"),
    students: load<(typeof t.students.$inferInsert)[]>("fixtures/students.json"),
    studentInterests: load<(typeof t.studentInterests.$inferInsert)[]>("fixtures/student-interests.json"),
    studentPreferences: load<(typeof t.studentPreferences.$inferInsert)[]>("fixtures/student-preferences.json"),
    supervisorPreferences: load<(typeof t.supervisorPreferences.$inferInsert)[]>("fixtures/supervisor-preferences.json"),
  }
  const seeds = {
    allocationRuns: load<Record<string, unknown>[]>("seed/allocation-runs.seed.json"),
    allocations: load<(typeof t.allocations.$inferInsert)[]>("seed/allocations.seed.json"),
    sprints: load<(typeof t.sprints.$inferInsert)[]>("seed/sprints.seed.json"),
    milestones: load<(typeof t.milestones.$inferInsert)[]>("seed/milestones.seed.json"),
    tasks: load<(typeof t.tasks.$inferInsert)[]>("seed/tasks.seed.json"),
    meetings: load<(typeof t.meetings.$inferInsert)[]>("seed/meetings.seed.json"),
    atRiskFlags: load<(typeof t.atRiskFlags.$inferInsert)[]>("seed/at-risk-flags.seed.json"),
    auditLog: load<(typeof t.auditLog.$inferInsert)[]>("seed/audit-log.seed.json"),
    preferenceWindow: load<{ is_open: boolean; opens_at: string; closes_at: string }>("seed/preference-window.seed.json"),
    users: load<SeedUserRow[]>("seed/users.seed.json"),
    demoAccounts: load<SeedDemoAccount[]>("seed/demo-accounts.seed.json"),
  }

  const demoHash = await argon2.hash(config.DEMO_PASSWORD)
  const loginAccounts = new Map(seeds.demoAccounts.map((a) => [a.account_id, a]))
  const now = new Date().toISOString()

  // Merge the users directory + demoAccounts into the single accounts table:
  // every directory row becomes an account; only rows that existed as demo
  // accounts get a password hash (and thus the ability to log in).
  const accountRows: (typeof t.accounts.$inferInsert)[] = seeds.users.map((u) => {
    const demo = loginAccounts.get(u.account_id)
    return {
      account_id: u.account_id,
      email: u.email,
      role: u.role,
      display_name: u.display_name,
      active: u.active,
      password_hash: demo ? demoHash : null,
      failed_login_count: 0,
      locked_until: null,
      student_id: u.role === "student" ? (demo?.ref_id ?? (Number(u.account_id.replace("student-", "")) || null)) : null,
      supervisor_id:
        u.role === "supervisor" ? (demo?.ref_id ?? (Number(u.account_id.replace("supervisor-", "")) || null)) : null,
      created_at: now,
    }
  })

  await db.transaction(async (tx) => {
    // Delete in dependency order.
    for (const table of [
      t.auditLog,
      t.allocations,
      t.allocationRuns,
      t.tasks,
      t.milestones,
      t.sprints,
      t.meetings,
      t.atRiskFlags,
      t.supervisorPreferences,
      t.studentPreferences,
      t.studentInterests,
      t.supervisorExpertise,
      t.accounts,
      t.students,
      t.supervisors,
      t.researchAreas,
      t.preferenceWindow,
    ]) {
      await tx.delete(table)
    }

    await tx.insert(t.researchAreas).values(fixtures.researchAreas)
    await tx.insert(t.supervisors).values(fixtures.supervisors)
    await tx.insert(t.supervisorExpertise).values(fixtures.supervisorExpertise)
    for (let i = 0; i < fixtures.students.length; i += 500) {
      await tx.insert(t.students).values(fixtures.students.slice(i, i + 500))
    }
    for (let i = 0; i < fixtures.studentInterests.length; i += 500) {
      await tx.insert(t.studentInterests).values(fixtures.studentInterests.slice(i, i + 500))
    }
    for (let i = 0; i < fixtures.studentPreferences.length; i += 500) {
      await tx.insert(t.studentPreferences).values(fixtures.studentPreferences.slice(i, i + 500))
    }
    for (let i = 0; i < fixtures.supervisorPreferences.length; i += 500) {
      await tx.insert(t.supervisorPreferences).values(fixtures.supervisorPreferences.slice(i, i + 500))
    }

    await tx.insert(t.allocationRuns).values(seeds.allocationRuns as (typeof t.allocationRuns.$inferInsert)[])
    await tx.insert(t.allocations).values(seeds.allocations)
    await tx.insert(t.sprints).values(seeds.sprints)
    await tx.insert(t.milestones).values(seeds.milestones)
    await tx.insert(t.tasks).values(seeds.tasks)
    await tx.insert(t.meetings).values(seeds.meetings)
    await tx.insert(t.atRiskFlags).values(seeds.atRiskFlags)
    await tx.insert(t.auditLog).values(seeds.auditLog)
    await tx.insert(t.preferenceWindow).values({ id: 1, ...seeds.preferenceWindow })
    for (let i = 0; i < accountRows.length; i += 500) {
      await tx.insert(t.accounts).values(accountRows.slice(i, i + 500))
    }

    // Re-align identity sequences with the explicit ids we just inserted.
    for (const [table, column] of [
      ["research_areas", "area_id"],
      ["supervisors", "supervisor_id"],
      ["allocations", "allocation_id"],
      ["sprints", "sprint_id"],
      ["milestones", "milestone_id"],
      ["tasks", "task_id"],
      ["meetings", "meeting_id"],
      ["at_risk_flags", "flag_id"],
      ["audit_log", "entry_id"],
    ] as const) {
      await tx.execute(
        sql.raw(
          `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE((SELECT MAX(${column}) FROM ${table}), 0) + 1, false)`,
        ),
      )
    }
  })

  return { students: fixtures.students.length, accounts: accountRows.length }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  const { db, pool } = await import("./db/client.js")
  const result = await seedDatabase(db)
  console.log(`Seeded ${result.students} students, ${result.accounts} accounts.`)
  await pool.end()
}
