import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { MoreVertical } from "lucide-react"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Task, TaskStatus } from "@/lib/types/entities"

const OTHER_STATUSES: Record<TaskStatus, { value: TaskStatus; label: string }[]> = {
  todo: [
    { value: "in_progress", label: "Move to In progress" },
    { value: "done", label: "Move to Done" },
  ],
  in_progress: [
    { value: "todo", label: "Move to To do" },
    { value: "done", label: "Move to Done" },
  ],
  done: [
    { value: "todo", label: "Move to To do" },
    { value: "in_progress", label: "Move to In progress" },
  ],
}

export function TaskCard({ task, onMove }: { task: Task; onMove: (status: TaskStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.task_id,
  })

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? "opacity-50" : undefined}
    >
      <CardContent className="flex items-start justify-between gap-2 py-3">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="flex-1 cursor-grab text-left text-sm leading-snug active:cursor-grabbing"
        >
          {task.title}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge value={task.priority} className="text-[10px]" />
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label={`Move "${task.title}"`}>
              <MoreVertical className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {OTHER_STATUSES[task.status].map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => onMove(opt.value)}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
