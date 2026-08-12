import { ArrowRight, CircleAlert, FileSpreadsheet, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CsvValidationError,
  importStudentCohort,
  type CohortImportResult,
  type CsvRowError,
} from "@/lib/services/cohort.service"
import { routePaths } from "@/routes/route-paths"

const CLEARED_LABELS: Record<keyof CohortImportResult["cleared"], string> = {
  interests: "student interests",
  studentPreferences: "student preferences",
  supervisorPreferences: "supervisor preferences",
  allocations: "allocations",
  runs: "allocation runs",
  sprints: "sprints",
  milestones: "milestones",
  tasks: "tasks",
  meetings: "meetings",
  flags: "at-risk flags",
}

export function CohortImportPanel({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<CohortImportResult | null>(null)
  const [failure, setFailure] = useState<{ errors: CsvRowError[]; total: number } | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ""
    if (!picked) return
    setFile(picked)
    setResult(null)
    setFailure(null)
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    try {
      const res = await importStudentCohort(file)
      setResult(res)
      setFailure(null)
      setFile(null)
      toast.success(`Imported ${res.imported} students.`)
      onImported?.()
    } catch (err) {
      if (err instanceof CsvValidationError) {
        setFailure({ errors: err.errors, total: err.totalErrorCount })
        toast.error("Import rejected — no changes were made.")
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to import cohort.")
      }
    } finally {
      setImporting(false)
    }
  }

  const clearedSummary = result
    ? (Object.entries(result.cleared) as [keyof CohortImportResult["cleared"], number][])
        .filter(([, count]) => count > 0)
        .map(([key, count]) => `${count} ${CLEARED_LABELS[key]}`)
        .join(", ")
    : ""

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import students.csv</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Expected columns: student_id, first_name, last_name, email, programme, mode, entry_year,
            entry_qualification, prior_avg_mark, created_at. The import is all-or-nothing — any invalid row rejects
            the whole file.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
            <Button variant="outline" size="sm" disabled={importing} onClick={() => inputRef.current?.click()}>
              <Upload className="size-3.5" />
              Choose students.csv
            </Button>
            {file && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileSpreadsheet className="size-4" />
                {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
              </span>
            )}
            {file && (
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" size="sm" disabled={importing}>
                    {importing ? "Importing…" : "Import and replace cohort"}
                  </Button>
                }
                title="Replace current cohort?"
                description="This replaces all students and clears their interests, preferences, allocations, allocation runs, sprints, milestones, tasks, meetings and at-risk flags. Supervisors, research areas and admin accounts are kept. This cannot be undone (Reset demo data restores the original seed)."
                confirmLabel="Import and replace"
                destructive
                onConfirm={handleImport}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {failure && (
        <Alert variant="destructive">
          <CircleAlert className="size-4" />
          <AlertTitle>Import rejected — {failure.total} validation error{failure.total === 1 ? "" : "s"}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {failure.errors.map((e, i) => (
                <li key={i}>
                  {e.row > 0 ? `Row ${e.row}: ` : ""}
                  {e.message}
                </li>
              ))}
            </ul>
            {failure.total > failure.errors.length && <p className="mt-1">…and {failure.total - failure.errors.length} more.</p>}
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Imported <span className="font-medium">{result.imported}</span> students.
              {clearedSummary && (
                <span className="text-muted-foreground"> Cleared from the previous cohort: {clearedSummary}.</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Next step: run the allocation algorithm over the new cohort. Until students submit preferences, a run
              will allocate 0 students.
            </p>
            <Button asChild size="sm">
              <Link to={routePaths.admin.runAllocation}>
                Run allocation
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
