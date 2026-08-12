import { describe, expect, it } from "vitest"
import { alignmentScore } from "./alignment"
import { runGa } from "./engine"
import { mulberry32, randInt } from "./prng"
import type { GaInstance, GaParams, GaWeights } from "./types"
import { DEFAULT_GA_PARAMS } from "./types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function params(overrides: Partial<GaParams> & { weights?: Partial<GaWeights> } = {}): GaParams {
  return {
    ...DEFAULT_GA_PARAMS,
    population: 30,
    generations: 60,
    stagnationWindow: 60,
    seed: 42,
    ...overrides,
    weights: { ...DEFAULT_GA_PARAMS.weights, ...overrides.weights },
  }
}

/** Deterministic random instance: every student lists `listLen` distinct supervisors. */
function randomInstance(opts: {
  seed?: number
  students: number
  supervisors: number
  quotaMin?: number
  quotaMax: number
  listLen?: number
}): GaInstance {
  const rng = mulberry32(opts.seed ?? 7)
  const listLen = Math.min(opts.listLen ?? 5, opts.supervisors)
  const prefs: GaInstance["prefs"] = []
  for (let i = 0; i < opts.students; i++) {
    const pool = Array.from({ length: opts.supervisors }, (_, s) => s)
    const list = []
    for (let k = 0; k < listLen; k++) {
      const pick = randInt(rng, pool.length)
      list.push({ supIdx: pool[pick], rank: k + 1, score: rng(), align: rng() })
      pool.splice(pick, 1)
    }
    prefs.push(list)
  }
  return {
    studentIds: Array.from({ length: opts.students }, (_, i) => i + 1),
    supervisors: Array.from({ length: opts.supervisors }, (_, s) => ({
      id: s + 1,
      quotaMin: opts.quotaMin ?? 0,
      quotaMax: opts.quotaMax,
    })),
    prefs,
  }
}

function loadsOf(instance: GaInstance, assignment: number[]): number[] {
  const loads = new Array<number>(instance.supervisors.length).fill(0)
  assignment.forEach((g, i) => {
    if (g >= 0) loads[instance.prefs[i][g].supIdx]++
  })
  return loads
}

function meanAssignedRank(instance: GaInstance, assignment: number[]): number {
  const ranks = assignment.flatMap((g, i) => (g >= 0 ? [instance.prefs[i][g].rank] : []))
  return ranks.reduce((s, r) => s + r, 0) / ranks.length
}

function utilisationStdev(instance: GaInstance, assignment: number[]): number {
  const utils = loadsOf(instance, assignment).map((load, s) => load / instance.supervisors[s].quotaMax)
  const mean = utils.reduce((s, u) => s + u, 0) / utils.length
  return Math.sqrt(utils.reduce((s, u) => s + (u - mean) ** 2, 0) / utils.length)
}

// ---------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------

describe("mulberry32", () => {
  it("is deterministic for a given seed and differs across seeds", () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    const c = mulberry32(124)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    const seqC = [c(), c(), c(), c(), c()]
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const v of seqA) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of seqA) expect(v).toBeLessThan(1)
  })
})

// ---------------------------------------------------------------------------
// Alignment (D14)
// ---------------------------------------------------------------------------

describe("alignmentScore", () => {
  it("matches the D14 weighting exactly", () => {
    const interests: { area_id: number; rank: 1 | 2 | 3 }[] = [
      { area_id: 1, rank: 1 },
      { area_id: 2, rank: 2 },
    ]
    // Only the rank-1 interest matched, at proficiency 3: 1.0*1.0 / (1.0+0.6)
    expect(alignmentScore(interests, new Map([[1, 3]]))).toBeCloseTo(1 / 1.6, 10)
    // Only the rank-2 interest matched, at proficiency 2: 0.6*0.7 / 1.6
    expect(alignmentScore(interests, new Map([[2, 2]]))).toBeCloseTo(0.42 / 1.6, 10)
    // Both matched at proficiency 1: (1.0*0.4 + 0.6*0.4) / 1.6
    expect(
      alignmentScore(
        interests,
        new Map([
          [1, 1],
          [2, 1],
        ]),
      ),
    ).toBeCloseTo(0.64 / 1.6, 10)
  })

  it("returns 0 for a student with no interests or no overlap", () => {
    expect(alignmentScore([], new Map([[1, 3]]))).toBe(0)
    expect(alignmentScore([{ area_id: 1, rank: 1 }], new Map([[9, 3]]))).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// GA engine
// ---------------------------------------------------------------------------

describe("runGa", () => {
  it("is reproducible: same seed gives an identical assignment, different seed differs", () => {
    const instance = randomInstance({ students: 40, supervisors: 6, quotaMax: 8 })
    const a = runGa(instance, params({ seed: 42 }))
    const b = runGa(instance, params({ seed: 42 }))
    const c = runGa(instance, params({ seed: 43 }))
    expect(a.assignment).toEqual(b.assignment)
    expect(a.bestFitness).toBe(b.bestFitness)
    expect(a.assignment).not.toEqual(c.assignment)
  })

  it("never exceeds quota_max, even on a tight instance", () => {
    // sum(quota_max) = 42 vs 40 students — binding caps.
    const instance = randomInstance({ students: 40, supervisors: 6, quotaMax: 7 })
    const result = runGa(instance, params())
    const loads = loadsOf(instance, result.assignment)
    loads.forEach((load, s) => expect(load).toBeLessThanOrEqual(instance.supervisors[s].quotaMax))
  })

  it("satisfies quota_min when feasible", () => {
    const instance = randomInstance({ students: 40, supervisors: 6, quotaMin: 2, quotaMax: 10 })
    const result = runGa(instance, params())
    expect(result.minInfeasibleSupervisorIds).toEqual([])
    const loads = loadsOf(instance, result.assignment)
    loads.forEach((load, s) => expect(load).toBeGreaterThanOrEqual(instance.supervisors[s].quotaMin))
  })

  it("stays feasible and assigns everyone on a maximally tight instance (sum quota_max = n)", () => {
    const instance = randomInstance({ students: 12, supervisors: 3, quotaMin: 1, quotaMax: 4, listLen: 3 })
    const result = runGa(instance, params())
    expect(result.assignment.every((g) => g >= 0)).toBe(true)
    expect(loadsOf(instance, result.assignment)).toEqual([4, 4, 4])
  })

  it("weight extremes steer the outcome: wP=1 optimises rank, wB=1 optimises balance", () => {
    // Every student prefers supervisor 0 first; caps are loose enough that
    // pure preference weight piles everyone onto supervisor 0.
    const students = 30
    const prefs: GaInstance["prefs"] = Array.from({ length: students }, () =>
      [0, 1, 2, 3, 4].map((supIdx, k) => ({ supIdx, rank: k + 1, score: 0.5, align: 0.5 })),
    )
    const instance: GaInstance = {
      studentIds: Array.from({ length: students }, (_, i) => i + 1),
      supervisors: Array.from({ length: 5 }, (_, s) => ({ id: s + 1, quotaMin: 0, quotaMax: students })),
      prefs,
    }
    const prefRun = runGa(instance, params({ weights: { preference: 1, expertise: 0, balance: 0 } }))
    const balanceRun = runGa(instance, params({ weights: { preference: 0, expertise: 0, balance: 1 } }))
    expect(meanAssignedRank(instance, prefRun.assignment)).toBe(1)
    expect(meanAssignedRank(instance, balanceRun.assignment)).toBeGreaterThan(1)
    expect(utilisationStdev(instance, balanceRun.assignment)).toBeLessThan(
      utilisationStdev(instance, prefRun.assignment),
    )
  })

  it("leaves students unassigned only when every listed supervisor is full", () => {
    // 3 students all list the same 2 supervisors with capacity 1 each.
    const prefs: GaInstance["prefs"] = Array.from({ length: 3 }, () => [
      { supIdx: 0, rank: 1, score: 0, align: 0 },
      { supIdx: 1, rank: 2, score: 0, align: 0 },
    ])
    const instance: GaInstance = {
      studentIds: [1, 2, 3],
      supervisors: [
        { id: 1, quotaMin: 0, quotaMax: 1 },
        { id: 2, quotaMin: 0, quotaMax: 1 },
      ],
      prefs,
    }
    const result = runGa(instance, params())
    expect(result.assignment.filter((g) => g === -1)).toHaveLength(1)
  })

  it("keeps best fitness monotone non-decreasing (elitism invariant)", () => {
    const instance = randomInstance({ students: 40, supervisors: 6, quotaMax: 8 })
    const { fitnessHistory } = runGa(instance, params())
    for (let g = 1; g < fitnessHistory.length; g++) {
      expect(fitnessHistory[g]).toBeGreaterThanOrEqual(fitnessHistory[g - 1])
    }
  })

  it("finds the known optimum on a handcrafted instance", () => {
    // Supervisor A holds 2, B holds 2; all three students prefer A.
    // Optimum under pure preference weight: two at A (rank 1), one at B (rank 2).
    const prefs: GaInstance["prefs"] = Array.from({ length: 3 }, () => [
      { supIdx: 0, rank: 1, score: 0, align: 0 },
      { supIdx: 1, rank: 2, score: 0, align: 0 },
    ])
    const instance: GaInstance = {
      studentIds: [1, 2, 3],
      supervisors: [
        { id: 1, quotaMin: 0, quotaMax: 2 },
        { id: 2, quotaMin: 0, quotaMax: 2 },
      ],
      prefs,
    }
    const result = runGa(instance, params({ weights: { preference: 1, expertise: 0, balance: 0 } }))
    expect(loadsOf(instance, result.assignment)).toEqual([2, 1])
    expect(result.bestFitness).toBeCloseTo((1 + 1 + 0.8) / 3, 10)
  })

  it("handles a zero-preference cohort without crashing", () => {
    const instance: GaInstance = {
      studentIds: [1, 2, 3],
      supervisors: [{ id: 1, quotaMin: 0, quotaMax: 5 }],
      prefs: [[], [], []],
    }
    const result = runGa(instance, params())
    expect(result.assignment).toEqual([-1, -1, -1])
    expect(result.pairScores).toEqual([0, 0, 0])
  })

  it("reports supervisors whose quota_min is infeasible and still completes", () => {
    // Supervisor 2 requires 2 students but only student 0 lists them.
    const prefs: GaInstance["prefs"] = [
      [
        { supIdx: 0, rank: 1, score: 0, align: 0 },
        { supIdx: 1, rank: 2, score: 0, align: 0 },
      ],
      [{ supIdx: 0, rank: 1, score: 0, align: 0 }],
      [{ supIdx: 0, rank: 1, score: 0, align: 0 }],
    ]
    const instance: GaInstance = {
      studentIds: [1, 2, 3],
      supervisors: [
        { id: 1, quotaMin: 0, quotaMax: 5 },
        { id: 2, quotaMin: 2, quotaMax: 5 },
      ],
      prefs,
    }
    const result = runGa(instance, params())
    expect(result.minInfeasibleSupervisorIds).toEqual([2])
  })

  it("rejects invalid parameters", () => {
    const instance = randomInstance({ students: 5, supervisors: 2, quotaMax: 5, listLen: 2 })
    expect(() => runGa(instance, params({ weights: { preference: 0, expertise: 0, balance: 0 } }))).toThrow()
    expect(() => runGa(instance, params({ mutationRate: 1.5 }))).toThrow()
    expect(() => runGa(instance, params({ population: 1 }))).toThrow()
  })
})
