import { EmptyState } from "@/components/common/empty-state"
import type { Milestone, Sprint } from "@/lib/types/entities"
import { formatDate } from "@/lib/utils/date"
import { CalendarRange } from "lucide-react"

const MS_DAY = 86_400_000

function toTime(isoDate: string): number {
  return new Date(isoDate).getTime()
}

const SPRINT_STYLES = {
  done: "bg-success text-success-foreground",
  active: "bg-warning text-warning-foreground",
  upcoming: "bg-secondary text-secondary-foreground",
} as const

const MILESTONE_STYLES = {
  planned: "bg-secondary border-secondary-foreground/30",
  in_progress: "bg-warning border-warning-foreground/30",
  done: "bg-success border-success-foreground/30",
  overdue: "bg-destructive border-destructive-foreground/30",
} as const

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return d
}

interface TimelineChartProps {
  sprints: Sprint[]
  milestones: Milestone[]
}

export function TimelineChart({ sprints, milestones }: TimelineChartProps) {
  if (sprints.length === 0 && milestones.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Nothing to show yet"
        description="Add a sprint or milestone to see them plotted on the timeline."
      />
    )
  }

  const now = Date.now()
  const allTimes = [
    ...sprints.flatMap((s) => [toTime(s.start_date), toTime(s.end_date)]),
    ...milestones.map((m) => toTime(m.due_date)),
    now,
  ]
  const rawMin = Math.min(...allTimes)
  const rawMax = Math.max(...allTimes)
  const padding = Math.max((rawMax - rawMin) * 0.06, MS_DAY * 3)
  const rangeStart = rawMin - padding
  const rangeEnd = rawMax + padding
  const span = rangeEnd - rangeStart

  const pct = (time: number) => ((time - rangeStart) / span) * 100

  const ticks: Date[] = []
  const cursor = startOfWeek(new Date(rangeStart))
  while (cursor.getTime() <= rangeEnd) {
    ticks.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="relative min-w-[760px]">
        <div className="relative h-8 border-b border-border">
          {ticks.map((t) => (
            <div
              key={t.toISOString()}
              className="absolute top-0 h-full border-l border-border pl-1.5 text-[11px] whitespace-nowrap text-muted-foreground"
              style={{ left: `${pct(t.getTime())}%` }}
            >
              {formatDate(t.toISOString())}
            </div>
          ))}
        </div>

        <div
          className="absolute top-8 bottom-0 z-10 border-l-2 border-dashed border-primary"
          style={{ left: `${pct(now)}%` }}
        >
          <span className="absolute -top-0.5 left-1.5 text-[10px] font-medium whitespace-nowrap text-primary">
            Today
          </span>
        </div>

        {sprints.length > 0 && (
          <div className="border-b border-border">
            {sprints.map((sprint) => {
              const left = pct(toTime(sprint.start_date))
              const width = Math.max(pct(toTime(sprint.end_date)) - left, 3)
              const state = now > toTime(sprint.end_date) ? "done" : now < toTime(sprint.start_date) ? "upcoming" : "active"
              return (
                <div key={sprint.sprint_id} className="relative flex h-11 items-center border-b border-border/60 last:border-0">
                  <div
                    className={`absolute top-2 bottom-2 flex items-center overflow-hidden rounded-md px-2 text-xs font-medium ${SPRINT_STYLES[state]}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${sprint.name} (${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)})`}
                  >
                    <span className="truncate">{sprint.name}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {milestones.length > 0 && (
          <div>
            {milestones.map((m) => {
              const left = pct(toTime(m.due_date))
              return (
                <div key={m.milestone_id} className="relative flex h-11 items-center border-b border-border/60 last:border-0">
                  <div className="absolute flex -translate-x-1/2 items-center gap-1.5" style={{ left: `${left}%` }}>
                    <span
                      className={`size-3 shrink-0 rotate-45 rounded-[2px] border ${MILESTONE_STYLES[m.status]}`}
                    />
                    <span className="truncate text-xs font-medium whitespace-nowrap">{m.title}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
