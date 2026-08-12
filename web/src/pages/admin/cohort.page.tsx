import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Info } from "lucide-react"
import { CohortImportPanel } from "@/components/admin/cohort-import-panel"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getCohortSummary } from "@/lib/services/cohort.service"
import { formatDateTime } from "@/lib/utils/date"

export function CohortPage() {
  const queryClient = useQueryClient()
  const summaryQuery = useQuery({ queryKey: ["cohort-summary"], queryFn: getCohortSummary })
  const summary = summaryQuery.data

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cohort"
        description="Import each year's student cohort from a students.csv export. Importing replaces the current cohort and clears preferences, allocations and progress data. Reset demo data restores the original seed cohort."
      />

      {summaryQuery.isPending ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current cohort</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="font-medium">{summary!.studentCount}</span> students
            </p>
            <p className="text-muted-foreground">
              {summary!.lastImport
                ? `Last import: ${formatDateTime(summary!.lastImport.occurred_at)} — ${summary!.lastImport.detail}`
                : "No CSV import yet — this is the seed dataset."}
            </p>
          </CardContent>
        </Card>
      )}

      {summary && !summary.hasPreferences && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>No student preferences yet</AlertTitle>
          <AlertDescription>
            This cohort has no supervisor preferences, so an allocation run will allocate 0 students until students
            submit their preference lists.
          </AlertDescription>
        </Alert>
      )}

      <CohortImportPanel onImported={() => queryClient.invalidateQueries()} />
    </div>
  )
}
