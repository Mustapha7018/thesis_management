import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Plus, X } from "lucide-react"
import { MeetingForm } from "@/components/meetings/meeting-form"
import { MeetingList } from "@/components/meetings/meeting-list"
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { listSupervisorCohort } from "@/lib/services/dashboard.service"
import { listMeetings, scheduleMeeting, updateMeeting } from "@/lib/services/meetings.service"
import { formatDate } from "@/lib/utils/date"

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function SupervisorMeetingsPage() {
  const { session } = useAuth()
  const supervisorId = session!.ref_id!
  const queryClient = useQueryClient()
  const [studentIdForNewMeeting, setStudentIdForNewMeeting] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  const cohortQuery = useQuery({
    queryKey: ["supervisor-cohort", supervisorId],
    queryFn: () => listSupervisorCohort(supervisorId, { limit: 100 }),
  })
  const meetingsQuery = useQuery({
    queryKey: ["meetings", { supervisorId }],
    queryFn: () => listMeetings({ supervisorId }),
  })

  const studentNameById = new Map(cohortQuery.data?.data.map((r) => [r.student_id, r.student_name]) ?? [])

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["meetings", { supervisorId }] })
  }

  const allMeetings = meetingsQuery.data ?? []
  const visibleMeetings = selectedDate
    ? allMeetings.filter((m) => isSameDay(new Date(m.scheduled_at), selectedDate))
    : allMeetings

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Supervision meetings across your cohort."
        actions={
          <div className="flex items-center gap-2">
            <Select value={studentIdForNewMeeting} onValueChange={setStudentIdForNewMeeting}>
              <SelectTrigger size="sm" className="w-48">
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                {cohortQuery.data?.data.map((r) => (
                  <SelectItem key={r.student_id} value={String(r.student_id)}>
                    {r.student_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <MeetingForm
              trigger={
                <Button size="sm" disabled={!studentIdForNewMeeting}>
                  <Plus className="size-4" />
                  Schedule
                </Button>
              }
              onSubmit={async (scheduledAt) => {
                await scheduleMeeting({
                  student_id: Number(studentIdForNewMeeting),
                  supervisor_id: supervisorId,
                  scheduled_at: scheduledAt,
                })
                await invalidate()
              }}
            />
          </div>
        }
      />
      {meetingsQuery.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : !meetingsQuery.data || meetingsQuery.data.length === 0 ? (
        <EmptyState title="No meetings yet" description="Schedule a meeting with one of your students." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <MeetingsCalendar meetings={allMeetings} selected={selectedDate} onSelect={setSelectedDate} />
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              {selectedDate ? (
                <>
                  <span>Showing meetings on {formatDate(selectedDate.toISOString())}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => setSelectedDate(undefined)}>
                    <X className="size-3.5" />
                    Clear
                  </Button>
                </>
              ) : (
                <span>Showing all meetings</span>
              )}
            </div>
            {visibleMeetings.length === 0 ? (
              <EmptyState title="No meetings on this day" />
            ) : (
              <MeetingList
                meetings={visibleMeetings}
                counterpartName={(m) => studentNameById.get(m.student_id) ?? "Student"}
                onUpdate={async (meetingId, patch) => {
                  await updateMeeting(meetingId, patch)
                  await invalidate()
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
