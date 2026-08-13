/**
 * Cohort batches (FR-PROF-06): each CSV import creates a new batch (academic
 * year); previous batches are archived and browsable. The CSV is
 * pre-validated client-side for instant feedback, then re-validated
 * authoritatively server-side.
 */
import { api, ApiError, query } from "@/lib/api/client"
import { CsvValidationError, parseStudentsCsv, type CsvRowError } from "./parse-students-csv"
import type { ListParams, Paginated } from "@/lib/types/dto"
import type { Student } from "@/lib/types/entities"

export { CsvValidationError, parseStudentsCsv }
export type { CsvRowError }

export interface CohortRow {
  cohort_id: number
  label: string
  imported_at: string
  source_file: string | null
  active: boolean
  student_count: number
}

export interface CohortImportResult {
  imported: number
  cohort_id: number
  label: string
}

export async function listCohorts(): Promise<CohortRow[]> {
  return api.get("/admin/cohorts")
}

export async function listCohortStudents(
  cohortId: number,
  params?: ListParams & { search?: string },
): Promise<Paginated<Student>> {
  return api.get(
    `/admin/cohorts/${cohortId}/students${query({ page: params?.page, limit: params?.limit, search: params?.search })}`,
  )
}

export async function deleteCohort(cohortId: number): Promise<void> {
  await api.delete(`/admin/cohorts/${cohortId}`)
}

export async function importStudentCohort(file: File, label: string): Promise<CohortImportResult> {
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
    return await api.post<CohortImportResult>("/admin/cohort/import", { file_name: file.name, label, content: text })
  } catch (err) {
    // The server re-validates; surface its row errors in the same shape.
    if (err instanceof ApiError && err.details && typeof err.details === "object" && "errors" in err.details) {
      const details = err.details as { errors: CsvRowError[]; totalErrorCount: number }
      throw new CsvValidationError(details.errors, details.totalErrorCount)
    }
    throw err
  }
}
