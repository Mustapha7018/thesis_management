import type { Meeting } from "@/lib/types/entities"

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n")
}

/** Builds a minimal, valid single-event .ics file for a supervision meeting (FR-MEET-03). */
export function buildMeetingIcs(
  meeting: Meeting,
  studentName: string,
  supervisorName: string,
): string {
  const start = toIcsDate(meeting.scheduled_at)
  const end = toIcsDate(new Date(new Date(meeting.scheduled_at).getTime() + 30 * 60_000).toISOString())
  const summary = escapeIcsText(`Supervision meeting: ${studentName} & ${supervisorName}`)
  const description = escapeIcsText(meeting.notes ?? "Supervision meeting.")

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Thesis Portal//Meeting Export//EN",
    "BEGIN:VEVENT",
    `UID:meeting-${meeting.meeting_id}@thesis-portal.local`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

export function downloadIcsFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
