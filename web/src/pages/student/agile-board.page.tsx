import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { KanbanBoard } from "@/components/agile/kanban-board"
import { TaskForm } from "@/components/agile/task-form"
import { TimelineChart } from "@/components/agile/timeline-chart"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/context/auth-context"
import { createTask, listMyMilestones, listMySprints, listMyTasks, updateTaskStatus } from "@/lib/services/agile.service"
import type { Task, TaskStatus } from "@/lib/types/entities"

export function AgileBoardPage() {
  const { session } = useAuth()
  const studentId = session!.ref_id!
  const queryClient = useQueryClient()

  const tasksQuery = useQuery({ queryKey: ["tasks", studentId], queryFn: () => listMyTasks(studentId) })
  const sprintsQuery = useQuery({ queryKey: ["sprints", studentId], queryFn: () => listMySprints(studentId) })
  const milestonesQuery = useQuery({
    queryKey: ["milestones", studentId],
    queryFn: () => listMyMilestones(studentId, { limit: 100 }),
  })

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["tasks", studentId] })
    await queryClient.invalidateQueries({ queryKey: ["progress", studentId] })
  }

  return (
    <div>
      <PageHeader
        title="Agile board"
        description="Track tasks on the board, or see sprints and milestones plotted over time."
        actions={
          <TaskForm
            sprints={sprintsQuery.data ?? []}
            milestones={milestonesQuery.data?.data ?? []}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                New task
              </Button>
            }
            onSubmit={async (input) => {
              await createTask(studentId, input)
              await invalidate()
            }}
          />
        }
      />
      <Tabs defaultValue="board">
        <TabsList className="mb-4">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="board">
          {tasksQuery.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <KanbanBoard
              tasks={tasksQuery.data ?? []}
              onMove={async (taskId, status: TaskStatus) => {
                // Optimistic update: reflect the move instantly rather than waiting on the
                // service round-trip, so dnd-kit never has a stale render to snap back to.
                queryClient.setQueryData<Task[]>(["tasks", studentId], (old) =>
                  old?.map((t) => (t.task_id === taskId ? { ...t, status } : t)),
                )
                await updateTaskStatus(taskId, status)
                await invalidate()
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="timeline">
          {sprintsQuery.isPending || milestonesQuery.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <TimelineChart sprints={sprintsQuery.data ?? []} milestones={milestonesQuery.data?.data ?? []} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
