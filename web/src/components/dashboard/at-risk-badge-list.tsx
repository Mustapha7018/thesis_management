import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import type { AtRiskFlagView } from "@/lib/types/dto"
import { formatDateTime } from "@/lib/utils/date"

export function AtRiskBadgeList({
  flags,
  studentName,
  detailHrefFor,
}: {
  flags: AtRiskFlagView[]
  studentName: (studentId: number) => string
  detailHrefFor?: (studentId: number) => string
}) {
  if (flags.length === 0) {
    return <p className="text-sm text-muted-foreground">No active at-risk flags. Everyone's on track.</p>
  }

  return (
    <div className="space-y-2">
      {flags.map((flag) => (
        <div key={flag.flag_id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium">
                {detailHrefFor ? (
                  <Link to={detailHrefFor(flag.student_id)} className="text-link hover:underline">
                    {studentName(flag.student_id)}
                  </Link>
                ) : (
                  studentName(flag.student_id)
                )}
              </p>
              <p className="text-sm text-muted-foreground">{flag.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">Raised {formatDateTime(flag.raised_at)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {flag.rule_code}
            </Badge>
            {flag.reviewed && (
              <Badge variant="outline" className="text-[10px]">
                Reviewed
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
