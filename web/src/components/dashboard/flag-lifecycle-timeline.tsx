import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { AtRiskFlagView } from "@/lib/types/dto"
import { formatDateTime } from "@/lib/utils/date"

export function FlagLifecycleTimeline({
  flags,
  onMarkReviewed,
  onClear,
}: {
  flags: AtRiskFlagView[]
  onMarkReviewed: (flagId: number) => Promise<void>
  onClear: (flagId: number, note?: string) => Promise<void>
}) {
  const [noteByFlag, setNoteByFlag] = useState<Record<number, string>>({})

  if (flags.length === 0) {
    return <p className="text-sm text-muted-foreground">No at-risk flags for this student.</p>
  }

  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <Card key={flag.flag_id}>
          <CardContent className="space-y-2 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {flag.rule_code}
                </Badge>
                <Badge className={flag.cleared_at ? "bg-success text-success-foreground border-transparent" : "bg-destructive text-destructive-foreground border-transparent"}>
                  {flag.cleared_at ? "Cleared" : flag.reviewed ? "Reviewed" : "Raised"}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">Raised {formatDateTime(flag.raised_at)}</span>
            </div>
            <p className="text-sm">{flag.reason}</p>
            {flag.cleared_at ? (
              <p className="text-xs text-muted-foreground">Cleared {formatDateTime(flag.cleared_at)}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!flag.reviewed && (
                  <Button variant="outline" size="sm" onClick={() => onMarkReviewed(flag.flag_id)}>
                    Mark reviewed
                  </Button>
                )}
                <input
                  placeholder="Clearing note (optional)"
                  value={noteByFlag[flag.flag_id] ?? ""}
                  onChange={(e) => setNoteByFlag({ ...noteByFlag, [flag.flag_id]: e.target.value })}
                  className="h-8 flex-1 min-w-40 rounded-md border border-input bg-transparent px-2 text-xs"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    await onClear(flag.flag_id, noteByFlag[flag.flag_id])
                    toast.success("Flag cleared.")
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
