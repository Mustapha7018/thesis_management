import { getDb, nextId, saveDb } from "./db/store"
import type { MeetingInput } from "@/lib/types/dto"
import type { Meeting } from "@/lib/types/entities"
import { buildMeetingIcs } from "@/lib/utils/ics"
import { readFileAsDataUrl, validateUploadFile } from "@/lib/utils/file-upload"

export async function listMeetings(filter: { studentId?: number; supervisorId?: number }): Promise<Meeting[]> {
  return getDb()
    .meetings.filter(
      (m) =>
        (filter.studentId === undefined || m.student_id === filter.studentId) &&
        (filter.supervisorId === undefined || m.supervisor_id === filter.supervisorId),
    )
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
}

export async function scheduleMeeting(input: MeetingInput): Promise<Meeting> {
  const db = getDb()
  const meeting: Meeting = {
    meeting_id: nextId(db.meetings, "meeting_id"),
    student_id: input.student_id,
    supervisor_id: input.supervisor_id,
    scheduled_at: input.scheduled_at,
    held: 0,
    notes: input.notes ?? null,
    log_file_name: null,
    log_file_type: null,
    log_file_data: null,
  }
  db.meetings.push(meeting)
  saveDb()
  return meeting
}

export async function updateMeeting(meetingId: number, patch: { held?: boolean; notes?: string }): Promise<Meeting> {
  const db = getDb()
  const meeting = db.meetings.find((m) => m.meeting_id === meetingId)
  if (!meeting) throw new Error("Meeting not found.")
  if (patch.held !== undefined) meeting.held = patch.held ? 1 : 0
  if (patch.notes !== undefined) meeting.notes = patch.notes
  saveDb()
  return meeting
}

/** Student-uploaded supervision log for a meeting (PDF/Word), stored as a base64 data URL. */
export async function uploadMeetingLog(meetingId: number, file: File): Promise<Meeting> {
  const error = validateUploadFile(file)
  if (error) throw new Error(error)

  const db = getDb()
  const meeting = db.meetings.find((m) => m.meeting_id === meetingId)
  if (!meeting) throw new Error("Meeting not found.")

  meeting.log_file_data = await readFileAsDataUrl(file)
  meeting.log_file_name = file.name
  meeting.log_file_type = file.type
  saveDb()
  return meeting
}

export async function removeMeetingLog(meetingId: number): Promise<Meeting> {
  const db = getDb()
  const meeting = db.meetings.find((m) => m.meeting_id === meetingId)
  if (!meeting) throw new Error("Meeting not found.")
  meeting.log_file_data = null
  meeting.log_file_name = null
  meeting.log_file_type = null
  saveDb()
  return meeting
}

/** Client-side only (FR-MEET-03) — builds the .ics content for a meeting; caller triggers the download. */
export function getMeetingIcsContent(meetingId: number): string {
  const db = getDb()
  const meeting = db.meetings.find((m) => m.meeting_id === meetingId)
  if (!meeting) throw new Error("Meeting not found.")
  const student = db.students.find((s) => s.student_id === meeting.student_id)
  const supervisor = db.supervisors.find((s) => s.supervisor_id === meeting.supervisor_id)
  return buildMeetingIcs(
    meeting,
    student ? `${student.first_name} ${student.last_name}` : "Student",
    supervisor ? `${supervisor.title} ${supervisor.first_name} ${supervisor.last_name}` : "Supervisor",
  )
}
