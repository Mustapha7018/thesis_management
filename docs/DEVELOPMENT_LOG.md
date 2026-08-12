# Development Log

Running record of design decisions, implementation work and verification evidence for the
thesis management portal. Each entry links work back to the requirements specification
(FR-*/NFR-*) and project objectives (O1–O6) so it can be cited directly in the
dissertation's methodology and evaluation chapters.

Conventions: newest entries at the bottom; every feature entry records **what** was built,
**why** (requirement/objective), **key decisions with rationale**, and **how it was verified**.

---

## 2026-08-12 — Repository baseline

- Initialised git history and published to GitHub (`Mustapha7018/thesis_management`, private).
- Repo layout: `web/` (React 19 + Vite 8 + TypeScript portal), `synthetic_data/` (dataset
  generator, CSVs, schema.sql, validation), `docs/` (planning, requirements, literature review).
- Hygiene: `.docx` documents and generated artifacts (`thesis_management.db`,
  `validation_report.md`) are kept out of version control; this markdown log is versioned.
- Baseline app state: no backend — a localStorage-backed store (`web/src/lib/services/db/store.ts`)
  stands in behind an async service layer shaped like the future REST API (FR-API-01/02/03),
  so a real backend can replace it without UI rework. Allocation used a placeholder
  greedy/random first-fit (`mock-allocation-algorithm.ts`), with the real GA deferred to task 5.0.

## 2026-08-12 — Bulk cohort import via CSV (FR-PROF-06, O1)

**What:** New admin "Cohort" page (`/admin/cohort`) where an admin uploads a `students.csv`
conforming to the synthetic_data schema; the import replaces the current cohort so the
platform is reusable for every intake year.

**Implementation:** `web/src/lib/services/cohort.service.ts` (browser-side Papa.parse +
zod validation), `web/src/components/admin/cohort-import-panel.tsx`, `web/src/pages/admin/cohort.page.tsx`.

**Key decisions:**
- *Replace-cohort semantics.* Importing wipes students **and every student-keyed collection*
  (interests, preferences, allocations, allocation runs, sprints, milestones, tasks, meetings,
  at-risk flags) — stale allocation runs referencing deleted students would corrupt the
  Publish/Compare pages, and a new cohort is a new problem instance.
- *All-or-nothing validation.* Any invalid row rejects the whole file (first 10 row errors
  shown, with total count); nothing is written on failure. Checks: exact header match,
  email convention (FR-AUTH-02), programme/mode/qualification enums, `prior_avg_mark` ∈ [40, 90],
  parseable dates, duplicate id/email detection.
- *Imported students get no demo login accounts* — mirrors the seed, where only 8 of 500
  students have logins; students are data subjects of the allocation, not portal users, until
  provisioning (FR-AUTH-01) is a real backend concern.
- Acceptance criterion met: the synthetic_data CSV imports without transformation.

**Verification:** browser E2E — imported the real 500-row `students.csv` (success card with
cleared counts + audit entry), rejected files with renamed headers / duplicate ids /
out-of-range marks with row-level errors and zero writes, re-import idempotent, allocation
runnable on the fresh cohort (0 allocated until preferences exist — expected and surfaced
in the UI). `npm run lint` + `npm run build` clean.

## 2026-08-12 — Admin account CRUD (FR-AUTH-06, O4)

**What:** Admins can create, edit, retire/reactivate and delete admin accounts from the
Users page; new admins can immediately log in.

**Implementation:** `createAdmin` / `updateAdmin` / `setAdminActive` / `deleteAdmin` in
`web/src/lib/services/admin.service.ts`; `admin-form-dialog.tsx`; admin row actions in
`user-table.tsx`.

**Key decisions:**
- Guards live in the **service layer**, not the UI, so they survive the future API swap:
  staff email format, case-insensitive uniqueness, no self-retire/self-delete, and the
  last active admin can never be retired or deleted (lock-out prevention).
- The dual account collections (`users` directory + `demoAccounts` logins) are kept in sync
  on every mutation, following the existing `setUserActive` pattern.
- Every action writes an audit-log entry (FR-AUTH-07) attributed to the session email
  (replacing the previous hardcoded "admin" actor).

**Verification:** browser E2E — created `sam.turner@sunderland.ac.uk` (invalid/duplicate
emails rejected), retired + reactivated, logged in as the new admin, deleted a throwaway
admin, own-row guards disabled in UI and enforced in service, audit log shows
`account_created`/`account_deleted`/`role_change` with correct actors.

## 2026-08-12 — Genetic-algorithm allocation engine (task 5.0; FR-ALLOC-01/02/03/05; O2)

**What:** The real GA replacing the placeholder, wired into the Run Allocation page with
configurable objective weights, a reproducibility seed, live progress and cancellation.
Module: `web/src/lib/services/ga/` (`engine.ts`, `alignment.ts`, `prng.ts`, `types.ts`,
`ga.worker.ts`, `ga.service.ts`, `engine.test.ts`).

**Design (follows the literature commitments — Sanchez-Anguix et al. 2019, per the
literature review Theme B):**
- *Representation:* direct vector — gene *i* is an index into student *i*'s rank-sorted
  preference list (on-list assignment only, so every pairing remains explainable per
  FR-ALLOC-07 and mean satisfied rank stays well-defined); −1 = unassigned, produced only
  by repair when all listed supervisors are full.
- *Objective (weighted-sum scalarisation, weights normalised to sum 1):*
  `wP·P + wE·E + wB·B − unassigned/n`, where P = mean preference value `(6 − rank)/5` over
  all students, E = mean expertise alignment (the D14 formula from the synthetic_data
  decision ledger: interest-rank weights 1.0/0.6/0.35 × proficiency weights 1.0/0.7/0.4,
  normalised per student), B = `1 − 2·stdev(load/quota_max over all supervisors)` ∈ [0, 1].
  The fixed unassignment penalty guarantees the GA never prefers leaving a student out
  while a listed slot is open, keeping % unallocated a meaningful benchmark metric.
- *Constraint handling — repair, not penalty* (hard FR-ALLOC-02 guarantee): Phase A evicts
  lowest-composite students from over-`quota_max` supervisors to their best listed
  alternative with space (else unassigned); Phase B fills under-`quota_min` supervisors
  from unassigned applicants (best rank first) then donors above their own minimum
  (largest surplus first). Both phases provably terminate and cannot create new
  violations; genuinely infeasible minimums (fewer applicants than quota_min) are reported,
  not looped on. `quota_min` was previously enforced nowhere in the codebase.
- *Operators & schedule:* tournament selection (k = 3), uniform crossover, per-gene
  mutation resampling within the student's list (default 0.02), elitism 2, population 100,
  ≤ 300 generations with early stop after 50 stagnant generations, initial population
  seeded with a repaired greedy-by-rank individual plus randoms.
- *Determinism (FR-ALLOC-01 acceptance):* single mulberry32 PRNG stream seeded from the
  user-supplied seed; no `Math.random`, no time-dependent choices → same seed + weights +
  instance = byte-identical assignment.
- *Per-pairing `objective_score`:* `(wP·prefValue + wE·align)/(wP + wE)` on the existing
  0–1 scale, so explanation/result views needed no changes.
- *Execution:* Web Worker (Vite-native), progress posted every 10 generations; cancel
  terminates the worker; persistence (run row incl. full `params` for sensitivity
  analysis, allocation rows, audit entry) happens only on completion, so cancel or
  tab-close can never leave partial state.

**Accompanying fixes:**
- `checkQuotaViolations` moved to shared `quota-check.ts`, now reporting both `over_max`
  and `under_min` across **all** supervisors (zero-load supervisors were previously invisible).
- `computeBenchmark` workload variance now iterates all supervisors — a supervisor with
  zero students is real imbalance, not an absent data point.
- CSV export (FR-API-04): benchmarks table and per-run allocations exportable from the
  Compare runs page (`csv-export.ts`, Papa.unparse).
- Audit event type `allocation_run` added; publish/run actors attributed to session email.

**Testing (NFR-MAIN-01, deliverable D4):** vitest added (`npm test`); 14 unit tests over
the pure engine: seed determinism, quota_max/min compliance, repair termination on a
maximally tight instance (Σquota_max = n), weight-extreme steering (wP=1 optimises rank,
wB=1 optimises balance), elitism monotonicity, a handcrafted known-optimum instance,
zero-preference cohort, infeasible-minimum reporting, D14 alignment values, parameter
validation. All pass.

**Benchmark evidence (live 500-student / 32-supervisor instance, NFR-PERF-01/NFR-SCAL-01):**

| Run | Mean satisfied rank | Workload variance | % unallocated | Runtime |
|---|---|---|---|---|
| GA (wP=0.5, wE=0.3, wB=0.2, seed=12345) | 1.43 | 6.86 | 0% | 365 ms |
| GA (identical seed/weights, re-run) | 1.43 | 6.86 | 0% | 359 ms |
| Greedy baseline | 1.20 | 7.31 | 0.4% | 3 ms |
| Random baseline | 2.95 | 12.62 | 1% | 5 ms |

Observations for the evaluation chapter: (1) reproducibility confirmed — identical metrics
across same-seed runs; (2) runtime is ~3 orders of magnitude under the 60 s budget at the
500-student stress scale; (3) with default weights the GA trades a small amount of mean
rank versus pure greedy in exchange for full allocation (0% vs 0.4% unallocated), better
workload balance, and hard quota_min satisfaction (which greedy does not guarantee) —
the expected multi-objective trade-off; raising wP closes the rank gap. Also verified in
browser: live progress + mid-run cancel (nothing persisted), CSV exports well-formed,
published GA run visible to students/supervisors with per-pairing explanations
(FR-ALLOC-06/07).

---

## Planned / next

- **Backend (FR-API module):** replace the localStorage store behind the existing async
  service layer with a real API + database (schema already defined in
  `synthetic_data/schema.sql`); provisioning and real authentication (FR-AUTH-01..05).
- GA parameter-sensitivity experiments for O6 (params are persisted per run to support this).
- Manual baseline entry UI (FR-ALLOC-04) and sandbox/what-if runs (FR-ALLOC-08, Could).
