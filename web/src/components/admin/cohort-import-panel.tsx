import { ArrowRight, CircleAlert, FileSpreadsheet, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
      toast.error("Batch label is required.")
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
        toast.error("Import rejected.")
      } else {
        toast.error(err instanceof Error ? err.message : "Import failed.")
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
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
              {file.name}
            </span>
          )}
          {file && (
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm" disabled={importing}>
                  {importing ? "Importing…" : "Import"}
                </Button>
              }
              title={`Import batch ${label.trim()}?`}
              description="The current batch is archived and its students can no longer log in."
              confirmLabel="Import"
              destructive
              onConfirm={handleImport}
            />
          )}
        </CardContent>
      </Card>

      {failure && (
        <Alert variant="destructive">
          <CircleAlert className="size-4" />
          <AlertTitle>{failure.total} validation error{failure.total === 1 ? "" : "s"}</AlertTitle>
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
          <CardContent className="flex items-center justify-between pt-6">
            <p className="text-sm">
              Batch <span className="font-medium">{result.label}</span> imported: {result.imported} students.
            </p>
            <Button asChild size="sm" variant="outline">
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
