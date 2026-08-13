import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, Trash2 } from "lucide-react"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { deleteCohort, listCohorts, listCohortStudents } from "@/lib/services/cohort.service"
import { formatDateTime } from "@/lib/utils/date"

export function CohortsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const cohortsQuery = useQuery({ queryKey: ["cohorts"], queryFn: listCohorts })
  const cohorts = cohortsQuery.data ?? []
  const activeCohort = cohorts.find((c) => c.active)

  const batchParam = searchParams.get("batch")
  const selectedId = batchParam !== null ? Number(batchParam) : (activeCohort?.cohort_id ?? null)
  const selected = cohorts.find((c) => c.cohort_id === selectedId) ?? activeCohort ?? null

  const studentsQuery = useQuery({
    queryKey: ["cohort-students", selected?.cohort_id, page, search],
    queryFn: () => listCohortStudents(selected!.cohort_id, { page, limit: 20, search: search || undefined }),
    enabled: selected !== null,
  })

  function selectBatch(cohortId: string) {
    setSearchParams(cohortId === String(activeCohort?.cohort_id) ? {} : { batch: cohortId })
    setPage(1)
    setSearch("")
  }

  async function handleDelete(cohortId: number, label: string) {
    try {
      await deleteCohort(cohortId)
      toast.success(`Batch ${label} deleted.`)
      if (selectedId === cohortId) setSearchParams({})
      await queryClient.invalidateQueries({ queryKey: ["cohorts"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete batch.")
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Cohorts" />

      {cohortsQuery.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selected ? String(selected.cohort_id) : undefined} onValueChange={selectBatch}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select a batch" />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((c) => (
                  <SelectItem key={c.cohort_id} value={String(c.cohort_id)}>
                    {c.label} {c.active ? "(active)" : "(archived)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative min-w-56 flex-1 max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                className="pl-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          {studentsQuery.isPending || !studentsQuery.data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <DataTable
              data={studentsQuery.data}
              getRowKey={(row) => row.student_id}
              onPageChange={setPage}
              emptyTitle="No students match"
              columns={[
                { header: "ID", cell: (row) => <span className="font-mono text-xs">{row.student_id}</span> },
                { header: "Name", cell: (row) => `${row.first_name} ${row.last_name}` },
                { header: "Email", cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
                { header: "Programme", cell: (row) => row.programme },
                { header: "Mode", cell: (row) => row.mode },
                { header: "Entry mark", cell: (row) => row.prior_avg_mark.toFixed(1) },
              ]}
            />
          )}

          <div className="overflow-hidden rounded-lg border border-border">
            {cohorts.map((c) => (
              <div key={c.cohort_id} className="flex items-center justify-between border-b border-border px-4 py-2 text-sm last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{c.label}</span>
                  {c.active ? (
                    <Badge className="border-transparent bg-success text-success-foreground">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Archived</Badge>
                  )}
                  <span className="text-muted-foreground">
                    {c.student_count} students · {formatDateTime(c.imported_at)}
                  </span>
                </div>
                {!c.active && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    }
                    title={`Delete batch ${c.label}?`}
                    description={`Permanently removes ${c.student_count} students, their activity and the batch's runs.`}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => handleDelete(c.cohort_id, c.label)}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
