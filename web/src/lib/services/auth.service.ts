import { api, clearAuth, storeAuth } from "@/lib/api/client"
import type { AuthSession } from "@/lib/types/dto"

const SESSION_KEY = "thesis-portal:v1:session"

export async function login(email: string, password: string): Promise<AuthSession> {
  const { token, session } = await api.post<{ token: string; session: AuthSession }>("/auth/login", {
    email: email.trim(),
    password,
  })
  storeAuth(token, JSON.stringify(session))
  return session
}

export function logout(): void {
  clearAuth()
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
