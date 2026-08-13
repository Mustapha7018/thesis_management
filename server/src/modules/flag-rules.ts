/**
 * At-risk flag rule engine (FR-DASH-02): raises rule-based flags with a
 * rule_code and a human-readable reason, derived entirely from real student
 * activity. Evaluated on dashboard reads — flags appear within one page load
 * of the condition becoming true (well inside FR-DASH-01's <1-minute
 * staleness) without needing a scheduler.
 *
 * Lifecycle (FR-DASH-03) stays manual: the engine only RAISES flags; review
 * and clear are supervisor actions, and cleared flags are retained. A
 * cool-down stops a just-cleared flag from being re-raised immediately.
 *
 * Thresholds are named constants; admin-configurable thresholds (FR-DASH-06,
 * Could) are deferred.
 */
import { eq } from "drizzle-orm"
import { db } from "../db/client.js"
import { allocationRuns, allocations, atRiskFlags, meetings, milestones } from "../db/schema.js"
import { nowIso } from "../lib/http.js"

/** No meeting scheduled or held within this window ⇒ NO_RECENT_MEETING. */
const MEETING_WINDOW_DAYS = 28
/** Don't re-raise the same rule for a student this soon after it was cleared. */
const CLEAR_COOLDOWN_DAYS = 14

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

export async function evaluateAtRiskFlags(): Promise<void> {
  const [milestoneRows, meetingRows, existingFlags, publishedRun] = await Promise.all([
    db.select().from(milestones),
    db.select().from(meetings),
    db.select().from(atRiskFlags),
    db.query.allocationRuns.findFirst({ where: eq(allocationRuns.published, true) }),
  ])
  const allocatedStudentIds = publishedRun
    ? new Set(
        (await db.select({ student_id: allocations.student_id }).from(allocations).where(eq(allocations.run_id, publishedRun.run_id))).map(
          (a) => a.student_id,
        ),
      )
    : new Set<number>()

  const cooldownCutoff = daysAgoIso(CLEAR_COOLDOWN_DAYS)
  const suppressed = new Set<string>() // "studentId:ruleCode"
  for (const flag of existingFlags) {
    const key = `${flag.student_id}:${flag.rule_code}`
    if (flag.cleared_at === null) suppressed.add(key) // still active
    else if (flag.cleared_at > cooldownCutoff) suppressed.add(key) // recently cleared
  }

  const today = nowIso().slice(0, 10)
  const raisedAt = nowIso()
  const newFlags: (typeof atRiskFlags.$inferInsert)[] = []

  // MILESTONE_OVERDUE — any student with an overdue, not-done milestone.
  const overdueByStudent = new Map<number, typeof milestoneRows>()
  for (const m of milestoneRows) {
    if (m.status !== "done" && m.due_date < today) {
      const list = overdueByStudent.get(m.student_id) ?? []
      list.push(m)
      overdueByStudent.set(m.student_id, list)
    }
  }
  for (const [studentId, overdue] of overdueByStudent) {
    if (suppressed.has(`${studentId}:MILESTONE_OVERDUE`)) continue
    const earliest = [...overdue].sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
    newFlags.push({
      student_id: studentId,
      rule_code: "MILESTONE_OVERDUE",
      reason:
        `Milestone '${earliest.title}' is overdue and not marked done.` +
        (overdue.length > 1 ? ` (${overdue.length} overdue in total.)` : ""),
      raised_at: raisedAt,
      cleared_at: null,
    })
  }

  // NO_RECENT_MEETING — allocated students only, and only once supervision has
  // been running longer than the window (a freshly published cohort gets a
  // grace period rather than 500 instant flags).
  const recentCutoff = daysAgoIso(MEETING_WINDOW_DAYS)
  const supervisionMature = publishedRun !== undefined && publishedRun.created_at <= recentCutoff
  const recentMeetingStudents = new Set(
    meetingRows.filter((m) => m.scheduled_at >= recentCutoff).map((m) => m.student_id),
  )
  for (const studentId of supervisionMature ? allocatedStudentIds : new Set<number>()) {
    if (recentMeetingStudents.has(studentId)) continue
    if (suppressed.has(`${studentId}:NO_RECENT_MEETING`)) continue
    newFlags.push({
      student_id: studentId,
      rule_code: "NO_RECENT_MEETING",
      reason: `No supervision meeting scheduled or held in the last ${MEETING_WINDOW_DAYS / 7} weeks.`,
      raised_at: raisedAt,
      cleared_at: null,
    })
  }

  for (let i = 0; i < newFlags.length; i += 500) {
    await db.insert(atRiskFlags).values(newFlags.slice(i, i + 500))
  }
}
