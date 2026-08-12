import { auditLog } from "../db/schema.js"
import { nowIso } from "./http.js"

export type AuditEventType =
  | "login"
  | "login_failed"
  | "role_change"
  | "account_locked"
  | "cohort_import"
  | "account_created"
  | "account_deleted"
  | "allocation_run"

/** Works with both the root db and a transaction handle. */
interface Insertable {
  insert: (table: typeof auditLog) => { values: (row: typeof auditLog.$inferInsert) => Promise<unknown> }
}

export async function writeAudit(db: Insertable, eventType: AuditEventType, actorEmail: string, detail: string) {
  await db.insert(auditLog).values({
    occurred_at: nowIso(),
    event_type: eventType,
    actor_email: actorEmail,
    detail,
  })
}
