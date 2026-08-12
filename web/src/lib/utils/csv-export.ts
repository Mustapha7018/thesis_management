import Papa from "papaparse"
import { downloadDataUrl } from "./file-upload"

/** Serialises rows to CSV and triggers a browser download (FR-API-04). */
export function exportCsv(fileName: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) throw new Error("Nothing to export.")
  const url = URL.createObjectURL(new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8" }))
  try {
    downloadDataUrl(url, fileName)
  } finally {
    URL.revokeObjectURL(url)
  }
}
