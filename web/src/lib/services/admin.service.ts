import { api, query } from "@/lib/api/client"
import type { AdminSupervisorRow, AdminUserRow, ListParams, Paginated } from "@/lib/types/dto"
import type { AuditLogEntry, PreferenceWindow, ResearchArea } from "@/lib/types/entities"

export async function listSupervisors(params?: ListParams): Promise<Paginated<AdminSupervisorRow>> {
  return api.get(
    `/admin/supervisors${query({
      page: params?.page,
      limit: params?.limit,
      search: params?.filter?.search as string | undefined,
    })}`,
  )
}

export async function listUsers(params?: ListParams): Promise<Paginated<AdminUserRow>> {
  return api.get(
    `/admin/users${query({
      page: params?.page,
      limit: params?.limit,
      role: params?.filter?.role as string | undefined,
      search: params?.filter?.search as string | undefined,
    })}`,
  )
}

export async function setUserActive(accountId: string, active: boolean): Promise<AdminUserRow> {
  return api.patch(`/admin/users/${accountId}`, { active })
}

export async function createAdmin(input: { displayName: string; email: string }): Promise<AdminUserRow> {
  return api.post("/admin/admins", input)
}

export async function updateAdmin(
  accountId: string,
  patch: { displayName?: string; email?: string },
): Promise<AdminUserRow> {
  return api.patch(`/admin/admins/${accountId}`, patch)
}

export async function setAdminActive(accountId: string, active: boolean): Promise<AdminUserRow> {
  return api.patch(`/admin/admins/${accountId}`, { active })
}

export async function deleteAdmin(accountId: string): Promise<void> {
  await api.delete(`/admin/admins/${accountId}`)
}

export async function listResearchAreas(): Promise<ResearchArea[]> {
  return api.get("/research-areas")
}

export async function createResearchArea(input: {
  code: string
  name: string
  description?: string
}): Promise<ResearchArea> {
  return api.post("/research-areas", input)
}

export async function getPreferenceWindow(): Promise<PreferenceWindow> {
  return api.get("/preference-window")
}

export async function setPreferenceWindow(patch: Partial<PreferenceWindow>): Promise<PreferenceWindow> {
  return api.put("/preference-window", patch)
}

export async function listAuditLog(params?: ListParams): Promise<Paginated<AuditLogEntry>> {
  return api.get(`/admin/audit-log${query({ page: params?.page, limit: params?.limit })}`)
}

/** Dev/demo convenience: restores the seeded dataset server-side. */
export async function resetDemoData(): Promise<void> {
  await api.post("/admin/reset-demo")
}
