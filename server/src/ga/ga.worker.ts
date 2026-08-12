/**
 * worker_threads host for the shared GA engine — the Node twin of the
 * browser's ga.worker.ts. Receives {instance, params} via workerData and
 * posts progress/done/error to the parent.
 */
import { parentPort, workerData } from "node:worker_threads"
import { runGa } from "@shared/services/ga/engine"
import type { GaInstance, GaParams } from "@shared/services/ga/types"

const { instance, params } = workerData as { instance: GaInstance; params: GaParams }

const PROGRESS_EVERY = 10

try {
  const result = runGa(instance, params, (progress) => {
    if (progress.generation % PROGRESS_EVERY === 0 || progress.generation === progress.totalGenerations) {
      parentPort?.postMessage({ type: "progress", progress })
    }
  })
  parentPort?.postMessage({ type: "done", result })
} catch (err) {
  parentPort?.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) })
}
