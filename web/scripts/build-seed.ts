/**
 * Authors the seed data for the six schema tables that exist but are empty
 * (sprints, milestones, tasks, meetings, at_risk_flags, allocations) plus the
 * portal-only demo accounts / users / audit log / preference-window state.
 *
 * Demo cohort: 8 real students picked from the synthetic dataset (fixtures),
 * spanning all 6 programmes and both FT/PT, with a genuine mark spread. Each
 * demo student's PUBLISHED allocation pairs them with a supervisor drawn from
 * their own rank-1/2 row in student-preferences.json — not fabricated — so
 * the allocation-explanation view stays consistent with the real generated
 * data. The "manual" and "random" baseline runs reuse the same students'
 * rank-3 and rank-5 choices respectively, which is what makes the benchmark
 * comparison (mean satisfied rank, mean score) tell a coherent story: the
 * published run should outperform manual, which should outperform random.
 *
 * Run manually with `npm run seed:build` whenever this file changes — not
 * wired into predev/prebuild, same rationale as build-fixtures.ts.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = resolve(__dirname, "../src/lib/data/fixtures")
const OUT_DIR = resolve(__dirname, "../src/lib/data/seed")

type Row = Record<string, unknown>
function load(name: string): Row[] {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, `${name}.json`), "utf-8"))
}

const students = load("students") as {
  student_id: number
  first_name: string
  last_name: string
  email: string
  programme: string
  mode: string
  prior_avg_mark: number
}[]
const supervisors = load("supervisors") as {
  supervisor_id: number
  title: string
  first_name: string
  last_name: string
  email: string
}[]
const studentPreferences = load("student-preferences") as {
  student_id: number
  supervisor_id: number
  rank: number
}[]
const supervisorPreferences = load("supervisor-preferences") as {
  supervisor_id: number
  student_id: number
  score: number
}[]
const studentById = new Map(students.map((s) => [s.student_id, s]))
const supervisorById = new Map(supervisors.map((s) => [s.supervisor_id, s]))

// ---------------------------------------------------------------------------
// Demo cohort — 8 students, hand-picked for programme/mode/mark spread.
// ---------------------------------------------------------------------------
const DEMO_STUDENT_IDS = [51, 4, 249, 325, 258, 263, 205, 300]

function prefFor(studentId: number, rank: number) {
  const p = studentPreferences.find((p) => p.student_id === studentId && p.rank === rank)
  if (!p) throw new Error(`no rank-${rank} preference for student ${studentId}`)
  return p
}
function scoreFor(supervisorId: number, studentId: number) {
  return (
    supervisorPreferences.find(
      (sp) => sp.supervisor_id === supervisorId && sp.student_id === studentId,
    )?.score ?? null
  )
}

// Rank chosen per student per run: published picks whichever of rank-1/rank-2
// scores higher (closer to how a real GA would break a near-tie); manual uses
// rank-3; random uses rank-5 — deliberately worse, for the baseline story.
const PUBLISHED_RANK_CHOICE: Record<number, 1 | 2> = {
  51: 1,
  4: 1,
  249: 2,
  325: 2,
  258: 1,
  263: 2,
  205: 1,
  300: 1,
}

function objectiveScore(rank: number, score: number | null): number {
  const rankWeight = (6 - rank) / 5
  return Math.round(((rankWeight + (score ?? 0)) / 2) * 100) / 100
}

interface AllocationSeedRow {
  allocation_id: number
  run_id: string
  algorithm: "greedy-mock" | "manual" | "random"
  student_id: number
  supervisor_id: number
  objective_score: number
  created_at: string
}

const allocations: AllocationSeedRow[] = []
let allocationId = 1

const runs = [
  { run_id: "run-2026-07-28-random", algorithm: "random" as const, rank: 5, created_at: "2026-07-28T09:00:00Z" },
  { run_id: "run-2026-07-29-manual", algorithm: "manual" as const, rank: 3, created_at: "2026-07-29T09:00:00Z" },
  {
    run_id: "run-2026-07-30-greedy-mock",
    algorithm: "greedy-mock" as const,
    rank: "published" as const,
    created_at: "2026-07-30T09:00:00Z",
  },
]

for (const run of runs) {
  for (const studentId of DEMO_STUDENT_IDS) {
    const rank = run.rank === "published" ? PUBLISHED_RANK_CHOICE[studentId] : run.rank
    const pref = prefFor(studentId, rank)
    const score = scoreFor(pref.supervisor_id, studentId)
    allocations.push({
      allocation_id: allocationId++,
      run_id: run.run_id,
      algorithm: run.algorithm,
      student_id: studentId,
      supervisor_id: pref.supervisor_id,
      objective_score: objectiveScore(rank, score),
      created_at: run.created_at,
    })
  }
}

const allocationRuns = [
  {
    run_id: "run-2026-07-28-random",
    algorithm: "random",
    label: "Random baseline",
    created_at: "2026-07-28T09:00:00Z",
    published: false,
    instance_size: DEMO_STUDENT_IDS.length,
    runtime_ms: 4,
  },
  {
    run_id: "run-2026-07-29-manual",
    algorithm: "manual",
    label: "Manual baseline",
    created_at: "2026-07-29T09:00:00Z",
    published: false,
    instance_size: DEMO_STUDENT_IDS.length,
    runtime_ms: null,
  },
  {
    run_id: "run-2026-07-30-greedy-mock",
    algorithm: "greedy-mock",
    label: "Greedy baseline (mock) — GA engine pending (task 5.0)",
    created_at: "2026-07-30T09:00:00Z",
    published: true,
    instance_size: DEMO_STUDENT_IDS.length,
    runtime_ms: 9,
  },
]

// Published pairing per student -> becomes the "my supervisor" relationship
// the rest of the seed (sprints/milestones/meetings) is written against.
const publishedSupervisorByStudent = new Map<number, number>()
for (const a of allocations) {
  if (a.algorithm === "greedy-mock") publishedSupervisorByStudent.set(a.student_id, a.supervisor_id)
}

// ---------------------------------------------------------------------------
// Demo accounts: 8 students + their published supervisor + 1 admin
// ---------------------------------------------------------------------------
const demoAccounts = [
  ...DEMO_STUDENT_IDS.map((id) => {
    const s = studentById.get(id)!
    return {
      account_id: `student-${id}`,
      email: s.email,
      role: "student" as const,
      ref_id: id,
      display_name: `${s.first_name} ${s.last_name}`,
      active: true,
    }
  }),
  ...[...new Set(publishedSupervisorByStudent.values())].map((id) => {
    const s = supervisorById.get(id)!
    return {
      account_id: `supervisor-${id}`,
      email: s.email,
      role: "supervisor" as const,
      ref_id: id,
      display_name: `${s.title} ${s.first_name} ${s.last_name}`,
      active: true,
    }
  }),
  {
    account_id: "admin-1",
    email: "jordan.blake@sunderland.ac.uk",
    role: "admin" as const,
    ref_id: null,
    display_name: "Jordan Blake",
    active: true,
  },
]

// ---------------------------------------------------------------------------
// Sprints / milestones / tasks
// Today (fixed reference for the demo): 2026-08-04.
// ---------------------------------------------------------------------------
const sprints: Row[] = []
const milestones: Row[] = []
const tasks: Row[] = []
let sprintId = 1
let milestoneId = 1
let taskId = 1

// Students 51 and 300 are the intentionally-behind demo cases (see at-risk
// flags below): 51 has an overdue milestone and a stalled sprint; 300 has a
// cleared historical flag, now back on track.
const BEHIND_STUDENT_IDS = new Set([51, 300])

for (const studentId of DEMO_STUDENT_IDS) {
  const behind = BEHIND_STUDENT_IDS.has(studentId)

  const sprint1 = {
    sprint_id: sprintId++,
    student_id: studentId,
    name: "Sprint 1 — Literature Review",
    goal: "Complete literature review and finalise research question.",
    start_date: "2026-06-29",
    end_date: "2026-07-13",
  }
  const sprint2 = {
    sprint_id: sprintId++,
    student_id: studentId,
    name: "Sprint 2 — Requirements & Design",
    goal: "Elicit requirements and produce the system design.",
    start_date: "2026-07-14",
    end_date: "2026-08-10",
  }
  sprints.push(sprint1, sprint2)

  const noAttachment = { attachment_name: null, attachment_type: null, attachment_data: null }
  const msDone = {
    milestone_id: milestoneId++,
    student_id: studentId,
    title: "Literature review complete",
    description: "Ten peer-reviewed sources synthesised into a written review.",
    due_date: "2026-07-10",
    status: "done",
    created_at: "2026-06-25T09:00:00Z",
    ...noAttachment,
  }
  const msCurrent = behind
    ? {
        milestone_id: milestoneId++,
        student_id: studentId,
        title: "Requirements specification signed off",
        description: "Draft requirements reviewed and approved by supervisor.",
        due_date: "2026-07-25",
        // Past due, not done — recomputed to "overdue" by agile.service on read (FR-AGILE-05).
        status: "in_progress",
        created_at: "2026-07-10T09:00:00Z",
        ...noAttachment,
      }
    : {
        milestone_id: milestoneId++,
        student_id: studentId,
        title: "Requirements specification signed off",
        description: "Draft requirements reviewed and approved by supervisor.",
        due_date: "2026-08-01",
        status: "done",
        created_at: "2026-07-10T09:00:00Z",
        ...noAttachment,
      }
  const msNext = {
    milestone_id: milestoneId++,
    student_id: studentId,
    title: "System design & prototype plan",
    description: "Architecture sketch and implementation plan for the next sprint.",
    due_date: "2026-08-20",
    status: behind ? "planned" : "in_progress",
    created_at: "2026-07-14T09:00:00Z",
    ...noAttachment,
  }
  milestones.push(msDone, msCurrent, msNext)

  const taskDefs: { title: string; priority: string; status: string; sprint?: number; milestone?: number }[] = [
    { title: "Screen literature search results", priority: "medium", status: "done", sprint: sprint1.sprint_id, milestone: msDone.milestone_id },
    { title: "Write literature review draft", priority: "high", status: "done", sprint: sprint1.sprint_id, milestone: msDone.milestone_id },
    { title: "Draft functional requirements", priority: "high", status: behind ? "in_progress" : "done", sprint: sprint2.sprint_id, milestone: msCurrent.milestone_id },
    { title: "Draft non-functional requirements", priority: "medium", status: behind ? "todo" : "done", sprint: sprint2.sprint_id, milestone: msCurrent.milestone_id },
    { title: "Sketch system architecture diagram", priority: "medium", status: behind ? "todo" : "in_progress", sprint: sprint2.sprint_id, milestone: msNext.milestone_id },
    { title: "Set up project repository", priority: "low", status: "done", sprint: sprint2.sprint_id },
  ]
  for (const t of taskDefs) {
    tasks.push({
      task_id: taskId++,
      sprint_id: t.sprint ?? null,
      milestone_id: t.milestone ?? null,
      student_id: studentId,
      title: t.title,
      priority: t.priority,
      status: t.status,
      created_at: "2026-06-29T09:00:00Z",
      updated_at: "2026-07-20T09:00:00Z",
    })
  }
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
const meetings: Row[] = []
let meetingId = 1
const noLog = { log_file_name: null, log_file_type: null, log_file_data: null }
for (const studentId of DEMO_STUDENT_IDS) {
  const supervisorId = publishedSupervisorByStudent.get(studentId)!
  const behind = BEHIND_STUDENT_IDS.has(studentId)

  meetings.push({
    meeting_id: meetingId++,
    student_id: studentId,
    supervisor_id: supervisorId,
    scheduled_at: "2026-07-02T13:00:00Z",
    held: 1,
    notes: "Kick-off meeting: agreed research question and literature review scope.",
    ...noLog,
  })

  if (!behind) {
    meetings.push({
      meeting_id: meetingId++,
      student_id: studentId,
      supervisor_id: supervisorId,
      scheduled_at: "2026-07-23T13:00:00Z",
      held: 1,
      notes: "Reviewed literature review draft; discussed requirements elicitation approach.",
      ...noLog,
    })
    meetings.push({
      meeting_id: meetingId++,
      student_id: studentId,
      supervisor_id: supervisorId,
      scheduled_at: "2026-08-11T13:00:00Z",
      held: 0,
      notes: null,
      ...noLog,
    })
  } else {
    // Behind students: no meeting since the kick-off — part of why they're flagged.
    meetings.push({
      meeting_id: meetingId++,
      student_id: studentId,
      supervisor_id: supervisorId,
      scheduled_at: "2026-08-06T13:00:00Z",
      held: 0,
      notes: null,
      ...noLog,
    })
  }
}

// ---------------------------------------------------------------------------
// At-risk flags (supervisor/admin-only — students never see their own flags)
// ---------------------------------------------------------------------------
const atRiskFlags: Row[] = [
  {
    flag_id: 1,
    student_id: 51,
    rule_code: "MILESTONE_OVERDUE",
    reason:
      "Milestone 'Requirements specification signed off' is overdue and not marked done, with no meeting logged in over 4 weeks.",
    raised_at: "2026-07-28T08:00:00Z",
    cleared_at: null,
  },
  {
    flag_id: 2,
    student_id: 300,
    rule_code: "NO_RECENT_MEETING",
    reason: "No supervision meeting logged for over 6 weeks.",
    raised_at: "2026-07-05T08:00:00Z",
    cleared_at: "2026-07-23T10:30:00Z",
  },
]

// ---------------------------------------------------------------------------
// Admin: users (all students + supervisors + admin, active/retired), audit
// log, preference window.
// ---------------------------------------------------------------------------
const users: Row[] = [
  ...students.map((s) => ({
    account_id: `student-${s.student_id}`,
    email: s.email,
    role: "student",
    display_name: `${s.first_name} ${s.last_name}`,
    active: true,
  })),
  ...supervisors.map((s) => ({
    account_id: `supervisor-${s.supervisor_id}`,
    email: s.email,
    role: "supervisor",
    display_name: `${s.title} ${s.first_name} ${s.last_name}`,
    active: true,
  })),
  {
    account_id: "admin-1",
    email: "jordan.blake@sunderland.ac.uk",
    role: "admin",
    display_name: "Jordan Blake",
    active: true,
  },
]

const auditLog: Row[] = [
  {
    entry_id: 1,
    occurred_at: "2026-08-01T08:55:00Z",
    event_type: "login",
    actor_email: "jordan.blake@sunderland.ac.uk",
    detail: "Admin login succeeded.",
  },
  {
    entry_id: 2,
    occurred_at: "2026-08-01T09:02:00Z",
    event_type: "login",
    actor_email: studentById.get(51)!.email,
    detail: "Student login succeeded.",
  },
  {
    entry_id: 3,
    occurred_at: "2026-08-02T14:12:00Z",
    event_type: "login_failed",
    actor_email: studentById.get(300)!.email,
    detail: "Failed login attempt (2 of 5 before lockout).",
  },
  {
    entry_id: 4,
    occurred_at: "2026-07-30T09:00:00Z",
    event_type: "role_change",
    actor_email: "jordan.blake@sunderland.ac.uk",
    detail: "Published allocation run run-2026-07-30-greedy-mock.",
  },
]

// Open by default (relative to the demo's "today" of 2026-08-04) so the
// student profile/preference flows are explorable out of the box; admin can
// close it to demonstrate FR-PROF-05's submission-window enforcement.
const preferenceWindow = {
  is_open: true,
  opens_at: "2026-07-01T00:00:00Z",
  closes_at: "2026-09-01T23:59:59Z",
}

// ---------------------------------------------------------------------------
// Write seed files
// ---------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true })

function write(name: string, data: unknown) {
  writeFileSync(resolve(OUT_DIR, `${name}.seed.json`), JSON.stringify(data, null, 2) + "\n")
}

write("demo-accounts", demoAccounts)
write("allocations", allocations)
write("allocation-runs", allocationRuns)
write("sprints", sprints)
write("milestones", milestones)
write("tasks", tasks)
write("meetings", meetings)
write("at-risk-flags", atRiskFlags)
write("users", users)
write("audit-log", auditLog)
write("preference-window", preferenceWindow)

console.log("✔ Seed data built:")
console.log(`  - demo-accounts.seed.json (${demoAccounts.length})`)
console.log(`  - allocations.seed.json (${allocations.length})`)
console.log(`  - allocation-runs.seed.json (${allocationRuns.length})`)
console.log(`  - sprints.seed.json (${sprints.length})`)
console.log(`  - milestones.seed.json (${milestones.length})`)
console.log(`  - tasks.seed.json (${tasks.length})`)
console.log(`  - meetings.seed.json (${meetings.length})`)
console.log(`  - at-risk-flags.seed.json (${atRiskFlags.length})`)
console.log(`  - users.seed.json (${users.length})`)
console.log(`  - audit-log.seed.json (${auditLog.length})`)
console.log(`  - preference-window.seed.json (1 record)`)
console.log("\nDemo accounts:")
for (const a of demoAccounts) console.log(`  ${a.role.padEnd(10)} ${a.email}  (${a.display_name})`)
