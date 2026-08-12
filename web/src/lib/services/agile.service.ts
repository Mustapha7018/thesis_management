import { getDb, nextId, saveDb } from "./db/store"
import { paginate } from "./db/query-helpers"
import type { ListParams, MilestoneInput, Paginated, ProgressSummary, SprintInput, TaskInput } from "@/lib/types/dto"
import type { Milestone, MilestoneStatus, Sprint, Task, TaskStatus } from "@/lib/types/entities"
import { isPast } from "@/lib/utils/date"
import { readFileAsDataUrl, validateUploadFile } from "@/lib/utils/file-upload"

/** FR-AGILE-05: recompute overdue status on read rather than via a background job. */
function withOverdueRecomputed(milestone: Milestone): Milestone {
  if (milestone.status !== "done" && milestone.status !== "overdue" && isPast(milestone.due_date)) {
    return { ...milestone, status: "overdue" }
  }
  return milestone
}

// ---------------------------------------------------------------------------
// Sprints (FR-AGILE-01)
// ---------------------------------------------------------------------------

export async function listMySprints(studentId: number): Promise<Sprint[]> {
  return getDb().sprints.filter((s) => s.student_id === studentId)
}

export async function createSprint(studentId: number, input: SprintInput): Promise<Sprint> {
  if (input.end_date < input.start_date) throw new Error("End date must be on or after the start date.")
  const db = getDb()
  const sprint: Sprint = {
    sprint_id: nextId(db.sprints, "sprint_id"),
    student_id: studentId,
    name: input.name,
    goal: input.goal ?? null,
    start_date: input.start_date,
    end_date: input.end_date,
  }
  db.sprints.push(sprint)
  saveDb()
  return sprint
}

export async function updateSprint(sprintId: number, patch: Partial<SprintInput>): Promise<Sprint> {
  const db = getDb()
  const sprint = db.sprints.find((s) => s.sprint_id === sprintId)
  if (!sprint) throw new Error("Sprint not found.")
  const next = { ...sprint, ...patch }
  if (next.end_date < next.start_date) throw new Error("End date must be on or after the start date.")
  Object.assign(sprint, next)
  saveDb()
  return sprint
}

export async function deleteSprint(sprintId: number): Promise<void> {
  const db = getDb()
  db.sprints = db.sprints.filter((s) => s.sprint_id !== sprintId)
  saveDb()
}

// ---------------------------------------------------------------------------
// Milestones (FR-AGILE-02/05)
// ---------------------------------------------------------------------------

export async function listMyMilestones(studentId: number, params?: ListParams): Promise<Paginated<Milestone>> {
  const rows = getDb()
    .milestones.filter((m) => m.student_id === studentId)
    .map(withOverdueRecomputed)
  return paginate(rows, params)
}

export async function createMilestone(studentId: number, input: MilestoneInput): Promise<Milestone> {
  const db = getDb()
  const milestone: Milestone = {
    milestone_id: nextId(db.milestones, "milestone_id"),
    student_id: studentId,
    title: input.title,
    description: input.description ?? null,
    due_date: input.due_date,
    status: input.status ?? "planned",
    created_at: new Date().toISOString(),
    attachment_name: null,
    attachment_type: null,
    attachment_data: null,
  }
  db.milestones.push(milestone)
  saveDb()
  return milestone
}

export async function setMilestoneStatus(milestoneId: number, status: MilestoneStatus): Promise<Milestone> {
  const db = getDb()
  const milestone = db.milestones.find((m) => m.milestone_id === milestoneId)
  if (!milestone) throw new Error("Milestone not found.")
  milestone.status = status
  saveDb()
  return milestone
}

/** Deliverable attached to a milestone (PDF/Word), stored as a base64 data URL. */
export async function uploadMilestoneAttachment(milestoneId: number, file: File): Promise<Milestone> {
  const error = validateUploadFile(file)
  if (error) throw new Error(error)

  const db = getDb()
  const milestone = db.milestones.find((m) => m.milestone_id === milestoneId)
  if (!milestone) throw new Error("Milestone not found.")

  milestone.attachment_data = await readFileAsDataUrl(file)
  milestone.attachment_name = file.name
  milestone.attachment_type = file.type
  saveDb()
  return milestone
}

export async function removeMilestoneAttachment(milestoneId: number): Promise<Milestone> {
  const db = getDb()
  const milestone = db.milestones.find((m) => m.milestone_id === milestoneId)
  if (!milestone) throw new Error("Milestone not found.")
  milestone.attachment_data = null
  milestone.attachment_name = null
  milestone.attachment_type = null
  saveDb()
  return milestone
}

// ---------------------------------------------------------------------------
// Tasks (FR-AGILE-03/04)
// ---------------------------------------------------------------------------

export async function listMyTasks(
  studentId: number,
  filter?: { sprintId?: number; milestoneId?: number; status?: TaskStatus },
): Promise<Task[]> {
  return getDb().tasks.filter(
    (t) =>
      t.student_id === studentId &&
      (filter?.sprintId === undefined || t.sprint_id === filter.sprintId) &&
      (filter?.milestoneId === undefined || t.milestone_id === filter.milestoneId) &&
      (filter?.status === undefined || t.status === filter.status),
  )
}

export async function createTask(studentId: number, input: TaskInput): Promise<Task> {
  const db = getDb()
  const task: Task = {
    task_id: nextId(db.tasks, "task_id"),
    sprint_id: input.sprint_id ?? null,
    milestone_id: input.milestone_id ?? null,
    student_id: studentId,
    title: input.title,
    priority: input.priority,
    status: input.status ?? "todo",
    created_at: new Date().toISOString(),
    updated_at: null,
  }
  db.tasks.push(task)
  saveDb()
  return task
}

export async function updateTaskStatus(taskId: number, status: TaskStatus): Promise<Task> {
  const db = getDb()
  const task = db.tasks.find((t) => t.task_id === taskId)
  if (!task) throw new Error("Task not found.")
  task.status = status
  task.updated_at = new Date().toISOString()
  saveDb()
  return task
}

// ---------------------------------------------------------------------------
// Progress (FR-AGILE-06) — shared by student + supervisor/admin views.
// ---------------------------------------------------------------------------

export async function getStudentProgress(studentId: number): Promise<ProgressSummary> {
  const db = getDb()
  const milestones = db.milestones.filter((m) => m.student_id === studentId).map(withOverdueRecomputed)
  const tasks = db.tasks.filter((t) => t.student_id === studentId)

  const milestonesDone = milestones.filter((m) => m.status === "done").length
  const milestonesOverdue = milestones.filter((m) => m.status === "overdue").length
  const tasksDone = tasks.filter((t) => t.status === "done").length

  const totalUnits = milestones.length + tasks.length
  const doneUnits = milestonesDone + tasksDone
  const percentComplete = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0

  return {
    student_id: studentId,
    milestones_total: milestones.length,
    milestones_done: milestonesDone,
    milestones_overdue: milestonesOverdue,
    tasks_total: tasks.length,
    tasks_done: tasksDone,
    percent_complete: percentComplete,
  }
}
