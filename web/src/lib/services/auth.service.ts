import { getDb, nextId, saveDb } from "./db/store"
import type { AuthSession, DemoAccountSummary } from "@/lib/types/dto"
import { isValidUniversityEmail } from "@/lib/utils/validation"

const SESSION_KEY = "thesis-portal:v1:session"

export async function login(email: string): Promise<AuthSession> {
  const trimmed = email.trim()
  if (!isValidUniversityEmail(trimmed)) {
    throw new Error(
      "That doesn't look like a Sunderland account. Students use a 6-character code @student.sunderland.ac.uk; staff use firstname.lastname@sunderland.ac.uk.",
    )
  }

  const db = getDb()
  const account = db.demoAccounts.find((a) => a.email.toLowerCase() === trimmed.toLowerCase())

  if (!account || !account.active) {
    db.auditLog.push({
      entry_id: nextId(db.auditLog, "entry_id"),
      occurred_at: new Date().toISOString(),
      event_type: "login_failed",
      actor_email: trimmed,
      detail: account ? "Login attempted on a retired account." : "Login attempted for an unrecognised account.",
    })
    saveDb()
    throw new Error("No matching demo account. Pick one from the list below.")
  }

  db.auditLog.push({
    entry_id: nextId(db.auditLog, "entry_id"),
    occurred_at: new Date().toISOString(),
    event_type: "login",
    actor_email: account.email,
    detail: `${account.role} login succeeded.`,
  })
  saveDb()

  const session: AuthSession = {
    account_id: account.account_id,
    email: account.email,
    role: account.role,
    ref_id: account.ref_id,
    display_name: account.display_name,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function getSession(): AuthSession | null {
  if (typeof localStorage === "undefined") return null
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function listDemoAccounts(): DemoAccountSummary[] {
  return getDb()
    .demoAccounts.filter((a) => a.active)
    .map((a) => ({
      account_id: a.account_id,
      email: a.email,
      role: a.role,
      display_name: a.display_name,
    }))
}
