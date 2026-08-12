import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { homeForRole, routePaths } from "@/routes/route-paths"
import type { Role } from "@/lib/types/entities"

export function RequireAuth() {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) {
    return <Navigate to={routePaths.login} replace state={{ from: location }} />
  }
  return <Outlet />
}

export function RequireRole({ role }: { role: Role }) {
  const { session } = useAuth()

  if (!session) return <Navigate to={routePaths.login} replace />
  if (session.role !== role) return <Navigate to={homeForRole(session.role)} replace />
  return <Outlet />
}
