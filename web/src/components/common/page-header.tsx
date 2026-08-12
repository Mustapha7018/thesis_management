import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  showBackButton?: boolean
}

export function PageHeader({ title, description, actions, showBackButton = false }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {showBackButton && (
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1 text-muted-foreground" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
