import { z } from "zod"

/**
 * Pagination contract shared with the frontend's Paginated<T> DTO
 * (FR-API-03). List endpoints filter in memory — cohort-scale data
 * (≤ 500 students) makes SQL-side pagination an optimisation, not a need.
 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export function paginate<T>(rows: T[], page: number, limit: number): Paginated<T> {
  const start = (page - 1) * limit
  return { data: rows.slice(start, start + limit), total: rows.length, page, limit }
}

export const nowIso = () => new Date().toISOString()
