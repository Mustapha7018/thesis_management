/**
 * Full evaluation experiment (O6): 30 independent seeded runs per GA
 * configuration plus 30 seeded random-baseline runs and the deterministic
 * greedy baseline, over the live database instance. Every run is exactly
 * reproducible from its seed.
 *
 * Outputs (consumed by evaluation/analyze.py):
 *   docs/evaluation/experiments-runs.csv         one row per run
 *   docs/evaluation/experiments-convergence.csv  best fitness per generation
 *
 * Usage: npm run experiment:full   (~3 minutes)
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildGaInstance } from "../src/ga/instance.js"
import { runBaseline } from "../src/ga/baselines.js"
import { pool } from "../src/db/client.js"
import { runGa } from "@shared/services/ga/engine"
import { mulberry32 } from "@shared/services/ga/prng"
import type { GaInstance, GaParams } from "@shared/services/ga/types"
import { DEFAULT_GA_PARAMS } from "@shared/services/ga/types"

const N_SEEDS = 30
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => i + 1)
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/evaluation")

interface Config {
  group: "weights" | "population" | "mutation" | "default"
  config: string
  weights: { preference: number; expertise: number; balance: number }
  population: number
  mutationRate: number
}

const D = DEFAULT_GA_PARAMS
// The default configuration is its own group and is re-used as the middle
// level of the population and mutation families during analysis.
const configs: Config[] = [
  { group: "default", config: "default", weights: D.weights, population: D.population, mutationRate: D.mutationRate },
  { group: "weights", config: "pure-preference", weights: { preference: 1, expertise: 0, balance: 0 }, population: D.population, mutationRate: D.mutationRate },
  { group: "weights", config: "pure-expertise", weights: { preference: 0, expertise: 1, balance: 0 }, population: D.population, mutationRate: D.mutationRate },
  { group: "weights", config: "pure-balance", weights: { preference: 0, expertise: 0, balance: 1 }, population: D.population, mutationRate: D.mutationRate },
  { group: "weights", config: "equal-weights", weights: { preference: 1 / 3, expertise: 1 / 3, balance: 1 / 3 }, population: D.population, mutationRate: D.mutationRate },
  { group: "population", config: "population-50", weights: D.weights, population: 50, mutationRate: D.mutationRate },
  { group: "population", config: "population-200", weights: D.weights, population: 200, mutationRate: D.mutationRate },
  { group: "mutation", config: "mutation-0.005", weights: D.weights, population: D.population, mutationRate: 0.005 },
  { group: "mutation", config: "mutation-0.05", weights: D.weights, population: D.population, mutationRate: 0.05 },
]

function metrics(instance: GaInstance, assignment: number[]) {
  const loads = new Array<number>(instance.supervisors.length).fill(0)
  let rankSum = 0
  let assigned = 0
  assignment.forEach((gene, i) => {
    if (gene < 0) return
    const pref = instance.prefs[i][gene]
    loads[pref.supIdx]++
    rankSum += pref.rank
    assigned++
  })
  const mean = loads.reduce((s, c) => s + c, 0) / loads.length
  const variance = loads.reduce((s, c) => s + (c - mean) ** 2, 0) / loads.length
  const n = instance.studentIds.length
  return {
    meanRank: assigned > 0 ? rankSum / assigned : 0,
    workloadVariance: variance,
    pctUnallocated: ((n - assigned) / n) * 100,
  }
}

interface RunRow extends Record<string, string | number> {
  algorithm: string
  group: string
  config: string
  wP: number
  wE: number
  wB: number
  population: number
  mutationRate: number
  seed: number
  bestFitness: number | ""
  generationsRun: number | ""
  meanRank: number
  workloadVariance: number
  pctUnallocated: number
  runtimeMs: number
}

const instance = await buildGaInstance()
console.log(`Instance: ${instance.studentIds.length} students × ${instance.supervisors.length} supervisors`)
console.log(`Running ${configs.length} GA configs × ${N_SEEDS} seeds + ${N_SEEDS} random + greedy…`)

const rows: RunRow[] = []
const convergence: { config: string; seed: number; generation: number; bestFitness: number }[] = []

for (const config of configs) {
  for (const seed of SEEDS) {
    const params: GaParams = {
      weights: config.weights,
      seed,
      population: config.population,
      generations: D.generations,
      mutationRate: config.mutationRate,
      elitism: D.elitism,
      stagnationWindow: D.stagnationWindow,
    }
    const started = performance.now()
    const result = runGa(instance, params)
    const runtimeMs = Math.round(performance.now() - started)
    rows.push({
      algorithm: "ga",
      group: config.group,
      config: config.config,
      wP: config.weights.preference,
      wE: config.weights.expertise,
      wB: config.weights.balance,
      population: config.population,
      mutationRate: config.mutationRate,
      seed,
      bestFitness: result.bestFitness,
      generationsRun: result.generationsRun,
      ...metrics(instance, result.assignment),
      runtimeMs,
    })
    result.fitnessHistory.forEach((best, generation) => {
      convergence.push({ config: config.config, seed, generation: generation + 1, bestFitness: best })
    })
  }
  process.stdout.write(`  ${config.config} done\n`)
}

for (const seed of SEEDS) {
  const started = performance.now()
  const result = runBaseline(instance, "random", mulberry32(seed))
  rows.push({
    algorithm: "random",
    group: "baseline",
    config: "random-baseline",
    wP: 0,
    wE: 0,
    wB: 0,
    population: 0,
    mutationRate: 0,
    seed,
    bestFitness: "",
    generationsRun: "",
    ...metrics(instance, result.assignment),
    runtimeMs: Math.round(performance.now() - started),
  })
}
{
  const started = performance.now()
  const result = runBaseline(instance, "greedy-mock")
  rows.push({
    algorithm: "greedy",
    group: "baseline",
    config: "greedy-baseline",
    wP: 0,
    wE: 0,
    wB: 0,
    population: 0,
    mutationRate: 0,
    seed: 0,
    bestFitness: "",
    generationsRun: "",
    ...metrics(instance, result.assignment),
    runtimeMs: Math.round(performance.now() - started),
  })
}

mkdirSync(OUT_DIR, { recursive: true })
const runHeaders = Object.keys(rows[0])
writeFileSync(
  resolve(OUT_DIR, "experiments-runs.csv"),
  [runHeaders.join(","), ...rows.map((r) => runHeaders.map((h) => r[h]).join(","))].join("\n") + "\n",
)
writeFileSync(
  resolve(OUT_DIR, "experiments-convergence.csv"),
  ["config,seed,generation,bestFitness", ...convergence.map((c) => `${c.config},${c.seed},${c.generation},${c.bestFitness}`)].join(
    "\n",
  ) + "\n",
)

console.log(`Wrote ${rows.length} run rows and ${convergence.length} convergence rows to ${OUT_DIR}`)
await pool.end()
