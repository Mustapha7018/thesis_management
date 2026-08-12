import researchAreasFixture from "@/lib/data/fixtures/research-areas.json"
import studentInterestsFixture from "@/lib/data/fixtures/student-interests.json"
import studentPreferencesFixture from "@/lib/data/fixtures/student-preferences.json"
import studentsFixture from "@/lib/data/fixtures/students.json"
import supervisorExpertiseFixture from "@/lib/data/fixtures/supervisor-expertise.json"
import supervisorPreferencesFixture from "@/lib/data/fixtures/supervisor-preferences.json"
import supervisorsFixture from "@/lib/data/fixtures/supervisors.json"
import allocationRunsSeed from "@/lib/data/seed/allocation-runs.seed.json"
import allocationsSeed from "@/lib/data/seed/allocations.seed.json"
import atRiskFlagsSeed from "@/lib/data/seed/at-risk-flags.seed.json"
import auditLogSeed from "@/lib/data/seed/audit-log.seed.json"
import demoAccountsSeed from "@/lib/data/seed/demo-accounts.seed.json"
import meetingsSeed from "@/lib/data/seed/meetings.seed.json"
import milestonesSeed from "@/lib/data/seed/milestones.seed.json"
import preferenceWindowSeed from "@/lib/data/seed/preference-window.seed.json"
import sprintsSeed from "@/lib/data/seed/sprints.seed.json"
import tasksSeed from "@/lib/data/seed/tasks.seed.json"
import usersSeed from "@/lib/data/seed/users.seed.json"

import type { AdminUserRow } from "@/lib/types/dto"
import type {
  Allocation,
  AllocationRun,
  AtRiskFlag,
  AuditLogEntry,
  DemoAccount,
  Meeting,
  Milestone,
  PreferenceWindow,
  ResearchArea,
  Sprint,
  Student,
  StudentInterest,
  StudentPreference,
  Supervisor,
  SupervisorExpertise,
  SupervisorPreference,
  Task,
} from "@/lib/types/entities"

export interface Db {
  researchAreas: ResearchArea[]
  supervisors: Supervisor[]
  supervisorExpertise: SupervisorExpertise[]
  students: Student[]
  studentInterests: StudentInterest[]
  studentPreferences: StudentPreference[]
  supervisorPreferences: SupervisorPreference[]
  allocations: Allocation[]
  allocationRuns: AllocationRun[]
  sprints: Sprint[]
  milestones: Milestone[]
  tasks: Task[]
  meetings: Meeting[]
  atRiskFlags: AtRiskFlag[]
  demoAccounts: DemoAccount[]
  users: AdminUserRow[]
  auditLog: AuditLogEntry[]
  preferenceWindow: PreferenceWindow
  /** Client-only "reviewed" marker for at-risk flags (see plan's open decision #1) — not a real schema column. */
  reviewedFlagIds: number[]
}

const STORAGE_KEY = "thesis-portal:v2:db"

function buildInitialState(): Db {
  return {
    researchAreas: researchAreasFixture as ResearchArea[],
    supervisors: supervisorsFixture as Supervisor[],
    supervisorExpertise: supervisorExpertiseFixture as SupervisorExpertise[],
    students: studentsFixture as Student[],
    studentInterests: studentInterestsFixture as StudentInterest[],
    studentPreferences: studentPreferencesFixture as StudentPreference[],
    supervisorPreferences: supervisorPreferencesFixture as SupervisorPreference[],
    allocations: allocationsSeed as Allocation[],
    allocationRuns: allocationRunsSeed as AllocationRun[],
    sprints: sprintsSeed as Sprint[],
    milestones: milestonesSeed as Milestone[],
    tasks: tasksSeed as Task[],
    meetings: meetingsSeed as Meeting[],
    atRiskFlags: atRiskFlagsSeed as AtRiskFlag[],
    demoAccounts: demoAccountsSeed as DemoAccount[],
    users: usersSeed as AdminUserRow[],
    auditLog: auditLogSeed as AuditLogEntry[],
    preferenceWindow: preferenceWindowSeed as PreferenceWindow,
    reviewedFlagIds: [],
  }
}

let state: Db = loadState()

function loadState(): Db {
  if (typeof localStorage === "undefined") return buildInitialState()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const initial = buildInitialState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
  try {
    return JSON.parse(raw) as Db
  } catch {
    const initial = buildInitialState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
}

function persist() {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** All service mutations go through this: mutate the returned object, then call persist(). */
export function getDb(): Db {
  return state
}

export function saveDb() {
  persist()
}

/** Wipes the namespace and re-seeds from the checked-in fixtures/seed JSON. */
export function resetDemoData() {
  state = buildInitialState()
  persist()
}

export function nextId<T>(rows: T[], key: keyof T): number {
  return rows.reduce((max, row) => Math.max(max, Number(row[key]) || 0), 0) + 1
}
