/**
 * Agile module (FR-AGILE-01..05). Milestone "overdue" is computed on read —
 * every response reflects it within seconds of the due date passing, which
 * satisfies FR-AGILE-05's 24-hour acceptance criterion without a scheduler.
 * Attachments arrive as base64 data URLs (3 MB raw cap re-enforced here).
 */
import { asc, eq } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { db } from "../db/client.js"
import { milestones, sprints, tasks } from "../db/schema.js"
import { badRequest, notFound } from "../lib/errors.js"
import { listQuerySchema, nowIso, paginate } from "../lib/http.js"
import { assertSelfOr } from "../plugins/auth.js"

const studentParams = z.object({ id: z.coerce.number().int() })

const attachmentBody = z.object({
  file_name: z.string().min(1),
  file_type: z.string().min(1),
  data_url: z.string().startsWith("data:").max(4_400_000, "File is too large — max 3MB."),
})

const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

function assertAllowedUpload(body: z.infer<typeof attachmentBody>) {
  const extensionOk = [".pdf", ".docx"].some((ext) => body.file_name.toLowerCase().endsWith(ext))
  if (!extensionOk && !ALLOWED_UPLOAD_TYPES.has(body.file_type)) {
    throw badRequest("Only PDF or Word (.docx) files are accepted.")
  }
}

type MilestoneRow = typeof milestones.$inferSelect

function withOverdueRecomputed(m: MilestoneRow): MilestoneRow {
  if (m.status === "done") return m
  const overdue = m.due_date < nowIso().slice(0, 10)
  return overdue ? { ...m, status: "overdue" } : m
}

async function findMilestone(milestoneId: number): Promise<MilestoneRow> {
  const row = await db.query.milestones.findFirst({ where: eq(milestones.milestone_id, milestoneId) })
  if (!row) throw notFound("Milestone not found.")
  return row
}

export const agileModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()

  // --- Sprints ---

  app.get("/students/:id/sprints", { schema: { tags: ["agile"], params: studentParams } }, async (req) => {
    assertSelfOr(req, "student", req.params.id, ["admin", "supervisor"])
    return db.select().from(sprints).where(eq(sprints.student_id, req.params.id)).orderBy(asc(sprints.start_date))
  })

  const sprintBody = z.object({
    name: z.string().min(1),
    goal: z.string().nullish(),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
  })

  app.post(
    "/students/:id/sprints",
    { schema: { tags: ["agile"], params: studentParams, body: sprintBody } },
    async (req, reply) => {
      assertSelfOr(req, "student", req.params.id, [])
      if (req.body.end_date < req.body.start_date) throw badRequest("Sprint end date must not be before its start date.")
      const [sprint] = await db
        .insert(sprints)
        .values({ student_id: req.params.id, ...req.body, goal: req.body.goal ?? null })
        .returning()
      return reply.status(201).send(sprint)
    },
  )

  app.patch(
    "/sprints/:sprintId",
    {
      schema: { tags: ["agile"], params: z.object({ sprintId: z.coerce.number().int() }), body: sprintBody.partial() },
    },
    async (req) => {
      const sprint = await db.query.sprints.findFirst({ where: eq(sprints.sprint_id, req.params.sprintId) })
      if (!sprint) throw notFound("Sprint not found.")
      assertSelfOr(req, "student", sprint.student_id, [])
      const merged = { ...sprint, ...req.body }
      if (merged.end_date < merged.start_date) throw badRequest("Sprint end date must not be before its start date.")
      const [updated] = await db.update(sprints).set(req.body).where(eq(sprints.sprint_id, sprint.sprint_id)).returning()
      return updated
    },
  )

  app.delete(
    "/sprints/:sprintId",
    { schema: { tags: ["agile"], params: z.object({ sprintId: z.coerce.number().int() }) } },
    async (req, reply) => {
      const sprint = await db.query.sprints.findFirst({ where: eq(sprints.sprint_id, req.params.sprintId) })
      if (!sprint) throw notFound("Sprint not found.")
      assertSelfOr(req, "student", sprint.student_id, [])
      await db.delete(sprints).where(eq(sprints.sprint_id, sprint.sprint_id))
      return reply.status(204).send()
    },
  )

  // --- Milestones ---

  app.get(
    "/students/:id/milestones",
    { schema: { tags: ["agile"], params: studentParams, querystring: listQuerySchema } },
    async (req) => {
      assertSelfOr(req, "student", req.params.id, ["admin", "supervisor"])
      const rows = await db
        .select()
        .from(milestones)
        .where(eq(milestones.student_id, req.params.id))
        .orderBy(asc(milestones.due_date))
      return paginate(rows.map(withOverdueRecomputed), req.query.page, req.query.limit)
    },
  )

  app.post(
    "/students/:id/milestones",
    {
      schema: {
        tags: ["agile"],
        params: studentParams,
        body: z.object({
          title: z.string().min(1),
          description: z.string().nullish(),
          due_date: z.string().min(1),
          status: z.enum(["planned", "in_progress", "done", "overdue"]).default("planned"),
        }),
      },
    },
    async (req, reply) => {
      assertSelfOr(req, "student", req.params.id, [])
      const [milestone] = await db
        .insert(milestones)
        .values({
          student_id: req.params.id,
          title: req.body.title,
          description: req.body.description ?? null,
          due_date: req.body.due_date,
          status: req.body.status,
          created_at: nowIso(),
        })
        .returning()
      return reply.status(201).send(milestone)
    },
  )

  app.patch(
    "/milestones/:milestoneId",
    {
      schema: {
        tags: ["agile"],
        params: z.object({ milestoneId: z.coerce.number().int() }),
        body: z.object({ status: z.enum(["planned", "in_progress", "done", "overdue"]) }),
      },
    },
    async (req) => {
      const milestone = await findMilestone(req.params.milestoneId)
      assertSelfOr(req, "student", milestone.student_id, [])
      const [updated] = await db
        .update(milestones)
        .set({ status: req.body.status })
        .where(eq(milestones.milestone_id, milestone.milestone_id))
        .returning()
      return updated
    },
  )

  app.put(
    "/milestones/:milestoneId/attachment",
    {
      schema: {
        tags: ["agile"],
        params: z.object({ milestoneId: z.coerce.number().int() }),
        body: attachmentBody,
      },
    },
    async (req) => {
      const milestone = await findMilestone(req.params.milestoneId)
      assertSelfOr(req, "student", milestone.student_id, [])
      assertAllowedUpload(req.body)
      const [updated] = await db
        .update(milestones)
        .set({ attachment_name: req.body.file_name, attachment_type: req.body.file_type, attachment_data: req.body.data_url })
        .where(eq(milestones.milestone_id, milestone.milestone_id))
        .returning()
      return updated
    },
  )

  app.delete(
    "/milestones/:milestoneId/attachment",
    { schema: { tags: ["agile"], params: z.object({ milestoneId: z.coerce.number().int() }) } },
    async (req) => {
      const milestone = await findMilestone(req.params.milestoneId)
      assertSelfOr(req, "student", milestone.student_id, [])
      const [updated] = await db
        .update(milestones)
        .set({ attachment_name: null, attachment_type: null, attachment_data: null })
        .where(eq(milestones.milestone_id, milestone.milestone_id))
        .returning()
      return updated
    },
  )

  // --- Tasks ---

  app.get(
    "/students/:id/tasks",
    {
      schema: {
        tags: ["agile"],
        params: studentParams,
        querystring: z.object({
          sprintId: z.coerce.number().int().optional(),
          milestoneId: z.coerce.number().int().optional(),
          status: z.enum(["todo", "in_progress", "done"]).optional(),
        }),
      },
    },
    async (req) => {
      assertSelfOr(req, "student", req.params.id, ["admin", "supervisor"])
      let rows = await db.select().from(tasks).where(eq(tasks.student_id, req.params.id))
      if (req.query.sprintId !== undefined) rows = rows.filter((t) => t.sprint_id === req.query.sprintId)
      if (req.query.milestoneId !== undefined) rows = rows.filter((t) => t.milestone_id === req.query.milestoneId)
      if (req.query.status !== undefined) rows = rows.filter((t) => t.status === req.query.status)
      return rows
    },
  )

  app.post(
    "/students/:id/tasks",
    {
      schema: {
        tags: ["agile"],
        params: studentParams,
        body: z.object({
          title: z.string().min(1),
          priority: z.enum(["low", "medium", "high"]),
          status: z.enum(["todo", "in_progress", "done"]).default("todo"),
          sprint_id: z.number().int().nullish(),
          milestone_id: z.number().int().nullish(),
        }),
      },
    },
    async (req, reply) => {
      assertSelfOr(req, "student", req.params.id, [])
      const [task] = await db
        .insert(tasks)
        .values({
          student_id: req.params.id,
          title: req.body.title,
          priority: req.body.priority,
          status: req.body.status,
          sprint_id: req.body.sprint_id ?? null,
          milestone_id: req.body.milestone_id ?? null,
          created_at: nowIso(),
          updated_at: null,
        })
        .returning()
      return reply.status(201).send(task)
    },
  )

  app.patch(
    "/tasks/:taskId",
    {
      schema: {
        tags: ["agile"],
        params: z.object({ taskId: z.coerce.number().int() }),
        body: z.object({ status: z.enum(["todo", "in_progress", "done"]) }),
      },
    },
    async (req) => {
      const task = await db.query.tasks.findFirst({ where: eq(tasks.task_id, req.params.taskId) })
      if (!task) throw notFound("Task not found.")
      assertSelfOr(req, "student", task.student_id, [])
      const [updated] = await db
        .update(tasks)
        .set({ status: req.body.status, updated_at: nowIso() })
        .where(eq(tasks.task_id, task.task_id))
        .returning()
      return updated
    },
  )

  // --- Progress ---

  app.get("/students/:id/progress", { schema: { tags: ["agile"], params: studentParams } }, async (req) => {
    assertSelfOr(req, "student", req.params.id, ["admin", "supervisor"])
    return computeProgress(req.params.id)
  })
}

export async function computeProgress(studentId: number) {
  const [milestoneRows, taskRows] = await Promise.all([
    db.select().from(milestones).where(eq(milestones.student_id, studentId)),
    db.select().from(tasks).where(eq(tasks.student_id, studentId)),
  ])
  const recomputed = milestoneRows.map(withOverdueRecomputed)
  const milestonesDone = recomputed.filter((m) => m.status === "done").length
  const milestonesOverdue = recomputed.filter((m) => m.status === "overdue").length
  const tasksDone = taskRows.filter((t) => t.status === "done").length
  const totalItems = recomputed.length + taskRows.length
  return {
    student_id: studentId,
    milestones_total: recomputed.length,
    milestones_done: milestonesDone,
    milestones_overdue: milestonesOverdue,
    tasks_total: taskRows.length,
    tasks_done: tasksDone,
    percent_complete: totalItems > 0 ? Math.round(((milestonesDone + tasksDone) / totalItems) * 100) : 0,
  }
}
