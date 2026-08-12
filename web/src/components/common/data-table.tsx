import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/common/empty-state"
import type { Paginated } from "@/lib/types/dto"

export interface DataTableColumn<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: Paginated<T>
  getRowKey: (row: T) => string | number
  onPageChange?: (page: number) => void
  emptyTitle?: string
  emptyDescription?: string
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onPageChange,
  emptyTitle = "Nothing here yet",
  emptyDescription,
}: DataTableProps<T>) {
  if (data.total === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.header} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((row) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((col) => (
                  <TableCell key={col.header} className={col.className}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => onPageChange(data.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= totalPages}
              onClick={() => onPageChange(data.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
