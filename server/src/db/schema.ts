/**
 * Drizzle schema: the 13 baseline tables from synthetic_data/schema.sql,
 * translated to PostgreSQL, plus the additive portal tables the baseline
 * anticipated ("the API and GA engine will write into them"): accounts,
 * allocation_runs, audit_log, preference_window, and review/attachment
 * columns. Dates stay ISO-8601 text (the portable convention the baseline
 * documents); genuine booleans use boolean columns.
 */
import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const researchAreas = pgTable("research_areas", {
  area_id: integer().primaryKey().generatedByDefaultAsIdentity(),
  code: text().notNull().unique(),
  name: text().notNull().unique(),
  description: text(),
})

export const supervisors = pgTable("supervisors", {
  supervisor_id: integer().primaryKey().generatedByDefaultAsIdentity(),
  title: text().notNull(),
  first_name: text().notNull(),
  last_name: text().notNull(),
  email: text().notNull().unique(),
  seniority: text().notNull(),
  fte: real().notNull(),
  quota_min: integer().notNull(),
  quota_max: integer().notNull(),
  created_at: text().notNull(),
})

export const supervisorExpertise = pgTable(
  "supervisor_expertise",
  {
    supervisor_id: integer()
      .notNull()
      .references(() => supervisors.supervisor_id, { onDelete: "cascade" }),
    area_id: integer()
      .notNull()
      .references(() => researchAreas.area_id),
    proficiency: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.supervisor_id, t.area_id] })],
)

/**
 * One row per imported student batch (academic year). Exactly one cohort is
 * active; allocation and the GA operate on the active cohort's students,
 * previous batches remain browsable history.
 */
export const cohorts = pgTable("cohorts", {
  cohort_id: integer().primaryKey().generatedByDefaultAsIdentity(),
  label: text().notNull().unique(),
  imported_at: text().notNull(),
  source_file: text(),
  active: boolean().notNull().default(false),
})

export const students = pgTable(
  "students",
  {
    student_id: integer().primaryKey(),
    first_name: text().notNull(),
    last_name: text().notNull(),
    email: text().notNull().unique(),
    programme: text().notNull(),
    mode: text().notNull(),
    entry_year: integer().notNull(),
    entry_qualification: text().notNull(),
    prior_avg_mark: real().notNull(),
    created_at: text().notNull(),
    cohort_id: integer().references(() => cohorts.cohort_id, { onDelete: "cascade" }),
  },
  (t) => [index("student_cohort").on(t.cohort_id)],
)

export const studentInterests = pgTable(
  "student_interests",
  {
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    area_id: integer()
      .notNull()
      .references(() => researchAreas.area_id),
    rank: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.student_id, t.area_id] })],
)

export const studentPreferences = pgTable(
  "student_preferences",
  {
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    supervisor_id: integer()
      .notNull()
      .references(() => supervisors.supervisor_id),
    rank: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.student_id, t.rank] }),
    uniqueIndex("student_pref_pair").on(t.student_id, t.supervisor_id),
    // Applicants view queries by supervisor (FK columns are not auto-indexed).
    index("student_pref_supervisor").on(t.supervisor_id),
  ],
)

export const supervisorPreferences = pgTable(
  "supervisor_preferences",
  {
    supervisor_id: integer()
      .notNull()
      .references(() => supervisors.supervisor_id, { onDelete: "cascade" }),
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    score: real().notNull(),
  },
  (t) => [primaryKey({ columns: [t.supervisor_id, t.student_id] })],
)

export const allocationRuns = pgTable(
  "allocation_runs",
  {
    run_id: text().primaryKey(),
    algorithm: text().notNull(),
    label: text().notNull(),
    created_at: text().notNull(),
    published: boolean().notNull().default(false),
    instance_size: integer().notNull(),
    runtime_ms: integer(),
    params: jsonb(),
    cohort_id: integer().references(() => cohorts.cohort_id, { onDelete: "cascade" }),
  },
  // At most one published run, enforced at the database level (FR-ALLOC-06).
  (t) => [uniqueIndex("one_published_run").on(t.published).where(sql`${t.published} = true`)],
)

export const allocations = pgTable(
  "allocations",
  {
    allocation_id: integer().primaryKey().generatedByDefaultAsIdentity(),
    run_id: text()
      .notNull()
      .references(() => allocationRuns.run_id, { onDelete: "cascade" }),
    algorithm: text().notNull(),
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    supervisor_id: integer()
      .notNull()
      .references(() => supervisors.supervisor_id),
    objective_score: real(),
    created_at: text().notNull(),
  },
  (t) => [
    uniqueIndex("allocation_run_student").on(t.run_id, t.student_id),
    index("allocation_student").on(t.student_id),
    index("allocation_supervisor").on(t.supervisor_id),
  ],
)

export const sprints = pgTable(
  "sprints",
  {
    sprint_id: integer().primaryKey().generatedByDefaultAsIdentity(),
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    name: text().notNull(),
    goal: text(),
    start_date: text().notNull(),
    end_date: text().notNull(),
  },
  (t) => [index("sprint_student").on(t.student_id)],
)

export const milestones = pgTable(
  "milestones",
  {
    milestone_id: integer().primaryKey().generatedByDefaultAsIdentity(),
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    due_date: text().notNull(),
    status: text().notNull(),
    created_at: text().notNull(),
    attachment_name: text(),
    attachment_type: text(),
    attachment_data: text(),
  },
  (t) => [index("milestone_student").on(t.student_id)],
)

export const tasks = pgTable(
  "tasks",
  {
    task_id: integer().primaryKey().generatedByDefaultAsIdentity(),
    sprint_id: integer().references(() => sprints.sprint_id, { onDelete: "set null" }),
    milestone_id: integer().references(() => milestones.milestone_id, { onDelete: "set null" }),
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    title: text().notNull(),
    priority: text().notNull(),
    status: text().notNull(),
    created_at: text().notNull(),
    updated_at: text(),
  },
  (t) => [index("task_student").on(t.student_id)],
)

export const meetings = pgTable(
  "meetings",
  {
    meeting_id: integer().primaryKey().generatedByDefaultAsIdentity(),
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    supervisor_id: integer()
      .notNull()
      .references(() => supervisors.supervisor_id),
    scheduled_at: text().notNull(),
    held: integer().notNull().default(0),
    notes: text(),
    log_file_name: text(),
    log_file_type: text(),
    log_file_data: text(),
  },
  (t) => [index("meeting_student").on(t.student_id), index("meeting_supervisor").on(t.supervisor_id)],
)

export const atRiskFlags = pgTable(
  "at_risk_flags",
  {
    flag_id: integer().primaryKey().generatedByDefaultAsIdentity(),
    student_id: integer()
      .notNull()
      .references(() => students.student_id, { onDelete: "cascade" }),
    rule_code: text().notNull(),
    reason: text().notNull(),
    raised_at: text().notNull(),
    cleared_at: text(),
    reviewed_at: text(),
    reviewed_by: text(),
    cleared_note: text(),
  },
  (t) => [index("flag_student").on(t.student_id)],
)

/** Merges the old users directory + demoAccounts: one row per account (FR-AUTH-01). */
export const accounts = pgTable("accounts", {
  account_id: text().primaryKey(),
  email: text().notNull().unique(),
  role: text().notNull(),
  display_name: text().notNull(),
  active: boolean().notNull().default(true),
  /** Null = directory-only account that cannot log in (e.g. bulk-imported students). */
  password_hash: text(),
  failed_login_count: integer().notNull().default(0),
  locked_until: text(),
  student_id: integer().references(() => students.student_id, { onDelete: "set null" }),
  supervisor_id: integer().references(() => supervisors.supervisor_id, { onDelete: "set null" }),
  created_at: text().notNull(),
})

/** Append-only (FR-AUTH-07 / NFR-SEC-04): the API exposes no update or delete route. */
export const auditLog = pgTable("audit_log", {
  entry_id: integer().primaryKey().generatedByDefaultAsIdentity(),
  occurred_at: text().notNull(),
  event_type: text().notNull(),
  actor_email: text().notNull(),
  detail: text().notNull(),
})

/** Singleton row (id always 1). */
export const preferenceWindow = pgTable("preference_window", {
  id: integer().primaryKey().default(1),
  is_open: boolean().notNull(),
  opens_at: text().notNull(),
  closes_at: text().notNull(),
})
