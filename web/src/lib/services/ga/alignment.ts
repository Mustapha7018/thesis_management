/**
 * Expertise-alignment score between a student and a supervisor, following
 * the synthetic_data decision ledger (D14): interest ranks weigh 1.0/0.6/0.35
 * (rank 1/2/3) and proficiencies weigh 1.0/0.7/0.4 (level 3/2/1), normalised
 * by the student's maximum attainable weight so scores are comparable between
 * a 1-interest and a 3-interest student.
 */
import type { StudentInterest, SupervisorExpertise } from "@/lib/types/entities"

const INTEREST_WEIGHT: Record<1 | 2 | 3, number> = { 1: 1.0, 2: 0.6, 3: 0.35 }
const PROFICIENCY_WEIGHT: Record<1 | 2 | 3, number> = { 3: 1.0, 2: 0.7, 1: 0.4 }

/**
 * Returns the 0-1 alignment for one (student, supervisor) pairing.
 * `interests` are the student's rows; `expertiseByArea` maps the supervisor's
 * area_id -> proficiency. A student with no interests scores 0.
 */
export function alignmentScore(
  interests: Pick<StudentInterest, "area_id" | "rank">[],
  expertiseByArea: Map<number, SupervisorExpertise["proficiency"]>,
): number {
  if (interests.length === 0) return 0
  let achieved = 0
  let max = 0
  for (const interest of interests) {
    const interestWeight = INTEREST_WEIGHT[interest.rank]
    max += interestWeight
    const proficiency = expertiseByArea.get(interest.area_id)
    if (proficiency !== undefined) {
      achieved += interestWeight * PROFICIENCY_WEIGHT[proficiency]
    }
  }
  return max > 0 ? achieved / max : 0
}
