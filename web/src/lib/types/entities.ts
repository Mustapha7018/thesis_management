/**
 * Mirrors synthetic_data/schema.sql (13 tables) plus the auxiliary
 * portal-only concepts (roles, demo accounts, audit log, preference window)
 * that the schema doesn't model because there's no real backend yet.
 */

// ---------------------------------------------------------------------------
// Schema-backed entities
// ---------------------------------------------------------------------------

export interface ResearchArea {
  area_id: number
  code: string
  name: string
  description: string | null
}

export type SupervisorTitle = "Dr" | "Prof"
export type Seniority =
  | "Lecturer"
  | "Senior Lecturer"
  | "Associate Professor"
  | "Professor"

export interface Supervisor {
  supervisor_id: number
  title: SupervisorTitle
  first_name: string
  last_name: string
  email: string
  seniority: Seniority
  fte: number
  quota_min: number
  quota_max: number
  created_at: string
}

export interface SupervisorExpertise {
  supervisor_id: number
  area_id: number
  proficiency: 1 | 2 | 3
}

export type Programme =
  | "MSc Data Science"
  | "MSc Computer Science"
  | "MSc Cybersecurity"
  | "MSc Applied Cybersecurity"
  | "MSc Computer Science with Data Science"
  | "MSc Computer Science with Cyber Security"

export type StudyMode = "FT" | "PT"
export type EntryQualification = "First" | "2:1" | "2:2" | "International equivalent"

export interface Student {
  student_id: number
  first_name: string
  last_name: string
  email: string
  programme: Programme
  mode: StudyMode
  entry_year: number
  entry_qualification: EntryQualification
  prior_avg_mark: number
  created_at: string
}

export interface StudentInterest {
  student_id: number
  area_id: number
  rank: 1 | 2 | 3
}

export interface StudentPreference {
  student_id: number
  supervisor_id: number
  rank: 1 | 2 | 3 | 4 | 5
}

export interface SupervisorPreference {
  supervisor_id: number
  student_id: number
  score: number
}

export type AllocationAlgorithm = "ga" | "random" | "manual" | "greedy-mock"

export interface Allocation {
  allocation_id: number
  run_id: string
  algorithm: AllocationAlgorithm
  student_id: number
  supervisor_id: number
  objective_score: number | null
  created_at: string
}

export interface Sprint {
  sprint_id: number
  student_id: number
  name: string
  goal: string | null
  start_date: string
  end_date: string
}

export type MilestoneStatus = "planned" | "in_progress" | "done" | "overdue"

export interface Milestone {
  milestone_id: number
  student_id: number
  title: string
  description: string | null
  due_date: string
  status: MilestoneStatus
  created_at: string
  /** Deliverable attached to the milestone (PDF/Word), stored as a base64 data URL. */
  attachment_name: string | null
  attachment_type: string | null
  attachment_data: string | null
}

export type TaskPriority = "low" | "medium" | "high"
export type TaskStatus = "todo" | "in_progress" | "done"

export interface Task {
  task_id: number
  sprint_id: number | null
  milestone_id: number | null
  student_id: number
  title: string
  priority: TaskPriority
  status: TaskStatus
  created_at: string
  updated_at: string | null
}

export interface Meeting {
  meeting_id: number
  student_id: number
  supervisor_id: number
  scheduled_at: string
  held: 0 | 1
  notes: string | null
  /** Student-uploaded supervision log (PDF/Word), stored as a base64 data URL. */
  log_file_name: string | null
  log_file_type: string | null
  log_file_data: string | null
}

export interface AtRiskFlag {
  flag_id: number
  student_id: number
  rule_code: string
  reason: string
  raised_at: string
  cleared_at: string | null
}

// ---------------------------------------------------------------------------
// Portal-only concepts (no schema table — there's no real backend/auth yet)
// ---------------------------------------------------------------------------

export type Role = "student" | "supervisor" | "admin"

export interface DemoAccount {
  account_id: string
  email: string
  role: Role
  /** student_id or supervisor_id; null for admin */
  ref_id: number | null
  display_name: string
  active: boolean
}

export interface AuditLogEntry {
  entry_id: number
  occurred_at: string
  event_type:
    | "login"
    | "login_failed"
    | "role_change"
    | "account_locked"
    | "cohort_import"
    | "account_created"
    | "account_deleted"
  actor_email: string
  detail: string
}

export interface PreferenceWindow {
  is_open: boolean
  opens_at: string
  closes_at: string
}

/** One run's per-run identity/status; the per-pairing rows live in Allocation[]. */
export interface AllocationRun {
  run_id: string
  algorithm: AllocationAlgorithm
  label: string
  created_at: string
  published: boolean
  /** How many students the run was computed over — lets % unallocated stay meaningful whether it's an 8-student demo run or a full 500-student run. */
  instance_size: number
  /** null for "manual" runs — there's no algorithm runtime for a human-entered baseline. */
  runtime_ms: number | null
}
