import { getStudentProgress } from "./agile.service"
import { getDb, saveDb } from "./db/store"
import { paginate } from "./db/query-helpers"
import type { AtRiskFlagView, CohortStudentSummary, ListParams, Paginated, StudentDetail } from "@/lib/types/dto"
import { isPast } from "@/lib/utils/date"

function publishedSupervisorIdForStudent(db: ReturnType<typeof getDb>, studentId: number): number | null {
  const publishedRun = db.allocationRuns.find((r) => r.published)
  if (!publishedRun) return null
  return db.allocations.find((a) => a.run_id === publishedRun.run_id && a.student_id === studentId)?.supervisor_id ?? null
}

async function buildCohortSummary(db: ReturnType<typeof getDb>, studentId: number, supervisorId: number): Promise<CohortStudentSummary> {
  const student = db.students.find((s) => s.student_id === studentId)!
  const supervisor = db.supervisors.find((s) => s.supervisor_id === supervisorId)!
  const progress = await getStudentProgress(studentId)
  const activeFlagCount = db.atRiskFlags.filter((f) => f.student_id === studentId && !f.cleared_at).length

  return {
    student_id: studentId,
    student_name: `${student.first_name} ${student.last_name}`,
    programme: student.programme,
    supervisor_id: supervisorId,
    supervisor_name: `${supervisor.title} ${supervisor.first_name} ${supervisor.last_name}`,
    progress,
    active_flag_count: activeFlagCount,
  }
}

// ---------------------------------------------------------------------------
// Supervisor cohort (FR-DASH-01)
// ---------------------------------------------------------------------------

export async function listSupervisorCohort(
  supervisorId: number,
  params?: ListParams,
): Promise<Paginated<CohortStudentSummary>> {
  const db = getDb()
  const publishedRun = db.allocationRuns.find((r) => r.published)
  if (!publishedRun) return { data: [], total: 0, page: params?.page ?? 1, limit: params?.limit ?? 20 }

  const studentIds = db.allocations
    .filter((a) => a.run_id === publishedRun.run_id && a.supervisor_id === supervisorId)
    .map((a) => a.student_id)

  const summaries = await Promise.all(studentIds.map((id) => buildCohortSummary(db, id, supervisorId)))
  return paginate(summaries, params)
}

/** Admin-facing cohort-wide overview, all supervisors (FR-DASH-04). */
export async function listAdminCohortOverview(params?: ListParams): Promise<Paginated<CohortStudentSummary>> {
  const db = getDb()
  const publishedRun = db.allocationRuns.find((r) => r.published)
  if (!publishedRun) return { data: [], total: 0, page: params?.page ?? 1, limit: params?.limit ?? 20 }

  const rows = db.allocations.filter((a) => a.run_id === publishedRun.run_id)
  const summaries = await Promise.all(rows.map((a) => buildCohortSummary(db, a.student_id, a.supervisor_id)))
  return paginate(summaries, params)
}

// ---------------------------------------------------------------------------
// Student drill-down (FR-DASH-05)
// ---------------------------------------------------------------------------

export async function getStudentDetail(studentId: number): Promise<StudentDetail> {
  const db = getDb()
  const student = db.students.find((s) => s.student_id === studentId)
  if (!student) throw new Error("Student not found.")

  const supervisorId = publishedSupervisorIdForStudent(db, studentId)
  const supervisor = supervisorId ? db.supervisors.find((s) => s.supervisor_id === supervisorId) : undefined

  const milestones = db.milestones
    .filter((m) => m.student_id === studentId)
    .map((m) => (m.status !== "done" && m.status !== "overdue" && isPast(m.due_date) ? { ...m, status: "overdue" as const } : m))
  const meetings = db.meetings
    .filter((m) => m.student_id === studentId)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
  const flags = db.atRiskFlags.filter((f) => f.student_id === studentId)

  return {
    student_id: studentId,
    student_name: `${student.first_name} ${student.last_name}`,
    supervisor_name: supervisor ? `${supervisor.title} ${supervisor.first_name} ${supervisor.last_name}` : "Unassigned",
    progress: await getStudentProgress(studentId),
    milestones,
    meetings,
    flags,
  }
}

// ---------------------------------------------------------------------------
// At-risk flags (FR-DASH-02/03) — supervisor/admin only, never student-facing.
// ---------------------------------------------------------------------------

export async function listAtRiskFlags(filter: {
  studentId?: number
  supervisorId?: number
  active?: boolean
}): Promise<AtRiskFlagView[]> {
  const db = getDb()
  let studentIdsForSupervisor: Set<number> | null = null
  if (filter.supervisorId !== undefined) {
    const publishedRun = db.allocationRuns.find((r) => r.published)
    studentIdsForSupervisor = new Set(
      publishedRun
        ? db.allocations
            .filter((a) => a.run_id === publishedRun.run_id && a.supervisor_id === filter.supervisorId)
            .map((a) => a.student_id)
        : [],
    )
  }

  return db.atRiskFlags
    .filter(
      (f) =>
        (filter.studentId === undefined || f.student_id === filter.studentId) &&
        (studentIdsForSupervisor === null || studentIdsForSupervisor.has(f.student_id)) &&
        (filter.active === undefined || (filter.active ? !f.cleared_at : !!f.cleared_at)),
    )
    .map((f) => ({ ...f, reviewed: db.reviewedFlagIds.includes(f.flag_id) }))
    .sort((a, b) => new Date(b.raised_at).getTime() - new Date(a.raised_at).getTime())
}

export async function markFlagReviewed(flagId: number): Promise<void> {
  const db = getDb()
  if (!db.reviewedFlagIds.includes(flagId)) {
    db.reviewedFlagIds.push(flagId)
    saveDb()
  }
}

export async function clearFlag(flagId: number, note?: string): Promise<AtRiskFlagView> {
  const db = getDb()
  const flag = db.atRiskFlags.find((f) => f.flag_id === flagId)
  if (!flag) throw new Error("Flag not found.")
  flag.cleared_at = new Date().toISOString()
  if (note) flag.reason = `${flag.reason} — cleared: ${note}`
  if (!db.reviewedFlagIds.includes(flagId)) db.reviewedFlagIds.push(flagId)
  saveDb()
  return { ...flag, reviewed: true }
}
