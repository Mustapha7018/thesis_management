/**
 * Dashboards + at-risk flag lifecycle (FR-DASH-01..03). Flag review/clear
 * now records actor + timestamp server-side (previously client-only state).
 */
import { desc, eq } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { db } from "../db/client.js"
import { allocationRuns, allocations, atRiskFlags, meetings, milestones, students, supervisors } from "../db/schema.js"
import { forbidden, notFound } from "../lib/errors.js"
import { listQuerySchema, nowIso, paginate } from "../lib/http.js"
import { assertSelfOr, requireRole } from "../plugins/auth.js"
import { computeProgress } from "./agile.module.js"
import { evaluateAtRiskFlags } from "./flag-rules.js"

async function publishedAllocations() {
  const run = await db.query.allocationRuns.findFirst({ where: eq(allocationRuns.published, true) })
  if (!run) return []
  return db.select().from(allocations).where(eq(allocations.run_id, run.run_id))
}

type FlagRow = typeof atRiskFlags.$inferSelect

const toFlagView = (f: FlagRow) => ({
  flag_id: f.flag_id,
  student_id: f.student_id,
  rule_code: f.rule_code,
  reason: f.cleared_note ? `${f.reason} — cleared: ${f.cleared_note}` : f.reason,
  raised_at: f.raised_at,
  cleared_at: f.cleared_at,
  reviewed: f.reviewed_at !== null,
})

async function buildCohortSummary(studentId: number, supervisorId: number) {
  const [student, supervisor, progress, flags] = await Promise.all([
    db.query.students.findFirst({ where: eq(students.student_id, studentId) }),
    db.query.supervisors.findFirst({ where: eq(supervisors.supervisor_id, supervisorId) }),
    computeProgress(studentId),
    db.select().from(atRiskFlags).where(eq(atRiskFlags.student_id, studentId)),
  ])
  return {
    student_id: studentId,
    student_name: student ? `${student.first_name} ${student.last_name}` : "Unknown student",
    programme: student?.programme ?? "",
    supervisor_id: supervisorId,
    supervisor_name: supervisor ? `${supervisor.title} ${supervisor.first_name} ${supervisor.last_name}` : "Unknown supervisor",
    progress,
    active_flag_count: flags.filter((f) => f.cleared_at === null).length,
  }
}

export const dashboardModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()

  app.get(
    "/supervisors/:id/cohort",
    {
      schema: { tags: ["dashboard"], params: z.object({ id: z.coerce.number().int() }), querystring: listQuerySchema },
    },
    async (req) => {
      assertSelfOr(req, "supervisor", req.params.id)
      await evaluateAtRiskFlags()
      const rows = await publishedAllocations()
      const mine = rows.filter((a) => a.supervisor_id === req.params.id)
      const summaries = await Promise.all(mine.map((a) => buildCohortSummary(a.student_id, a.supervisor_id)))
      return paginate(summaries, req.query.page, req.query.limit)
    },
  )

  app.get(
    "/admin/cohort-overview",
    {
      preHandler: requireRole("admin"),
      schema: { tags: ["dashboard"], querystring: listQuerySchema.extend({ search: z.string().optional() }) },
    },
    async (req) => {
      await evaluateAtRiskFlags()
      let rows = await publishedAllocations()

      const needle = req.query.search?.trim().toLowerCase()
      if (needle) {
        // Search by student or supervisor name/email before paginating.
        const [studentRows, supervisorRows] = await Promise.all([
          db.select().from(students),
          db.select().from(supervisors),
        ])
        const studentText = new Map(
          studentRows.map((s) => [s.student_id, `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase()]),
        )
        const supervisorText = new Map(
          supervisorRows.map((s) => [s.supervisor_id, `${s.title} ${s.first_name} ${s.last_name} ${s.email}`.toLowerCase()]),
        )
        rows = rows.filter(
          (a) =>
            (studentText.get(a.student_id) ?? "").includes(needle) ||
            (supervisorText.get(a.supervisor_id) ?? "").includes(needle),
        )
      }

      // Paginate BEFORE aggregating so a 500-student overview stays fast.
      const page = paginate(rows, req.query.page, req.query.limit)
      const summaries = await Promise.all(page.data.map((a) => buildCohortSummary(a.student_id, a.supervisor_id)))
      return { ...page, data: summaries }
    },
  )

  app.get(
    "/students/:id/detail",
    { schema: { tags: ["dashboard"], params: z.object({ id: z.coerce.number().int() }) } },
    async (req) => {
      const studentId = req.params.id
      await evaluateAtRiskFlags()
      const allocationRows = await publishedAllocations()
      const allocation = allocationRows.find((a) => a.student_id === studentId)
      // Supervisors may only open detail for their own allocated students.
      if (req.user.role === "supervisor") {
        if (!allocation || allocation.supervisor_id !== req.user.ref_id) throw forbidden()
      } else {
        assertSelfOr(req, "student", studentId)
      }

      const [student, supervisor, progress, milestoneRows, meetingRows, flagRows] = await Promise.all([
        db.query.students.findFirst({ where: eq(students.student_id, studentId) }),
        allocation
          ? db.query.supervisors.findFirst({ where: eq(supervisors.supervisor_id, allocation.supervisor_id) })
          : Promise.resolve(undefined),
        computeProgress(studentId),
        db.select().from(milestones).where(eq(milestones.student_id, studentId)),
        db.select().from(meetings).where(eq(meetings.student_id, studentId)),
        db.select().from(atRiskFlags).where(eq(atRiskFlags.student_id, studentId)),
      ])
      if (!student) throw notFound("Student not found.")

      return {
        student_id: studentId,
        student_name: `${student.first_name} ${student.last_name}`,
        supervisor_name: supervisor
          ? `${supervisor.title} ${supervisor.first_name} ${supervisor.last_name}`
          : "Not yet allocated",
        progress,
        milestones: milestoneRows,
        meetings: meetingRows,
        flags: flagRows.map(toFlagView),
      }
    },
  )

  app.get(
    "/at-risk-flags",
    {
      schema: {
        tags: ["dashboard"],
        querystring: z.object({
          studentId: z.coerce.number().int().optional(),
          supervisorId: z.coerce.number().int().optional(),
          active: z.coerce.boolean().optional(),
        }),
      },
    },
    async (req) => {
      if (req.user.role === "student") throw forbidden()
      if (req.query.supervisorId !== undefined) assertSelfOr(req, "supervisor", req.query.supervisorId)

      await evaluateAtRiskFlags()
      let rows = await db.select().from(atRiskFlags).orderBy(desc(atRiskFlags.raised_at))
      if (req.query.studentId !== undefined) rows = rows.filter((f) => f.student_id === req.query.studentId)
      if (req.query.supervisorId !== undefined) {
        const allocationRows = await publishedAllocations()
        const myStudents = new Set(
          allocationRows.filter((a) => a.supervisor_id === req.query.supervisorId).map((a) => a.student_id),
        )
        rows = rows.filter((f) => myStudents.has(f.student_id))
      }
      if (req.query.active !== undefined) {
        rows = rows.filter((f) => (f.cleared_at === null) === req.query.active)
      }
      return rows.map(toFlagView)
    },
  )

  app.post(
    "/at-risk-flags/:flagId/review",
    { schema: { tags: ["dashboard"], params: z.object({ flagId: z.coerce.number().int() }) } },
    async (req) => {
      if (req.user.role === "student") throw forbidden()
      const flag = await db.query.atRiskFlags.findFirst({ where: eq(atRiskFlags.flag_id, req.params.flagId) })
      if (!flag) throw notFound("Flag not found.")
      await db
        .update(atRiskFlags)
        .set({ reviewed_at: nowIso(), reviewed_by: req.user.email })
        .where(eq(atRiskFlags.flag_id, flag.flag_id))
      return { ok: true }
    },
  )

  app.post(
    "/at-risk-flags/:flagId/clear",
    {
      schema: {
        tags: ["dashboard"],
        params: z.object({ flagId: z.coerce.number().int() }),
        body: z.object({ note: z.string().optional() }).default({}),
      },
    },
    async (req) => {
      if (req.user.role === "student") throw forbidden()
      const flag = await db.query.atRiskFlags.findFirst({ where: eq(atRiskFlags.flag_id, req.params.flagId) })
      if (!flag) throw notFound("Flag not found.")
      const [updated] = await db
        .update(atRiskFlags)
        .set({
          cleared_at: nowIso(),
          cleared_note: req.body.note?.trim() ? req.body.note.trim() : null,
          reviewed_at: flag.reviewed_at ?? nowIso(),
          reviewed_by: flag.reviewed_by ?? req.user.email,
        })
        .where(eq(atRiskFlags.flag_id, flag.flag_id))
        .returning()
      return toFlagView(updated)
    },
  )
}
