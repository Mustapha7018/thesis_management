/**
 * Seeds the database with the validated synthetic dataset (the allocation
 * problem instance) plus accounts and configuration — and nothing else.
 * No fabricated activity: sprints, milestones, tasks, meetings, allocation
 * runs, at-risk flags and audit entries all start empty and only ever arise
 * from real user actions (FR-DASH-02's rule engine raises flags; the GA and
 * baselines create runs; the audit log records real events).
 *
 * Every account is login-capable with the shared DEMO_PASSWORD (argon2-
 * hashed; FR-AUTH-03: no plaintext credential stored). Idempotent — also
 * backs POST /admin/reset-demo.
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
  const preferenceWindow = load<{ is_open: boolean; opens_at: string; closes_at: string }>(
    "seed/preference-window.seed.json",
  )

  const demoHash = await argon2.hash(config.DEMO_PASSWORD)
  const now = new Date().toISOString()

  const accountRows: (typeof t.accounts.$inferInsert)[] = [
    ...fixtures.students.map((s) => ({
      account_id: `student-${s.student_id}`,
      email: s.email!,
      role: "student",
      display_name: `${s.first_name} ${s.last_name}`,
      active: true,
      password_hash: demoHash,
      student_id: s.student_id as number,
      created_at: now,
    })),
    ...fixtures.supervisors.map((s) => ({
      account_id: `supervisor-${s.supervisor_id}`,
      email: s.email!,
      role: "supervisor",
      display_name: `${s.title} ${s.first_name} ${s.last_name}`,
      active: true,
      password_hash: demoHash,
      supervisor_id: s.supervisor_id as number,
      created_at: now,
    })),
    {
      account_id: "admin-1",
      email: "jordan.blake@sunderland.ac.uk",
      role: "admin",
      display_name: "Jordan Blake",
      active: true,
      password_hash: demoHash,
      created_at: now,
    },
  ]

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
    await tx.insert(t.preferenceWindow).values({ id: 1, ...preferenceWindow })
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
  console.log(`Seeded ${result.students} students, ${result.accounts} accounts (all login-capable).`)
  await pool.end()
}
