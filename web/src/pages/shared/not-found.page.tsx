import { CompassIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { useAuth } from "@/context/auth-context"
import { homeForRole, routePaths } from "@/routes/route-paths"

export function NotFoundPage() {
  const { session } = useAuth()
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <EmptyState
        icon={CompassIcon}
        title="Page not found"
        description="The page you're looking for doesn't exist."
        action={
          <Button asChild>
            <Link to={session ? homeForRole(session.role) : routePaths.login}>Go back</Link>
          </Button>
        }
      />
    </div>
  )
}
