import { useQuery } from "@tanstack/react-query"
import { CalendarClock, FileCheck2, KanbanSquare } from "lucide-react"
import { Link } from "react-router-dom"
import { ProgressIndicator } from "@/components/agile/progress-indicator"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { getStudentProgress } from "@/lib/services/agile.service"
import { getMyAllocation } from "@/lib/services/allocation.service"
import { listMeetings } from "@/lib/services/meetings.service"
import { routePaths } from "@/routes/route-paths"
import { formatDateTime } from "@/lib/utils/date"

export function StudentDashboardPage() {
  const { session } = useAuth()
  const studentId = session!.ref_id!

  const progressQuery = useQuery({ queryKey: ["progress", studentId], queryFn: () => getStudentProgress(studentId) })
  const allocationQuery = useQuery({ queryKey: ["my-allocation", studentId], queryFn: () => getMyAllocation(studentId) })
  const meetingsQuery = useQuery({ queryKey: ["meetings", { studentId }], queryFn: () => listMeetings({ studentId }) })

  const nextMeeting = meetingsQuery.data?.find((m) => !m.held && new Date(m.scheduled_at).getTime() > Date.now())

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${session!.display_name.split(" ")[0]}`} description="Here's where your project stands." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {progressQuery.isPending ? <Skeleton className="h-16 w-full" /> : <ProgressIndicator progress={progressQuery.data!} />}
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to={routePaths.student.agile}>
                <KanbanSquare className="size-4" />
                Open agile board
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supervisor</CardTitle>
          </CardHeader>
          <CardContent>
            {allocationQuery.isPending ? (
              <Skeleton className="h-10 w-full" />
            ) : allocationQuery.data ? (
              <p className="text-sm font-medium">{allocationQuery.data.supervisor_name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Not yet published.</p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to={routePaths.student.allocation}>
                <FileCheck2 className="size-4" />
                View allocation
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-muted-foreground" />
            Next meeting
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meetingsQuery.isPending ? (
            <Skeleton className="h-8 w-64" />
          ) : nextMeeting ? (
            <p className="text-sm">{formatDateTime(nextMeeting.scheduled_at)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming meeting scheduled.</p>
          )}
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to={routePaths.student.meetings}>Meetings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
