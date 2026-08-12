import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { MilestoneAttachment } from "@/components/agile/milestone-attachment"
import { MilestoneForm } from "@/components/agile/milestone-form"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import {
  createMilestone,
  listMyMilestones,
  removeMilestoneAttachment,
  setMilestoneStatus,
  uploadMilestoneAttachment,
} from "@/lib/services/agile.service"
import type { MilestoneStatus } from "@/lib/types/entities"
import { formatDate } from "@/lib/utils/date"

export function MilestonesPage() {
  const { session } = useAuth()
  const studentId = session!.ref_id!
  const queryClient = useQueryClient()

  const milestonesQuery = useQuery({
    queryKey: ["milestones", studentId],
    queryFn: () => listMyMilestones(studentId),
  })

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["milestones", studentId] })
    await queryClient.invalidateQueries({ queryKey: ["progress", studentId] })
  }

  return (
    <div>
      <PageHeader
        title="Milestones"
        description="Key deliverables with due dates. Overdue status is set automatically."
        actions={
          <MilestoneForm
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                New milestone
              </Button>
            }
            onSubmit={async (input) => {
              await createMilestone(studentId, input)
              await invalidate()
            }}
          />
        }
      />
      {milestonesQuery.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : !milestonesQuery.data || milestonesQuery.data.total === 0 ? (
        <EmptyState title="No milestones yet" description="Add your first milestone to start tracking deliverables." />
      ) : (
        <div className="space-y-3">
          {milestonesQuery.data.data.map((milestone) => (
            <Card key={milestone.milestone_id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{milestone.title}</p>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground">{milestone.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(milestone.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={milestone.status} />
                    {milestone.status !== "overdue" && (
                      <Select
                        value={milestone.status}
                        onValueChange={async (value) => {
                          await setMilestoneStatus(milestone.milestone_id, value as MilestoneStatus)
                          await invalidate()
                        }}
                      >
                        <SelectTrigger size="sm" className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <MilestoneAttachment
                  milestone={milestone}
                  onUpload={async (file) => {
                    await uploadMilestoneAttachment(milestone.milestone_id, file)
                    await invalidate()
                  }}
                  onRemove={async () => {
                    await removeMilestoneAttachment(milestone.milestone_id)
                    await invalidate()
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
