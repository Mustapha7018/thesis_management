import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusValue =
  | "planned"
  | "in_progress"
  | "done"
  | "overdue"
  | "todo"
  | "low"
  | "medium"
  | "high"

const STYLES: Record<StatusValue, string> = {
  planned: "bg-secondary text-secondary-foreground",
  todo: "bg-secondary text-secondary-foreground",
  low: "bg-secondary text-secondary-foreground",
  in_progress: "bg-warning text-warning-foreground",
  medium: "bg-warning text-warning-foreground",
  done: "bg-success text-success-foreground",
  overdue: "bg-destructive text-destructive-foreground",
  high: "bg-destructive text-destructive-foreground",
}

const LABELS: Record<StatusValue, string> = {
  planned: "Planned",
  todo: "To do",
  low: "Low",
  in_progress: "In progress",
  medium: "Medium",
  done: "Done",
  overdue: "Overdue",
  high: "High",
}

export function StatusBadge({ value, className }: { value: StatusValue; className?: string }) {
  return <Badge className={cn(STYLES[value], "border-transparent", className)}>{LABELS[value]}</Badge>
}
