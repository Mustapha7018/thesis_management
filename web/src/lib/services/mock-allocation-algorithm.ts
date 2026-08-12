/**
 * Placeholder allocation algorithm standing in for the real genetic-algorithm
 * engine (task 5.0, not built yet). Runs a simple greedy (or shuffled/random)
 * first-fit over each student's ranked 5-supervisor preference list,
 * respecting quota_max as a hard cap — never assigns a supervisor past their
 * quota_max. quota_min satisfaction is best-effort only (a simple greedy pass
 * can't guarantee it the way a real search-based GA can); this is exactly the
 * kind of thing the real engine will do properly.
 *
 * Every run writes into the same `allocations`/`allocation_runs` shape the
 * real GA will use, so nothing here needs to be thrown away later — the real
 * GA just becomes another `algorithm` value.
 */
import type { Db } from "./db/store"
import { getDb, nextId, saveDb } from "./db/store"
import type { AllocationAlgorithm } from "@/lib/types/entities"

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function objectiveScore(rank: number, score: number | null): number {
  const rankWeight = (6 - rank) / 5
  return Math.round(((rankWeight + (score ?? 0)) / 2) * 100) / 100
}

export interface MockRunResult {
  run_id: string
  runtime_ms: number
  instance_size: number
  allocated_count: number
}

/** Runs the mock algorithm over every student in the instance, writes a new run + allocation rows. */
export function runMockAllocation(algorithm: Extract<AllocationAlgorithm, "greedy-mock" | "random">): MockRunResult {
  const db = getDb()
  const started = performance.now()

  const quotaMax = new Map(db.supervisors.map((s) => [s.supervisor_id, s.quota_max]))
  const assignedCount = new Map<number, number>()

  const prefsByStudent = new Map<number, typeof db.studentPreferences>()
  for (const p of db.studentPreferences) {
    const list = prefsByStudent.get(p.student_id) ?? []
    list.push(p)
    prefsByStudent.set(p.student_id, list)
  }
  const scoreByPair = new Map<string, number>()
  for (const sp of db.supervisorPreferences) {
    scoreByPair.set(`${sp.supervisor_id}:${sp.student_id}`, sp.score)
  }

  const studentOrder =
    algorithm === "random" ? shuffle(db.students.map((s) => s.student_id)) : db.students.map((s) => s.student_id)

  const runId = `run-${new Date().toISOString().slice(0, 10)}-${algorithm}-${Date.now()}`
  const newAllocations: Db["allocations"] = []
  let nextAllocationId = nextId(db.allocations, "allocation_id")

  for (const studentId of studentOrder) {
    const prefs = prefsByStudent.get(studentId) ?? []
    const orderedPrefs = algorithm === "random" ? shuffle(prefs) : [...prefs].sort((a, b) => a.rank - b.rank)

    for (const pref of orderedPrefs) {
      const max = quotaMax.get(pref.supervisor_id) ?? 0
      const current = assignedCount.get(pref.supervisor_id) ?? 0
      if (current >= max) continue

      assignedCount.set(pref.supervisor_id, current + 1)
      const score = scoreByPair.get(`${pref.supervisor_id}:${studentId}`) ?? null
      newAllocations.push({
        allocation_id: nextAllocationId++,
        run_id: runId,
        algorithm,
        student_id: studentId,
        supervisor_id: pref.supervisor_id,
        objective_score: objectiveScore(pref.rank, score),
        created_at: new Date().toISOString(),
      })
      break
    }
  }

  db.allocations.push(...newAllocations)
  db.allocationRuns.push({
    run_id: runId,
    algorithm,
    label: algorithm === "greedy-mock" ? "Greedy baseline (mock) — GA engine pending (task 5.0)" : "Random baseline",
    created_at: new Date().toISOString(),
    published: false,
    instance_size: db.students.length,
    runtime_ms: Math.round(performance.now() - started),
  })
  saveDb()

  return {
    run_id: runId,
    runtime_ms: Math.round(performance.now() - started),
    instance_size: db.students.length,
    allocated_count: newAllocations.length,
  }
}

export interface QuotaViolation {
  supervisor_id: number
  assigned: number
  quota_max: number
}

/** Automated post-run check for FR-ALLOC-02: zero violations expected on every produced allocation. */
export function checkQuotaViolations(runId: string): QuotaViolation[] {
  const db = getDb()
  const quotaMax = new Map(db.supervisors.map((s) => [s.supervisor_id, s.quota_max]))
  const counts = new Map<number, number>()
  for (const a of db.allocations) {
    if (a.run_id !== runId) continue
    counts.set(a.supervisor_id, (counts.get(a.supervisor_id) ?? 0) + 1)
  }
  const violations: QuotaViolation[] = []
  for (const [supervisorId, assigned] of counts) {
    const max = quotaMax.get(supervisorId) ?? 0
    if (assigned > max) violations.push({ supervisor_id: supervisorId, assigned, quota_max: max })
  }
  return violations
}
