import { Progress } from "@/components/ui/progress"
import type { ProgressSummary } from "@/lib/types/dto"

export function ProgressIndicator({ progress }: { progress: ProgressSummary }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Overall progress</span>
        <span className="font-medium">{progress.percent_complete}%</span>
      </div>
      <Progress value={progress.percent_complete} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Milestones: {progress.milestones_done}/{progress.milestones_total}
        </span>
        <span>
          Tasks: {progress.tasks_done}/{progress.tasks_total}
        </span>
        {progress.milestones_overdue > 0 && (
          <span className="font-medium text-destructive">{progress.milestones_overdue} overdue</span>
        )}
      </div>
    </div>
  )
}
