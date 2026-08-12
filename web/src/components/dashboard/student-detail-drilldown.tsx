import { ProgressIndicator } from "@/components/agile/progress-indicator"
import { FileAttachmentChip } from "@/components/common/file-attachment-chip"
import { StatusBadge } from "@/components/common/status-badge"
import { FlagLifecycleTimeline } from "@/components/dashboard/flag-lifecycle-timeline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AtRiskFlagView, StudentDetail } from "@/lib/types/dto"
import { formatDate, formatDateTime } from "@/lib/utils/date"

export function StudentDetailDrilldown({
  detail,
  flags,
  onMarkReviewed,
  onClear,
}: {
  detail: StudentDetail
  flags: AtRiskFlagView[]
  onMarkReviewed: (flagId: number) => Promise<void>
  onClear: (flagId: number, note?: string) => Promise<void>
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressIndicator progress={detail.progress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">At-risk flags</CardTitle>
        </CardHeader>
        <CardContent>
          <FlagLifecycleTimeline flags={flags} onMarkReviewed={onMarkReviewed} onClear={onClear} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones yet.</p>}
          {detail.milestones.map((m) => (
            <div key={m.milestone_id} className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">Due {formatDate(m.due_date)}</p>
                {m.attachment_name && (
                  <div className="mt-1">
                    <FileAttachmentChip fileName={m.attachment_name} fileType={m.attachment_type!} fileData={m.attachment_data!} />
                  </div>
                )}
              </div>
              <StatusBadge value={m.status} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meetings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.meetings.length === 0 && <p className="text-sm text-muted-foreground">No meetings logged yet.</p>}
          {detail.meetings.map((m) => (
            <div key={m.meeting_id} className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0">
              <div>
                <p className="text-sm">{formatDateTime(m.scheduled_at)}</p>
                {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                {m.log_file_name && (
                  <div className="mt-1">
                    <FileAttachmentChip fileName={m.log_file_name} fileType={m.log_file_type!} fileData={m.log_file_data!} />
                  </div>
                )}
              </div>
              <StatusBadge value={m.held ? "done" : "planned"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
