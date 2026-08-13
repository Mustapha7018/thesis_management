/**
 * Greedy/random baseline allocators (FR-ALLOC-04) — server-side port of the
 * web mock-allocation-algorithm, operating on the same GaInstance shape as
 * the GA so both draw from identical data.
 */
import type { GaInstance } from "@shared/services/ga/types"

export interface BaselineResult {
  /** Per student index: pref-list index or -1 (same encoding as the GA). */
  assignment: number[]
  pairScores: number[]
  allocatedCount: number
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const objectiveScore = (rank: number, score: number) => Math.round((((6 - rank) / 5 + score) / 2) * 100) / 100

/** `rng` makes the random baseline reproducible in experiments; API runs use Math.random. */
export function runBaseline(
  instance: GaInstance,
  algorithm: "greedy-mock" | "random",
  rng: () => number = Math.random,
): BaselineResult {
  const n = instance.studentIds.length
  const loads = new Array<number>(instance.supervisors.length).fill(0)
  const assignment = new Array<number>(n).fill(-1)
  const pairScores = new Array<number>(n).fill(0)

  const studentOrder = algorithm === "random" ? shuffle([...Array(n).keys()], rng) : [...Array(n).keys()]

  let allocatedCount = 0
  for (const i of studentOrder) {
    const prefs = instance.prefs[i]
    const order = algorithm === "random" ? shuffle([...prefs.keys()], rng) : [...prefs.keys()]
    for (const k of order) {
      const pref = prefs[k]
      const max = instance.supervisors[pref.supIdx].quotaMax
      if (loads[pref.supIdx] >= max) continue
      loads[pref.supIdx]++
      assignment[i] = k
      pairScores[i] = objectiveScore(pref.rank, pref.score)
      allocatedCount++
      break
    }
  }

  return { assignment, pairScores, allocatedCount }
}
