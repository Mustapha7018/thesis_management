/**
 * One-time CSV -> JSON fixture converter. Run manually with `npm run fixtures:build`
 * whenever synthetic_data/data/*.csv changes — not wired into predev/prebuild
 * because the source dataset is static for the life of this build.
 *
 * Re-validates the same invariants synthetic_data/validate.py already checked,
 * so a future regeneration of the CSVs can't silently desync the frontend.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, "../../synthetic_data/data")
const OUT_DIR = resolve(__dirname, "../src/lib/data/fixtures")

function parseCsv<T extends Record<string, string>>(fileName: string): T[] {
  const raw = readFileSync(resolve(DATA_DIR, fileName), "utf-8")
  const { data, errors } = Papa.parse<T>(raw, { header: true, skipEmptyLines: true })
  if (errors.length > 0) {
    throw new Error(`Failed to parse ${fileName}: ${JSON.stringify(errors[0])}`)
  }
  return data
}

function fail(message: string): never {
  console.error(`✖ ${message}`)
  process.exit(1)
}

function num(value: string): number {
  return Number(value)
}

// ---------------------------------------------------------------------------
// research_areas
// ---------------------------------------------------------------------------
const researchAreasRaw = parseCsv<{
  area_id: string
  code: string
  name: string
  description: string
}>("research_areas.csv")

const researchAreas = researchAreasRaw.map((r) => ({
  area_id: num(r.area_id),
  code: r.code,
  name: r.name,
  description: r.description || null,
}))
if (researchAreas.length === 0) fail("research_areas.csv produced zero rows")

// ---------------------------------------------------------------------------
// supervisors
// ---------------------------------------------------------------------------
const supervisorsRaw = parseCsv<{
  supervisor_id: string
  title: string
  first_name: string
  last_name: string
  email: string
  seniority: string
  fte: string
  quota_min: string
  quota_max: string
  created_at: string
}>("supervisors.csv")

const supervisors = supervisorsRaw.map((r) => ({
  supervisor_id: num(r.supervisor_id),
  title: r.title,
  first_name: r.first_name,
  last_name: r.last_name,
  email: r.email,
  seniority: r.seniority,
  fte: num(r.fte),
  quota_min: num(r.quota_min),
  quota_max: num(r.quota_max),
  created_at: r.created_at,
}))

for (const s of supervisors) {
  if (s.quota_max < s.quota_min) {
    fail(`supervisor ${s.supervisor_id}: quota_max < quota_min`)
  }
  if (!/^[\w.]+\.[\w.]+@sunderland\.ac\.uk$/.test(s.email)) {
    fail(`supervisor ${s.supervisor_id}: email "${s.email}" fails firstname.lastname@sunderland.ac.uk convention`)
  }
}
if (supervisors.length < 30) fail(`expected >=30 supervisors, got ${supervisors.length}`)

// ---------------------------------------------------------------------------
// supervisor_expertise
// ---------------------------------------------------------------------------
const supervisorExpertiseRaw = parseCsv<{
  supervisor_id: string
  area_id: string
  proficiency: string
}>("supervisor_expertise.csv")

const supervisorExpertise = supervisorExpertiseRaw.map((r) => ({
  supervisor_id: num(r.supervisor_id),
  area_id: num(r.area_id),
  proficiency: num(r.proficiency) as 1 | 2 | 3,
}))

for (const e of supervisorExpertise) {
  if (e.proficiency < 1 || e.proficiency > 3) {
    fail(`supervisor_expertise ${e.supervisor_id}/${e.area_id}: proficiency out of range`)
  }
}

// ---------------------------------------------------------------------------
// students
// ---------------------------------------------------------------------------
const studentsRaw = parseCsv<{
  student_id: string
  first_name: string
  last_name: string
  email: string
  programme: string
  mode: string
  entry_year: string
  entry_qualification: string
  prior_avg_mark: string
  created_at: string
}>("students.csv")

const students = studentsRaw.map((r) => ({
  student_id: num(r.student_id),
  first_name: r.first_name,
  last_name: r.last_name,
  email: r.email,
  programme: r.programme,
  mode: r.mode,
  entry_year: num(r.entry_year),
  entry_qualification: r.entry_qualification,
  prior_avg_mark: num(r.prior_avg_mark),
  created_at: r.created_at,
}))

for (const s of students) {
  if (!/^[a-z0-9]{6}@student\.sunderland\.ac\.uk$/.test(s.email)) {
    fail(`student ${s.student_id}: email "${s.email}" fails 6-char alphanumeric @student.sunderland.ac.uk convention`)
  }
  if (s.prior_avg_mark < 40 || s.prior_avg_mark > 90) {
    fail(`student ${s.student_id}: prior_avg_mark out of range`)
  }
}
if (students.length < 200) fail(`expected >=200 students, got ${students.length}`)

// ---------------------------------------------------------------------------
// student_interests
// ---------------------------------------------------------------------------
const studentInterestsRaw = parseCsv<{
  student_id: string
  area_id: string
  rank: string
}>("student_interests.csv")

const studentInterests = studentInterestsRaw.map((r) => ({
  student_id: num(r.student_id),
  area_id: num(r.area_id),
  rank: num(r.rank) as 1 | 2 | 3,
}))

// ---------------------------------------------------------------------------
// student_preferences (exactly 5 distinct supervisors per student, FR-PROF-02)
// ---------------------------------------------------------------------------
const studentPreferencesRaw = parseCsv<{
  student_id: string
  supervisor_id: string
  rank: string
}>("student_preferences.csv")

const studentPreferences = studentPreferencesRaw.map((r) => ({
  student_id: num(r.student_id),
  supervisor_id: num(r.supervisor_id),
  rank: num(r.rank) as 1 | 2 | 3 | 4 | 5,
}))

const prefsByStudent = new Map<number, typeof studentPreferences>()
for (const p of studentPreferences) {
  const list = prefsByStudent.get(p.student_id) ?? []
  list.push(p)
  prefsByStudent.set(p.student_id, list)
}
for (const [studentId, list] of prefsByStudent) {
  if (list.length !== 5) {
    fail(`student ${studentId}: expected exactly 5 preference rows, got ${list.length}`)
  }
  const distinctSupervisors = new Set(list.map((l) => l.supervisor_id))
  if (distinctSupervisors.size !== 5) {
    fail(`student ${studentId}: preference list has duplicate supervisors`)
  }
}

// ---------------------------------------------------------------------------
// supervisor_preferences (score 0-1)
// ---------------------------------------------------------------------------
const supervisorPreferencesRaw = parseCsv<{
  supervisor_id: string
  student_id: string
  score: string
}>("supervisor_preferences.csv")

const supervisorPreferences = supervisorPreferencesRaw.map((r) => ({
  supervisor_id: num(r.supervisor_id),
  student_id: num(r.student_id),
  score: num(r.score),
}))

for (const p of supervisorPreferences) {
  if (p.score < 0 || p.score > 1) {
    fail(`supervisor_preferences ${p.supervisor_id}/${p.student_id}: score out of [0,1]`)
  }
}

// ---------------------------------------------------------------------------
// Write fixtures
// ---------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true })

const fixtures: Record<string, unknown> = {
  "research-areas": researchAreas,
  supervisors,
  "supervisor-expertise": supervisorExpertise,
  students,
  "student-interests": studentInterests,
  "student-preferences": studentPreferences,
  "supervisor-preferences": supervisorPreferences,
}

for (const [name, data] of Object.entries(fixtures)) {
  writeFileSync(resolve(OUT_DIR, `${name}.json`), JSON.stringify(data, null, 2) + "\n")
}

console.log("✔ Fixtures built:")
for (const [name, data] of Object.entries(fixtures)) {
  console.log(`  - ${name}.json (${(data as unknown[]).length} rows)`)
}
