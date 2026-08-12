import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { RunBenchmark } from "@/lib/types/dto"
import { formatDateTime } from "@/lib/utils/date"

export function RunComparisonTable({
  runs,
  renderActions,
}: {
  runs: RunBenchmark[]
  renderActions?: (run: RunBenchmark) => ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Mean satisfied rank</TableHead>
            <TableHead>Workload variance</TableHead>
            <TableHead>% unallocated</TableHead>
            <TableHead>Runtime</TableHead>
            <TableHead>Status</TableHead>
            {renderActions && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.run_id}>
              <TableCell>
                <p className="font-medium">{run.label}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(run.created_at)}</p>
              </TableCell>
              <TableCell>{run.mean_satisfied_rank?.toFixed(2) ?? "—"}</TableCell>
              <TableCell>{run.workload_variance.toFixed(2)}</TableCell>
              <TableCell>{run.percent_unallocated}%</TableCell>
              <TableCell>{run.runtime_ms > 0 ? `${run.runtime_ms}ms` : "—"}</TableCell>
              <TableCell>
                {run.published ? (
                  <Badge className="border-transparent bg-success text-success-foreground">Published</Badge>
                ) : (
                  <Badge variant="secondary">Draft</Badge>
                )}
              </TableCell>
              {renderActions && <TableCell className="text-right">{renderActions(run)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
