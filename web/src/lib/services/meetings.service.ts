import { api, query } from "@/lib/api/client"
import type { MeetingInput } from "@/lib/types/dto"
import type { Meeting } from "@/lib/types/entities"
import { readFileAsDataUrl, validateUploadFile } from "@/lib/utils/file-upload"

export async function listMeetings(filter: { studentId?: number; supervisorId?: number }): Promise<Meeting[]> {
  return api.get(`/meetings${query({ studentId: filter.studentId, supervisorId: filter.supervisorId })}`)
}

export async function scheduleMeeting(input: MeetingInput): Promise<Meeting> {
  return api.post("/meetings", input)
}

export async function updateMeeting(meetingId: number, patch: { held?: boolean; notes?: string }): Promise<Meeting> {
  return api.patch(`/meetings/${meetingId}`, patch)
}

/** Student-uploaded supervision log for a meeting (PDF/Word), sent as a base64 data URL. */
export async function uploadMeetingLog(meetingId: number, file: File): Promise<Meeting> {
  const error = validateUploadFile(file)
  if (error) throw new Error(error)
  const dataUrl = await readFileAsDataUrl(file)
  return api.put(`/meetings/${meetingId}/log`, {
    file_name: file.name,
    file_type: file.type,
    data_url: dataUrl,
  })
}

export async function removeMeetingLog(meetingId: number): Promise<Meeting> {
  return api.delete(`/meetings/${meetingId}/log`)
}

/** Fetches the server-generated .ics for one meeting (FR-MEET-03). */
export async function getMeetingIcsContent(meetingId: number): Promise<string> {
  return api.text(`/meetings/${meetingId}/ics`)
}
