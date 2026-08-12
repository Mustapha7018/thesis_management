/**
 * Automated post-run quota check (FR-ALLOC-02): every supervisor must end a
 * run within [quota_min, quota_max]. Iterates all supervisors so zero-load
 * supervisors are seen — an under-min supervisor with no students is a real
 * violation, not an invisible one.
 */
import { getDb } from "./db/store"

export interface QuotaViolation {
  supervisor_id: number
  assigned: number
  quota_min: number
  quota_max: number
  kind: "over_max" | "under_min"
}

export function checkQuotaViolations(runId: string): QuotaViolation[] {
  const db = getDb()
  const counts = new Map<number, number>()
  for (const a of db.allocations) {
    if (a.run_id !== runId) continue
    counts.set(a.supervisor_id, (counts.get(a.supervisor_id) ?? 0) + 1)
  }
  const violations: QuotaViolation[] = []
  for (const s of db.supervisors) {
    const assigned = counts.get(s.supervisor_id) ?? 0
    if (assigned > s.quota_max) {
      violations.push({ supervisor_id: s.supervisor_id, assigned, quota_min: s.quota_min, quota_max: s.quota_max, kind: "over_max" })
    } else if (assigned < s.quota_min) {
      violations.push({ supervisor_id: s.supervisor_id, assigned, quota_min: s.quota_min, quota_max: s.quota_max, kind: "under_min" })
    }
  }
  return violations
}
