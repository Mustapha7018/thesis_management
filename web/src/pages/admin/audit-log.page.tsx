import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { listAuditLog } from "@/lib/services/admin.service"
import { formatDateTime } from "@/lib/utils/date"

const EVENT_VARIANT: Record<string, string> = {
  login: "bg-success text-success-foreground border-transparent",
  login_failed: "bg-destructive text-destructive-foreground border-transparent",
  role_change: "bg-warning text-warning-foreground border-transparent",
  account_locked: "bg-destructive text-destructive-foreground border-transparent",
  cohort_import: "bg-warning text-warning-foreground border-transparent",
  account_created: "bg-success text-success-foreground border-transparent",
  account_deleted: "bg-destructive text-destructive-foreground border-transparent",
  allocation_run: "bg-secondary text-secondary-foreground border-transparent",
}

export function AuditLogPage() {
  const [page, setPage] = useState(1)
  const logQuery = useQuery({ queryKey: ["audit-log", page], queryFn: () => listAuditLog({ page, limit: 20 }) })

  return (
    <div>
      <PageHeader title="Audit log" description="Security-relevant events: logins, failures and role changes." />
      {logQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <DataTable
          data={logQuery.data!}
          onPageChange={setPage}
          getRowKey={(row) => row.entry_id}
          emptyTitle="No events yet"
          columns={[
            { header: "When", cell: (row) => formatDateTime(row.occurred_at) },
            {
              header: "Event",
              cell: (row) => <Badge className={EVENT_VARIANT[row.event_type]}>{row.event_type.replace("_", " ")}</Badge>,
            },
            { header: "Actor", cell: (row) => row.actor_email },
            { header: "Detail", cell: (row) => <span className="text-muted-foreground">{row.detail}</span> },
          ]}
        />
      )}
    </div>
  )
}
