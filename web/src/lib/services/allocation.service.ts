import { runMockAllocation, checkQuotaViolations } from "./mock-allocation-algorithm"
import { getDb, saveDb, nextId } from "./db/store"
import { paginate } from "./db/query-helpers"
import type {
  AllocationExplanation,
  AllocationResult,
  ListParams,
  Paginated,
  RunBenchmark,
} from "@/lib/types/dto"
import type { AllocationAlgorithm } from "@/lib/types/entities"

function studentName(db: ReturnType<typeof getDb>, studentId: number): string {
  const s = db.students.find((s) => s.student_id === studentId)
  return s ? `${s.first_name} ${s.last_name}` : "Unknown student"
}
function supervisorName(db: ReturnType<typeof getDb>, supervisorId: number): string {
  const s = db.supervisors.find((s) => s.supervisor_id === supervisorId)
  return s ? `${s.title} ${s.first_name} ${s.last_name}` : "Unknown supervisor"
}

function toResult(db: ReturnType<typeof getDb>, a: (typeof db.allocations)[number]): AllocationResult {
  const run = db.allocationRuns.find((r) => r.run_id === a.run_id)
  return {
    allocation_id: a.allocation_id,
    run_id: a.run_id,
    algorithm: a.algorithm,
    student_id: a.student_id,
    student_name: studentName(db, a.student_id),
    supervisor_id: a.supervisor_id,
    supervisor_name: supervisorName(db, a.supervisor_id),
    objective_score: a.objective_score,
    published: run?.published ?? false,
  }
}

export async function getMyAllocation(studentId: number): Promise<AllocationResult | null> {
  const db = getDb()
  const publishedRun = db.allocationRuns.find((r) => r.published)
  if (!publishedRun) return null
  const allocation = db.allocations.find(
    (a) => a.run_id === publishedRun.run_id && a.student_id === studentId,
  )
  return allocation ? toResult(db, allocation) : null
}

export async function getSupervisorAllocations(
  supervisorId: number,
  params?: ListParams,
): Promise<Paginated<AllocationResult>> {
  const db = getDb()
  const publishedRun = db.allocationRuns.find((r) => r.published)
  if (!publishedRun) return { data: [], total: 0, page: params?.page ?? 1, limit: params?.limit ?? 20 }
  const rows = db.allocations
    .filter((a) => a.run_id === publishedRun.run_id && a.supervisor_id === supervisorId)
    .map((a) => toResult(db, a))
  return paginate(rows, params)
}

export async function explainAllocation(allocationId: number): Promise<AllocationExplanation> {
  const db = getDb()
  const allocation = db.allocations.find((a) => a.allocation_id === allocationId)
  if (!allocation) throw new Error("Allocation not found.")

  const studentRank = db.studentPreferences.find(
    (p) => p.student_id === allocation.student_id && p.supervisor_id === allocation.supervisor_id,
  )?.rank ?? null
  const supervisorScore = db.supervisorPreferences.find(
    (sp) => sp.supervisor_id === allocation.supervisor_id && sp.student_id === allocation.student_id,
  )?.score ?? null

  const areaById = new Map(db.researchAreas.map((a) => [a.area_id, a.name]))
  const studentAreaIds = new Set(
    db.studentInterests.filter((i) => i.student_id === allocation.student_id).map((i) => i.area_id),
  )
  const sharedAreaNames = db.supervisorExpertise
    .filter((e) => e.supervisor_id === allocation.supervisor_id && studentAreaIds.has(e.area_id))
    .map((e) => areaById.get(e.area_id) ?? "Unknown")

  const rankText = studentRank ? `ranked this supervisor #${studentRank}` : "did not rank this supervisor"
  const scoreText = supervisorScore !== null ? `scored this student ${supervisorScore.toFixed(2)}` : "did not score this student"
  const areaText = sharedAreaNames.length > 0 ? `shared research interest in ${sharedAreaNames.join(", ")}` : "no directly shared research area"

  return {
    allocation_id: allocationId,
    student_rank: studentRank,
    supervisor_score: supervisorScore,
    shared_area_names: sharedAreaNames,
    objective_score: allocation.objective_score,
    summary: `The student ${rankText}; the supervisor ${scoreText}. They have ${areaText}.`,
  }
}

// ---------------------------------------------------------------------------
// Admin-only: run / compare / publish
// ---------------------------------------------------------------------------

export async function runAllocation(algorithm: Extract<AllocationAlgorithm, "greedy-mock" | "random">) {
  return runMockAllocation(algorithm)
}

function computeBenchmark(db: ReturnType<typeof getDb>, run: (typeof db.allocationRuns)[number]): RunBenchmark {
  const runAllocations = db.allocations.filter((a) => a.run_id === run.run_id)
  const ranks = runAllocations
    .map((a) => db.studentPreferences.find((p) => p.student_id === a.student_id && p.supervisor_id === a.supervisor_id)?.rank)
    .filter((r): r is 1 | 2 | 3 | 4 | 5 => r !== undefined)

  const meanSatisfiedRank = ranks.length > 0 ? ranks.reduce((sum, r) => sum + r, 0) / ranks.length : null

  const countsBySupervisor = new Map<number, number>()
  for (const a of runAllocations) {
    countsBySupervisor.set(a.supervisor_id, (countsBySupervisor.get(a.supervisor_id) ?? 0) + 1)
  }
  const counts = [...countsBySupervisor.values()]
  const meanCount = counts.length > 0 ? counts.reduce((s, c) => s + c, 0) / counts.length : 0
  const workloadVariance =
    counts.length > 0 ? counts.reduce((s, c) => s + (c - meanCount) ** 2, 0) / counts.length : 0

  const percentUnallocated =
    run.instance_size > 0 ? ((run.instance_size - runAllocations.length) / run.instance_size) * 100 : 0

  return {
    run_id: run.run_id,
    algorithm: run.algorithm,
    label: run.label,
    mean_satisfied_rank: meanSatisfiedRank !== null ? Math.round(meanSatisfiedRank * 100) / 100 : null,
    workload_variance: Math.round(workloadVariance * 100) / 100,
    percent_unallocated: Math.round(percentUnallocated * 10) / 10,
    runtime_ms: run.runtime_ms ?? 0,
    published: run.published,
    created_at: run.created_at,
  }
}

export async function compareRuns(): Promise<RunBenchmark[]> {
  const db = getDb()
  return db.allocationRuns
    .map((run) => computeBenchmark(db, run))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function getQuotaViolations(runId: string) {
  return checkQuotaViolations(runId)
}

export async function publishRun(runId: string): Promise<void> {
  const db = getDb()
  const run = db.allocationRuns.find((r) => r.run_id === runId)
  if (!run) throw new Error("Run not found.")

  for (const r of db.allocationRuns) r.published = r.run_id === runId
  db.auditLog.push({
    entry_id: nextId(db.auditLog, "entry_id"),
    occurred_at: new Date().toISOString(),
    event_type: "role_change",
    actor_email: "admin",
    detail: `Published allocation run ${runId}.`,
  })
  saveDb()
}
