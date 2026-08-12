/**
 * Pure students.csv parsing + validation (FR-PROF-06), shared between the
 * web client (instant pre-validation) and the server (authoritative
 * re-validation). No store or DOM access.
 */
import Papa from "papaparse"
import { z } from "zod"
import type { Student } from "@/lib/types/entities"
import { isStudentEmail } from "@/lib/utils/validation"

const EXPECTED_HEADERS = [
  "student_id",
  "first_name",
  "last_name",
  "email",
  "programme",
  "mode",
  "entry_year",
  "entry_qualification",
  "prior_avg_mark",
  "created_at",
] as const

const PROGRAMMES = [
  "MSc Data Science",
  "MSc Computer Science",
  "MSc Cybersecurity",
  "MSc Applied Cybersecurity",
  "MSc Computer Science with Data Science",
  "MSc Computer Science with Cyber Security",
] as const

const ENTRY_QUALIFICATIONS = ["First", "2:1", "2:2", "International equivalent"] as const

const rowSchema = z.object({
  student_id: z.coerce.number({ error: "student_id must be a number" }).int().positive({
    error: "student_id must be a positive integer",
  }),
  first_name: z.string().min(1, "first_name is required"),
  last_name: z.string().min(1, "last_name is required"),
  email: z
    .string()
    .refine(isStudentEmail, "email must be a 6-character code @student.sunderland.ac.uk"),
  programme: z.enum(PROGRAMMES, { error: `programme must be one of: ${PROGRAMMES.join(", ")}` }),
  mode: z.enum(["FT", "PT"], { error: "mode must be FT or PT" }),
  entry_year: z.coerce
    .number({ error: "entry_year must be a number" })
    .int()
    .min(2000, "entry_year out of range 2000–2100")
    .max(2100, "entry_year out of range 2000–2100"),
  entry_qualification: z.enum(ENTRY_QUALIFICATIONS, {
    error: `entry_qualification must be one of: ${ENTRY_QUALIFICATIONS.join(", ")}`,
  }),
  prior_avg_mark: z.coerce
    .number({ error: "prior_avg_mark must be a number" })
    .min(40, "prior_avg_mark out of range 40–90")
    .max(90, "prior_avg_mark out of range 40–90"),
  created_at: z
    .string()
    .min(1, "created_at is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "created_at is not a valid date"),
})

export interface CsvRowError {
  /** 1-based data row (excluding the header line); 0 for file-level errors. */
  row: number
  message: string
}

export class CsvValidationError extends Error {
  errors: CsvRowError[]
  totalErrorCount: number

  constructor(errors: CsvRowError[], totalErrorCount: number) {
    super(`students.csv failed validation with ${totalErrorCount} error${totalErrorCount === 1 ? "" : "s"}.`)
    this.name = "CsvValidationError"
    this.errors = errors
    this.totalErrorCount = totalErrorCount
  }
}

/** Pure parse + validate; collects every error instead of throwing. */
export function parseStudentsCsv(text: string): { students: Student[]; errors: CsvRowError[] } {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy" })

  const fields = parsed.meta.fields ?? []
  const missing = EXPECTED_HEADERS.filter((h) => !fields.includes(h))
  const extra = fields.filter((f) => !(EXPECTED_HEADERS as readonly string[]).includes(f))
  if (missing.length > 0 || extra.length > 0) {
    return {
      students: [],
      errors: [
        {
          row: 0,
          message: `Header mismatch — expected columns: ${EXPECTED_HEADERS.join(", ")}. Got: ${fields.join(", ") || "none"}.`,
        },
      ],
    }
  }
  if (parsed.data.length === 0) {
    return { students: [], errors: [{ row: 0, message: "File contains no student rows." }] }
  }

  const students: Student[] = []
  const errors: CsvRowError[] = []
  const seenIds = new Map<number, number>()
  const seenEmails = new Map<string, number>()

  parsed.data.forEach((raw, index) => {
    const row = index + 1
    const result = rowSchema.safeParse(raw)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path.join(".")
        errors.push({
          row,
          message: field && !issue.message.startsWith(field) ? `${field}: ${issue.message}` : issue.message,
        })
      }
      return
    }
    const student = result.data
    const idFirstSeen = seenIds.get(student.student_id)
    if (idFirstSeen !== undefined) {
      errors.push({ row, message: `Duplicate student_id ${student.student_id} (first seen at row ${idFirstSeen}).` })
      return
    }
    const emailKey = student.email.toLowerCase()
    const emailFirstSeen = seenEmails.get(emailKey)
    if (emailFirstSeen !== undefined) {
      errors.push({ row, message: `Duplicate email ${student.email} (first seen at row ${emailFirstSeen}).` })
      return
    }
    seenIds.set(student.student_id, row)
    seenEmails.set(emailKey, row)
    students.push(student)
  })

  return { students, errors }
}
