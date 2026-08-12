import { getSession } from "./auth.service"
import { getDb, nextId, saveDb } from "./db/store"
import type { Db } from "./db/store"
import { paginate } from "./db/query-helpers"
import type { AdminSupervisorRow, AdminUserRow, ListParams, Paginated } from "@/lib/types/dto"
import type { AuditLogEntry, PreferenceWindow, ResearchArea } from "@/lib/types/entities"
import { isStaffEmail } from "@/lib/utils/validation"

// ---------------------------------------------------------------------------
// Supervisors (admin browse/drill-down)
// ---------------------------------------------------------------------------

export async function listSupervisors(params?: ListParams): Promise<Paginated<AdminSupervisorRow>> {
  const db = getDb()
  const publishedRun = db.allocationRuns.find((r) => r.published)

  let rows: AdminSupervisorRow[] = db.supervisors.map((s) => ({
    supervisor_id: s.supervisor_id,
    name: `${s.title} ${s.first_name} ${s.last_name}`,
    email: s.email,
    seniority: s.seniority,
    quota_min: s.quota_min,
    quota_max: s.quota_max,
    allocated_count: publishedRun
      ? db.allocations.filter((a) => a.run_id === publishedRun.run_id && a.supervisor_id === s.supervisor_id).length
      : 0,
  }))

  const search = params?.filter?.search
  if (search && typeof search === "string") {
    const needle = search.trim().toLowerCase()
    if (needle) {
      rows = rows.filter((r) => r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle))
    }
  }
  return paginate(rows, params)
}

// ---------------------------------------------------------------------------
// Users (FR-AUTH-06)
// ---------------------------------------------------------------------------

export async function listUsers(params?: ListParams): Promise<Paginated<AdminUserRow>> {
  const db = getDb()
  let rows = db.users
  const roleFilter = params?.filter?.role
  if (roleFilter) rows = rows.filter((u) => u.role === roleFilter)
  const search = params?.filter?.search
  if (search && typeof search === "string") {
    const needle = search.trim().toLowerCase()
    if (needle) {
      rows = rows.filter(
        (u) => u.display_name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
      )
    }
  }
  return paginate(rows, params)
}

export async function setUserActive(accountId: string, active: boolean): Promise<AdminUserRow> {
  const db = getDb()
  const user = db.users.find((u) => u.account_id === accountId)
  if (!user) throw new Error("User not found.")
  user.active = active

  const demoAccount = db.demoAccounts.find((a) => a.account_id === accountId)
  if (demoAccount) demoAccount.active = active

  db.auditLog.push({
    entry_id: nextId(db.auditLog, "entry_id"),
    occurred_at: new Date().toISOString(),
    event_type: "role_change",
    actor_email: actorEmail(),
    detail: `${active ? "Reactivated" : "Retired"} user ${user.email}.`,
  })
  saveDb()
  return user
}

// ---------------------------------------------------------------------------
// Admin accounts (FR-AUTH-06) — guards live here, not in the UI, so they
// survive when a real API replaces this layer.
// ---------------------------------------------------------------------------

function actorEmail(): string {
  return getSession()?.email ?? "admin"
}

function nextAdminAccountId(db: Db): string {
  const suffixes = [...db.users, ...db.demoAccounts]
    .filter((row) => row.account_id.startsWith("admin-"))
    .map((row) => Number(row.account_id.slice("admin-".length)) || 0)
  return `admin-${Math.max(0, ...suffixes) + 1}`
}

function assertEmailAvailable(db: Db, email: string, excludeAccountId?: string) {
  const needle = email.toLowerCase()
  const taken =
    db.users.some((u) => u.account_id !== excludeAccountId && u.email.toLowerCase() === needle) ||
    db.demoAccounts.some((a) => a.account_id !== excludeAccountId && a.email.toLowerCase() === needle)
  if (taken) throw new Error(`An account with email ${email} already exists.`)
}

function assertNotSelf(accountId: string, action: string) {
  if (getSession()?.account_id === accountId) {
    throw new Error(`You cannot ${action} your own account.`)
  }
}

function assertNotLastActiveAdmin(db: Db, accountId: string) {
  const otherActiveAdmins = db.users.filter(
    (u) => u.role === "admin" && u.active && u.account_id !== accountId,
  )
  if (otherActiveAdmins.length === 0) {
    throw new Error("Cannot retire or delete the last active admin.")
  }
}

function findAdmin(db: Db, accountId: string): AdminUserRow {
  const user = db.users.find((u) => u.account_id === accountId)
  if (!user || user.role !== "admin") throw new Error("Admin account not found.")
  return user
}

export async function createAdmin(input: { displayName: string; email: string }): Promise<AdminUserRow> {
  const email = input.email.trim()
  const displayName = input.displayName.trim()
  if (!isStaffEmail(email)) {
    throw new Error("Admin email must be firstname.lastname@sunderland.ac.uk.")
  }
  if (!displayName) throw new Error("Display name is required.")

  const db = getDb()
  assertEmailAvailable(db, email)

  const accountId = nextAdminAccountId(db)
  const user: AdminUserRow = { account_id: accountId, email, role: "admin", display_name: displayName, active: true }
  db.users.push(user)
  db.demoAccounts.push({ account_id: accountId, email, role: "admin", ref_id: null, display_name: displayName, active: true })

  db.auditLog.push({
    entry_id: nextId(db.auditLog, "entry_id"),
    occurred_at: new Date().toISOString(),
    event_type: "account_created",
    actor_email: actorEmail(),
    detail: `Created admin account ${email}.`,
  })
  saveDb()
  return user
}

export async function updateAdmin(
  accountId: string,
  patch: { displayName?: string; email?: string },
): Promise<AdminUserRow> {
  const db = getDb()
  const user = findAdmin(db, accountId)
  const previousEmail = user.email

  if (patch.email !== undefined) {
    const email = patch.email.trim()
    if (!isStaffEmail(email)) {
      throw new Error("Admin email must be firstname.lastname@sunderland.ac.uk.")
    }
    assertEmailAvailable(db, email, accountId)
    user.email = email
  }
  if (patch.displayName !== undefined) {
    const displayName = patch.displayName.trim()
    if (!displayName) throw new Error("Display name is required.")
    user.display_name = displayName
  }

  const demoAccount = db.demoAccounts.find((a) => a.account_id === accountId)
  if (demoAccount) {
    demoAccount.email = user.email
    demoAccount.display_name = user.display_name
  }

  db.auditLog.push({
    entry_id: nextId(db.auditLog, "entry_id"),
    occurred_at: new Date().toISOString(),
    event_type: "role_change",
    actor_email: actorEmail(),
    detail: `Updated admin account ${previousEmail}${user.email !== previousEmail ? ` (email now ${user.email})` : ""}.`,
  })
  saveDb()
  return user
}

export async function setAdminActive(accountId: string, active: boolean): Promise<AdminUserRow> {
  const db = getDb()
  findAdmin(db, accountId)
  if (!active) {
    assertNotSelf(accountId, "retire")
    assertNotLastActiveAdmin(db, accountId)
  }
  return setUserActive(accountId, active)
}

export async function deleteAdmin(accountId: string): Promise<void> {
  const db = getDb()
  const user = findAdmin(db, accountId)
  assertNotSelf(accountId, "delete")
  assertNotLastActiveAdmin(db, accountId)

  db.users = db.users.filter((u) => u.account_id !== accountId)
  db.demoAccounts = db.demoAccounts.filter((a) => a.account_id !== accountId)

  db.auditLog.push({
    entry_id: nextId(db.auditLog, "entry_id"),
    occurred_at: new Date().toISOString(),
    event_type: "account_deleted",
    actor_email: actorEmail(),
    detail: `Deleted admin account ${user.email}.`,
  })
  saveDb()
}

// ---------------------------------------------------------------------------
// Research areas (FR-AUTH-06)
// ---------------------------------------------------------------------------

export async function listResearchAreas(): Promise<ResearchArea[]> {
  return getDb().researchAreas
}

export async function createResearchArea(input: { code: string; name: string; description?: string }): Promise<ResearchArea> {
  const db = getDb()
  if (db.researchAreas.some((a) => a.code === input.code)) {
    throw new Error(`Area code "${input.code}" already exists.`)
  }
  const area: ResearchArea = {
    area_id: nextId(db.researchAreas, "area_id"),
    code: input.code,
    name: input.name,
    description: input.description ?? null,
  }
  db.researchAreas.push(area)
  saveDb()
  return area
}

// ---------------------------------------------------------------------------
// Preference window (FR-PROF-05)
// ---------------------------------------------------------------------------

export async function getPreferenceWindow(): Promise<PreferenceWindow> {
  return getDb().preferenceWindow
}

export async function setPreferenceWindow(patch: Partial<PreferenceWindow>): Promise<PreferenceWindow> {
  const db = getDb()
  db.preferenceWindow = { ...db.preferenceWindow, ...patch }
  db.auditLog.push({
    entry_id: nextId(db.auditLog, "entry_id"),
    occurred_at: new Date().toISOString(),
    event_type: "role_change",
    actor_email: actorEmail(),
    detail: `Preference window set to ${db.preferenceWindow.is_open ? "open" : "closed"}.`,
  })
  saveDb()
  return db.preferenceWindow
}

// ---------------------------------------------------------------------------
// Audit log (FR-AUTH-07)
// ---------------------------------------------------------------------------

export async function listAuditLog(params?: ListParams): Promise<Paginated<AuditLogEntry>> {
  const rows = [...getDb().auditLog].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  )
  return paginate(rows, params)
}
