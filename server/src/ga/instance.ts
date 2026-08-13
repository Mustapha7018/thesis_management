/**
 * Server-side port of the web ga.service instance extraction: joins the six
 * instance tables into the plain-data GaInstance the shared engine consumes,
 * with the D14 alignment score precomputed per listed pairing.
 */
import { asc, eq } from "drizzle-orm"
import { db } from "../db/client.js"
import {
  cohorts,
  studentInterests,
  studentPreferences,
  students,
  supervisorExpertise,
  supervisorPreferences,
  supervisors,
} from "../db/schema.js"
import { alignmentScore } from "@shared/services/ga/alignment"
import type { GaInstance } from "@shared/services/ga/types"

export async function buildGaInstance(): Promise<GaInstance> {
  // The allocation instance is the ACTIVE batch only; archived batches are history.
  const activeCohort = await db.query.cohorts.findFirst({ where: eq(cohorts.active, true) })
  const [studentRows, supervisorRows, interests, expertise, scores, prefs] = await Promise.all([
    activeCohort
      ? db.select().from(students).where(eq(students.cohort_id, activeCohort.cohort_id)).orderBy(asc(students.student_id))
      : Promise.resolve([]),
    db.select().from(supervisors).orderBy(asc(supervisors.supervisor_id)),
    db.select().from(studentInterests),
    db.select().from(supervisorExpertise),
    db.select().from(supervisorPreferences),
    db.select().from(studentPreferences),
  ])

  const supIdxById = new Map<number, number>()
  supervisorRows.forEach((s, idx) => supIdxById.set(s.supervisor_id, idx))

  const interestsByStudent = new Map<number, { area_id: number; rank: 1 | 2 | 3 }[]>()
  for (const i of interests) {
    const list = interestsByStudent.get(i.student_id) ?? []
    list.push({ area_id: i.area_id, rank: i.rank as 1 | 2 | 3 })
    interestsByStudent.set(i.student_id, list)
  }
  const expertiseBySupervisor = new Map<number, Map<number, 1 | 2 | 3>>()
  for (const e of expertise) {
    const byArea = expertiseBySupervisor.get(e.supervisor_id) ?? new Map<number, 1 | 2 | 3>()
    byArea.set(e.area_id, e.proficiency as 1 | 2 | 3)
    expertiseBySupervisor.set(e.supervisor_id, byArea)
  }
  const scoreByPair = new Map<string, number>()
  for (const sp of scores) scoreByPair.set(`${sp.supervisor_id}:${sp.student_id}`, sp.score)

  const prefsByStudent = new Map<number, typeof prefs>()
  for (const p of prefs) {
    const list = prefsByStudent.get(p.student_id) ?? []
    list.push(p)
    prefsByStudent.set(p.student_id, list)
  }

  const emptyExpertise = new Map<number, 1 | 2 | 3>()
  return {
    studentIds: studentRows.map((s) => s.student_id),
    supervisors: supervisorRows.map((s) => ({ id: s.supervisor_id, quotaMin: s.quota_min, quotaMax: s.quota_max })),
    prefs: studentRows.map((student) => {
      const studentInterestRows = interestsByStudent.get(student.student_id) ?? []
      return (prefsByStudent.get(student.student_id) ?? [])
        .filter((p) => supIdxById.has(p.supervisor_id))
        .sort((a, b) => a.rank - b.rank)
        .map((p) => ({
          supIdx: supIdxById.get(p.supervisor_id)!,
          rank: p.rank,
          score: scoreByPair.get(`${p.supervisor_id}:${student.student_id}`) ?? 0,
          align: alignmentScore(studentInterestRows, expertiseBySupervisor.get(p.supervisor_id) ?? emptyExpertise),
        }))
    }),
  }
}

/** Supervisors with fewer applicants than quota_min — their minimum cannot be met. */
export function findInfeasibleQuotaMins(instance: GaInstance): number[] {
  const applicantCounts = new Array<number>(instance.supervisors.length).fill(0)
  for (const list of instance.prefs) {
    for (const pref of list) applicantCounts[pref.supIdx]++
  }
  return instance.supervisors.filter((s, idx) => applicantCounts[idx] < s.quotaMin).map((s) => s.id)
}
