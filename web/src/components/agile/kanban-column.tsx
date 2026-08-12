import { useDroppable } from "@dnd-kit/core"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types/entities"

export function KanbanColumn({
  status,
  title,
  count,
  children,
}: {
  status: TaskStatus
  title: string
  count: number
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-64 flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}
