import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PublishDialog } from "@/components/admin/publish-dialog"
import { RunComparisonTable } from "@/components/admin/run-comparison-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { compareRuns, publishRun } from "@/lib/services/allocation.service"

export function PublishPage() {
  const queryClient = useQueryClient()
  const runsQuery = useQuery({ queryKey: ["run-benchmarks"], queryFn: compareRuns })

  async function invalidateEverything() {
    // Publishing changes what every student/supervisor allocation & cohort query returns.
    await queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) })
  }

  return (
    <div>
      <PageHeader title="Publish" description="Publish exactly one allocation run — this is what students and supervisors see." />
      {runsQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !runsQuery.data || runsQuery.data.length === 0 ? (
        <EmptyState title="No runs yet" description="Run an allocation before you can publish one." />
      ) : (
        <RunComparisonTable
          runs={runsQuery.data}
          renderActions={(run) => (
            <PublishDialog
              run={run}
              onPublish={async () => {
                await publishRun(run.run_id)
                await invalidateEverything()
                toast.success(`Published "${run.label}".`)
              }}
            />
          )}
        />
      )}
    </div>
  )
}
