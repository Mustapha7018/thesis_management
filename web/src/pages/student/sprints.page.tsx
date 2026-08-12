import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { SprintForm } from "@/components/agile/sprint-form"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { createSprint, listMySprints } from "@/lib/services/agile.service"
import { formatDate } from "@/lib/utils/date"

export function SprintsPage() {
  const { session } = useAuth()
  const studentId = session!.ref_id!
  const queryClient = useQueryClient()

  const sprintsQuery = useQuery({ queryKey: ["sprints", studentId], queryFn: () => listMySprints(studentId) })

  return (
    <div>
      <PageHeader
        title="Sprints"
        description="Plan your work in time-boxed sprints."
        actions={
          <SprintForm
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                New sprint
              </Button>
            }
            onSubmit={async (input) => {
              await createSprint(studentId, input)
              await queryClient.invalidateQueries({ queryKey: ["sprints", studentId] })
            }}
          />
        }
      />
      {sprintsQuery.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : !sprintsQuery.data || sprintsQuery.data.length === 0 ? (
        <EmptyState title="No sprints yet" description="Create your first sprint to start planning." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sprintsQuery.data.map((sprint) => (
            <Card key={sprint.sprint_id}>
              <CardHeader>
                <CardTitle className="text-base">{sprint.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {sprint.goal && <p className="text-muted-foreground">{sprint.goal}</p>}
                <p className="text-xs text-muted-foreground">
                  {formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
