/**
 * Domain-module integration tests: profile, agile, meetings (+ICS feed),
 * dashboard and admin reads — the CRUD surface the O4 evaluation verifies
 * ("CRUD, user management, calendar sync and meeting logging").
 * Runs after api.test.ts, which restores the seeded dataset.
 */
import type { FastifyInstance } from "fastify"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildApp } from "../src/app.js"

const DEMO_PASSWORD = "Password123!"

let app: FastifyInstance
let adminToken: string
let studentToken: string
let studentId: number
let supervisorToken: string
let supervisorId: number

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function tokenFor(email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: DEMO_PASSWORD },
  })
  expect(res.statusCode).toBe(200)
  return res.json() as { token: string; session: { ref_id: number | null } }
}

beforeAll(async () => {
  app = await buildApp()
  adminToken = (await tokenFor("jordan.blake@sunderland.ac.uk")).token
  const student = await tokenFor("z47nuz@student.sunderland.ac.uk")
  studentToken = student.token
  studentId = student.session.ref_id!
  const supervisor = await tokenFor("fatima.diallo@sunderland.ac.uk")
  supervisorToken = supervisor.token
  supervisorId = supervisor.session.ref_id!
})

afterAll(async () => {
  await app.close()
  const { pool } = await import("../src/db/client.js")
  await pool.end()
})

describe("profile (FR-PROF-01..04)", () => {
  it("serves reference data to any authenticated role", async () => {
    const areas = await app.inject({ method: "GET", url: "/api/v1/research-areas", headers: auth(studentToken) })
    expect(areas.statusCode).toBe(200)
    expect((areas.json() as unknown[]).length).toBe(12)

    const brief = await app.inject({ method: "GET", url: "/api/v1/supervisors/brief", headers: auth(studentToken) })
    expect((brief.json() as unknown[]).length).toBe(32)
  })

  it("round-trips student interests", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/students/${studentId}/interests`,
      headers: auth(studentToken),
      payload: { interests: [{ areaId: 1, rank: 1 }, { areaId: 3, rank: 2 }] },
    })
    expect(put.statusCode).toBe(200)
    const get = await app.inject({
      method: "GET",
      url: `/api/v1/students/${studentId}/interests`,
      headers: auth(studentToken),
    })
    expect((get.json() as { area_id: number }[]).map((i) => i.area_id)).toEqual([1, 3])
  })

  it("round-trips a 5-supervisor preference list while the window is open", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/students/${studentId}/preferences`,
      headers: auth(studentToken),
      payload: { supervisorIdsInRankOrder: [5, 4, 3, 2, 1] },
    })
    expect(put.statusCode).toBe(200)
    const get = await app.inject({
      method: "GET",
      url: `/api/v1/students/${studentId}/preferences`,
      headers: auth(studentToken),
    })
    expect((get.json() as { supervisor_id: number }[]).map((p) => p.supervisor_id)).toEqual([5, 4, 3, 2, 1])
  })

  it("round-trips supervisor expertise and applicant scoring", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/api/v1/supervisors/${supervisorId}/expertise`,
      headers: auth(supervisorToken),
      payload: { expertise: [{ areaId: 2, proficiency: 3 }, { areaId: 4, proficiency: 2 }] },
    })
    expect(put.statusCode).toBe(200)

    const applicants = await app.inject({
      method: "GET",
      url: `/api/v1/supervisors/${supervisorId}/applicants`,
      headers: auth(supervisorToken),
    })
    expect(applicants.statusCode).toBe(200)
    const list = applicants.json() as { student_id: number }[]
    expect(list.length).toBeGreaterThan(0)

    const score = await app.inject({
      method: "PUT",
      url: `/api/v1/supervisors/${supervisorId}/applicants/${list[0].student_id}/score`,
      headers: auth(supervisorToken),
      payload: { score: 0.85 },
    })
    expect(score.statusCode).toBe(200)

    const outOfRange = await app.inject({
      method: "PUT",
      url: `/api/v1/supervisors/${supervisorId}/applicants/${list[0].student_id}/score`,
      headers: auth(supervisorToken),
      payload: { score: 1.5 },
    })
    expect(outOfRange.statusCode).toBe(400)
  })
})

describe("agile (FR-AGILE-01..06)", () => {
  it("sprint lifecycle with date validation", async () => {
    const bad = await app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/sprints`,
      headers: auth(studentToken),
      payload: { name: "Backwards", start_date: "2026-09-10", end_date: "2026-09-01" },
    })
    expect(bad.statusCode).toBe(400)

    const created = await app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/sprints`,
      headers: auth(studentToken),
      payload: { name: "Sprint T", goal: "Test goal", start_date: "2026-09-01", end_date: "2026-09-14" },
    })
    expect(created.statusCode).toBe(201)
    const sprintId = (created.json() as { sprint_id: number }).sprint_id

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/v1/sprints/${sprintId}`,
      headers: auth(studentToken),
      payload: { name: "Sprint T2" },
    })
    expect((patched.json() as { name: string }).name).toBe("Sprint T2")

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/sprints/${sprintId}`,
      headers: auth(studentToken),
    })
    expect(deleted.statusCode).toBe(204)
  })

  it("milestone lifecycle incl. attachment upload rules and overdue-on-read", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/milestones`,
      headers: auth(studentToken),
      payload: { title: "Overdue milestone", due_date: "2020-01-01" },
    })
    expect(created.statusCode).toBe(201)
    const milestoneId = (created.json() as { milestone_id: number }).milestone_id

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/students/${studentId}/milestones?limit=100`,
      headers: auth(studentToken),
    })
    const row = (list.json() as { data: { milestone_id: number; status: string }[] }).data.find(
      (m) => m.milestone_id === milestoneId,
    )
    expect(row?.status).toBe("overdue") // FR-AGILE-05: computed on read

    const badUpload = await app.inject({
      method: "PUT",
      url: `/api/v1/milestones/${milestoneId}/attachment`,
      headers: auth(studentToken),
      payload: { file_name: "notes.txt", file_type: "text/plain", data_url: "data:text/plain;base64,aGk=" },
    })
    expect(badUpload.statusCode).toBe(400)

    const upload = await app.inject({
      method: "PUT",
      url: `/api/v1/milestones/${milestoneId}/attachment`,
      headers: auth(studentToken),
      payload: { file_name: "report.pdf", file_type: "application/pdf", data_url: "data:application/pdf;base64,aGk=" },
    })
    expect((upload.json() as { attachment_name: string }).attachment_name).toBe("report.pdf")

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/milestones/${milestoneId}/attachment`,
      headers: auth(studentToken),
    })
    expect((removed.json() as { attachment_name: string | null }).attachment_name).toBeNull()

    const done = await app.inject({
      method: "PATCH",
      url: `/api/v1/milestones/${milestoneId}`,
      headers: auth(studentToken),
      payload: { status: "done" },
    })
    expect((done.json() as { status: string }).status).toBe("done")
  })

  it("task lifecycle and progress aggregation", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/students/${studentId}/tasks`,
      headers: auth(studentToken),
      payload: { title: "Write tests", priority: "high" },
    })
    expect(created.statusCode).toBe(201)
    const taskId = (created.json() as { task_id: number }).task_id

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/v1/tasks/${taskId}`,
      headers: auth(studentToken),
      payload: { status: "done" },
    })
    expect((updated.json() as { status: string; updated_at: string | null }).updated_at).not.toBeNull()

    const filtered = await app.inject({
      method: "GET",
      url: `/api/v1/students/${studentId}/tasks?status=done`,
      headers: auth(studentToken),
    })
    expect((filtered.json() as { task_id: number }[]).some((t) => t.task_id === taskId)).toBe(true)

    const progress = await app.inject({
      method: "GET",
      url: `/api/v1/students/${studentId}/progress`,
      headers: auth(studentToken),
    })
    const summary = progress.json() as { percent_complete: number; tasks_done: number }
    expect(summary.tasks_done).toBeGreaterThan(0)
    expect(summary.percent_complete).toBeGreaterThanOrEqual(0)
  })
})

describe("meetings + calendar (FR-MEET-01..05)", () => {
  let meetingId: number

  it("schedules, updates and logs a meeting", async () => {
    const missingFilter = await app.inject({ method: "GET", url: "/api/v1/meetings", headers: auth(studentToken) })
    expect(missingFilter.statusCode).toBe(400)

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/meetings",
      headers: auth(studentToken),
      payload: { student_id: studentId, supervisor_id: supervisorId, scheduled_at: "2026-09-01T10:00:00Z", notes: "Kick-off" },
    })
    expect(created.statusCode).toBe(201)
    meetingId = (created.json() as { meeting_id: number }).meeting_id

    const held = await app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${meetingId}`,
      headers: auth(supervisorToken),
      payload: { held: true, notes: "Discussed scope" },
    })
    expect((held.json() as { held: number }).held).toBe(1)

    const log = await app.inject({
      method: "PUT",
      url: `/api/v1/meetings/${meetingId}/log`,
      headers: auth(studentToken),
      payload: { file_name: "log.pdf", file_type: "application/pdf", data_url: "data:application/pdf;base64,aGk=" },
    })
    expect((log.json() as { log_file_name: string }).log_file_name).toBe("log.pdf")

    const removeLog = await app.inject({
      method: "DELETE",
      url: `/api/v1/meetings/${meetingId}/log`,
      headers: auth(studentToken),
    })
    expect((removeLog.json() as { log_file_name: string | null }).log_file_name).toBeNull()

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/meetings?studentId=${studentId}`,
      headers: auth(studentToken),
    })
    expect((list.json() as { meeting_id: number }[]).some((m) => m.meeting_id === meetingId)).toBe(true)
  })

  it("serves a single-meeting ICS and a token-authenticated feed", async () => {
    const ics = await app.inject({
      method: "GET",
      url: `/api/v1/meetings/${meetingId}/ics`,
      headers: auth(studentToken),
    })
    expect(ics.statusCode).toBe(200)
    expect(ics.headers["content-type"]).toContain("text/calendar")
    expect(ics.body).toContain("BEGIN:VCALENDAR")
    expect(ics.body).toContain("BEGIN:VEVENT")

    const feedUrl = await app.inject({ method: "GET", url: "/api/v1/calendar/feed-url", headers: auth(studentToken) })
    const { url } = feedUrl.json() as { url: string }
    const feed = await app.inject({ method: "GET", url })
    expect(feed.statusCode).toBe(200)
    expect(feed.body).toContain("BEGIN:VCALENDAR")

    const badFeed = await app.inject({ method: "GET", url: "/api/v1/calendar/feed.ics?token=garbage" })
    expect(badFeed.statusCode).toBe(403)

    // A normal access token must not work as a feed token.
    const notFeedToken = await app.inject({
      method: "GET",
      url: `/api/v1/calendar/feed.ics?token=${studentToken}`,
    })
    expect(notFeedToken.statusCode).toBe(403)
  })
})

describe("dashboards + flags (FR-DASH-01..03)", () => {
  it("serves the admin cohort overview and supervisor cohort from the published run", async () => {
    const overview = await app.inject({
      method: "GET",
      url: "/api/v1/admin/cohort-overview",
      headers: auth(adminToken),
    })
    expect(overview.statusCode).toBe(200)
    expect((overview.json() as { total: number }).total).toBeGreaterThan(0)

    const cohort = await app.inject({
      method: "GET",
      url: `/api/v1/supervisors/${supervisorId}/cohort`,
      headers: auth(supervisorToken),
    })
    expect(cohort.statusCode).toBe(200)
  })

  it("serves student detail with progress to admins", async () => {
    const detail = await app.inject({ method: "GET", url: `/api/v1/students/1/detail`, headers: auth(adminToken) })
    expect(detail.statusCode).toBe(200)
    const body = detail.json() as { student_name: string; progress: { percent_complete: number } }
    expect(body.student_name.length).toBeGreaterThan(0)
  })

  it("runs the flag lifecycle: list, review, clear with note", async () => {
    const flags = await app.inject({ method: "GET", url: "/api/v1/at-risk-flags?active=true", headers: auth(adminToken) })
    const list = flags.json() as { flag_id: number; reviewed: boolean }[]
    expect(list.length).toBeGreaterThan(0)
    const flagId = list[0].flag_id

    const review = await app.inject({
      method: "POST",
      url: `/api/v1/at-risk-flags/${flagId}/review`,
      headers: auth(supervisorToken),
    })
    expect(review.statusCode).toBe(200)

    const cleared = await app.inject({
      method: "POST",
      url: `/api/v1/at-risk-flags/${flagId}/clear`,
      headers: auth(supervisorToken),
      payload: { note: "Spoke to the student" },
    })
    const body = cleared.json() as { cleared_at: string | null; reviewed: boolean; reason: string }
    expect(body.cleared_at).not.toBeNull()
    expect(body.reviewed).toBe(true)
    expect(body.reason).toContain("Spoke to the student")
  })
})

describe("admin reads + allocation views", () => {
  it("lists supervisors with allocated counts and the audit log", async () => {
    const supers = await app.inject({ method: "GET", url: "/api/v1/admin/supervisors?limit=50", headers: auth(adminToken) })
    expect((supers.json() as { total: number }).total).toBe(32)

    const audit = await app.inject({ method: "GET", url: "/api/v1/admin/audit-log", headers: auth(adminToken) })
    expect((audit.json() as { total: number }).total).toBeGreaterThan(0)

    const summary = await app.inject({ method: "GET", url: "/api/v1/admin/cohort/summary", headers: auth(adminToken) })
    expect((summary.json() as { studentCount: number }).studentCount).toBe(500)

    const feasibility = await app.inject({ method: "GET", url: "/api/v1/allocation/feasibility", headers: auth(adminToken) })
    expect(feasibility.statusCode).toBe(200)
  })

  it("retires and reactivates a directory account", async () => {
    const retired = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/users/student-1",
      headers: auth(adminToken),
      payload: { active: false },
    })
    expect((retired.json() as { active: boolean }).active).toBe(false)
    const reactivated = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/users/student-1",
      headers: auth(adminToken),
      payload: { active: true },
    })
    expect((reactivated.json() as { active: boolean }).active).toBe(true)
  })

  it("serves a student's published allocation with an explanation", async () => {
    const allocation = await app.inject({
      method: "GET",
      url: `/api/v1/students/${studentId}/allocation`,
      headers: auth(studentToken),
    })
    expect(allocation.statusCode).toBe(200)
    const body = allocation.json() as { allocation_id: number; supervisor_name: string } | null
    if (body) {
      const explanation = await app.inject({
        method: "GET",
        url: `/api/v1/allocations/${body.allocation_id}/explanation`,
        headers: auth(studentToken),
      })
      expect(explanation.statusCode).toBe(200)
      expect((explanation.json() as { summary: string }).summary.length).toBeGreaterThan(0)
    }
  })

  it("creates a research area and rejects duplicates", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/research-areas",
      headers: auth(adminToken),
      payload: { code: "TEST_AREA", name: "Test Area" },
    })
    expect(created.statusCode).toBe(201)
    const dupe = await app.inject({
      method: "POST",
      url: "/api/v1/research-areas",
      headers: auth(adminToken),
      payload: { code: "TEST_AREA", name: "Test Area 2" },
    })
    expect(dupe.statusCode).toBe(409)
  })
})
