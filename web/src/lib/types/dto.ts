import type {
  AllocationAlgorithm,
  AtRiskFlag,
  MilestoneStatus,
  Role,
  TaskPriority,
  TaskStatus,
} from "./entities"

// ---------------------------------------------------------------------------
// Pagination / filtering — mirrors FR-API-01/02/03 (versioned JSON API,
// pagination + filtering on list endpoints) so the mock service layer's
// shapes need no rework when a real REST API replaces it.
// ---------------------------------------------------------------------------

export interface ListParams {
  page?: number
  limit?: number
  sort?: string
  filter?: Record<string, string | number | boolean | undefined>
}

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthSession {
  account_id: string
  email: string
  role: Role
  ref_id: number | null
  display_name: string
}

export interface DemoAccountSummary {
  account_id: string
  email: string
  role: Role
  display_name: string
}

// ---------------------------------------------------------------------------
// Profile (PROF module)
// ---------------------------------------------------------------------------

export interface SupervisorBrief {
  supervisor_id: number
  title: string
  first_name: string
  last_name: string
  seniority: string
  expertise_area_names: string[]
}

export interface ApplicantView {
  student_id: number
  first_name: string
  last_name: string
  programme: string
  rank_given: number
  interest_area_names: string[]
  current_score: number | null
}

// ---------------------------------------------------------------------------
// Allocation (ALLOC module)
// ---------------------------------------------------------------------------

export interface AllocationExplanation {
  allocation_id: number
  student_rank: number | null
  supervisor_score: number | null
  shared_area_names: string[]
  objective_score: number | null
  summary: string
}

export interface AllocationResult {
  allocation_id: number
  run_id: string
  algorithm: AllocationAlgorithm
  student_id: number
  student_name: string
  supervisor_id: number
  supervisor_name: string
  objective_score: number | null
  published: boolean
}

export interface RunBenchmark {
  run_id: string
  algorithm: AllocationAlgorithm
  label: string
  mean_satisfied_rank: number | null
  workload_variance: number
  percent_unallocated: number
  runtime_ms: number
  published: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Agile (AGILE module)
// ---------------------------------------------------------------------------

export interface TaskInput {
  title: string
  priority: TaskPriority
  status?: TaskStatus
  sprint_id?: number | null
  milestone_id?: number | null
}

export interface SprintInput {
  name: string
  goal?: string | null
  start_date: string
  end_date: string
}

export interface MilestoneInput {
  title: string
  description?: string | null
  due_date: string
  status?: MilestoneStatus
}

export interface ProgressSummary {
  student_id: number
  milestones_total: number
  milestones_done: number
  milestones_overdue: number
  tasks_total: number
  tasks_done: number
  percent_complete: number
}

// ---------------------------------------------------------------------------
// Meetings (MEET module)
// ---------------------------------------------------------------------------

export interface MeetingInput {
  student_id: number
  supervisor_id: number
  scheduled_at: string
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Dashboard (DASH module) — supervisor + admin
// ---------------------------------------------------------------------------

export interface CohortStudentSummary {
  student_id: number
  student_name: string
  programme: string
  supervisor_id: number
  supervisor_name: string
  progress: ProgressSummary
  active_flag_count: number
}

/** at_risk_flags row plus the client-only "reviewed" marker (see plan's open decision #1 — not a real schema column). */
export interface AtRiskFlagView extends AtRiskFlag {
  reviewed: boolean
}

export interface StudentDetail {
  student_id: number
  student_name: string
  supervisor_name: string
  progress: ProgressSummary
  milestones: import("./entities").Milestone[]
  meetings: import("./entities").Meeting[]
  flags: import("./entities").AtRiskFlag[]
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminUserRow {
  account_id: string
  email: string
  role: Role
  display_name: string
  active: boolean
}

export interface AdminSupervisorRow {
  supervisor_id: number
  name: string
  email: string
  seniority: string
  quota_min: number
  quota_max: number
  allocated_count: number
}
