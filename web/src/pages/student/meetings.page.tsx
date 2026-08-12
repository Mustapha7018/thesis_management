import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"
import { useState } from "react"
import { MeetingForm } from "@/components/meetings/meeting-form"
import { MeetingList } from "@/components/meetings/meeting-list"
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { getMyAllocation } from "@/lib/services/allocation.service"
import { listMeetings, removeMeetingLog, scheduleMeeting, updateMeeting, uploadMeetingLog } from "@/lib/services/meetings.service"
import { formatDate } from "@/lib/utils/date"

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function StudentMeetingsPage() {
  const { session } = useAuth()
  const studentId = session!.ref_id!
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  const allocationQuery = useQuery({ queryKey: ["my-allocation", studentId], queryFn: () => getMyAllocation(studentId) })
  const meetingsQuery = useQuery({ queryKey: ["meetings", { studentId }], queryFn: () => listMeetings({ studentId }) })

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["meetings", { studentId }] })
  }

  const allMeetings = meetingsQuery.data ?? []
  const visibleMeetings = selectedDate
    ? allMeetings.filter((m) => isSameDay(new Date(m.scheduled_at), selectedDate))
    : allMeetings

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Your supervision meeting history and upcoming schedule."
        actions={
          allocationQuery.data && (
            <MeetingForm
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  Schedule meeting
                </Button>
              }
              onSubmit={async (scheduledAt) => {
                await scheduleMeeting({
                  student_id: studentId,
                  supervisor_id: allocationQuery.data!.supervisor_id,
                  scheduled_at: scheduledAt,
                })
                await invalidate()
              }}
            />
          )
        }
      />
      {meetingsQuery.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : !meetingsQuery.data || meetingsQuery.data.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description={allocationQuery.data ? "Schedule your first supervision meeting." : "You need a published allocation before scheduling meetings."}
        />
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
                counterpartName={() => allocationQuery.data?.supervisor_name ?? "Supervisor"}
                canUploadLog
                onUpdate={async (meetingId, patch) => {
                  await updateMeeting(meetingId, patch)
                  await invalidate()
                }}
                onUploadLog={async (meetingId, file) => {
                  await uploadMeetingLog(meetingId, file)
                  await invalidate()
                }}
                onRemoveLog={async (meetingId) => {
                  await removeMeetingLog(meetingId)
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
