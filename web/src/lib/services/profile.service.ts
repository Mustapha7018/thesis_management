import { api } from "@/lib/api/client"
import type { ApplicantView, SupervisorBrief } from "@/lib/types/dto"
import type { ResearchArea, StudentInterest, StudentPreference, SupervisorExpertise } from "@/lib/types/entities"

export async function listResearchAreas(): Promise<ResearchArea[]> {
  return api.get("/research-areas")
}

export async function listSupervisorsBrief(): Promise<SupervisorBrief[]> {
  return api.get("/supervisors/brief")
}

export async function getMyInterests(studentId: number): Promise<StudentInterest[]> {
  return api.get(`/students/${studentId}/interests`)
}

export async function setMyInterests(
  studentId: number,
  interests: { areaId: number; rank: 1 | 2 | 3 }[],
): Promise<void> {
  await api.put(`/students/${studentId}/interests`, { interests })
}

export async function getMyPreferenceList(studentId: number): Promise<StudentPreference[]> {
  return api.get(`/students/${studentId}/preferences`)
}

export async function setMyPreferenceList(studentId: number, supervisorIdsInRankOrder: number[]): Promise<void> {
  await api.put(`/students/${studentId}/preferences`, { supervisorIdsInRankOrder })
}

export async function getMyExpertise(supervisorId: number): Promise<SupervisorExpertise[]> {
  return api.get(`/supervisors/${supervisorId}/expertise`)
}

export async function setMyExpertise(
  supervisorId: number,
  expertise: { areaId: number; proficiency: 1 | 2 | 3 }[],
): Promise<void> {
  await api.put(`/supervisors/${supervisorId}/expertise`, { expertise })
}

export async function listApplicants(supervisorId: number): Promise<ApplicantView[]> {
  return api.get(`/supervisors/${supervisorId}/applicants`)
}

export async function scoreApplicant(supervisorId: number, studentId: number, score: number): Promise<void> {
  await api.put(`/supervisors/${supervisorId}/applicants/${studentId}/score`, { score })
}
