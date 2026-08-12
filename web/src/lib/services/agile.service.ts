import { api, query } from "@/lib/api/client"
import type { ListParams, MilestoneInput, Paginated, ProgressSummary, SprintInput, TaskInput } from "@/lib/types/dto"
import type { Milestone, MilestoneStatus, Sprint, Task, TaskStatus } from "@/lib/types/entities"
import { readFileAsDataUrl, validateUploadFile } from "@/lib/utils/file-upload"

export async function listMySprints(studentId: number): Promise<Sprint[]> {
  return api.get(`/students/${studentId}/sprints`)
}

export async function createSprint(studentId: number, input: SprintInput): Promise<Sprint> {
  return api.post(`/students/${studentId}/sprints`, input)
}

export async function updateSprint(sprintId: number, patch: Partial<SprintInput>): Promise<Sprint> {
  return api.patch(`/sprints/${sprintId}`, patch)
}

export async function deleteSprint(sprintId: number): Promise<void> {
  await api.delete(`/sprints/${sprintId}`)
}

export async function listMyMilestones(studentId: number, params?: ListParams): Promise<Paginated<Milestone>> {
  return api.get(`/students/${studentId}/milestones${query({ page: params?.page, limit: params?.limit })}`)
}

export async function createMilestone(studentId: number, input: MilestoneInput): Promise<Milestone> {
  return api.post(`/students/${studentId}/milestones`, input)
}

export async function setMilestoneStatus(milestoneId: number, status: MilestoneStatus): Promise<Milestone> {
  return api.patch(`/milestones/${milestoneId}`, { status })
}

/** Deliverable attached to a milestone (PDF/Word), sent as a base64 data URL. */
export async function uploadMilestoneAttachment(milestoneId: number, file: File): Promise<Milestone> {
  const error = validateUploadFile(file)
  if (error) throw new Error(error)
  const dataUrl = await readFileAsDataUrl(file)
  return api.put(`/milestones/${milestoneId}/attachment`, {
    file_name: file.name,
    file_type: file.type,
    data_url: dataUrl,
  })
}

export async function removeMilestoneAttachment(milestoneId: number): Promise<Milestone> {
  return api.delete(`/milestones/${milestoneId}/attachment`)
}

export async function listMyTasks(
  studentId: number,
  filter?: { sprintId?: number; milestoneId?: number; status?: TaskStatus },
): Promise<Task[]> {
  return api.get(
    `/students/${studentId}/tasks${query({
      sprintId: filter?.sprintId,
      milestoneId: filter?.milestoneId,
      status: filter?.status,
    })}`,
  )
}

export async function createTask(studentId: number, input: TaskInput): Promise<Task> {
  return api.post(`/students/${studentId}/tasks`, input)
}

export async function updateTaskStatus(taskId: number, status: TaskStatus): Promise<Task> {
  return api.patch(`/tasks/${taskId}`, { status })
}

export async function getStudentProgress(studentId: number): Promise<ProgressSummary> {
  return api.get(`/students/${studentId}/progress`)
}
