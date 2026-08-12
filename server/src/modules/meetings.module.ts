/**
 * Meetings (FR-MEET-01..05): scheduling, held/notes updates, supervision-log
 * uploads, single-event ICS download and a per-user ICS feed (FR-MEET-03)
 * authenticated by a signed feed token so calendar apps can poll it.
 */
import { desc, eq, or } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { db } from "../db/client.js"
import { accounts, meetings, students, supervisors } from "../db/schema.js"
import { badRequest, forbidden, notFound } from "../lib/errors.js"
import { nowIso } from "../lib/http.js"
import { assertSelfOr } from "../plugins/auth.js"

type MeetingRow = typeof meetings.$inferSelect

const logBody = z.object({
  file_name: z.string().min(1),
  file_type: z.string().min(1),
  data_url: z.string().startsWith("data:").max(4_400_000, "File is too large — max 3MB."),
})

function assertParty(req: { user: { role: string; ref_id: number | null } }, meeting: MeetingRow) {
  const user = req.user
  if (user.role === "admin") return
  if (user.role === "student" && user.ref_id === meeting.student_id) return
  if (user.role === "supervisor" && user.ref_id === meeting.supervisor_id) return
  throw forbidden()
}

function icsEvent(meeting: MeetingRow, studentName: string, supervisorName: string): string {
  const start = new Date(meeting.scheduled_at)
  const end = new Date(start.getTime() + 30 * 60_000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  return [
    "BEGIN:VEVENT",
    `UID:meeting-${meeting.meeting_id}@thesis-portal`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Supervision meeting — ${studentName} / ${supervisorName}`,
    `DESCRIPTION:${(meeting.notes ?? "").replace(/\n/g, "\\n")}`,
    "END:VEVENT",
  ].join("\r\n")
}

function icsCalendar(events: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Thesis Portal//EN", ...events, "END:VCALENDAR"].join("\r\n")
}

async function meetingNames(meeting: MeetingRow) {
  const [student, supervisor] = await Promise.all([
    db.query.students.findFirst({ where: eq(students.student_id, meeting.student_id) }),
    db.query.supervisors.findFirst({ where: eq(supervisors.supervisor_id, meeting.supervisor_id) }),
  ])
  return {
    studentName: student ? `${student.first_name} ${student.last_name}` : "Student",
    supervisorName: supervisor ? `${supervisor.title} ${supervisor.first_name} ${supervisor.last_name}` : "Supervisor",
  }
}

export const meetingsModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()

  app.get(
    "/meetings",
    {
      schema: {
        tags: ["meetings"],
        querystring: z.object({
          studentId: z.coerce.number().int().optional(),
          supervisorId: z.coerce.number().int().optional(),
        }),
      },
    },
    async (req) => {
      const { studentId, supervisorId } = req.query
      if (studentId === undefined && supervisorId === undefined) throw badRequest("Provide studentId or supervisorId.")
      if (studentId !== undefined) assertSelfOr(req, "student", studentId, ["admin", "supervisor"])
      if (supervisorId !== undefined) assertSelfOr(req, "supervisor", supervisorId)
      let rows = await db.select().from(meetings).orderBy(desc(meetings.scheduled_at))
      if (studentId !== undefined) rows = rows.filter((m) => m.student_id === studentId)
      if (supervisorId !== undefined) rows = rows.filter((m) => m.supervisor_id === supervisorId)
      return rows
    },
  )

  app.post(
    "/meetings",
    {
      schema: {
        tags: ["meetings"],
        body: z.object({
          student_id: z.number().int(),
          supervisor_id: z.number().int(),
          scheduled_at: z.string().min(1),
          notes: z.string().nullish(),
        }),
      },
    },
    async (req, reply) => {
      // Either party (or an admin) may schedule, but only for pairs they belong to.
      if (req.user.role === "student" && req.user.ref_id !== req.body.student_id) throw forbidden()
      if (req.user.role === "supervisor" && req.user.ref_id !== req.body.supervisor_id) throw forbidden()
      const [meeting] = await db
        .insert(meetings)
        .values({
          student_id: req.body.student_id,
          supervisor_id: req.body.supervisor_id,
          scheduled_at: req.body.scheduled_at,
          held: 0,
          notes: req.body.notes ?? null,
        })
        .returning()
      return reply.status(201).send(meeting)
    },
  )

  app.patch(
    "/meetings/:meetingId",
    {
      schema: {
        tags: ["meetings"],
        params: z.object({ meetingId: z.coerce.number().int() }),
        body: z.object({ held: z.boolean().optional(), notes: z.string().optional() }),
      },
    },
    async (req) => {
      const meeting = await db.query.meetings.findFirst({ where: eq(meetings.meeting_id, req.params.meetingId) })
      if (!meeting) throw notFound("Meeting not found.")
      assertParty(req, meeting)
      const patch: Partial<typeof meetings.$inferInsert> = {}
      if (req.body.held !== undefined) patch.held = req.body.held ? 1 : 0
      if (req.body.notes !== undefined) patch.notes = req.body.notes
      const [updated] = await db.update(meetings).set(patch).where(eq(meetings.meeting_id, meeting.meeting_id)).returning()
      return updated
    },
  )

  app.put(
    "/meetings/:meetingId/log",
    {
      schema: { tags: ["meetings"], params: z.object({ meetingId: z.coerce.number().int() }), body: logBody },
    },
    async (req) => {
      const meeting = await db.query.meetings.findFirst({ where: eq(meetings.meeting_id, req.params.meetingId) })
      if (!meeting) throw notFound("Meeting not found.")
      assertParty(req, meeting)
      const extensionOk = [".pdf", ".docx"].some((ext) => req.body.file_name.toLowerCase().endsWith(ext))
      const typeOk = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(req.body.file_type)
      if (!extensionOk && !typeOk) throw badRequest("Only PDF or Word (.docx) files are accepted.")
      const [updated] = await db
        .update(meetings)
        .set({ log_file_name: req.body.file_name, log_file_type: req.body.file_type, log_file_data: req.body.data_url })
        .where(eq(meetings.meeting_id, meeting.meeting_id))
        .returning()
      return updated
    },
  )

  app.delete(
    "/meetings/:meetingId/log",
    { schema: { tags: ["meetings"], params: z.object({ meetingId: z.coerce.number().int() }) } },
    async (req) => {
      const meeting = await db.query.meetings.findFirst({ where: eq(meetings.meeting_id, req.params.meetingId) })
      if (!meeting) throw notFound("Meeting not found.")
      assertParty(req, meeting)
      const [updated] = await db
        .update(meetings)
        .set({ log_file_name: null, log_file_type: null, log_file_data: null })
        .where(eq(meetings.meeting_id, meeting.meeting_id))
        .returning()
      return updated
    },
  )

  app.get(
    "/meetings/:meetingId/ics",
    { schema: { tags: ["meetings"], params: z.object({ meetingId: z.coerce.number().int() }) } },
    async (req, reply) => {
      const meeting = await db.query.meetings.findFirst({ where: eq(meetings.meeting_id, req.params.meetingId) })
      if (!meeting) throw notFound("Meeting not found.")
      assertParty(req, meeting)
      const names = await meetingNames(meeting)
      return reply
        .header("content-type", "text/calendar; charset=utf-8")
        .header("content-disposition", `attachment; filename="meeting-${meeting.meeting_id}.ics"`)
        .send(icsCalendar([icsEvent(meeting, names.studentName, names.supervisorName)]))
    },
  )

  /** Returns the caller's personal feed URL (signed token — calendar apps can't send JWT headers). */
  app.get("/calendar/feed-url", { schema: { tags: ["meetings"] } }, async (req) => {
    const feedToken = app.jwt.sign({ ...req.user, feed: true }, { expiresIn: "365d" })
    return { url: `/api/v1/calendar/feed.ics?token=${feedToken}` }
  })

  app.get(
    "/calendar/feed.ics",
    {
      config: { public: true },
      schema: { tags: ["meetings"], querystring: z.object({ token: z.string() }) },
    },
    async (req, reply) => {
      let claims: { sub: string; feed?: boolean }
      try {
        claims = app.jwt.verify(req.query.token)
      } catch {
        throw forbidden("Invalid feed token.")
      }
      if (!claims.feed) throw forbidden("Invalid feed token.")
      const account = await db.query.accounts.findFirst({ where: eq(accounts.account_id, claims.sub) })
      if (!account || !account.active) throw forbidden("Invalid feed token.")

      let rows: MeetingRow[] = []
      if (account.student_id !== null || account.supervisor_id !== null) {
        rows = await db
          .select()
          .from(meetings)
          .where(
            or(
              account.student_id !== null ? eq(meetings.student_id, account.student_id) : undefined,
              account.supervisor_id !== null ? eq(meetings.supervisor_id, account.supervisor_id) : undefined,
            ),
          )
      }
      const events = await Promise.all(
        rows.map(async (m) => {
          const names = await meetingNames(m)
          return icsEvent(m, names.studentName, names.supervisorName)
        }),
      )
      req.log.info({ account: account.account_id, events: events.length, at: nowIso() }, "calendar feed served")
      return reply.header("content-type", "text/calendar; charset=utf-8").send(icsCalendar(events))
    },
  )
}
