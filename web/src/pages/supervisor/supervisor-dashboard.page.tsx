import { useQuery } from "@tanstack/react-query"
import { AtRiskBadgeList } from "@/components/dashboard/at-risk-badge-list"
import { CohortTable } from "@/components/dashboard/cohort-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { listAtRiskFlags, listSupervisorCohort } from "@/lib/services/dashboard.service"
import { routePaths } from "@/routes/route-paths"

export function SupervisorDashboardPage() {
  const { session } = useAuth()
  const supervisorId = session!.ref_id!

  const cohortQuery = useQuery({
    queryKey: ["supervisor-cohort", supervisorId],
    queryFn: () => listSupervisorCohort(supervisorId, { limit: 100 }),
  })
  const flagsQuery = useQuery({
    queryKey: ["at-risk-flags", { supervisorId, active: true }],
    queryFn: () => listAtRiskFlags({ supervisorId, active: true }),
  })

  const studentNameById = new Map(cohortQuery.data?.data.map((r) => [r.student_id, r.student_name]) ?? [])

  return (
    <div className="space-y-6">
      <PageHeader title="My students" description="Progress and at-risk flags for your allocated students." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">At-risk flags</CardTitle>
        </CardHeader>
        <CardContent>
          {flagsQuery.isPending ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <AtRiskBadgeList
              flags={flagsQuery.data ?? []}
              studentName={(id) => studentNameById.get(id) ?? "Student"}
              detailHrefFor={(id) => routePaths.supervisor.studentDetail(id)}
            />
          )}
        </CardContent>
      </Card>

      {cohortQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !cohortQuery.data || cohortQuery.data.total === 0 ? (
        <EmptyState title="No students allocated yet" description="Once an allocation run is published, your students will appear here." />
      ) : (
        <CohortTable rows={cohortQuery.data.data} detailHrefFor={(id) => routePaths.supervisor.studentDetail(id)} />
      )}
    </div>
  )
}
