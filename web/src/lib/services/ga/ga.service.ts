/**
 * Orchestrates a GA run: extracts a plain-data instance from the store,
 * spawns the worker, relays progress, and persists the run + allocations in
 * a single save on completion. Nothing is written before "done", so cancel
 * and tab-close can never leave partial state behind.
 */
import { getSession } from "../auth.service"
import { getDb, nextId, saveDb } from "../db/store"
import { alignmentScore } from "./alignment"
import type { GaInstance, GaParams, GaProgress, GaResult, GaWorkerMessage } from "./types"
import type { Allocation } from "@/lib/types/entities"

export interface GaRunSummary {
  run_id: string
  runtime_ms: number
  instance_size: number
  allocated_count: number
  generations_run: number
  best_fitness: number
  min_infeasible_supervisor_ids: number[]
}

export type GaRunOutcome = { status: "done"; summary: GaRunSummary } | { status: "cancelled" }

export interface GaRunHandle {
  promise: Promise<GaRunOutcome>
  cancel: () => void
}

/** Builds the structured-clone-safe instance the engine consumes. */
export function buildGaInstance(): GaInstance {
  const db = getDb()

  const supIdxById = new Map<number, number>()
  db.supervisors.forEach((s, idx) => supIdxById.set(s.supervisor_id, idx))

  const interestsByStudent = new Map<number, { area_id: number; rank: 1 | 2 | 3 }[]>()
  for (const i of db.studentInterests) {
    const list = interestsByStudent.get(i.student_id) ?? []
    list.push(i)
    interestsByStudent.set(i.student_id, list)
  }
  const expertiseBySupervisor = new Map<number, Map<number, 1 | 2 | 3>>()
  for (const e of db.supervisorExpertise) {
    const byArea = expertiseBySupervisor.get(e.supervisor_id) ?? new Map()
    byArea.set(e.area_id, e.proficiency)
    expertiseBySupervisor.set(e.supervisor_id, byArea)
  }
  const scoreByPair = new Map<string, number>()
  for (const sp of db.supervisorPreferences) {
    scoreByPair.set(`${sp.supervisor_id}:${sp.student_id}`, sp.score)
  }
  const prefsByStudent = new Map<number, typeof db.studentPreferences>()
  for (const p of db.studentPreferences) {
    const list = prefsByStudent.get(p.student_id) ?? []
    list.push(p)
    prefsByStudent.set(p.student_id, list)
  }

  const emptyExpertise = new Map<number, 1 | 2 | 3>()
  return {
    studentIds: db.students.map((s) => s.student_id),
    supervisors: db.supervisors.map((s) => ({ id: s.supervisor_id, quotaMin: s.quota_min, quotaMax: s.quota_max })),
    prefs: db.students.map((student) => {
      const interests = interestsByStudent.get(student.student_id) ?? []
      return (prefsByStudent.get(student.student_id) ?? [])
        .filter((p) => supIdxById.has(p.supervisor_id))
        .sort((a, b) => a.rank - b.rank)
        .map((p) => ({
          supIdx: supIdxById.get(p.supervisor_id)!,
          rank: p.rank,
          score: scoreByPair.get(`${p.supervisor_id}:${student.student_id}`) ?? 0,
          align: alignmentScore(interests, expertiseBySupervisor.get(p.supervisor_id) ?? emptyExpertise),
        }))
    }),
  }
}

/** Supervisors with fewer applicants than quota_min — their minimum cannot be met. */
export function findInfeasibleQuotaMins(instance: GaInstance): number[] {
  const applicantCounts = new Array<number>(instance.supervisors.length).fill(0)
  for (const list of instance.prefs) {
    for (const pref of list) applicantCounts[pref.supIdx]++
  }
  return instance.supervisors.filter((s, idx) => applicantCounts[idx] < s.quotaMin).map((s) => s.id)
}

function persistRun(instance: GaInstance, params: GaParams, result: GaResult, runtimeMs: number): GaRunSummary {
  const db = getDb()
  const { weights } = params
  const runId = `run-${new Date().toISOString().slice(0, 10)}-ga-${Date.now()}`

  const newAllocations: Allocation[] = []
  let nextAllocationId = nextId(db.allocations, "allocation_id")
  result.assignment.forEach((gene, i) => {
    if (gene < 0) return
    newAllocations.push({
      allocation_id: nextAllocationId++,
      run_id: runId,
      algorithm: "ga",
      student_id: instance.studentIds[i],
      supervisor_id: instance.supervisors[instance.prefs[i][gene].supIdx].id,
      objective_score: result.pairScores[i],
      created_at: new Date().toISOString(),
    })
  })

  db.allocations.push(...newAllocations)
  db.allocationRuns.push({
    run_id: runId,
    algorithm: "ga",
    label: `GA (wP=${weights.preference}, wE=${weights.expertise}, wB=${weights.balance}, seed=${params.seed})`,
    created_at: new Date().toISOString(),
    published: false,
    instance_size: instance.studentIds.length,
    runtime_ms: runtimeMs,
    params,
  })
  db.auditLog.push({
    entry_id: nextId(db.auditLog, "entry_id"),
    occurred_at: new Date().toISOString(),
    event_type: "allocation_run",
    actor_email: getSession()?.email ?? "admin",
    detail: `Ran GA allocation ${runId} (seed ${params.seed}, ${newAllocations.length}/${instance.studentIds.length} allocated).`,
  })
  saveDb()

  return {
    run_id: runId,
    runtime_ms: runtimeMs,
    instance_size: instance.studentIds.length,
    allocated_count: newAllocations.length,
    generations_run: result.generationsRun,
    best_fitness: result.bestFitness,
    min_infeasible_supervisor_ids: result.minInfeasibleSupervisorIds,
  }
}

export function runGaAllocation(params: GaParams, onProgress?: (progress: GaProgress) => void): GaRunHandle {
  const instance = buildGaInstance()
  const worker = new Worker(new URL("./ga.worker.ts", import.meta.url), { type: "module" })
  const started = performance.now()
  let settled = false

  let cancel: () => void = () => {}
  const promise = new Promise<GaRunOutcome>((resolve, reject) => {
    cancel = () => {
      if (settled) return
      settled = true
      worker.terminate()
      resolve({ status: "cancelled" })
    }
    worker.onmessage = (event: MessageEvent<GaWorkerMessage>) => {
      const message = event.data
      if (message.type === "progress") {
        onProgress?.(message.progress)
        return
      }
      if (settled) return
      settled = true
      worker.terminate()
      if (message.type === "done") {
        resolve({ status: "done", summary: persistRun(instance, params, message.result, Math.round(performance.now() - started)) })
      } else {
        reject(new Error(message.message))
      }
    }
    worker.onerror = (event) => {
      if (settled) return
      settled = true
      worker.terminate()
      reject(new Error(event.message || "GA worker failed."))
    }
    worker.postMessage({ type: "start", instance, params })
  })

  return { promise, cancel }
}
