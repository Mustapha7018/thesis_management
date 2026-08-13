/**
 * Cohort batches (FR-PROF-06 extended): each CSV import creates a NEW batch
 * (e.g. "2026/2027") rather than overwriting — the previous batch is archived
 * (its students keep their data but can no longer log in), the new batch
 * becomes active, and allocation/GA operate on the active batch only.
 * Student ids/emails must be unique ACROSS batches (each intake is new
 * people); a colliding file is rejected before anything is written.
 * Non-active batches can be deleted, cascading to their students and runs.
 */
import argon2 from "argon2"
import { asc, desc, eq, inArray } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { config } from "../config.js"
import { db } from "../db/client.js"
import { accounts, allocationRuns, cohorts, students } from "../db/schema.js"
import { writeAudit } from "../lib/audit.js"
import { badRequest, conflict, notFound } from "../lib/errors.js"
import { listQuerySchema, nowIso, paginate } from "../lib/http.js"
import { requireRole } from "../plugins/auth.js"
import { parseStudentsCsv } from "@shared/services/parse-students-csv"

export const cohortModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()
  const adminOnly = { preHandler: requireRole("admin") }

  /** Batch history, newest first: drives the cohort page and the sidebar dropdown. */
  app.get("/admin/cohorts", { ...adminOnly, schema: { tags: ["cohort"] } }, async () => {
    const [cohortRows, studentRows] = await Promise.all([
      db.select().from(cohorts).orderBy(desc(cohorts.imported_at)),
      db.select({ cohort_id: students.cohort_id }).from(students),
    ])
    const counts = new Map<number, number>()
    for (const s of studentRows) {
      if (s.cohort_id !== null) counts.set(s.cohort_id, (counts.get(s.cohort_id) ?? 0) + 1)
    }
    return cohortRows.map((c) => ({ ...c, student_count: counts.get(c.cohort_id) ?? 0 }))
  })

  app.get(
    "/admin/cohorts/:cohortId/students",
    {
      ...adminOnly,
      schema: {
        tags: ["cohort"],
        params: z.object({ cohortId: z.coerce.number().int() }),
        querystring: listQuerySchema.extend({ search: z.string().optional() }),
      },
    },
    async (req) => {
      const cohort = await db.query.cohorts.findFirst({ where: eq(cohorts.cohort_id, req.params.cohortId) })
      if (!cohort) throw notFound("Cohort not found.")
      let rows = await db
        .select()
        .from(students)
        .where(eq(students.cohort_id, cohort.cohort_id))
        .orderBy(asc(students.student_id))
      const needle = req.query.search?.trim().toLowerCase()
      if (needle) {
        rows = rows.filter(
          (s) =>
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(needle) ||
            s.email.toLowerCase().includes(needle) ||
            s.programme.toLowerCase().includes(needle),
        )
      }
      return paginate(rows, req.query.page, req.query.limit)
    },
  )

  app.post(
    "/admin/cohort/import",
    {
      ...adminOnly,
      schema: {
        tags: ["cohort"],
        body: z.object({
          file_name: z.string().min(1),
          label: z.string().min(1).max(40),
          content: z.string().min(1).max(2 * 1024 * 1024, "File is too large — a students.csv export should be under 2 MB."),
        }),
      },
    },
    async (req) => {
      if (!req.body.file_name.toLowerCase().endsWith(".csv")) throw badRequest("Only .csv files are accepted.")
      const { students: parsed, errors } = parseStudentsCsv(req.body.content)
      if (errors.length > 0) {
        const err = badRequest("students.csv failed validation.")
        err.payload = { errors: errors.slice(0, 10), totalErrorCount: errors.length }
        throw err
      }

      const label = req.body.label.trim()
      const existingLabel = await db.query.cohorts.findFirst({ where: eq(cohorts.label, label) })
      if (existingLabel) throw conflict(`A cohort labelled "${label}" already exists.`)

      // Batches are distinct intakes: ids and emails must not collide with any
      // existing batch. (To re-import the same file, delete the old batch first.)
      const existing = await db.select({ id: students.student_id, email: students.email }).from(students)
      const existingIds = new Set(existing.map((s) => s.id))
      const existingEmails = new Set(existing.map((s) => s.email.toLowerCase()))
      const collisions: string[] = []
      for (const s of parsed) {
        if (existingIds.has(s.student_id)) collisions.push(`student_id ${s.student_id}`)
        else if (existingEmails.has(s.email.toLowerCase())) collisions.push(`email ${s.email}`)
        if (collisions.length >= 5) break
      }
      if (collisions.length > 0) {
        throw conflict(
          `This file collides with an existing batch (${collisions.join(", ")}${collisions.length >= 5 ? ", …" : ""}). ` +
            "Each batch must contain new students; delete the previous batch first to re-import the same file.",
        )
      }

      const demoHash = await argon2.hash(config.DEMO_PASSWORD)
      const importedAt = nowIso()

      const cohortId = await db.transaction(async (tx) => {
        const previousActive = await tx.query.cohorts.findFirst({ where: eq(cohorts.active, true) })

        // Archive the outgoing batch: keep its data, retire its logins.
        if (previousActive) {
          await tx.update(cohorts).set({ active: false }).where(eq(cohorts.cohort_id, previousActive.cohort_id))
          const oldStudentIds = (
            await tx.select({ id: students.student_id }).from(students).where(eq(students.cohort_id, previousActive.cohort_id))
          ).map((s) => s.id)
          if (oldStudentIds.length > 0) {
            await tx.update(accounts).set({ active: false }).where(inArray(accounts.student_id, oldStudentIds))
          }
        }
        // The previous batch's published allocation is history, not the current state.
        await tx.update(allocationRuns).set({ published: false }).where(eq(allocationRuns.published, true))

        const [cohort] = await tx
          .insert(cohorts)
          .values({ label, imported_at: importedAt, source_file: req.body.file_name, active: true })
          .returning()

        for (let i = 0; i < parsed.length; i += 500) {
          await tx.insert(students).values(parsed.slice(i, i + 500).map((s) => ({ ...s, cohort_id: cohort.cohort_id })))
        }
        const accountRows = parsed.map((s) => ({
          account_id: `student-${s.student_id}`,
          email: s.email,
          role: "student",
          display_name: `${s.first_name} ${s.last_name}`,
          active: true,
          password_hash: demoHash,
          student_id: s.student_id,
          created_at: importedAt,
        }))
        for (let i = 0; i < accountRows.length; i += 500) {
          await tx.insert(accounts).values(accountRows.slice(i, i + 500))
        }
        await writeAudit(
          tx,
          "cohort_import",
          req.user.email,
          `Imported batch "${label}" (${parsed.length} students from ${req.body.file_name}); previous batch archived.`,
        )
        return cohort.cohort_id
      })

      return { imported: parsed.length, cohort_id: cohortId, label }
    },
  )

  app.delete(
    "/admin/cohorts/:cohortId",
    { ...adminOnly, schema: { tags: ["cohort"], params: z.object({ cohortId: z.coerce.number().int() }) } },
    async (req, reply) => {
      const cohort = await db.query.cohorts.findFirst({ where: eq(cohorts.cohort_id, req.params.cohortId) })
      if (!cohort) throw notFound("Cohort not found.")
      if (cohort.active) throw badRequest("The active cohort cannot be deleted. Import a new batch first.")

      await db.transaction(async (tx) => {
        const studentIds = (
          await tx.select({ id: students.student_id }).from(students).where(eq(students.cohort_id, cohort.cohort_id))
        ).map((s) => s.id)
        if (studentIds.length > 0) {
          await tx.delete(accounts).where(inArray(accounts.student_id, studentIds))
        }
        // Students, their dependants and the batch's runs cascade from these deletes.
        await tx.delete(cohorts).where(eq(cohorts.cohort_id, cohort.cohort_id))
        await writeAudit(
          tx,
          "cohort_import",
          req.user.email,
          `Deleted archived batch "${cohort.label}" (${studentIds.length} students).`,
        )
      })
      return reply.status(204).send()
    },
  )
}
