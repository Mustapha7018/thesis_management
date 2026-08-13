/**
 * Bulk cohort import (FR-PROF-06): authoritative server-side re-validation
 * of students.csv, then an all-or-nothing transactional replacement of the
 * cohort and every student-keyed table. The CSV arrives as a JSON body
 * (file name + text content) — it is ~60 KB of text, multipart adds nothing.
 */
import argon2 from "argon2"
import { desc, eq } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { config } from "../config.js"
import { db } from "../db/client.js"
import {
  accounts,
  allocationRuns,
  allocations,
  atRiskFlags,
  auditLog,
  meetings,
  milestones,
  sprints,
  studentInterests,
  studentPreferences,
  students,
  supervisorPreferences,
  tasks,
} from "../db/schema.js"
import { writeAudit } from "../lib/audit.js"
import { badRequest } from "../lib/errors.js"
import { nowIso } from "../lib/http.js"
import { requireRole } from "../plugins/auth.js"
import { parseStudentsCsv } from "@shared/services/parse-students-csv"

export const cohortModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()
  const adminOnly = { preHandler: requireRole("admin") }

  app.get("/admin/cohort/summary", { ...adminOnly, schema: { tags: ["cohort"] } }, async () => {
    const [studentCount, prefCount, lastImport] = await Promise.all([
      db.$count(students),
      db.$count(studentPreferences),
      db.query.auditLog.findFirst({
        where: eq(auditLog.event_type, "cohort_import"),
        orderBy: desc(auditLog.occurred_at),
      }),
    ])
    return {
      studentCount,
      hasPreferences: prefCount > 0,
      lastImport: lastImport ?? null,
    }
  })

  app.post(
    "/admin/cohort/import",
    {
      ...adminOnly,
      schema: {
        tags: ["cohort"],
        body: z.object({
          file_name: z.string().min(1),
          content: z.string().min(1).max(2 * 1024 * 1024, "File is too large — a students.csv export should be under 2 MB."),
        }),
      },
    },
    async (req) => {
      if (!req.body.file_name.toLowerCase().endsWith(".csv")) throw badRequest("Only .csv files are accepted.")
      const { students: parsed, errors } = parseStudentsCsv(req.body.content)
      if (errors.length > 0) {
        const err = badRequest("students.csv failed validation.") as Error & {
          statusCode: number
          payload?: unknown
        }
        // Structured validation detail for the client's error panel.
        throw Object.assign(err, {
          payload: { errors: errors.slice(0, 10), totalErrorCount: errors.length },
        })
      }

      const cleared = {
        interests: await db.$count(studentInterests),
        studentPreferences: await db.$count(studentPreferences),
        supervisorPreferences: await db.$count(supervisorPreferences),
        allocations: await db.$count(allocations),
        runs: await db.$count(allocationRuns),
        sprints: await db.$count(sprints),
        milestones: await db.$count(milestones),
        tasks: await db.$count(tasks),
        meetings: await db.$count(meetings),
        flags: await db.$count(atRiskFlags),
      }

      const demoHash = await argon2.hash(config.DEMO_PASSWORD)

      await db.transaction(async (tx) => {
        // Student-keyed data first, then the cohort itself.
        await tx.delete(allocations)
        await tx.delete(allocationRuns)
        await tx.delete(tasks)
        await tx.delete(milestones)
        await tx.delete(sprints)
        await tx.delete(meetings)
        await tx.delete(atRiskFlags)
        await tx.delete(supervisorPreferences)
        await tx.delete(studentPreferences)
        await tx.delete(studentInterests)
        await tx.delete(accounts).where(eq(accounts.role, "student"))
        await tx.delete(students)

        for (let i = 0; i < parsed.length; i += 500) {
          await tx.insert(students).values(parsed.slice(i, i + 500))
        }
        // Imported students can log in immediately with the shared demo password.
        const accountRows = parsed.map((s) => ({
          account_id: `student-${s.student_id}`,
          email: s.email,
          role: "student",
          display_name: `${s.first_name} ${s.last_name}`,
          active: true,
          password_hash: demoHash,
          student_id: s.student_id,
          created_at: nowIso(),
        }))
        for (let i = 0; i < accountRows.length; i += 500) {
          await tx.insert(accounts).values(accountRows.slice(i, i + 500))
        }
        await writeAudit(
          tx,
          "cohort_import",
          req.user.email,
          `Imported ${parsed.length} students from ${req.body.file_name}; replaced previous cohort and cleared dependent data.`,
        )
      })

      return { imported: parsed.length, cleared }
    },
  )
}
