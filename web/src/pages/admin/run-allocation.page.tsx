import { useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/common/page-header"
import { RunAllocationPanel } from "@/components/admin/run-allocation-panel"

export function RunAllocationPage() {
  const queryClient = useQueryClient()

  return (
    <div>
      <PageHeader title="Run allocation" />
      <RunAllocationPanel onRunComplete={() => queryClient.invalidateQueries({ queryKey: ["run-benchmarks"] })} />
    </div>
  )
}
