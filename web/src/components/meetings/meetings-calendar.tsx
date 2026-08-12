import { useMemo, type CSSProperties } from "react"
import { Calendar } from "@/components/ui/calendar"
import type { Meeting } from "@/lib/types/entities"

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

interface MeetingsCalendarProps {
  meetings: Meeting[]
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
}

export function MeetingsCalendar({ meetings, selected, onSelect }: MeetingsCalendarProps) {
  const meetingDates = useMemo(() => meetings.map((m) => new Date(m.scheduled_at)), [meetings])
  const heldDates = useMemo(() => meetings.filter((m) => m.held).map((m) => new Date(m.scheduled_at)), [meetings])

  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={(date) => {
        if (date && selected && isSameDay(date, selected)) {
          onSelect(undefined)
          return
        }
        onSelect(date)
      }}
      defaultMonth={meetingDates[0]}
      modifiers={{ hasMeeting: meetingDates, held: heldDates }}
      modifiersClassNames={{
        hasMeeting:
          "after:absolute after:bottom-1.5 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary",
        held: "after:bg-success",
      }}
      classNames={{
        caption_label: "text-base font-semibold select-none",
        weekday: "flex-1 text-sm font-normal text-muted-foreground select-none",
      }}
      style={{ "--cell-size": "3rem" } as CSSProperties}
      className="rounded-lg border border-border p-4 text-base"
    />
  )
}
