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

## 2026-08-12 — Backend: Fastify REST API + PostgreSQL (O4; FR-API-01..04, FR-AUTH-01..07)

**What:** The real backend replacing the localStorage mock: a new `server/` package
(Node + Fastify + TypeScript) exposing a **versioned REST JSON API at `/api/v1` that is
the sole writer to a PostgreSQL database** — the architecture §2.1 commits to. The web
client now talks exclusively to public API endpoints (FR-API-01 acceptance criterion);
the browser-side store, fixtures, mock allocator and demo-account picker were removed
from the app bundle.

**Stack decision (no framework was committed in any planning document):** Node/Fastify
chosen over Python/FastAPI and BaaS options because the GA engine, entity types, zod
validation and CSV parser are already TypeScript — the server imports them **directly
from `web/src/lib` via tsconfig paths** (single source of truth, no port, no drift).
PostgreSQL was selected as the live development database (NFR-PORT-01 names it as the
production target); Drizzle ORM provides the schema-as-code and parameterised queries
only (NFR-SEC-03).

**Database:** the 13 baseline tables from `synthetic_data/schema.sql` translated to
PostgreSQL plus the additive portal tables the baseline anticipated: `accounts` (merging
the former users directory + demo accounts; argon2 password hashes, lockout counters),
`allocation_runs` (with `params` JSONB and a **partial unique index enforcing exactly one
published run at the database level**), append-only `audit_log`, `preference_window`,
and review/attachment columns (`at_risk_flags.reviewed_at/reviewed_by/cleared_note`
formalise what was previously client-only state). Seeded from the checked-in synthetic
dataset; the seed is idempotent and also backs `POST /admin/reset-demo`.

**Auth (FR-AUTH-02/03/04/05):** email+password login (shared demo password, argon2-hashed;
directory-only students have no hash and cannot authenticate), expiring JWTs, lockout
after 5 consecutive failures (15-min window, `account_locked` audit event), and
**deny-by-default authorisation**: a global hook rejects any request without a valid
token unless the route is explicitly public; role guards + resource-ownership checks
("self or admin") run per route. The login screen lost the demo-account browser and
gained a password field. Password-reset-by-email deferred (Should) — documented stub.

**GA as a batch process beside the API:** `POST /allocation-runs {algorithm:"ga"}`
returns 202 + job id; the shared engine runs in a **worker_threads** worker; the client
polls `GET /allocation-jobs/:id` for generation/fitness progress (driving the existing
progress bar) and `DELETE` cancels. Persistence (allocations + run + audit) is one
transaction on completion — cancellation writes nothing. Baselines run synchronously
in-request (~3 ms). **Determinism evidence:** seed 12345 produced best fitness 0.7827
in 108 generations in both the browser engine and the server worker — byte-identical
results across environments, strengthening the FR-ALLOC-01 reproducibility claim.

**Other server-side obligations:** preference-window enforcement and the
exactly-5-distinct-preferences rule now hold against any client (FR-PROF-02/05);
milestone overdue is computed on read (satisfies FR-AGILE-05's 24 h criterion without a
scheduler — documented); per-user **ICS calendar feed** served with signed feed tokens
plus single-meeting ICS downloads (FR-MEET-03); cohort CSV import re-validated
server-side and applied atomically in a transaction (FR-PROF-06); flag review/clear now
records actor + timestamp; OpenAPI docs generated from the zod schemas at `/api/docs`
(FR-API-02).

**Testing & CI (NFR-MAIN-01):** 36 integration tests over the full app via
`app.inject()` against a dedicated auto-migrated test database — login/lockout, the
RBAC matrix including the explicit *"student token on an admin endpoint → 403"*
acceptance check, business rules, admin guards, publish exclusivity, atomic import
rejection, and the GA job lifecycle incl. same-seed reproducibility. Coverage:
**82% statements / 87% lines** (target ≥70%). New GitHub Actions workflow runs
lint + typecheck + tests + build for both packages, with a PostgreSQL 18 service
container for the server suite. Web suite (14 GA engine tests) unchanged and green.

**Verified end-to-end in the browser** against the running server: password login,
admin dashboard/cohort/users/audit pages all served from PostgreSQL, GA run through the
job API from the UI (500/500 allocated, 0 violations), compare/publish views, CSV
exports. Deferred to a later iteration: cloud deployment (env-driven config, CORS,
bundled build and backup strategy documented in `server/README.md`), notifications
(FR-ALLOC-06/FR-MEET-04), load testing (NFR-PERF-03).

## 2026-08-13 — DB hardening, manual baseline (FR-ALLOC-04), sensitivity experiment (O6)

**Database hardening:** indexes added on every frequently-queried foreign-key column
(PostgreSQL does not auto-index FKs) — allocations by student/supervisor, preferences by
supervisor (applicants view), and the per-student agile/meeting/flag tables; pool size
made configurable (`PG_POOL_MAX`, default 10) with idle/connection timeouts; graceful
shutdown drains HTTP before releasing DB connections. Connection pooling itself was
already in place via `pg.Pool`.

**Manual baseline (FR-ALLOC-04, Must — last open Must requirement):**
`POST /api/v1/allocation-runs/manual` records a hand-made allocation (e.g. a
departmental spreadsheet) identically to algorithmic runs: same run/allocation tables,
same benchmarks, audit-logged; `objective_score` computed where the pairing is on the
student's list, null off-list; `runtime_ms` null (human-entered). Server validates
duplicate students and unknown ids. UI: a third baseline card with a
"student_id,supervisor_id per line" paste box. Verified in browser — a partial manual
run correctly reports its quota_min violations. Integration test added (37 total).

**Parameter-sensitivity experiment (O2/O6 evaluation plan):**
`npm run experiment:sensitivity` runs the shared engine over the live 500×32 instance —
5 weight profiles × 3 seeds, population {50, 100, 200}, mutation {0.005, 0.02, 0.05} —
plus the greedy reference; results in `docs/evaluation/ga-sensitivity-<date>.csv`.
Headline findings for the evaluation chapter (means over 3 seeds):

| Configuration | Fitness | Mean rank | Load variance | % unallocated |
|---|---|---|---|---|
| **GA, pure preference (wP=1)** | 0.967 | **1.16** | 8.13 | **0** |
| GA, default (0.5/0.3/0.2) | 0.787 | 1.43 | **6.73** | 0 |
| GA, pure balance (wB=1) | 0.903 | 2.12 | 7.44 | 0 |
| Greedy baseline | — | 1.21 | 7.31 | 0.4 |

(1) With pure preference weight the GA **beats greedy on greedy's own objective**
(mean rank 1.16 vs 1.21) while allocating 100% of students and guaranteeing quota_min —
greedy does neither. (2) Weights steer outcomes monotonically (FR-ALLOC-01 acceptance).
(3) Population 200 improves fitness marginally at ~4× the runtime of population 50;
low mutation (0.005) converges slower but slightly better — defaults are a reasonable
operating point. All runs < 1 s (NFR-PERF-01 margin ≈ 60×).

## 2026-08-13 — Real data everywhere: flag rule engine, universal logins, placeholder removal (FR-DASH-02)

**Problem:** an audit of the three role dashboards found the UIs fully API-driven, but
fed by hand-authored placeholders three layers down: (1) at-risk flags were never raised
by anything — FR-DASH-02 (Must: "Raise rule-based at-risk flags carrying a rule_code and
a human-readable reason") was unimplemented and the only flags in existence were two
hand-written seed rows; (2) the demo seeds fabricated activity (sprints/milestones/tasks/
meetings for 8 students, three rigged allocation runs — the published one still labelled
"GA engine pending" — and four fabricated audit-log entries); (3) only 17 of 533 accounts
had password hashes, so real students and supervisors could not log in and generate real
data.

**At-risk flag rule engine** (`server/src/modules/flag-rules.ts`): flags are now derived
entirely from real activity. Rules (formalising the two de facto rule codes the seed had
invented): **MILESTONE_OVERDUE** — any student with an overdue, not-done milestone
(reason names the earliest overdue milestone and counts the rest); **NO_RECENT_MEETING**
— an allocated student with no meeting scheduled or held in the last 28 days.
Design decisions: *evaluate-on-read* (the evaluator runs at the top of the four
dashboard/flag endpoints, so a flag appears within one page load of its condition —
inside FR-DASH-01's <1-minute staleness — without a scheduler); *raise-only* (the
lifecycle raised → reviewed → cleared stays a human decision per FR-DASH-03; nothing
auto-clears); *14-day cool-down* after clearing so a just-cleared flag doesn't
immediately re-raise; *28-day grace period after publication* for NO_RECENT_MEETING —
first verification flagged all 500 students seconds after publishing (technically true,
practically noise), so the rule only fires once the published run is older than the
meeting window. Thresholds are named constants; admin-configurable thresholds
(FR-DASH-06, Could) deferred.

**Universal logins:** every seeded account — all 500 students, 32 supervisors, admin —
and every bulk-imported student now gets an argon2 hash of the shared `DEMO_PASSWORD`,
so anyone on the roster can log in and *do the work* that populates the dashboards.
Security caveat documented: a shared password is a demo/testing device; per-user
credentials and reset-by-email remain the deferred production path.

**Placeholder removal:** the server seed now loads only the validated synthetic dataset
(the allocation problem instance: students, supervisors, areas, expertise, interests,
preferences) plus accounts and the preference window. Sprints, milestones, tasks,
meetings, allocation runs, at-risk flags and audit entries all start empty and arise
only from user actions. The stale "Greedy (mock — GA pending)" badge was corrected.
Consequence, by design: a fresh system shows honest empty dashboards — the demo script
is now "log in and do the work": students submit interests/preferences and manage their
projects, the admin runs the real GA and publishes, supervisors see genuinely computed
progress and rule-raised flags.

**Verification:** 38 server integration tests green, including a new causality test —
a student creating an overdue milestone via the API must cause the engine (not a seed)
to raise a MILESTONE_OVERDUE flag for that student, which is then reviewed and cleared.
End-to-end curl trace on a fresh database: empty runs/flags/audit → roster student logs
in → creates overdue milestone → admin runs and publishes an allocation → exactly one
active flag, naming that milestone.

## 2026-08-13 — Cohort batches with history; admin dashboard search + pagination

**Design change:** the original cohort import used replace-and-wipe semantics (the
simpler option chosen when the feature was built). The user now needs batches kept
side-by-side — "2024/2025 batch, 2025/2026 batch" — with browsable history, so the data
model gained a batch dimension:

- New `cohorts` table (label, imported_at, source_file, active); `students.cohort_id`
  and `allocation_runs.cohort_id` FKs. Exactly one batch is **active**; the GA/baseline
  instance builder, manual-baseline validation and the supervisor applicants view all
  scope to the active batch. Archived batches keep every row (auditability) but their
  students' accounts are retired so only the current intake can log in.
- **Import now creates a batch instead of wiping**: the admin names it (e.g. 2026/2027),
  the outgoing batch is archived, its published allocation is unpublished (the new batch
  starts unallocated), and the new intake can log in immediately. Because each batch is
  a distinct intake, student ids/emails must be unique across batches — a colliding file
  is rejected with a 409 naming the collisions (re-importing the same file requires
  deleting the old batch first; documented trade-off vs surrogate keys, which would have
  meant renumbering every student-keyed table for no real-world benefit).
- Archived batches can be deleted (cascades to their students, activity and runs);
  the active batch cannot.
- UI: the Cohort page gained a batch selector, per-batch searchable/paginated student
  table, and a batch-history list with delete; the sidebar "Cohort" item now expands to
  the batch history (active + archived), deep-linking via `?batch=`. Benchmark rows in
  Compare runs now show which batch a run belongs to.

**Admin dashboard:** the cohort overview gained a server-side search (student or
supervisor name/email, filtered before pagination) and pagination controls (20/page)
replacing the previous fixed 100-row fetch.

**Verification:** 41 server integration tests (new: collision rejection, batch
archiving with login switchover — new batch logs in, old batch 401 — per-batch student
search, active-batch delete protection, dashboard search filtering); browser-verified
the full flow: imported a 40-student 2026/2027 batch, sidebar/history updated, archived
2025/2026 browsable, dashboard search "diallo" → 37 matches across 2 pages.

---

## Planned / next

- Cloud deployment of API + PostgreSQL + web app (O4 "secure cloud database"); set real
  `JWT_SECRET`, `ALLOW_DEMO_RESET=false`, TLS.
- GA parameter-sensitivity experiments for O6 (params are persisted per run to support this).
- Sandbox/what-if runs (FR-ALLOC-08, Could).
- Email notifications: password reset (FR-AUTH-05), publish notification (FR-ALLOC-06),
  meeting reminders (FR-MEET-04).
- Latency measurement for NFR-PERF-02/03 evidence (p95 targets, 300 concurrent users).
