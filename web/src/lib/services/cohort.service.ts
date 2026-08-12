/**
 * Cohort bulk import (FR-PROF-06). The CSV is pre-validated client-side for
 * instant feedback, then sent to the server which re-validates
 * authoritatively and replaces the cohort in one transaction.
 */
import { api, ApiError } from "@/lib/api/client"
import { CsvValidationError, parseStudentsCsv, type CsvRowError } from "./parse-students-csv"
import type { AuditLogEntry } from "@/lib/types/entities"

export { CsvValidationError, parseStudentsCsv }
export type { CsvRowError }

export interface CohortImportResult {
  imported: number
  cleared: {
    interests: number
    studentPreferences: number
    supervisorPreferences: number
    allocations: number
    runs: number
    sprints: number
    milestones: number
    tasks: number
    meetings: number
    flags: number
  }
}

export interface CohortSummary {
  studentCount: number
  hasPreferences: boolean
  lastImport: AuditLogEntry | null
}

export async function importStudentCohort(file: File): Promise<CohortImportResult> {
  if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
    throw new Error("Only .csv files are accepted.")
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("File is too large — a students.csv export should be under 2 MB.")
  }

  const text = await file.text()
  const { errors } = parseStudentsCsv(text)
  if (errors.length > 0) {
    throw new CsvValidationError(errors.slice(0, 10), errors.length)
  }

  try {
    return await api.post<CohortImportResult>("/admin/cohort/import", { file_name: file.name, content: text })
  } catch (err) {
    // The server re-validates; surface its row errors in the same shape.
    if (err instanceof ApiError && err.details && typeof err.details === "object" && "errors" in err.details) {
      const details = err.details as { errors: CsvRowError[]; totalErrorCount: number }
      throw new CsvValidationError(details.errors, details.totalErrorCount)
    }
    throw err
  }
}

export async function getCohortSummary(): Promise<CohortSummary> {
  return api.get("/admin/cohort/summary")
}
