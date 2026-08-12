/**
 * Genetic-algorithm allocation engine (task 5.0, objective O2).
 *
 * Design follows the literature commitments (Sanchez-Anguix et al., 2019):
 * direct representation (a vector mapping each student to a supervisor),
 * repair handling of quota violations, and a weighted-sum scalarised
 * objective over preference satisfaction, expertise alignment and workload
 * balance (FR-ALLOC-01).
 *
 * Pure and deterministic: no store access, no DOM, no Math.random — every
 * stochastic choice draws from one seeded PRNG stream, so the same
 * seed + weights + params + instance always yields the same assignment.
 *
 * Encoding: gene i is an index into student i's rank-sorted preference list
 * (assignments are always on-list, so every pairing is explainable and
 * mean_satisfied_rank stays defined), or -1 for unassigned. -1 is only ever
 * produced by repair when all of a student's listed supervisors are full;
 * a fixed penalty of 1 per unassigned student (relative to the normalised
 * objective) guarantees the GA never prefers unassignment over any open
 * listed slot.
 */
import { mulberry32, randInt } from "./prng"
import type { GaInstance, GaParams, GaProgress, GaResult } from "./types"

const TOURNAMENT_K = 3

interface Ctx {
  n: number
  nSup: number
  quotaMin: Int32Array
  quotaMax: Int32Array
  /** Normalised objective weights (sum 1). */
  wP: number
  wE: number
  wB: number
  /** prefValue[i][k] = (6 - rank)/5 for student i's k-th preference. */
  prefValue: Float64Array[]
  /** composite[i][k] = per-pairing objective score (persisted + repair order). */
  composite: Float64Array[]
  /** Per supervisor: applicants as (student, prefIdx), rank-ascending. */
  applicants: { stu: number; prefIdx: number }[][]
  prefs: GaInstance["prefs"]
}

function buildContext(instance: GaInstance, params: GaParams): Ctx {
  const { weights } = params
  const weightSum = weights.preference + weights.expertise + weights.balance
  if (!(weightSum > 0)) throw new Error("Objective weights must sum to a positive value.")
  if (weights.preference < 0 || weights.expertise < 0 || weights.balance < 0) {
    throw new Error("Objective weights must not be negative.")
  }
  if (params.population < 2) throw new Error("Population must be at least 2.")
  if (params.generations < 1) throw new Error("Generations must be at least 1.")
  if (params.elitism < 0 || params.elitism >= params.population) {
    throw new Error("Elitism must be smaller than the population size.")
  }
  if (params.mutationRate < 0 || params.mutationRate > 1) {
    throw new Error("Mutation rate must be between 0 and 1.")
  }

  const wP = weights.preference / weightSum
  const wE = weights.expertise / weightSum
  const wB = weights.balance / weightSum

  const n = instance.studentIds.length
  const nSup = instance.supervisors.length
  const quotaMin = new Int32Array(nSup)
  const quotaMax = new Int32Array(nSup)
  instance.supervisors.forEach((s, idx) => {
    quotaMin[idx] = s.quotaMin
    quotaMax[idx] = s.quotaMax
  })

  // The pairing composite mirrors the persisted objective_score: the two
  // per-pairing terms weighted as the run weights them (balance is run-level).
  // With balance-only weights, fall back to an unweighted average.
  const pairWeightSum = wP + wE
  const compP = pairWeightSum > 0 ? wP / pairWeightSum : 0.5
  const compE = pairWeightSum > 0 ? wE / pairWeightSum : 0.5

  const prefValue: Float64Array[] = []
  const composite: Float64Array[] = []
  const applicants: { stu: number; prefIdx: number }[][] = Array.from({ length: nSup }, () => [])
  instance.prefs.forEach((list, stu) => {
    const values = new Float64Array(list.length)
    const comps = new Float64Array(list.length)
    list.forEach((pref, k) => {
      values[k] = (6 - pref.rank) / 5
      comps[k] = compP * values[k] + compE * pref.align
      applicants[pref.supIdx].push({ stu, prefIdx: k })
    })
    prefValue.push(values)
    composite.push(comps)
  })
  // instance.prefs is rank-ascending per student, and students were pushed in
  // index order, so each applicant list is already deterministic; sort by rank
  // (then student) to make the repair's fill order explicit.
  for (const list of applicants) {
    list.sort((a, b) => instance.prefs[a.stu][a.prefIdx].rank - instance.prefs[b.stu][b.prefIdx].rank || a.stu - b.stu)
  }

  return { n, nSup, quotaMin, quotaMax, wP, wE, wB, prefValue, composite, applicants, prefs: instance.prefs }
}

function computeLoads(ctx: Ctx, genes: Int32Array): Int32Array {
  const loads = new Int32Array(ctx.nSup)
  for (let i = 0; i < ctx.n; i++) {
    const g = genes[i]
    if (g >= 0) loads[ctx.prefs[i][g].supIdx]++
  }
  return loads
}

/**
 * Repair to hard quota feasibility (FR-ALLOC-02). Phase A resolves over-max
 * supervisors by evicting their lowest-composite students to the best-rank
 * alternative with space (else unassigned) — each step strictly reduces an
 * over-max load and never pushes a target over max, so it terminates.
 * Phase B fills under-min supervisors from unassigned applicants (best rank
 * first), then by pulling applicants from donors above their own min
 * (largest surplus first, smallest composite loss as tie-break). Donors never
 * drop below their min and targets stay below max, so Phase B cannot create
 * violations; supervisors with no remaining candidates are left under min
 * (surfaced via the final under-min check) rather than looping forever.
 */
function repair(ctx: Ctx, genes: Int32Array): void {
  const loads = computeLoads(ctx, genes)

  // Phase A — over quota_max.
  for (let s = 0; s < ctx.nSup; s++) {
    if (loads[s] <= ctx.quotaMax[s]) continue
    const assigned: number[] = []
    for (let i = 0; i < ctx.n; i++) {
      const g = genes[i]
      if (g >= 0 && ctx.prefs[i][g].supIdx === s) assigned.push(i)
    }
    assigned.sort((a, b) => ctx.composite[a][genes[a]] - ctx.composite[b][genes[b]] || a - b)
    for (const stu of assigned) {
      if (loads[s] <= ctx.quotaMax[s]) break
      let moved = false
      for (let k = 0; k < ctx.prefs[stu].length; k++) {
        const target = ctx.prefs[stu][k].supIdx
        if (target !== s && loads[target] < ctx.quotaMax[target]) {
          genes[stu] = k
          loads[target]++
          loads[s]--
          moved = true
          break
        }
      }
      if (!moved) {
        genes[stu] = -1
        loads[s]--
      }
    }
  }

  // Phase B — under quota_min.
  for (let s = 0; s < ctx.nSup; s++) {
    if (loads[s] >= ctx.quotaMin[s]) continue
    // Pass 1: unassigned applicants, best rank first.
    for (const { stu, prefIdx } of ctx.applicants[s]) {
      if (loads[s] >= ctx.quotaMin[s]) break
      if (genes[stu] === -1) {
        genes[stu] = prefIdx
        loads[s]++
      }
    }
    // Pass 2: pull applicants from donors that stay at/above their own min.
    while (loads[s] < ctx.quotaMin[s]) {
      let best: { stu: number; prefIdx: number; surplus: number; loss: number } | null = null
      for (const { stu, prefIdx } of ctx.applicants[s]) {
        const g = genes[stu]
        if (g < 0) continue
        const donor = ctx.prefs[stu][g].supIdx
        if (donor === s || loads[donor] <= ctx.quotaMin[donor]) continue
        const surplus = loads[donor] - ctx.quotaMin[donor]
        const loss = ctx.composite[stu][g] - ctx.composite[stu][prefIdx]
        if (best === null || surplus > best.surplus || (surplus === best.surplus && loss < best.loss)) {
          best = { stu, prefIdx, surplus, loss }
        }
      }
      if (best === null) break // infeasible for this supervisor; reported downstream
      const donor = ctx.prefs[best.stu][genes[best.stu]].supIdx
      genes[best.stu] = best.prefIdx
      loads[donor]--
      loads[s]++
    }
  }
}

function fitness(ctx: Ctx, genes: Int32Array): number {
  let prefSum = 0
  let alignSum = 0
  let unassigned = 0
  const loads = new Int32Array(ctx.nSup)
  for (let i = 0; i < ctx.n; i++) {
    const g = genes[i]
    if (g < 0) {
      unassigned++
      continue
    }
    prefSum += ctx.prefValue[i][g]
    alignSum += ctx.prefs[i][g].align
    loads[ctx.prefs[i][g].supIdx]++
  }

  let meanUtil = 0
  for (let s = 0; s < ctx.nSup; s++) meanUtil += loads[s] / ctx.quotaMax[s]
  meanUtil /= ctx.nSup
  let variance = 0
  for (let s = 0; s < ctx.nSup; s++) {
    const d = loads[s] / ctx.quotaMax[s] - meanUtil
    variance += d * d
  }
  // Utilisations live in [0,1], so their stdev is <= 0.5 and B stays in [0,1].
  const balance = 1 - 2 * Math.sqrt(variance / ctx.nSup)

  const p = ctx.n > 0 ? prefSum / ctx.n : 0
  const e = ctx.n > 0 ? alignSum / ctx.n : 0
  const penalty = ctx.n > 0 ? unassigned / ctx.n : 0
  return ctx.wP * p + ctx.wE * e + ctx.wB * balance - penalty
}

/** Deterministic greedy-by-rank first-fit, expressed as genes. */
function greedySeed(ctx: Ctx): Int32Array {
  const genes = new Int32Array(ctx.n).fill(-1)
  const loads = new Int32Array(ctx.nSup)
  for (let i = 0; i < ctx.n; i++) {
    for (let k = 0; k < ctx.prefs[i].length; k++) {
      const s = ctx.prefs[i][k].supIdx
      if (loads[s] < ctx.quotaMax[s]) {
        genes[i] = k
        loads[s]++
        break
      }
    }
  }
  return genes
}

export function runGa(
  instance: GaInstance,
  params: GaParams,
  onProgress?: (progress: GaProgress) => void,
): GaResult {
  const ctx = buildContext(instance, params)
  const rng = mulberry32(params.seed)
  const { population: popSize, generations, mutationRate, elitism, stagnationWindow } = params

  const population: Int32Array[] = []
  const seedGenes = greedySeed(ctx)
  repair(ctx, seedGenes)
  population.push(seedGenes)
  while (population.length < popSize) {
    const genes = new Int32Array(ctx.n)
    for (let i = 0; i < ctx.n; i++) {
      const len = ctx.prefs[i].length
      genes[i] = len > 0 ? randInt(rng, len) : -1
    }
    repair(ctx, genes)
    population.push(genes)
  }
  let scores = population.map((genes) => fitness(ctx, genes))

  const fitnessHistory: number[] = []
  let stagnation = 0
  let generationsRun = 0

  const rankOrder = () =>
    population
      .map((_, idx) => idx)
      .sort((a, b) => scores[b] - scores[a] || a - b)

  const tournament = (): Int32Array => {
    let best = randInt(rng, popSize)
    for (let t = 1; t < TOURNAMENT_K; t++) {
      const challenger = randInt(rng, popSize)
      if (scores[challenger] > scores[best]) best = challenger
    }
    return population[best]
  }

  for (let gen = 0; gen < generations; gen++) {
    const order = rankOrder()
    const nextPopulation: Int32Array[] = order.slice(0, elitism).map((idx) => population[idx])
    const nextScores: number[] = order.slice(0, elitism).map((idx) => scores[idx])

    while (nextPopulation.length < popSize) {
      const parentA = tournament()
      const parentB = tournament()
      const child = new Int32Array(ctx.n)
      for (let i = 0; i < ctx.n; i++) {
        const len = ctx.prefs[i].length
        if (len === 0) {
          child[i] = -1
          continue
        }
        child[i] = rng() < 0.5 ? parentA[i] : parentB[i]
        if (rng() < mutationRate) child[i] = randInt(rng, len)
        // Crossover can inherit -1 from a repaired parent; keep it — repair
        // and the unassignment penalty push it back on-list when possible.
      }
      repair(ctx, child)
      nextPopulation.push(child)
      nextScores.push(fitness(ctx, child))
    }

    population.splice(0, popSize, ...nextPopulation)
    scores = nextScores
    generationsRun = gen + 1

    const best = Math.max(...scores)
    const previousBest = fitnessHistory.length > 0 ? fitnessHistory[fitnessHistory.length - 1] : -Infinity
    fitnessHistory.push(Math.max(best, previousBest))
    stagnation = best > previousBest ? 0 : stagnation + 1

    onProgress?.({ generation: generationsRun, totalGenerations: generations, bestFitness: fitnessHistory[fitnessHistory.length - 1] })
    if (stagnation >= stagnationWindow) break
  }

  const finalOrder = rankOrder()
  const bestGenes = population[finalOrder[0]]
  const bestFitness = scores[finalOrder[0]]

  const pairScores = new Array<number>(ctx.n).fill(0)
  for (let i = 0; i < ctx.n; i++) {
    const g = bestGenes[i]
    if (g >= 0) pairScores[i] = Math.round(ctx.composite[i][g] * 100) / 100
  }

  const loads = computeLoads(ctx, bestGenes)
  const minInfeasibleSupervisorIds: number[] = []
  for (let s = 0; s < ctx.nSup; s++) {
    if (loads[s] < ctx.quotaMin[s]) minInfeasibleSupervisorIds.push(instance.supervisors[s].id)
  }

  return {
    assignment: Array.from(bestGenes),
    bestFitness,
    generationsRun,
    fitnessHistory,
    pairScores,
    minInfeasibleSupervisorIds,
  }
}
