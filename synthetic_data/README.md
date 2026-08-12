# Synthetic Dataset & Data-Generation Protocol (Objective O1 → Deliverable D3)

Rule-based, schema-first synthetic data for the **AI-Driven Thesis Management
Platform** — Faculty of Business, School of Computer Science & Engineering,
University of Sunderland. The schema defined here (`schema.sql`) **is** the
application database: the API, GA allocation engine, Agile module and
supervisor dashboard all read/write these tables.

---

## 1. Quick start

```bash
python3 generate.py          # writes data/*.csv and thesis_management.db
python3 validate.py          # runs 21 checks, writes validation_report.md
```

No third-party dependencies — Python 3.9+ standard library only. Both scripts
are deterministic: the same `config.json` (including `seed`) always produces
byte-identical output (verified by hashing CSVs across repeated runs).

Current instance: **240 students, 32 supervisors** (config-driven; O1 requires
≥200/≥30 — scale up by editing `counts` and re-running).

## 2. Why rule-based generation (the reasoning)

The project's ethics position (Planning Review §4) is that **no real
participant data may be used**, which rules out the entire family of
data-driven generators — and this is a *methodological choice*, not a
limitation we discovered late:

| Approach | Representative tools | Why it doesn't fit this project |
|---|---|---|
| Deep generative (diffusion / score / GAN) | TabDDPM (Kotelnikov et al., 2023); STaSy (Kim et al., 2023); CTAB-GAN+ (Zhao et al., 2024) | All *learn distributions from a real seed dataset*. We have no institutional records and may not collect any. |
| Commercial/OSS synthesis platforms | SDV (Synthetic Data Vault), Gretel, Mostly AI | Same constraint: their fidelity metrics and models presuppose real training tables. |
| Context-free fakers | Faker, Mockaroo | Generate *plausible-looking values with no cross-column or cross-table dependencies*: a Faker "student" would pick supervisors uniformly at random, which destroys exactly the structure (preference–expertise alignment, workload pressure) the GA is being built to exploit and the benchmark (O6) must measure. |
| **Rule-based / schema-driven (this generator)** | — | Requires no input data (Tammisto et al., 2025); constraints hold *by construction*; every distribution is a declared, reviewable assumption. |

The systematic review by Tammisto et al. (2025) identifies rule-based
generation as the principal method family when real-world raw data cannot be
accessed, with the caveat that **realism claims rest on documented
assumptions**. That caveat drives the design: every distribution lives in
`config.json` or in named constants at the top of `generate.py`, and the
validator explicitly re-checks realised data against those declarations.

### How this generator differs from a "styled" random generator

1. **Dependency-aware, not independent columns.** Student interests are
   sampled *conditionally on programme* (a Cybersecurity student's interests
   concentrate on CYBER/NET_IOT); preference lists are sampled by
   interest–expertise **alignment scoring** through a softmax choice model, not
   uniformly. Validation shows rank-1 choices overlap supervisor expertise at
   0.78 vs 0.48 under random pairing — structure a context-free faker cannot
   produce.
2. **Two-sided by construction (SPA-style).** Following the student–project
   allocation literature (Abraham, Irving & Manlove, 2007; Sanchez-Anguix et
   al., 2019), both sides express preferences: students rank 5 supervisors;
   supervisors score exactly their applicants (a continuous score, because
   real staff do not produce total orders over whole cohorts).
3. **Feasible allocation instance guaranteed.** Quotas derive from a
   workload model (FTE × seniority base, after Alnaji et al., 2024) and the
   generator inflates capacity if `sum(quota_max)` falls below a configured
   slack (1.1× cohort), so the GA always faces a solvable problem.
4. **Bounded-rational choice, not optimal choice.** Softmax temperature and a
   seeded per-supervisor "popularity bias" reproduce application clustering on
   well-known staff (observed real-world phenomenon) while keeping alignment
   the dominant signal.
5. **Deterministic and parametric.** One seed, one RNG instance; regeneration
   at 500/60 for stress-testing (O6) is a config edit, not a code change.

## 3. Files

| File | Role |
|---|---|
| `schema.sql` | Full application DDL — 13 tables. Written for SQLite (dev) with portable types/constraints for PostgreSQL (deployment). |
| `config.json` | All parameters: counts, seed, email rules, distribution weights, workload model, choice-model temperature. |
| `generate.py` | The rule-based generator (stdlib only). |
| `validate.py` | 21-check validation suite → `validation_report.md` (evidence for milestone M4). |
| `data/*.csv` | One CSV per populated table (7 tables). |
| `thesis_management.db` | SQLite database built from `schema.sql` + generated rows, FK-checked. |
| `validation_report.md` | Generated PASS/FAIL report. |

## 4. Schema and generation rules

### 4.1 Populated tables (the O1 dataset)

- **research_areas** (12): taxonomy grounded in the school's programme
  portfolio (AI/ML, Data Science, Cybersecurity, Software Engineering, HCI,
  Networks/IoT, Health Informatics, Vision, NLP, Games, Cloud, EdTech).
- **supervisors** (32): title, name, `firstname.lastname@sunderland.ac.uk`
  (user-specified format), seniority (weighted: Lecturer 38%, SL 34%, AP 16%,
  Prof 12%), FTE (1.0/0.8/0.6), workload quotas.
- **supervisor_expertise** (2–4 areas each; first area proficiency 3):
  area prevalence skewed toward the school's profile.
- **students** (240): name, email, programme (6 real Sunderland MSc titles,
  weighted), mode (85% FT), entry qualification band, prior average mark
  (Gaussian per band, clipped 40–90).
- **student_interests** (1–3 ranked areas, programme-conditional).
- **student_preferences** (exactly 5 ranked supervisors per student;
  alignment + popularity + noise → softmax sampling).
- **supervisor_preferences** (scores over applicants only:
  0.65·alignment + 0.25·normalised prior mark + 0.10·noise).

### 4.2 Email rules (user requirements)

- **Students**: local part is exactly **6 random alphanumeric characters**
  at `student.sunderland.ac.uk` (e.g. `d9t357@student.sunderland.ac.uk`).
  Decision: first character forced to a letter and no special symbols —
  symbol-bearing local parts are rare in practice and break common
  validators; this is documented as an interpretation of "letters and
  symbols" and is trivially changeable in `gen_students()`.
- **Supervisors**: `firstname.lastname@sunderland.ac.uk`, lowercased,
  apostrophes stripped (`O'Brien → obrien`), uniqueness enforced.

### 4.3 Workload/quota model

`quota_max = round(base_capacity[seniority] × FTE)`, `quota_min ∈ {1,2}`.
Professors get a *lower* base (6) than Senior Lecturers (8) — research and
leadership commitments reduce supervision capacity — consistent with
workload-based faculty allocation modelling (Alnaji et al., 2024). A
feasibility pass then guarantees `sum(quota_max) ≥ 1.1 × students`.

### 4.4 At-risk-relevant attributes

`prior_avg_mark`, `entry_qualification` and `mode` are included because the
reviewed at-risk literature identifies prior attainment and study intensity
as leading predictive features (Chen & Zhai, 2023; Ujkani, Minkovska & Hinov,
2024). Behavioural signals (engagement, submissions) are **not** synthesised
— they will accrue organically in the portal tables (`milestones`, `tasks`,
`meetings`) once the system runs, which keeps the dataset honest: we generate
what exists *before* the system, not what the system itself will produce.

### 4.5 Empty (forward) tables

`allocations`, `sprints`, `milestones`, `tasks`, `meetings`, `at_risk_flags`
are created but unpopulated: they are written by the GA engine (O2), Agile
module (O3) and dashboard (O5). `allocations.run_id` + `algorithm` let GA and
manual/random baseline runs coexist for the O6 benchmark.

## 5. Names disclaimer

Name pools are curated, internationally diverse reference lists; pairings are
random. **No record corresponds to a real person**; any resemblance is
coincidental. No personal data was used or processed at any point
(privacy-by-design, Planning Review §4).

## 6. Validation strategy

Fidelity/utility metrics from the synthetic-data literature (SynthEval;
Lautrup et al., 2024) presuppose a real reference dataset and therefore *do
not apply* here by design. `validate.py` instead demonstrates the three
properties a rule-based dataset can and must demonstrate:

- **A. Constraint conformance** — email formats, ranges, uniqueness,
  referential integrity (8 checks).
- **B. Structural adequacy** — the instance is a well-posed, feasible
  allocation problem: size minimums, capacity slack, complete two-sided
  preference structure (9 checks).
- **C. Distributional plausibility** — realised distributions match the
  declared assumptions, and the alignment structure is present (4 checks).

Current result: **21/21 PASS** (see `validation_report.md`).

## 7. Limitations & future work

- Distributions are designed, not observed; realism is argued from documented
  assumptions, not measured against institutional data (inherent to the
  rule-based choice — acknowledged in the dissertation's evaluation).
- Scale-up for stress tests: edit `counts` in `config.json` (capacity slack
  auto-maintained). Different cohort shapes (e.g., PT-heavy) are config edits.
- PostgreSQL deployment: `schema.sql` uses portable constructs; migration is
  expected to require only minor type tweaks (e.g. `TEXT` timestamps →
  `TIMESTAMPTZ`, `INTEGER PRIMARY KEY` → `GENERATED ... AS IDENTITY`).
- Possible later additions (flagged by the user as "update stuff later"):
  student nationality/visa fields if reporting needs them, supervisor
  availability calendars, topic proposals as first-class rows.

## 8. References (Harvard)

Abraham, D.J., Irving, R.W. and Manlove, D.F. (2007) 'Two algorithms for the
student-project allocation problem', *Journal of Discrete Algorithms*, 5(1),
pp. 73–90.

Alnaji, L., Alsager, S.M. and Aymen, O. (2024) 'Optimizing faculty resource
allocation in higher education: a mathematical model for strategic planning',
*International Journal of Advanced and Applied Sciences*, 11(9), pp. 88–99.

Chen, Y. and Zhai, L. (2023) 'A comparative study on student performance
prediction using machine learning', *Education and Information Technologies*,
28(9), pp. 12039–12057.

Kim, J., Lee, C. and Park, N. (2023) 'STaSy: score-based tabular data
synthesis', *International Conference on Learning Representations (ICLR)*.

Kotelnikov, A., Baranchuk, D., Rubachev, I. and Babenko, A. (2023) 'TabDDPM:
modelling tabular data with diffusion models', *Proceedings of the 40th
International Conference on Machine Learning (ICML)*, PMLR 202,
pp. 17564–17579.

Lautrup, A.D., Hyrup, T., Zimek, A. and Schneider-Kamp, P. (2024) 'Systematic
review of generative modelling tools and utility metrics for fully synthetic
tabular data', *ACM Computing Surveys*, 57(4). doi: 10.1145/3704437.

Sanchez-Anguix, V., Chalumuri, R., Aydoğan, R. and Julian, V. (2019) 'A near
Pareto optimal approach to student–supervisor allocation with two sided
preferences and workload balance', *Applied Soft Computing*, 76, pp. 1–15.

Tammisto, M.-A., Shah, F.A., Rodriguez, D. and Pfahl, D. (2025) 'The challenge
of generating and evolving real-life-like synthetic test data without
accessing real-world raw data — a systematic review', *Expert Systems*,
42(12), e70164.

Ujkani, B., Minkovska, D. and Hinov, N. (2024) 'Course success prediction and
early identification of at-risk students using explainable artificial
intelligence', *Electronics*, 13(21), 4157.

Zhao, Z., Kunar, A., Birke, R., Van der Scheer, H. and Chen, L.Y. (2024)
'CTAB-GAN+: enhancing tabular data synthesis', *Frontiers in Big Data*, 6,
1296508.
