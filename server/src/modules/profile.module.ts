/**
 * Student/supervisor profile data (FR-PROF-01..05). Business rules enforced
 * server-side: 1-3 ranked interests, exactly-5-distinct preferences submitted
 * only while the window is open, 2-4 expertise areas, scores 0-1 on actual
 * applicants only.
 */
import { asc, eq, inArray } from "drizzle-orm"
import type { FastifyPluginAsync } from "fastify"
import type { ZodTypeProvider } from "fastify-type-provider-zod"
import { z } from "zod"
import { db } from "../db/client.js"
import {
  researchAreas,
  studentInterests,
  studentPreferences,
  students,
  supervisorExpertise,
  supervisorPreferences,
  supervisors,
} from "../db/schema.js"
import { badRequest, forbidden } from "../lib/errors.js"
import { assertSelfOr, requireRole } from "../plugins/auth.js"
import { getWindow } from "./preference-window.module.js"

const studentParams = z.object({ id: z.coerce.number().int() })
const supervisorParams = z.object({ id: z.coerce.number().int() })

export const profileModule: FastifyPluginAsync = async (raw) => {
  const app = raw.withTypeProvider<ZodTypeProvider>()

  app.get("/supervisors/brief", { schema: { tags: ["profile"] } }, async () => {
    const [supers, expertise, areas] = await Promise.all([
      db.select().from(supervisors),
      db.select().from(supervisorExpertise),
      db.select().from(researchAreas),
    ])
    const areaName = new Map(areas.map((a) => [a.area_id, a.name]))
    return supers.map((s) => ({
      supervisor_id: s.supervisor_id,
      title: s.title,
      first_name: s.first_name,
      last_name: s.last_name,
      seniority: s.seniority,
      expertise_area_names: expertise
        .filter((e) => e.supervisor_id === s.supervisor_id)
        .map((e) => areaName.get(e.area_id) ?? "Unknown"),
    }))
  })

  app.get(
    "/students/:id/interests",
    { schema: { tags: ["profile"], params: studentParams } },
    async (req) => {
      assertSelfOr(req, "student", req.params.id, ["admin", "supervisor"])
      return db
        .select()
        .from(studentInterests)
        .where(eq(studentInterests.student_id, req.params.id))
        .orderBy(asc(studentInterests.rank))
    },
  )

  app.put(
    "/students/:id/interests",
    {
      schema: {
        tags: ["profile"],
        params: studentParams,
        body: z.object({
          interests: z
            .array(z.object({ areaId: z.number().int(), rank: z.union([z.literal(1), z.literal(2), z.literal(3)]) }))
            .min(1)
            .max(3),
        }),
      },
    },
    async (req) => {
      assertSelfOr(req, "student", req.params.id, [])
      const { interests } = req.body
      if (new Set(interests.map((i) => i.rank)).size !== interests.length) throw badRequest("Ranks must be distinct.")
      if (new Set(interests.map((i) => i.areaId)).size !== interests.length) throw badRequest("Areas must be distinct.")
      await db.transaction(async (tx) => {
        await tx.delete(studentInterests).where(eq(studentInterests.student_id, req.params.id))
        await tx
          .insert(studentInterests)
          .values(interests.map((i) => ({ student_id: req.params.id, area_id: i.areaId, rank: i.rank })))
      })
      return { ok: true }
    },
  )

  app.get(
    "/students/:id/preferences",
    { schema: { tags: ["profile"], params: studentParams } },
    async (req) => {
      assertSelfOr(req, "student", req.params.id)
      return db
        .select()
        .from(studentPreferences)
        .where(eq(studentPreferences.student_id, req.params.id))
        .orderBy(asc(studentPreferences.rank))
    },
  )

  app.put(
    "/students/:id/preferences",
    {
      schema: {
        tags: ["profile"],
        params: studentParams,
        body: z.object({ supervisorIdsInRankOrder: z.array(z.number().int()).length(5) }),
      },
    },
    async (req) => {
      assertSelfOr(req, "student", req.params.id, [])
      const window = await getWindow()
      if (!window.is_open) throw forbidden("The preference window is closed — submissions are not accepted.")
      const ids = req.body.supervisorIdsInRankOrder
      if (new Set(ids).size !== 5) throw badRequest("Choose 5 distinct supervisors.")
      const known = await db.select({ id: supervisors.supervisor_id }).from(supervisors).where(inArray(supervisors.supervisor_id, ids))
      if (known.length !== 5) throw badRequest("Unknown supervisor in preference list.")
      await db.transaction(async (tx) => {
        await tx.delete(studentPreferences).where(eq(studentPreferences.student_id, req.params.id))
        await tx
          .insert(studentPreferences)
          .values(ids.map((supervisorId, index) => ({ student_id: req.params.id, supervisor_id: supervisorId, rank: index + 1 })))
      })
      return { ok: true }
    },
  )

  app.get(
    "/supervisors/:id/expertise",
    { schema: { tags: ["profile"], params: supervisorParams } },
    async (req) => {
      assertSelfOr(req, "supervisor", req.params.id)
      return db.select().from(supervisorExpertise).where(eq(supervisorExpertise.supervisor_id, req.params.id))
    },
  )

  app.put(
    "/supervisors/:id/expertise",
    {
      schema: {
        tags: ["profile"],
        params: supervisorParams,
        body: z.object({
          expertise: z
            .array(z.object({ areaId: z.number().int(), proficiency: z.union([z.literal(1), z.literal(2), z.literal(3)]) }))
            .min(2)
            .max(4),
        }),
      },
    },
    async (req) => {
      assertSelfOr(req, "supervisor", req.params.id, [])
      const { expertise } = req.body
      if (new Set(expertise.map((e) => e.areaId)).size !== expertise.length) throw badRequest("Areas must be distinct.")
      await db.transaction(async (tx) => {
        await tx.delete(supervisorExpertise).where(eq(supervisorExpertise.supervisor_id, req.params.id))
        await tx
          .insert(supervisorExpertise)
          .values(expertise.map((e) => ({ supervisor_id: req.params.id, area_id: e.areaId, proficiency: e.proficiency })))
      })
      return { ok: true }
    },
  )

  app.get(
    "/supervisors/:id/applicants",
    { schema: { tags: ["profile"], params: supervisorParams } },
    async (req) => {
      assertSelfOr(req, "supervisor", req.params.id)
      const prefs = await db
        .select()
        .from(studentPreferences)
        .where(eq(studentPreferences.supervisor_id, req.params.id))
      const studentIds = prefs.map((p) => p.student_id)
      if (studentIds.length === 0) return []
      const [studentRows, interests, areas, scores] = await Promise.all([
        db.select().from(students).where(inArray(students.student_id, studentIds)),
        db.select().from(studentInterests).where(inArray(studentInterests.student_id, studentIds)),
        db.select().from(researchAreas),
        db.select().from(supervisorPreferences).where(eq(supervisorPreferences.supervisor_id, req.params.id)),
      ])
      const areaName = new Map(areas.map((a) => [a.area_id, a.name]))
      const studentById = new Map(studentRows.map((s) => [s.student_id, s]))
      const scoreByStudent = new Map(scores.map((s) => [s.student_id, s.score]))
      return prefs
        .map((p) => {
          const student = studentById.get(p.student_id)
          if (!student) return null
          return {
            student_id: student.student_id,
            first_name: student.first_name,
            last_name: student.last_name,
            programme: student.programme,
            rank_given: p.rank,
            interest_area_names: interests
              .filter((i) => i.student_id === student.student_id)
              .map((i) => areaName.get(i.area_id) ?? "Unknown"),
            current_score: scoreByStudent.get(student.student_id) ?? null,
          }
        })
        .filter((r) => r !== null)
        .sort((a, b) => a.rank_given - b.rank_given)
    },
  )

  app.put(
    "/supervisors/:id/applicants/:studentId/score",
    {
      preHandler: requireRole("supervisor"),
      schema: {
        tags: ["profile"],
        params: z.object({ id: z.coerce.number().int(), studentId: z.coerce.number().int() }),
        body: z.object({ score: z.number().min(0).max(1) }),
      },
    },
    async (req) => {
      assertSelfOr(req, "supervisor", req.params.id, [])
      const applied = await db.query.studentPreferences.findFirst({
        where: (p, { and: andOp, eq: eqOp }) =>
          andOp(eqOp(p.student_id, req.params.studentId), eqOp(p.supervisor_id, req.params.id)),
      })
      if (!applied) throw badRequest("That student has not listed this supervisor.")
      await db
        .insert(supervisorPreferences)
        .values({ supervisor_id: req.params.id, student_id: req.params.studentId, score: req.body.score })
        .onConflictDoUpdate({
          target: [supervisorPreferences.supervisor_id, supervisorPreferences.student_id],
          set: { score: req.body.score },
        })
      return { ok: true }
    },
  )
}
