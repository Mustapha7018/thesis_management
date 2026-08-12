import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { getSession, login as loginService, logout as logoutService } from "@/lib/services/auth.service"
import type { AuthSession } from "@/lib/types/dto"

interface AuthContextValue {
  session: AuthSession | null
  login: (email: string, password: string) => Promise<AuthSession>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getSession())

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      login: async (email: string, password: string) => {
        const s = await loginService(email, password)
        setSession(s)
        return s
      },
      logout: () => {
        logoutService()
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
