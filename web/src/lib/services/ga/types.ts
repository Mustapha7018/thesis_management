/**
 * Plain-data shapes for the GA engine. Everything here must be
 * structured-clone-safe (posted to/from the Web Worker) and free of any
 * store or DOM references so the engine stays pure and unit-testable.
 */

export interface GaInstanceSupervisor {
  id: number
  quotaMin: number
  quotaMax: number
}

/** One entry of a student's rank-sorted preference list. */
export interface GaPref {
  /** Index into GaInstance.supervisors (not the supervisor_id). */
  supIdx: number
  /** Student's rank for this supervisor, 1 (best) to 5. */
  rank: number
  /** Supervisor's 0-1 suitability score for this student (0 if unscored). */
  score: number
  /** D14 expertise-alignment score for this pairing, 0-1. */
  align: number
}

export interface GaInstance {
  /** student_id per student slot; index is the gene position. */
  studentIds: number[]
  supervisors: GaInstanceSupervisor[]
  /** Per student, rank-ascending preference list (length 0-5). */
  prefs: GaPref[][]
}

export interface GaWeights {
  preference: number
  expertise: number
  balance: number
}

export interface GaParams {
  weights: GaWeights
  seed: number
  population: number
  generations: number
  /** Per-gene probability of resampling within the student's list. */
  mutationRate: number
  /** Number of best individuals copied verbatim each generation. */
  elitism: number
  /** Stop early after this many generations without improvement. */
  stagnationWindow: number
}

export const DEFAULT_GA_PARAMS: Omit<GaParams, "seed"> = {
  weights: { preference: 0.5, expertise: 0.3, balance: 0.2 },
  population: 100,
  generations: 300,
  mutationRate: 0.02,
  elitism: 2,
  stagnationWindow: 50,
}

export interface GaProgress {
  generation: number
  totalGenerations: number
  bestFitness: number
}

export interface GaResult {
  /** Per student: index into their preference list, or -1 = unassigned. */
  assignment: number[]
  bestFitness: number
  generationsRun: number
  /** Best fitness per generation (monotone non-decreasing via elitism). */
  fitnessHistory: number[]
  /** Per student, the persisted pairing objective score (0 for unassigned). */
  pairScores: number[]
  /** Supervisors whose quota_min could not be met from their applicants. */
  minInfeasibleSupervisorIds: number[]
}

// ---------------------------------------------------------------------------
// Worker message protocol
// ---------------------------------------------------------------------------

export interface GaWorkerStart {
  type: "start"
  instance: GaInstance
  params: GaParams
}

export type GaWorkerMessage =
  | { type: "progress"; progress: GaProgress }
  | { type: "done"; result: GaResult }
  | { type: "error"; message: string }
