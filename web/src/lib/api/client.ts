/**
 * Single HTTP client for the versioned REST API (FR-API-01). Injects the JWT,
 * unwraps the server's {error:{message,details}} envelope into a thrown
 * Error so every existing toast/catch keeps working, and treats a 401 as a
 * hard session expiry (clear + redirect to login).
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1"
const TOKEN_KEY = "thesis-portal:v1:token"
const SESSION_KEY = "thesis-portal:v1:session"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeAuth(token: string, sessionJson: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(SESSION_KEY, sessionJson)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
}

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers["content-type"] = "application/json"

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && token && !path.startsWith("/auth/")) {
    // Token expired or revoked mid-session: clean logout.
    clearAuth()
    window.location.assign("/login")
    throw new ApiError(401, "Session expired — please log in again.")
  }

  if (res.status === 204) return undefined as T

  const json = (await res.json().catch(() => null)) as { error?: { message?: string; details?: unknown } } | null
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.message ?? `Request failed (${res.status}).`, json?.error?.details)
  }
  return json as T
}

async function requestText(path: string): Promise<string> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status}).`)
  return res.text()
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  text: requestText,
}

/** Serialises ListParams-style options into a query string. */
export function query(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") searchParams.set(key, String(value))
  }
  const s = searchParams.toString()
  return s ? `?${s}` : ""
}
