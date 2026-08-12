import { useQuery } from "@tanstack/react-query"
import { RunComparisonTable } from "@/components/admin/run-comparison-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { compareRuns } from "@/lib/services/allocation.service"

export function CompareRunsPage() {
  const runsQuery = useQuery({ queryKey: ["run-benchmarks"], queryFn: compareRuns })

  return (
    <div>
      <PageHeader
        title="Compare runs"
        description="Benchmark metrics across every allocation run — preference satisfaction, workload balance and runtime."
      />
      {runsQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !runsQuery.data || runsQuery.data.length === 0 ? (
        <EmptyState title="No runs yet" description="Run an allocation to see benchmark metrics here." />
      ) : (
        <RunComparisonTable runs={runsQuery.data} />
      )}
    </div>
  )
}
