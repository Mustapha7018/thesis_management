/**
 * In-memory GA job registry: the batch process beside the API. One GA run at
 * a time (409 on a second start — single-admin tool, documented limitation).
 * Persistence happens only when the worker reports "done"; cancellation
 * terminates the worker thread and nothing is written.
 */
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Worker } from "node:worker_threads"
import { randomUUID } from "node:crypto"
import { persistRun, type RunSummary } from "./persist.js"
import type { GaInstance, GaParams, GaResult } from "@shared/services/ga/types"

export interface GaJob {
  job_id: string
  status: "running" | "done" | "cancelled" | "error"
  generation: number
  total_generations: number
  best_fitness: number | null
  summary: (RunSummary & { generations_run: number; best_fitness: number; min_infeasible_supervisor_ids: number[] }) | null
  error: string | null
}

interface ActiveJob {
  job: GaJob
  worker: Worker
}

const jobs = new Map<string, GaJob>()
let active: ActiveJob | null = null

/** Keep only the most recent finished jobs around for late polls. */
function pruneFinished() {
  const finished = [...jobs.values()].filter((j) => j.status !== "running")
  for (const old of finished.slice(0, Math.max(0, finished.length - 10))) {
    jobs.delete(old.job_id)
  }
}

function workerUrl(): URL {
  // tsx runs the .ts source directly; the esbuild bundle ships ga.worker.js.
  const tsUrl = new URL("./ga.worker.ts", import.meta.url)
  return existsSync(fileURLToPath(tsUrl)) ? tsUrl : new URL("./ga.worker.js", import.meta.url)
}

export function startGaJob(instance: GaInstance, params: GaParams, actorEmail: string): string {
  if (active) {
    const err = new Error("A genetic-algorithm run is already in progress.") as Error & { statusCode: number }
    err.statusCode = 409
    throw err
  }

  const jobId = randomUUID()
  const job: GaJob = {
    job_id: jobId,
    status: "running",
    generation: 0,
    total_generations: params.generations,
    best_fitness: null,
    summary: null,
    error: null,
  }
  jobs.set(jobId, job)
  pruneFinished()

  const started = performance.now()
  const url = workerUrl()
  const worker = new Worker(url, {
    workerData: { instance, params },
    execArgv: url.pathname.endsWith(".ts") ? ["--import", "tsx"] : [],
  })
  active = { job, worker }

  const finish = () => {
    active = null
    void worker.terminate()
  }

  worker.on("message", (message: { type: string; progress?: { generation: number; bestFitness: number }; result?: GaResult; message?: string }) => {
    if (message.type === "progress" && message.progress) {
      job.generation = message.progress.generation
      job.best_fitness = message.progress.bestFitness
      return
    }
    if (message.type === "done" && message.result) {
      const result = message.result
      const { weights } = params
      persistRun({
        instance,
        algorithm: "ga",
        label: `GA (wP=${weights.preference}, wE=${weights.expertise}, wB=${weights.balance}, seed=${params.seed})`,
        params,
        assignment: result.assignment,
        pairScores: result.pairScores,
        runtimeMs: Math.round(performance.now() - started),
        actorEmail,
      })
        .then((summary) => {
          job.status = "done"
          job.summary = {
            ...summary,
            generations_run: result.generationsRun,
            best_fitness: result.bestFitness,
            min_infeasible_supervisor_ids: result.minInfeasibleSupervisorIds,
          }
        })
        .catch((err: unknown) => {
          job.status = "error"
          job.error = err instanceof Error ? err.message : String(err)
        })
        .finally(finish)
      return
    }
    if (message.type === "error") {
      job.status = "error"
      job.error = message.message ?? "GA worker failed."
      finish()
    }
  })
  worker.on("error", (err: unknown) => {
    if (job.status === "running") {
      job.status = "error"
      job.error = err instanceof Error ? err.message : String(err)
    }
    finish()
  })

  return jobId
}

export function getJob(jobId: string): GaJob | undefined {
  return jobs.get(jobId)
}

export function cancelJob(jobId: string): GaJob | undefined {
  const job = jobs.get(jobId)
  if (!job) return undefined
  if (job.status === "running" && active?.job.job_id === jobId) {
    void active.worker.terminate()
    active = null
    job.status = "cancelled"
  }
  return job
}
