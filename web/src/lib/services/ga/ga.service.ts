/**
 * Client for the server-side GA batch job (the "batch process beside the
 * API"): POST starts the job, polling drives the progress bar, DELETE
 * cancels. The GaRunHandle shape is unchanged from the in-browser era, so
 * the Run Allocation panel needed no structural changes.
 */
import { api } from "@/lib/api/client"
import type { GaParams, GaProgress } from "./types"

const POLL_INTERVAL_MS = 500

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

interface JobStatus {
  job_id: string
  status: "running" | "done" | "cancelled" | "error"
  generation: number
  total_generations: number
  best_fitness: number | null
  summary: GaRunSummary | null
  error: string | null
}

/** Pre-flight warning data: supervisors whose quota_min cannot be met. */
export async function checkQuotaMinFeasibility(): Promise<number[]> {
  const { infeasible_supervisor_ids } = await api.get<{ infeasible_supervisor_ids: number[] }>(
    "/allocation/feasibility",
  )
  return infeasible_supervisor_ids
}

export function runGaAllocation(params: GaParams, onProgress?: (progress: GaProgress) => void): GaRunHandle {
  let cancelled = false
  let jobId: string | null = null

  const cancel = () => {
    cancelled = true
    if (jobId) void api.delete(`/allocation-jobs/${jobId}`).catch(() => {})
  }

  const promise = (async (): Promise<GaRunOutcome> => {
    const started = await api.post<{ kind: "job"; job_id: string }>("/allocation-runs", { algorithm: "ga", params })
    jobId = started.job_id

    for (;;) {
      if (cancelled) return { status: "cancelled" }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      const job = await api.get<JobStatus>(`/allocation-jobs/${jobId}`)
      if (job.status === "running") {
        onProgress?.({
          generation: job.generation,
          totalGenerations: job.total_generations,
          bestFitness: job.best_fitness ?? 0,
        })
        continue
      }
      if (job.status === "done" && job.summary) return { status: "done", summary: job.summary }
      if (job.status === "cancelled") return { status: "cancelled" }
      throw new Error(job.error ?? "GA run failed.")
    }
  })()

  return { promise, cancel }
}
