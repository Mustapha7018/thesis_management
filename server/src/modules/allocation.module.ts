/**
 * Allocation reads, benchmarks, publish and baseline runs
 * (FR-ALLOC-03/04/05/06/07). GA runs are asynchronous jobs — see
 * jobs.module.ts.
 */
import { asc, desc, eq } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { db } from "../db/client.js"
import {
  allocationRuns,
  allocations,
  researchAreas,
  studentInterests,
  studentPreferences,
  students,
  supervisorExpertise,
  supervisorPreferences,
  supervisors,
} from "../db/schema.js"
import { badRequest, notFound } from "../lib/errors.js"
import { listQuerySchema, paginate } from "../lib/http.js"
import { writeAudit } from "../lib/audit.js"
import { assertSelfOr, requireRole } from "../plugins/auth.js"
import { buildGaInstance } from "../ga/instance.js"
import { runBaseline } from "../ga/baselines.js"
import { persistRun } from "../ga/persist.js"
import { startGaJob } from "../ga/job-registry.js"
import { DEFAULT_GA_PARAMS } from "@shared/services/ga/types"

async function getPublishedRun() {
  return db.query.allocationRuns.findFirst({ where: eq(allocationRuns.published, true) })
}

async function nameMaps() {
  const [studentRows, supervisorRows] = await Promise.all([db.select().from(students), db.select().from(supervisors)])
  return {
    studentName: new Map(studentRows.map((s) => [s.student_id, `${s.first_name} ${s.last_name}`])),
    supervisorName: new Map(supervisorRows.map((s) => [s.supervisor_id, `${s.title} ${s.first_name} ${s.last_name}`])),
  }
}

const gaParamsSchema = z.object({
  weights: z.object({
    preference: z.number().min(0),
    expertise: z.number().min(0),
    balance: z.number().min(0),
  }),
  seed: z.number().int(),
  population: z.number().int().min(2).default(DEFAULT_GA_PARAMS.population),
  generations: z.number().int().min(1).default(DEFAULT_GA_PARAMS.generations),
  mutationRate: z.number().min(0).max(1).default(DEFAULT_GA_PARAMS.mutationRate),
  elitism: z.number().int().min(0).default(DEFAULT_GA_PARAMS.elitism),
  stagnationWindow: z.number().int().min(1).default(DEFAULT_GA_PARAMS.stagnationWindow),
})

export const allocationModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()
  const adminOnly = { preHandler: requireRole("admin") }

  app.get(
    "/students/:id/allocation",
    { schema: { tags: ["allocation"], params: z.object({ id: z.coerce.number().int() }) } },
    async (req) => {
      assertSelfOr(req, "student", req.params.id)
      const run = await getPublishedRun()
      if (!run) return null
      const allocation = await db.query.allocations.findFirst({
        where: (a, { and: andOp, eq: eqOp }) => andOp(eqOp(a.run_id, run.run_id), eqOp(a.student_id, req.params.id)),
      })
      if (!allocation) return null
      const names = await nameMaps()
      return {
        allocation_id: allocation.allocation_id,
        run_id: allocation.run_id,
        algorithm: allocation.algorithm,
        student_id: allocation.student_id,
        student_name: names.studentName.get(allocation.student_id) ?? "Unknown student",
        supervisor_id: allocation.supervisor_id,
        supervisor_name: names.supervisorName.get(allocation.supervisor_id) ?? "Unknown supervisor",
        objective_score: allocation.objective_score,
        published: true,
      }
    },
  )

  app.get(
    "/supervisors/:id/allocations",
    {
      schema: {
        tags: ["allocation"],
        params: z.object({ id: z.coerce.number().int() }),
        querystring: listQuerySchema,
      },
    },
    async (req) => {
      assertSelfOr(req, "supervisor", req.params.id)
      const run = await getPublishedRun()
      if (!run) return { data: [], total: 0, page: req.query.page, limit: req.query.limit }
      const rows = await db
        .select()
        .from(allocations)
        .where(eq(allocations.run_id, run.run_id))
      const names = await nameMaps()
      const mine = rows
        .filter((a) => a.supervisor_id === req.params.id)
        .map((a) => ({
          allocation_id: a.allocation_id,
          run_id: a.run_id,
          algorithm: a.algorithm,
          student_id: a.student_id,
          student_name: names.studentName.get(a.student_id) ?? "Unknown student",
          supervisor_id: a.supervisor_id,
          supervisor_name: names.supervisorName.get(a.supervisor_id) ?? "Unknown supervisor",
          objective_score: a.objective_score,
          published: true,
        }))
      return paginate(mine, req.query.page, req.query.limit)
    },
  )

  app.get(
    "/allocations/:allocationId/explanation",
    { schema: { tags: ["allocation"], params: z.object({ allocationId: z.coerce.number().int() }) } },
    async (req) => {
      const allocation = await db.query.allocations.findFirst({
        where: eq(allocations.allocation_id, req.params.allocationId),
      })
      if (!allocation) throw notFound("Allocation not found.")
      // A student may explain their own pairing, a supervisor theirs, an admin any.
      if (req.user.role === "student") assertSelfOr(req, "student", allocation.student_id)
      if (req.user.role === "supervisor") assertSelfOr(req, "supervisor", allocation.supervisor_id)

      const [pref, score, interests, expertise, areas] = await Promise.all([
        db.query.studentPreferences.findFirst({
          where: (p, { and: andOp, eq: eqOp }) =>
            andOp(eqOp(p.student_id, allocation.student_id), eqOp(p.supervisor_id, allocation.supervisor_id)),
        }),
        db.query.supervisorPreferences.findFirst({
          where: (sp, { and: andOp, eq: eqOp }) =>
            andOp(eqOp(sp.supervisor_id, allocation.supervisor_id), eqOp(sp.student_id, allocation.student_id)),
        }),
        db.select().from(studentInterests).where(eq(studentInterests.student_id, allocation.student_id)),
        db.select().from(supervisorExpertise).where(eq(supervisorExpertise.supervisor_id, allocation.supervisor_id)),
        db.select().from(researchAreas),
      ])
      const areaName = new Map(areas.map((a) => [a.area_id, a.name]))
      const studentAreaIds = new Set(interests.map((i) => i.area_id))
      const sharedAreaNames = expertise.filter((e) => studentAreaIds.has(e.area_id)).map((e) => areaName.get(e.area_id) ?? "Unknown")

      const studentRank = pref?.rank ?? null
      const supervisorScore = score?.score ?? null
      const rankText = studentRank ? `ranked this supervisor #${studentRank}` : "did not rank this supervisor"
      const scoreText = supervisorScore !== null ? `scored this student ${supervisorScore.toFixed(2)}` : "did not score this student"
      const areaText = sharedAreaNames.length > 0 ? `shared research interest in ${sharedAreaNames.join(", ")}` : "no directly shared research area"

      return {
        allocation_id: allocation.allocation_id,
        student_rank: studentRank,
        supervisor_score: supervisorScore,
        shared_area_names: sharedAreaNames,
        objective_score: allocation.objective_score,
        summary: `The student ${rankText}; the supervisor ${scoreText}. They have ${areaText}.`,
      }
    },
  )

  app.get("/allocation-runs/benchmarks", { ...adminOnly, schema: { tags: ["allocation"] } }, async () => {
    const [runs, allocationRows, prefs, supervisorRows] = await Promise.all([
      db.select().from(allocationRuns).orderBy(desc(allocationRuns.created_at)),
      db.select().from(allocations),
      db.select().from(studentPreferences),
      db.select().from(supervisors).orderBy(asc(supervisors.supervisor_id)),
    ])
    const rankByPair = new Map(prefs.map((p) => [`${p.student_id}:${p.supervisor_id}`, p.rank]))

    return runs.map((run) => {
      const rows = allocationRows.filter((a) => a.run_id === run.run_id)
      const ranks = rows
        .map((a) => rankByPair.get(`${a.student_id}:${a.supervisor_id}`))
        .filter((r): r is number => r !== undefined)
      const meanRank = ranks.length > 0 ? ranks.reduce((s, r) => s + r, 0) / ranks.length : null

      const countsBySupervisor = new Map<number, number>()
      for (const a of rows) countsBySupervisor.set(a.supervisor_id, (countsBySupervisor.get(a.supervisor_id) ?? 0) + 1)
      const counts = supervisorRows.map((s) => countsBySupervisor.get(s.supervisor_id) ?? 0)
      const mean = counts.length > 0 ? counts.reduce((s, c) => s + c, 0) / counts.length : 0
      const variance = counts.length > 0 ? counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length : 0

      return {
        run_id: run.run_id,
        algorithm: run.algorithm,
        label: run.label,
        mean_satisfied_rank: meanRank !== null ? Math.round(meanRank * 100) / 100 : null,
        workload_variance: Math.round(variance * 100) / 100,
        percent_unallocated:
          run.instance_size > 0 ? Math.round(((run.instance_size - rows.length) / run.instance_size) * 1000) / 10 : 0,
        runtime_ms: run.runtime_ms ?? 0,
        published: run.published,
        created_at: run.created_at,
      }
    })
  })

  app.get(
    "/allocation-runs/:runId/violations",
    { ...adminOnly, schema: { tags: ["allocation"], params: z.object({ runId: z.string() }) } },
    async (req) => {
      const [rows, supervisorRows] = await Promise.all([
        db.select().from(allocations).where(eq(allocations.run_id, req.params.runId)),
        db.select().from(supervisors),
      ])
      const counts = new Map<number, number>()
      for (const a of rows) counts.set(a.supervisor_id, (counts.get(a.supervisor_id) ?? 0) + 1)
      const violations = []
      for (const s of supervisorRows) {
        const assigned = counts.get(s.supervisor_id) ?? 0
        if (assigned > s.quota_max) {
          violations.push({ supervisor_id: s.supervisor_id, assigned, quota_min: s.quota_min, quota_max: s.quota_max, kind: "over_max" as const })
        } else if (assigned < s.quota_min) {
          violations.push({ supervisor_id: s.supervisor_id, assigned, quota_min: s.quota_min, quota_max: s.quota_max, kind: "under_min" as const })
        }
      }
      return violations
    },
  )

  app.get(
    "/allocation-runs/:runId/rows",
    { ...adminOnly, schema: { tags: ["allocation"], params: z.object({ runId: z.string() }) } },
    async (req) => {
      const [rows, prefs, scores, names] = await Promise.all([
        db.select().from(allocations).where(eq(allocations.run_id, req.params.runId)),
        db.select().from(studentPreferences),
        db.select().from(supervisorPreferences),
        nameMaps(),
      ])
      const rankByPair = new Map(prefs.map((p) => [`${p.student_id}:${p.supervisor_id}`, p.rank]))
      const scoreByPair = new Map(scores.map((s) => [`${s.student_id}:${s.supervisor_id}`, s.score]))
      return rows.map((a) => ({
        run_id: a.run_id,
        algorithm: a.algorithm,
        student_id: a.student_id,
        student_name: names.studentName.get(a.student_id) ?? "Unknown student",
        supervisor_id: a.supervisor_id,
        supervisor_name: names.supervisorName.get(a.supervisor_id) ?? "Unknown supervisor",
        student_rank: rankByPair.get(`${a.student_id}:${a.supervisor_id}`) ?? "",
        supervisor_score: scoreByPair.get(`${a.student_id}:${a.supervisor_id}`) ?? "",
        objective_score: a.objective_score ?? "",
      }))
    },
  )

  app.post(
    "/allocation-runs/:runId/publish",
    { ...adminOnly, schema: { tags: ["allocation"], params: z.object({ runId: z.string() }) } },
    async (req) => {
      const run = await db.query.allocationRuns.findFirst({ where: eq(allocationRuns.run_id, req.params.runId) })
      if (!run) throw notFound("Run not found.")
      await db.transaction(async (tx) => {
        await tx.update(allocationRuns).set({ published: false }).where(eq(allocationRuns.published, true))
        await tx.update(allocationRuns).set({ published: true }).where(eq(allocationRuns.run_id, run.run_id))
        await writeAudit(tx, "role_change", req.user.email, `Published allocation run ${run.run_id}.`)
      })
      return { ok: true }
    },
  )

  app.get("/allocation/feasibility", { ...adminOnly, schema: { tags: ["allocation"] } }, async () => {
    const { findInfeasibleQuotaMins } = await import("../ga/instance.js")
    const instance = await buildGaInstance()
    return { infeasible_supervisor_ids: findInfeasibleQuotaMins(instance) }
  })

  /**
   * Manual baseline (FR-ALLOC-04): an admin records a hand-made allocation
   * (e.g. from a departmental spreadsheet), persisted identically to
   * algorithmic runs so it appears in the same benchmarks.
   */
  app.post(
    "/allocation-runs/manual",
    {
      ...adminOnly,
      schema: {
        tags: ["allocation"],
        body: z.object({
          label: z.string().min(1).max(80).default("Manual baseline"),
          pairs: z
            .array(z.object({ student_id: z.number().int(), supervisor_id: z.number().int() }))
            .min(1)
            .max(1000),
        }),
      },
    },
    async (req, reply) => {
      const { label, pairs } = req.body

      const seenStudents = new Set<number>()
      for (const pair of pairs) {
        if (seenStudents.has(pair.student_id)) {
          throw badRequest(`Student ${pair.student_id} appears more than once.`)
        }
        seenStudents.add(pair.student_id)
      }

      const [studentRows, supervisorRows, prefs, scores] = await Promise.all([
        db.select({ id: students.student_id }).from(students),
        db.select({ id: supervisors.supervisor_id }).from(supervisors),
        db.select().from(studentPreferences),
        db.select().from(supervisorPreferences),
      ])
      const studentIds = new Set(studentRows.map((s) => s.id))
      const supervisorIds = new Set(supervisorRows.map((s) => s.id))
      for (const pair of pairs) {
        if (!studentIds.has(pair.student_id)) throw badRequest(`Unknown student_id ${pair.student_id}.`)
        if (!supervisorIds.has(pair.supervisor_id)) throw badRequest(`Unknown supervisor_id ${pair.supervisor_id}.`)
      }

      const rankByPair = new Map(prefs.map((p) => [`${p.student_id}:${p.supervisor_id}`, p.rank]))
      const scoreByPair = new Map(scores.map((s) => [`${s.student_id}:${s.supervisor_id}`, s.score]))
      const runId = `run-${new Date().toISOString().slice(0, 10)}-manual-${Date.now()}`
      const createdAt = new Date().toISOString()

      await db.transaction(async (tx) => {
        await tx.insert(allocationRuns).values({
          run_id: runId,
          algorithm: "manual",
          label,
          created_at: createdAt,
          published: false,
          instance_size: studentIds.size,
          runtime_ms: null, // human-entered — no algorithm runtime
          params: null,
        })
        for (let i = 0; i < pairs.length; i += 500) {
          await tx.insert(allocations).values(
            pairs.slice(i, i + 500).map((pair) => {
              const rank = rankByPair.get(`${pair.student_id}:${pair.supervisor_id}`)
              const score = scoreByPair.get(`${pair.student_id}:${pair.supervisor_id}`)
              return {
                run_id: runId,
                algorithm: "manual",
                student_id: pair.student_id,
                supervisor_id: pair.supervisor_id,
                // Off-list pairings have no preference data to score against.
                objective_score:
                  rank !== undefined ? Math.round((((6 - rank) / 5 + (score ?? 0)) / 2) * 100) / 100 : null,
                created_at: createdAt,
              }
            }),
          )
        }
        await writeAudit(tx, "allocation_run", req.user.email, `Recorded manual allocation ${runId} (${pairs.length} pairings).`)
      })

      return reply.status(200).send({
        kind: "completed" as const,
        summary: { run_id: runId, runtime_ms: 0, instance_size: studentIds.size, allocated_count: pairs.length },
      })
    },
  )

  app.post(
    "/allocation-runs",
    {
      ...adminOnly,
      schema: {
        tags: ["allocation"],
        body: z.discriminatedUnion("algorithm", [
          z.object({ algorithm: z.enum(["greedy-mock", "random"]) }),
          z.object({ algorithm: z.literal("ga"), params: gaParamsSchema }),
        ]),
      },
    },
    async (req, reply) => {
      const instance = await buildGaInstance()

      if (req.body.algorithm !== "ga") {
        const started = performance.now()
        const result = runBaseline(instance, req.body.algorithm)
        const summary = await persistRun({
          instance,
          algorithm: req.body.algorithm,
          label: req.body.algorithm === "greedy-mock" ? "Greedy baseline" : "Random baseline",
          params: null,
          assignment: result.assignment,
          pairScores: result.pairScores,
          runtimeMs: Math.round(performance.now() - started),
          actorEmail: req.user.email,
        })
        return reply.status(200).send({ kind: "completed" as const, summary })
      }

      const params = req.body.params
      const weightSum = params.weights.preference + params.weights.expertise + params.weights.balance
      if (weightSum <= 0) throw badRequest("Objective weights must sum to a positive value.")
      if (params.elitism >= params.population) throw badRequest("Elitism must be smaller than the population size.")

      const jobId = startGaJob(instance, params, req.user.email)
      return reply.status(202).send({ kind: "job" as const, job_id: jobId })
    },
  )
}
