/**
 * Baseline allocation methods for the O6 benchmark: a simple greedy (or
 * shuffled/random) first-fit over each student's ranked preference list,
 * respecting quota_max as a hard cap. quota_min satisfaction is best-effort
 * only — the real GA engine (services/ga/) handles it properly; these exist
 * as the manual/random comparison points required by FR-ALLOC-04.
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
    label: algorithm === "greedy-mock" ? "Greedy baseline" : "Random baseline",
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
