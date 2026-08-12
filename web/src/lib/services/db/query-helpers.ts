import type { ListParams, Paginated } from "@/lib/types/dto"

export function paginate<T>(rows: T[], params?: ListParams): Paginated<T> {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20
  const start = (page - 1) * limit
  return {
    data: rows.slice(start, start + limit),
    total: rows.length,
    page,
    limit,
  }
}

export function sortBy<T>(rows: T[], key: keyof T, direction: "asc" | "desc" = "asc"): T[] {
  const sorted = [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av === bv) return 0
    return av > bv ? 1 : -1
  })
  return direction === "desc" ? sorted.reverse() : sorted
}
