import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { CohortTable } from "@/components/dashboard/cohort-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listSupervisorCohort } from "@/lib/services/dashboard.service"
import { listSupervisorsBrief } from "@/lib/services/profile.service"

export function SupervisorDetailPage() {
  const { supervisorId } = useParams<{ supervisorId: string }>()
  const id = Number(supervisorId)

  const supervisorsQuery = useQuery({ queryKey: ["supervisors-brief"], queryFn: listSupervisorsBrief })
  const cohortQuery = useQuery({
    queryKey: ["supervisor-cohort", id],
    queryFn: () => listSupervisorCohort(id, { limit: 100 }),
  })

  const supervisor = supervisorsQuery.data?.find((s) => s.supervisor_id === id)

  if (supervisorsQuery.isPending) return <Skeleton className="h-96 w-full" />
  if (!supervisor) return null

  return (
    <div>
      <PageHeader
        title={`${supervisor.title} ${supervisor.first_name} ${supervisor.last_name}`}
        description={supervisor.seniority}
        showBackButton
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-2 py-4">
          <span className="mr-2 text-sm text-muted-foreground">Expertise:</span>
          {supervisor.expertise_area_names.length === 0 ? (
            <span className="text-sm text-muted-foreground">None recorded</span>
          ) : (
            supervisor.expertise_area_names.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      {cohortQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !cohortQuery.data || cohortQuery.data.total === 0 ? (
        <EmptyState title="No students allocated yet" description="This supervisor has no allocated students in the published run." />
      ) : (
        <CohortTable rows={cohortQuery.data.data} />
      )}
    </div>
  )
}
