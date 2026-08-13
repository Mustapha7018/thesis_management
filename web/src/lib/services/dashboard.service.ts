import { api, query } from "@/lib/api/client"
import type { AtRiskFlagView, CohortStudentSummary, ListParams, Paginated, StudentDetail } from "@/lib/types/dto"

export async function listSupervisorCohort(
  supervisorId: number,
  params?: ListParams,
): Promise<Paginated<CohortStudentSummary>> {
  return api.get(`/supervisors/${supervisorId}/cohort${query({ page: params?.page, limit: params?.limit })}`)
}

export async function listAdminCohortOverview(params?: ListParams): Promise<Paginated<CohortStudentSummary>> {
  return api.get(
    `/admin/cohort-overview${query({
      page: params?.page,
      limit: params?.limit,
      search: params?.filter?.search as string | undefined,
    })}`,
  )
}

export async function getStudentDetail(studentId: number): Promise<StudentDetail> {
  return api.get(`/students/${studentId}/detail`)
}

export async function listAtRiskFlags(filter: {
  studentId?: number
  supervisorId?: number
  active?: boolean
}): Promise<AtRiskFlagView[]> {
  return api.get(
    `/at-risk-flags${query({ studentId: filter.studentId, supervisorId: filter.supervisorId, active: filter.active })}`,
  )
}

export async function markFlagReviewed(flagId: number): Promise<void> {
  await api.post(`/at-risk-flags/${flagId}/review`)
}

export async function clearFlag(flagId: number, note?: string): Promise<AtRiskFlagView> {
  return api.post(`/at-risk-flags/${flagId}/clear`, { note })
}
