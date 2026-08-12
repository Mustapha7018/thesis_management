/**
 * Thin Web Worker wrapper around the pure GA engine, so a full run never
 * blocks the UI thread. Cancellation is handled by the service terminating
 * the worker — the engine loop is synchronous, so a cancel message could
 * never be processed here.
 */
import { runGa } from "./engine"
import type { GaWorkerMessage, GaWorkerStart } from "./types"

const PROGRESS_EVERY = 10

function post(message: GaWorkerMessage) {
  self.postMessage(message)
}

self.onmessage = (event: MessageEvent<GaWorkerStart>) => {
  const { instance, params } = event.data
  try {
    const result = runGa(instance, params, (progress) => {
      if (progress.generation % PROGRESS_EVERY === 0 || progress.generation === progress.totalGenerations) {
        post({ type: "progress", progress })
      }
    })
    post({ type: "done", result })
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) })
  }
}
