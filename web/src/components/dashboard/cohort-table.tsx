import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CohortStudentSummary } from "@/lib/types/dto"

export function CohortTable({
  rows,
  showSupervisor = false,
  detailHrefFor,
  supervisorHrefFor,
}: {
  rows: CohortStudentSummary[]
  showSupervisor?: boolean
  detailHrefFor?: (studentId: number) => string
  supervisorHrefFor?: (supervisorId: number) => string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            {showSupervisor && <TableHead>Supervisor</TableHead>}
            <TableHead>Progress</TableHead>
            <TableHead>Flags</TableHead>
            {detailHrefFor && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.student_id}>
              <TableCell className="font-medium">{row.student_name}</TableCell>
              {showSupervisor && (
                <TableCell className="text-sm text-muted-foreground">
                  {supervisorHrefFor ? (
                    <Link to={supervisorHrefFor(row.supervisor_id)} className="text-link hover:underline">
                      {row.supervisor_name}
                    </Link>
                  ) : (
                    row.supervisor_name
                  )}
                </TableCell>
              )}
              <TableCell className="min-w-40">
                <div className="flex items-center gap-2">
                  <Progress value={row.progress.percent_complete} className="h-1.5 w-24" />
                  <span className="text-xs text-muted-foreground">{row.progress.percent_complete}%</span>
                </div>
              </TableCell>
              <TableCell>
                {row.active_flag_count > 0 ? (
                  <Badge className="gap-1 border-transparent bg-destructive text-destructive-foreground">
                    <AlertTriangle className="size-3" />
                    {row.active_flag_count}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              {detailHrefFor && (
                <TableCell className="text-right">
                  <Link to={detailHrefFor(row.student_id)} className="text-sm text-link hover:underline">
                    View
                  </Link>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
