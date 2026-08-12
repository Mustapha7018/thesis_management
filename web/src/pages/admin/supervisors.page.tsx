import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { listSupervisors } from "@/lib/services/admin.service"
import { routePaths } from "@/routes/route-paths"

export function SupervisorsPage() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const supervisorsQuery = useQuery({
    queryKey: ["admin-supervisors", search, page],
    queryFn: () => listSupervisors({ page, limit: 20, filter: search ? { search } : undefined }),
  })

  return (
    <div>
      <PageHeader title="Supervisors" description="Browse supervisors and see the students allocated to each." />
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          className="pl-8"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>
      {supervisorsQuery.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <DataTable
          data={supervisorsQuery.data!}
          getRowKey={(row) => row.supervisor_id}
          onPageChange={setPage}
          emptyTitle="No supervisors match this search"
          columns={[
            {
              header: "Name",
              cell: (row) => (
                <Link
                  to={routePaths.admin.supervisorDetail(row.supervisor_id)}
                  className="font-medium text-link hover:underline"
                >
                  {row.name}
                </Link>
              ),
            },
            { header: "Email", cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
            { header: "Seniority", cell: (row) => row.seniority },
            {
              header: "Allocated",
              cell: (row) => (
                <Badge variant="secondary">
                  {row.allocated_count}/{row.quota_max}
                </Badge>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
