import { useQuery } from "@tanstack/react-query"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { RunComparisonTable } from "@/components/admin/run-comparison-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { compareRuns, getRunAllocationRows } from "@/lib/services/allocation.service"
import { exportCsv } from "@/lib/utils/csv-export"

export function CompareRunsPage() {
  const runsQuery = useQuery({ queryKey: ["run-benchmarks"], queryFn: compareRuns })

  function handleExportBenchmarks() {
    try {
      exportCsv(
        `benchmarks-${new Date().toISOString().slice(0, 10)}.csv`,
        (runsQuery.data ?? []).map((run) => ({
          run_id: run.run_id,
          algorithm: run.algorithm,
          label: run.label,
          mean_satisfied_rank: run.mean_satisfied_rank ?? "",
          workload_variance: run.workload_variance,
          percent_unallocated: run.percent_unallocated,
          runtime_ms: run.runtime_ms,
          published: run.published,
          created_at: run.created_at,
        })),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.")
    }
  }

  async function handleExportAllocations(runId: string) {
    try {
      exportCsv(`${runId}-allocations.csv`, await getRunAllocationRows(runId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.")
    }
  }

  return (
    <div>
      <PageHeader
        title="Compare runs"
        description="Benchmark metrics across every allocation run — preference satisfaction, workload balance and runtime."
        actions={
          <Button size="sm" variant="outline" onClick={handleExportBenchmarks} disabled={!runsQuery.data?.length}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />
      {runsQuery.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : !runsQuery.data || runsQuery.data.length === 0 ? (
        <EmptyState title="No runs yet" description="Run an allocation to see benchmark metrics here." />
      ) : (
        <RunComparisonTable
          runs={runsQuery.data}
          renderActions={(run) => (
            <Button size="sm" variant="ghost" onClick={() => handleExportAllocations(run.run_id)}>
              <Download className="size-3.5" />
              Export allocations
            </Button>
          )}
        />
      )}
    </div>
  )
}
