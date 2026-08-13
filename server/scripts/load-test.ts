/**
 * Latency + load benchmark (NFR-PERF-02/03) using autocannon.
 *
 * Two phases against a running server (LOG_LEVEL=warn recommended):
 *   1. Interactive latency — 10 concurrent connections per endpoint class,
 *      checking NFR-PERF-02: p95 <= 500 ms for CRUD, <= 2 s for dashboard
 *      aggregates.
 *   2. Concurrency — 300 concurrent connections on representative endpoints,
 *      checking NFR-PERF-03: 300 concurrent users within the same targets.
 *
 * Login (argon2 verification, deliberately expensive) is measured separately
 * and excluded from the CRUD claim — password hashing cost is a security
 * feature, not an interactive-latency defect.
 *
 * Outputs docs/evaluation/latency-load.csv and latency-load.md including the
 * exact hardware/software environment, so results are citable.
 *
 * Usage:
 *   LOG_LEVEL=warn PG_POOL_MAX=20 npx tsx src/index.ts   (separate terminal)
 *   npm run experiment:load
 */
import { mkdirSync, writeFileSync } from "node:fs"
import os from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import autocannon from "autocannon"
import pg from "pg"

const BASE = process.env.BASE_URL ?? "http://localhost:3001"
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/evaluation")
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Password123!"

async function login(email: string): Promise<{ token: string; ref_id: number | null }> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`)
  const body = (await res.json()) as { token: string; session: { ref_id: number | null } }
  return { token: body.token, ref_id: body.session.ref_id }
}

interface Scenario {
  name: string
  class: "crud-read" | "crud-write" | "aggregate" | "auth"
  method: "GET" | "PATCH"
  path: string
  token: string
  body?: unknown
  connections: number
  /** p95 target in ms (NFR-PERF-02); auth has no target (documented separately). */
  targetP95: number | null
}

interface ResultRow extends Record<string, string | number> {
  phase: string
  scenario: string
  class: string
  connections: number
  duration_s: number
  requests_per_s: number
  latency_avg_ms: number
  latency_p50_ms: number
  latency_p90_ms: number
  latency_p97_5_ms: number
  latency_p99_ms: number
  latency_max_ms: number
  non_2xx: number
  target_p95_ms: number | ""
  pass: string
}

async function run(phase: string, scenario: Scenario, durationSeconds: number): Promise<ResultRow> {
  const result = await autocannon({
    url: `${BASE}${scenario.path}`,
    method: scenario.method,
    connections: scenario.connections,
    duration: durationSeconds,
    headers: {
      Authorization: `Bearer ${scenario.token}`,
      ...(scenario.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: scenario.body !== undefined ? JSON.stringify(scenario.body) : undefined,
  })
  // autocannon reports fixed percentiles (p90, p97.5, p99); the NFR p95 target
  // is assessed against p97.5, which is conservative: p95 <= p97.5.
  const p975 = result.latency.p97_5
  const pass = scenario.targetP95 === null ? "n/a" : p975 <= scenario.targetP95 ? "PASS" : "FAIL"
  process.stdout.write(
    `  [${phase}] ${scenario.name}: p97.5 ${p975}ms, ${Math.round(result.requests.average)} req/s, non-2xx ${result.non2xx}\n`,
  )
  return {
    phase,
    scenario: scenario.name,
    class: scenario.class,
    connections: scenario.connections,
    duration_s: durationSeconds,
    requests_per_s: Math.round(result.requests.average),
    latency_avg_ms: result.latency.average,
    latency_p50_ms: result.latency.p50,
    latency_p90_ms: result.latency.p90,
    latency_p97_5_ms: result.latency.p97_5,
    latency_p99_ms: result.latency.p99,
    latency_max_ms: result.latency.max,
    non_2xx: result.non2xx,
    target_p95_ms: scenario.targetP95 ?? "",
    pass,
  }
}

// ---------------------------------------------------------------------------
// Setup: tokens, a published run (worst-case dashboards), a task to PATCH.
// ---------------------------------------------------------------------------

const admin = await login("jordan.blake@sunderland.ac.uk")
const student = await login("gvn1d6@student.sunderland.ac.uk")
const supervisor = await login("fatima.diallo@sunderland.ac.uk")

const authed = (token: string) => ({ Authorization: `Bearer ${token}`, "content-type": "application/json" })

const benchmarks = (await (
  await fetch(`${BASE}/api/v1/allocation-runs/benchmarks`, { headers: authed(admin.token) })
).json()) as { run_id: string; published: boolean }[]
if (!benchmarks.some((r) => r.published)) {
  const runRes = (await (
    await fetch(`${BASE}/api/v1/allocation-runs`, {
      method: "POST",
      headers: authed(admin.token),
      body: JSON.stringify({ algorithm: "greedy-mock" }),
    })
  ).json()) as { summary: { run_id: string } }
  await fetch(`${BASE}/api/v1/allocation-runs/${runRes.summary.run_id}/publish`, {
    method: "POST",
    headers: authed(admin.token),
  })
  console.log("Published a greedy run for dashboard scenarios.")
}

const task = (await (
  await fetch(`${BASE}/api/v1/students/${student.ref_id}/tasks`, {
    method: "POST",
    headers: authed(student.token),
    body: JSON.stringify({ title: "Load-test task", priority: "low" }),
  })
).json()) as { task_id: number }

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const CRUD_TARGET = 500
const AGGREGATE_TARGET = 2000

const interactive: Scenario[] = [
  { name: "GET /research-areas", class: "crud-read", method: "GET", path: "/api/v1/research-areas", token: student.token, connections: 10, targetP95: CRUD_TARGET },
  { name: "GET /admin/users?page=1", class: "crud-read", method: "GET", path: "/api/v1/admin/users?page=1", token: admin.token, connections: 10, targetP95: CRUD_TARGET },
  { name: "GET /students/:id/tasks", class: "crud-read", method: "GET", path: `/api/v1/students/${student.ref_id}/tasks`, token: student.token, connections: 10, targetP95: CRUD_TARGET },
  { name: "GET /meetings?studentId", class: "crud-read", method: "GET", path: `/api/v1/meetings?studentId=${student.ref_id}`, token: student.token, connections: 10, targetP95: CRUD_TARGET },
  { name: "GET /supervisors/:id/applicants", class: "crud-read", method: "GET", path: `/api/v1/supervisors/${supervisor.ref_id}/applicants`, token: supervisor.token, connections: 10, targetP95: CRUD_TARGET },
  { name: "PATCH /tasks/:id", class: "crud-write", method: "PATCH", path: `/api/v1/tasks/${task.task_id}`, token: student.token, body: { status: "in_progress" }, connections: 10, targetP95: CRUD_TARGET },
  { name: "GET /admin/cohort-overview", class: "aggregate", method: "GET", path: "/api/v1/admin/cohort-overview?page=1", token: admin.token, connections: 10, targetP95: AGGREGATE_TARGET },
  { name: "GET /supervisors/:id/cohort", class: "aggregate", method: "GET", path: `/api/v1/supervisors/${supervisor.ref_id}/cohort`, token: supervisor.token, connections: 10, targetP95: AGGREGATE_TARGET },
  { name: "GET /allocation-runs/benchmarks", class: "aggregate", method: "GET", path: "/api/v1/allocation-runs/benchmarks", token: admin.token, connections: 10, targetP95: AGGREGATE_TARGET },
]

const concurrency: Scenario[] = [
  { name: "GET /research-areas @300", class: "crud-read", method: "GET", path: "/api/v1/research-areas", token: student.token, connections: 300, targetP95: CRUD_TARGET },
  { name: "GET /students/:id/tasks @300", class: "crud-read", method: "GET", path: `/api/v1/students/${student.ref_id}/tasks`, token: student.token, connections: 300, targetP95: CRUD_TARGET },
  { name: "GET /admin/cohort-overview @300", class: "aggregate", method: "GET", path: "/api/v1/admin/cohort-overview?page=1", token: admin.token, connections: 300, targetP95: AGGREGATE_TARGET },
]

console.log("Phase 1: interactive latency (10 connections, 10 s each)…")
const rows: ResultRow[] = []
for (const scenario of interactive) rows.push(await run("interactive", scenario, 10))

console.log("Phase 2: concurrency (300 connections, 15 s each)…")
for (const scenario of concurrency) rows.push(await run("300-concurrent", scenario, 15))

// ---------------------------------------------------------------------------
// Environment capture + outputs
// ---------------------------------------------------------------------------

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/thesis_management",
})
await client.connect()
const pgVersion = (await client.query("select version()")).rows[0].version as string
await client.end()

const env = {
  date: new Date().toISOString(),
  tool: `autocannon ${(await import("autocannon/package.json", { with: { type: "json" } })).default.version}`,
  node: process.version,
  os: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: `${os.cpus()[0].model} × ${os.cpus().length}`,
  memory_gb: Math.round(os.totalmem() / 1024 ** 3),
  postgres: pgVersion.split(" on ")[0],
  server_mode: "tsx, LOG_LEVEL=warn",
  pool_max: process.env.PG_POOL_MAX ?? "(server default)",
  dataset: "500 students × 32 supervisors, published greedy run, flag engine active",
}

mkdirSync(OUT_DIR, { recursive: true })
const headers = Object.keys(rows[0])
writeFileSync(
  resolve(OUT_DIR, "latency-load.csv"),
  [headers.join(","), ...rows.map((r) => headers.map((h) => r[h]).join(","))].join("\n") + "\n",
)

const md = [
  "# Latency and load test results (NFR-PERF-02 / NFR-PERF-03)",
  "",
  "## Environment",
  "",
  ...Object.entries(env).map(([k, v]) => `- **${k}**: ${v}`),
  "",
  "Targets: p95 ≤ 500 ms (CRUD), p95 ≤ 2000 ms (dashboard aggregates); 300 concurrent connections within the same targets.",
  "autocannon reports fixed percentiles (p90 / p97.5 / p99); the p95 target is assessed against **p97.5**, which is conservative since p95 ≤ p97.5.",
  "",
  "| phase | scenario | class | conn | req/s | avg ms | p50 ms | p90 ms | p97.5 ms | p99 ms | max ms | non-2xx | target p95 | result |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.phase} | ${r.scenario} | ${r.class} | ${r.connections} | ${r.requests_per_s} | ${r.latency_avg_ms} | ${r.latency_p50_ms} | ${r.latency_p90_ms} | ${r.latency_p97_5_ms} | ${r.latency_p99_ms} | ${r.latency_max_ms} | ${r.non_2xx} | ${r.target_p95_ms} | ${r.pass} |`,
  ),
  "",
  "Login is excluded from the CRUD class: argon2 verification is deliberately CPU-expensive (a security property, FR-AUTH-03/NFR-SEC-01).",
  "",
].join("\n")
writeFileSync(resolve(OUT_DIR, "latency-load.md"), md)

const failed = rows.filter((r) => r.pass === "FAIL")
console.log(`\nWrote latency-load.{csv,md} to ${OUT_DIR}`)
console.log(failed.length === 0 ? "All scenarios within NFR targets." : `${failed.length} scenario(s) FAILED targets.`)
