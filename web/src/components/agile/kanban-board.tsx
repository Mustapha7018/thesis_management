import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { KanbanColumn } from "@/components/agile/kanban-column"
import { TaskCard } from "@/components/agile/task-card"
import type { Task, TaskStatus } from "@/lib/types/entities"

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To do" },
  { status: "in_progress", title: "In progress" },
  { status: "done", title: "Done" },
]

export function KanbanBoard({ tasks, onMove }: { tasks: Task[]; onMove: (taskId: number, status: TaskStatus) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const status = over.id as TaskStatus
    onMove(Number(active.id), status)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.status)
          return (
            <KanbanColumn key={col.status} status={col.status} title={col.title} count={columnTasks.length}>
              {columnTasks.map((task) => (
                <TaskCard key={task.task_id} task={task} onMove={(status) => onMove(task.task_id, status)} />
              ))}
            </KanbanColumn>
          )
        })}
      </div>
    </DndContext>
  )
}
