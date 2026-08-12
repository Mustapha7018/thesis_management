import { getDb, saveDb } from "./db/store"
import type { ApplicantView, SupervisorBrief } from "@/lib/types/dto"
import type { StudentInterest, SupervisorExpertise } from "@/lib/types/entities"
import { validateDistinctRankedList } from "@/lib/utils/validation"

export async function listResearchAreas() {
  return getDb().researchAreas
}

export async function listSupervisorsBrief(): Promise<SupervisorBrief[]> {
  const db = getDb()
  const areaById = new Map(db.researchAreas.map((a) => [a.area_id, a.name]))
  return db.supervisors.map((s) => ({
    supervisor_id: s.supervisor_id,
    title: s.title,
    first_name: s.first_name,
    last_name: s.last_name,
    seniority: s.seniority,
    expertise_area_names: db.supervisorExpertise
      .filter((e) => e.supervisor_id === s.supervisor_id)
      .map((e) => areaById.get(e.area_id) ?? "Unknown"),
  }))
}

// ---------------------------------------------------------------------------
// Student interests (FR-PROF-01): 1-3 ranked areas, unique ranks.
// ---------------------------------------------------------------------------

export async function getMyInterests(studentId: number): Promise<StudentInterest[]> {
  return getDb()
    .studentInterests.filter((i) => i.student_id === studentId)
    .sort((a, b) => a.rank - b.rank)
}

export async function setMyInterests(
  studentId: number,
  interests: { areaId: number; rank: 1 | 2 | 3 }[],
): Promise<void> {
  if (interests.length < 1 || interests.length > 3) {
    throw new Error("Choose between 1 and 3 research interests.")
  }
  const ranks = interests.map((i) => i.rank)
  if (new Set(ranks).size !== ranks.length) {
    throw new Error("Each interest must have a unique rank.")
  }
  const areas = interests.map((i) => i.areaId)
  if (new Set(areas).size !== areas.length) {
    throw new Error("Each research area can only be listed once.")
  }

  const db = getDb()
  db.studentInterests = db.studentInterests.filter((i) => i.student_id !== studentId)
  db.studentInterests.push(
    ...interests.map((i) => ({ student_id: studentId, area_id: i.areaId, rank: i.rank })),
  )
  saveDb()
}

// ---------------------------------------------------------------------------
// Student preference list (FR-PROF-02): exactly 5 distinct supervisors,
// gated by the admin-controlled preference window (FR-PROF-05).
// ---------------------------------------------------------------------------

export async function getMyPreferenceList(studentId: number) {
  return getDb()
    .studentPreferences.filter((p) => p.student_id === studentId)
    .sort((a, b) => a.rank - b.rank)
}

export async function setMyPreferenceList(studentId: number, supervisorIdsInRankOrder: number[]): Promise<void> {
  const db = getDb()
  if (!db.preferenceWindow.is_open) {
    throw new Error("The preference submission window is currently closed.")
  }
  const error = validateDistinctRankedList(supervisorIdsInRankOrder, 5)
  if (error) throw new Error(error)

  db.studentPreferences = db.studentPreferences.filter((p) => p.student_id !== studentId)
  db.studentPreferences.push(
    ...supervisorIdsInRankOrder.map((supervisorId, index) => ({
      student_id: studentId,
      supervisor_id: supervisorId,
      rank: (index + 1) as 1 | 2 | 3 | 4 | 5,
    })),
  )
  saveDb()
}

// ---------------------------------------------------------------------------
// Supervisor expertise (FR-PROF-03): 2-4 areas, proficiency 1-3.
// ---------------------------------------------------------------------------

export async function getMyExpertise(supervisorId: number): Promise<SupervisorExpertise[]> {
  return getDb().supervisorExpertise.filter((e) => e.supervisor_id === supervisorId)
}

export async function setMyExpertise(
  supervisorId: number,
  expertise: { areaId: number; proficiency: 1 | 2 | 3 }[],
): Promise<void> {
  if (expertise.length < 2 || expertise.length > 4) {
    throw new Error("Choose between 2 and 4 expertise areas.")
  }
  const areas = expertise.map((e) => e.areaId)
  if (new Set(areas).size !== areas.length) {
    throw new Error("Each research area can only be listed once.")
  }

  const db = getDb()
  db.supervisorExpertise = db.supervisorExpertise.filter((e) => e.supervisor_id !== supervisorId)
  db.supervisorExpertise.push(
    ...expertise.map((e) => ({ supervisor_id: supervisorId, area_id: e.areaId, proficiency: e.proficiency })),
  )
  saveDb()
}

// ---------------------------------------------------------------------------
// Applicant scoring (FR-PROF-04): supervisor scores 0-1, applicants only.
// ---------------------------------------------------------------------------

export async function listApplicants(supervisorId: number): Promise<ApplicantView[]> {
  const db = getDb()
  const areaById = new Map(db.researchAreas.map((a) => [a.area_id, a.name]))
  const studentById = new Map(db.students.map((s) => [s.student_id, s]))

  return db.studentPreferences
    .filter((p) => p.supervisor_id === supervisorId)
    .map((p) => {
      const student = studentById.get(p.student_id)!
      const interestAreaNames = db.studentInterests
        .filter((i) => i.student_id === p.student_id)
        .sort((a, b) => a.rank - b.rank)
        .map((i) => areaById.get(i.area_id) ?? "Unknown")
      const existingScore = db.supervisorPreferences.find(
        (sp) => sp.supervisor_id === supervisorId && sp.student_id === p.student_id,
      )
      return {
        student_id: p.student_id,
        first_name: student.first_name,
        last_name: student.last_name,
        programme: student.programme,
        rank_given: p.rank,
        interest_area_names: interestAreaNames,
        current_score: existingScore?.score ?? null,
      }
    })
    .sort((a, b) => a.rank_given - b.rank_given)
}

export async function scoreApplicant(supervisorId: number, studentId: number, score: number): Promise<void> {
  if (score < 0 || score > 1) throw new Error("Score must be between 0 and 1.")

  const db = getDb()
  const isApplicant = db.studentPreferences.some(
    (p) => p.supervisor_id === supervisorId && p.student_id === studentId,
  )
  if (!isApplicant) throw new Error("This student did not list you as a preference.")

  db.supervisorPreferences = db.supervisorPreferences.filter(
    (sp) => !(sp.supervisor_id === supervisorId && sp.student_id === studentId),
  )
  db.supervisorPreferences.push({ supervisor_id: supervisorId, student_id: studentId, score })
  saveDb()
}
