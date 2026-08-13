/**
 * GA parameter-sensitivity experiment (O2/O6 evaluation plan: "test parameter
 * sensitivity"). Runs the shared engine over the live database instance
 * across a grid of objective weights, population sizes and mutation rates,
 * three seeds per configuration, plus the greedy baseline for reference.
 *
 * Output: docs/evaluation/ga-sensitivity-<date>.csv (one row per run) and a
 * per-configuration summary (mean over seeds) on stdout — the raw material
 * for the benchmark tables and plots in the evaluation chapter (D6).
 *
 * Usage: npm run experiment:sensitivity   (server must NOT be required; reads
 * the database directly through the same extraction code as the API.)
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildGaInstance } from "../src/ga/instance.js"
import { runBaseline } from "../src/ga/baselines.js"
import { pool } from "../src/db/client.js"
import { runGa } from "@shared/services/ga/engine"
import type { GaInstance, GaParams } from "@shared/services/ga/types"
import { DEFAULT_GA_PARAMS } from "@shared/services/ga/types"

const SEEDS = [1, 2, 3]
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/evaluation")

interface Config {
  group: string
  label: string
  weights: { preference: number; expertise: number; balance: number }
  population: number
  mutationRate: number
}

const D = DEFAULT_GA_PARAMS
const configs: Config[] = [
  // Weight sensitivity (population/mutation at defaults)
  { group: "weights", label: "pure-preference", weights: { preference: 1, expertise: 0, balance: 0 }, population: D.population, mutationRate: D.mutationRate },
  { group: "weights", label: "pure-expertise", weights: { preference: 0, expertise: 1, balance: 0 }, population: D.population, mutationRate: D.mutationRate },
  { group: "weights", label: "pure-balance", weights: { preference: 0, expertise: 0, balance: 1 }, population: D.population, mutationRate: D.mutationRate },
  { group: "weights", label: "default (0.5/0.3/0.2)", weights: D.weights, population: D.population, mutationRate: D.mutationRate },
  { group: "weights", label: "equal (1/3 each)", weights: { preference: 1 / 3, expertise: 1 / 3, balance: 1 / 3 }, population: D.population, mutationRate: D.mutationRate },
  // Population sensitivity (default weights/mutation)
  { group: "population", label: "population 50", weights: D.weights, population: 50, mutationRate: D.mutationRate },
  { group: "population", label: "population 200", weights: D.weights, population: 200, mutationRate: D.mutationRate },
  // Mutation sensitivity (default weights/population)
  { group: "mutation", label: "mutation 0.005", weights: D.weights, population: D.population, mutationRate: 0.005 },
  { group: "mutation", label: "mutation 0.05", weights: D.weights, population: D.population, mutationRate: 0.05 },
]

interface RunRow {
  group: string
  label: string
  wP: number
  wE: number
  wB: number
  population: number
  mutationRate: number
  seed: number | ""
  bestFitness: number | ""
  generationsRun: number | ""
  meanAssignedRank: number
  workloadVariance: number
  pctUnallocated: number
  runtimeMs: number
}

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
    meanAssignedRank: assigned > 0 ? Math.round((rankSum / assigned) * 1000) / 1000 : 0,
    workloadVariance: Math.round(variance * 100) / 100,
    pctUnallocated: Math.round(((n - assigned) / n) * 1000) / 10,
  }
}

const instance = await buildGaInstance()
const rows: RunRow[] = []

console.log(`Instance: ${instance.studentIds.length} students × ${instance.supervisors.length} supervisors\n`)

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
      group: config.group,
      label: config.label,
      wP: config.weights.preference,
      wE: config.weights.expertise,
      wB: config.weights.balance,
      population: config.population,
      mutationRate: config.mutationRate,
      seed,
      bestFitness: Math.round(result.bestFitness * 10000) / 10000,
      generationsRun: result.generationsRun,
      ...metrics(instance, result.assignment),
      runtimeMs,
    })
    process.stdout.write(".")
  }
}

// Greedy baseline reference row (deterministic — one run).
{
  const started = performance.now()
  const baseline = runBaseline(instance, "greedy-mock")
  rows.push({
    group: "baseline",
    label: "greedy",
    wP: 0,
    wE: 0,
    wB: 0,
    population: 0,
    mutationRate: 0,
    seed: "",
    bestFitness: "",
    generationsRun: "",
    ...metrics(instance, baseline.assignment),
    runtimeMs: Math.round(performance.now() - started),
  })
}
console.log("\n")

// CSV
const headers = Object.keys(rows[0]) as (keyof RunRow)[]
const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => row[h]).join(","))].join("\n")
mkdirSync(OUT_DIR, { recursive: true })
const outPath = resolve(OUT_DIR, `ga-sensitivity-${new Date().toISOString().slice(0, 10)}.csv`)
writeFileSync(outPath, csv + "\n")

// Per-configuration summary (mean over seeds)
console.log("config".padEnd(26), "fitness".padStart(8), "meanRank".padStart(9), "loadVar".padStart(8), "%unalloc".padStart(9), "gens".padStart(6), "ms".padStart(6))
for (const config of configs) {
  const group = rows.filter((r) => r.label === config.label)
  const avg = (fn: (r: RunRow) => number) => Math.round((group.reduce((s, r) => s + fn(r), 0) / group.length) * 1000) / 1000
  console.log(
    config.label.padEnd(26),
    String(avg((r) => Number(r.bestFitness))).padStart(8),
    String(avg((r) => r.meanAssignedRank)).padStart(9),
    String(avg((r) => r.workloadVariance)).padStart(8),
    String(avg((r) => r.pctUnallocated)).padStart(9),
    String(avg((r) => Number(r.generationsRun))).padStart(6),
    String(avg((r) => r.runtimeMs)).padStart(6),
  )
}
const baselineRow = rows[rows.length - 1]
console.log("greedy baseline".padEnd(26), "—".padStart(8), String(baselineRow.meanAssignedRank).padStart(9), String(baselineRow.workloadVariance).padStart(8), String(baselineRow.pctUnallocated).padStart(9), "—".padStart(6), String(baselineRow.runtimeMs).padStart(6))

console.log(`\nWrote ${rows.length} rows to ${outPath}`)
await pool.end()
