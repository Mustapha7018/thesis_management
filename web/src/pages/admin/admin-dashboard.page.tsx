import { useQuery } from "@tanstack/react-query"
import { CohortTable } from "@/components/dashboard/cohort-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getPreferenceWindow } from "@/lib/services/admin.service"
import { listAtRiskFlags } from "@/lib/services/dashboard.service"
import { listAdminCohortOverview } from "@/lib/services/dashboard.service"
import { routePaths } from "@/routes/route-paths"

export function AdminDashboardPage() {
  const cohortQuery = useQuery({
    queryKey: ["admin-cohort"],
    queryFn: () => listAdminCohortOverview({ limit: 100 }),
  })
  const flagsQuery = useQuery({
    queryKey: ["at-risk-flags", { active: true }],
    queryFn: () => listAtRiskFlags({ active: true }),
  })
  const windowQuery = useQuery({ queryKey: ["preference-window"], queryFn: getPreferenceWindow })

  return (
    <div className="space-y-6">
      <PageHeader title="Cohort overview" description="Programme-wide progress across every allocated student." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Allocated students</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {cohortQuery.isPending ? <Skeleton className="h-8 w-12" /> : (cohortQuery.data?.total ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Active at-risk flags</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {flagsQuery.isPending ? <Skeleton className="h-8 w-12" /> : (flagsQuery.data?.length ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Preference window</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {windowQuery.isPending ? <Skeleton className="h-8 w-16" /> : windowQuery.data?.is_open ? "Open" : "Closed"}
          </CardContent>
        </Card>
      </div>

      {cohortQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !cohortQuery.data || cohortQuery.data.total === 0 ? (
        <EmptyState title="No allocation published yet" description="Publish an allocation run to see the cohort here." />
      ) : (
        <CohortTable
          rows={cohortQuery.data.data}
          showSupervisor
          supervisorHrefFor={(supervisorId) => routePaths.admin.supervisorDetail(supervisorId)}
        />
      )}
    </div>
  )
}
