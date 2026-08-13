import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useState } from "react"
import { CohortTable } from "@/components/dashboard/cohort-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getPreferenceWindow } from "@/lib/services/admin.service"
import { listAtRiskFlags, listAdminCohortOverview } from "@/lib/services/dashboard.service"
import { routePaths } from "@/routes/route-paths"

const PAGE_SIZE = 20

export function AdminDashboardPage() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const cohortQuery = useQuery({
    queryKey: ["admin-cohort", page, search],
    queryFn: () => listAdminCohortOverview({ page, limit: PAGE_SIZE, filter: { search: search || undefined } }),
  })
  const flagsQuery = useQuery({
    queryKey: ["at-risk-flags", { active: true }],
    queryFn: () => listAtRiskFlags({ active: true }),
  })
  const windowQuery = useQuery({ queryKey: ["preference-window"], queryFn: getPreferenceWindow })

  const data = cohortQuery.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="space-y-6">
      <PageHeader title="Cohort overview" description="Programme-wide progress across every allocated student." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Allocated students</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {cohortQuery.isPending ? <Skeleton className="h-8 w-12" /> : (data?.total ?? 0)}
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

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by student or supervisor…"
          className="pl-8"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {cohortQuery.isPending || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.total === 0 ? (
        search ? (
          <EmptyState title="No students match" description="Try a different student or supervisor name." />
        ) : (
          <EmptyState title="No allocation published yet" description="Publish an allocation run to see the cohort here." />
        )
      ) : (
        <div className="space-y-3">
          <CohortTable
            rows={data.data}
            showSupervisor
            supervisorHrefFor={(supervisorId) => routePaths.admin.supervisorDetail(supervisorId)}
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {data.page} of {totalPages} ({data.total} total)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= totalPages}
                  onClick={() => setPage(data.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
