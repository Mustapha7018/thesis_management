import { ArrowRight, CircleAlert, FileSpreadsheet, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CsvValidationError,
  importStudentCohort,
  type CohortImportResult,
  type CsvRowError,
} from "@/lib/services/cohort.service"
import { routePaths } from "@/routes/route-paths"

function defaultBatchLabel(): string {
  const year = new Date().getFullYear()
  return `${year}/${year + 1}`
}

export function CohortImportPanel({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState(defaultBatchLabel)
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
    if (!label.trim()) {
      toast.error("Give the batch a label, e.g. 2026/2027.")
      return
    }
    setImporting(true)
    try {
      const res = await importStudentCohort(file, label.trim())
      setResult(res)
      setFailure(null)
      setFile(null)
      toast.success(`Imported batch ${res.label}: ${res.imported} students.`)
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import a new batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Importing a students.csv creates a new batch and archives the current one (its students keep their data
            but can no longer log in). Student ids and emails must be new — each batch is a new intake.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-label">Batch label</Label>
              <Input
                id="batch-label"
                className="w-36"
                placeholder="2026/2027"
                value={label}
                disabled={importing}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
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
                    {importing ? "Importing…" : `Import as batch ${label.trim() || "…"}`}
                  </Button>
                }
                title={`Import batch ${label.trim()}?`}
                description="The current batch will be archived: its students keep their data but can no longer log in, and the published allocation is unpublished. The new batch becomes active with no allocations yet."
                confirmLabel="Import batch"
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
            <CardTitle className="text-base">Batch {result.label} imported</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="font-medium">{result.imported}</span> students imported and able to log in. The previous
              batch is archived in the history below.
            </p>
            <p className="text-sm text-muted-foreground">
              Next step: run the allocation algorithm once this batch has submitted preferences.
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
