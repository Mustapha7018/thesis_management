# info.md — File-by-File Guide & Decision Ledger

A companion to `README.md`. The README says *what* the pipeline is and why
rule-based generation was chosen; this file walks through **each file** and
then explains **every non-obvious number** — where it came from, what it
does, and what happens if you change it.

One principle up front: in a rule-based dataset, every figure is a **declared
design assumption**, not an observed fact. That is the honest trade-off of
generating without real data (README §2). The job of this document is to make
each assumption inspectable so it can be defended in the dissertation or
revised after supervisor feedback.

---

## Part 1 — File-by-file walkthrough

### `data/` — the dataset (7 CSVs, mirrors of the DB tables)

**`research_areas.csv` (12 rows).** The controlled vocabulary of the system.
Every "what do you work on / want to work on" question in the platform is
answered by pointing at one of these 12 IDs. Keeping it a table (rather than
free text) is what makes student–supervisor alignment *computable*.

**`supervisors.csv` (32 rows).** Staff identities plus the three numbers the
allocation engine cares about: `fte`, `quota_min`, `quota_max` (see Part 2,
D6–D8).

**`supervisor_expertise.csv` (~90 rows).** Which areas each supervisor works
in, at proficiency 1–3. Each supervisor has 2–4 rows; their first area is
always proficiency 3 (everyone has one leading specialism).

**`students.csv` (240 rows).** The cohort: identity, email, programme, mode,
entry qualification, prior average mark.

**`student_interests.csv` (~485 rows).** Each student's 1–3 ranked research
interests, sampled *conditionally on their programme* (Part 2, D1).

**`student_preferences.csv` (1,200 rows).** Each student's ranked list of
exactly 5 supervisors — one half of the two-sided matching instance.

**`supervisor_preferences.csv` (1,200 rows).** Supervisors' 0–1 scores over
exactly the students who listed them — the other half.

### Root files

**`config.json`** — all tunable parameters. If a number is likely to change
when the cohort changes, it lives here. Structural rules (e.g. "first
expertise area is proficiency 3") live in `generate.py` with comments.

**`schema.sql`** — DDL for 13 tables: the 7 populated ones plus 6 empty
"forward" tables (`allocations`, `sprints`, `milestones`, `tasks`,
`meetings`, `at_risk_flags`) that the GA engine (O2), Agile module (O3) and
dashboard (O5) will write into. Constraints are in the database itself so bad
data is rejected at the door regardless of which API code writes it.

**`generate.py`** — builds everything in dependency order:
areas → supervisors → expertise → students → interests → student preferences
→ supervisor scores → CSVs → SQLite DB (with a foreign-key check before the
file is released). One seeded RNG makes the whole run reproducible.

**`validate.py`** — independent audit of the finished DB: 21 checks across
(A) constraint conformance, (B) structural adequacy — "is this a well-posed,
feasible allocation problem?" — and (C) distributional plausibility —
"does the realised data match what config declared?".

**`validation_report.md`** — the audit's output (currently 21/21 PASS);
evidence artifact for milestone M4.

**`thesis_management.db`** — the SQLite database the API will use.

**`README.md`** — the generation protocol and its literature grounding
(seed of Deliverable D3).

---

## Part 2 — Decision ledger (the numbers, explained)

### D1. Programme → interest-area weights (`generate.py`, `PROGRAMME_AREA_WEIGHTS`)

**What they are.** Relative multipliers, *not* probabilities. When a student
picks an interest, every area gets a weight from their programme's row
(unlisted areas get the row's `"other"` value), the weights are normalised,
and one area is drawn. So only the *ratios* matter: 3.0 vs 1.2 means
"2.5× more likely per draw", regardless of absolute scale.

**The scale I used (four tiers):**

| Tier | Weight | Meaning |
|---|---|---|
| Defining subject | ~3.0–3.5 | The discipline the degree is named after |
| Adjacent core | ~1.5–2.5 | Taught heavily in the programme, natural project territory |
| Plausible specialism | ~0.9–1.4 | A minority of students specialise here |
| Background ("other") | ~0.3–0.5 | Possible but uncommon crossover |

**Worked example — MSc Data Science.** The row is DATA_SCI 3.0, AI_ML 2.5,
NLP 1.2, CV 1.2, HEALTH 0.9, other 0.35 (×7 remaining areas). Total weight =
3.0+2.5+1.2+1.2+0.9+(7×0.35) = 11.25. So the first interest drawn is:
DATA_SCI ≈ 27%, AI_ML ≈ 22%, NLP ≈ 11%, CV ≈ 11%, HEALTH ≈ 8%, and ≈ 3% for
each background area.

**Why DATA_SCI 3.0 but NLP 1.2, specifically?** Every MSc Data Science
student studies statistical modelling and data engineering — it is the
*defining* subject, so most (but deliberately not all) students should carry
it as an interest. NLP, by contrast, is one of several *application*
specialisms within data science: some students gravitate to text, others to
images (CV, also 1.2 — they are treated as sibling specialisms and given
equal weight), others to health data (0.9, slightly lower as a narrower
domain). The 3.0 : 1.2 ratio encodes the judgement "roughly one student
chooses NLP for every 2.5 who choose core data science" — a defensible
staff-room intuition, not a measured statistic. If your school's cohort
skews differently, change the ratio; nothing else needs to change.

**Why not make the defining subject weight 10 or 100?** Then nearly every DS
student would have identical interests, preference lists would pile onto the
same few supervisors, and the allocation problem would become artificially
brutal. Tier ratios of roughly 8:1 between top and background keep cohesion
*and* diversity.

### D2. Number of interests per student — 25% / 50% / 25% for 1/2/3 areas (`config.json`)

Most postgraduate students can name a main interest plus one secondary; a
quarter are single-minded, a quarter genuinely broad. A symmetric distribution
centred on 2 encodes that without claiming precision. It also matters
downstream: students with 3 interests match more supervisors (smoother
preference structure), students with 1 are choosier (harder to place) —
giving the GA a realistic mix of easy and hard cases.

### D3. Supervisor expertise: 2–4 areas (35% / 45% / 20%), first at proficiency 3

Academics typically describe themselves with one leading specialism plus one
to three secondary areas. Forcing at least 2 areas guarantees no supervisor
is a single-area island (which could make quota minimums unsatisfiable);
capping at 4 stops "expert in everything" profiles that would make alignment
meaningless. Proficiency 3 for the first area reflects that everyone has a
strongest field; later areas draw 1 or 2 (weighted toward 2).

### D4. Area prevalence among staff (`AREA_SUPERVISOR_WEIGHTS`: AI 1.6 … EdTech 0.6)

The staff profile of a CS school that advertises data science and
cybersecurity degrees: more AI/data/cyber/software-engineering staff, fewer
in niches like EdTech or Games. The ratios (max 1.6, min 0.6) are mild on
purpose — the point is a *tilt*, not an absence of any area. This interacts
with D1: because student demand also tilts toward AI/data/cyber, supply and
demand are correlated but not perfectly matched — which is exactly the
tension a good allocation algorithm must resolve.

### D5. What FTE is, and the values 1.0 / 0.8 / 0.6 (78% / 14% / 8%)

**FTE = Full-Time Equivalent**, the standard measure of contracted working
time in universities: 1.0 is a full-time contract, 0.8 means four days a
week, 0.6 three days. It matters here because supervision capacity should
scale with contracted time — a 0.6 FTE senior lecturer cannot carry the same
project load as a full-time colleague. The distribution (most staff
full-time, a modest fractional minority) mirrors the typical shape of UK
academic departments. FTE multiplies base capacity in D6.

### D6. Base supervision capacity by seniority — Lecturer 7, Senior Lecturer 8, Associate Professor 8, **Professor 6**

`quota_max = round(base_capacity[seniority] × FTE)`.

The counter-intuitive number is the professor's. The reasoning, consistent
with how UK workload allocation models (WAMs) treat senior staff and with the
workload-driven capacity modelling in Alnaji et al. (2024):

- **Lecturers (7):** often earlier-career, sometimes on probation, carrying
  the heaviest teaching-preparation load — slightly reduced project capacity.
- **Senior Lecturers / Associate Professors (8):** the workhorses of MSc
  supervision — established teaching portfolios, fewer institutional
  commitments than professors. Highest capacity.
- **Professors (6):** their workload is dominated by research leadership,
  grant capture, PhD (not MSc) supervision, examining and management. In
  most departments professors take *fewer* taught-masters projects, not more.
  Giving them the largest quota would be the intuitive-but-wrong choice.

These are assumptions; if your supervisor says "our professors take 10", it
is one number in `config.json`.

### D7. Seniority mix — 38% / 34% / 16% / 12%

The standard academic staffing pyramid: broad at the bottom, narrow at the
top. Roughly 7 in 10 staff at Lecturer/Senior Lecturer level matches the
shape of most UK post-92 computing departments.

### D8. quota_min ∈ {1, 2} and capacity slack 1.1×

`quota_min` forces the allocation to spread load: no supervisor may end up
with zero students (a fairness/workload rule most departments apply). Values
above 2 would over-constrain a 240-student instance.

The **slack target of 1.1** means total `quota_max` must be ≥ 110% of the
cohort (the generator tops up capacity if sampling falls short — verified:
264 seats for 240 students). Rationale: at slack 1.0 the problem is
perfectly tight — every seat must be filled exactly, and one awkward student
can make good solutions impossible; at slack 2.0 the problem is trivially
easy and the GA has nothing to prove. ~10% headroom keeps the instance
feasible but *competitive*, which is what the O6 benchmark needs.

### D9. Preference list length = 5

Matches common institutional practice (students asked for 3–5 choices) and
the student-project allocation literature, where short truncated lists are
the realistic regime (Abraham, Irving & Manlove, 2007). Five also keeps the
supervisor-scoring workload plausible: ~37 applicants per supervisor on
average (1,200 / 32), not hundreds.

### D10. The choice model — softmax temperature 0.35, popularity noise SD 0.08

Students pick supervisors by score = alignment (0–1) + popularity bias +
small personal noise, then a **softmax** draw at temperature T = 0.35.

- **Temperature** controls how rational the choice is. At T→0 every student
  robotically picks the mathematically best-aligned supervisors (unrealistic,
  and it collapses demand onto few staff). At T→∞ choices are uniform random
  (destroys the alignment structure the GA must exploit). T = 0.35 means a
  supervisor who scores 0.35 higher is about e ≈ 2.7× more likely to be
  picked per draw — mostly sensible choices with believable exceptions.
  Validation confirms the result: rank-1 picks overlap expertise at 0.78 vs
  0.48 under random pairing.
- **Popularity bias** (one N(0, 0.08) value per supervisor, fixed for the
  run) models reputation and visibility: some staff attract applications
  beyond pure subject fit. SD 0.08 is deliberately small next to the 0–1
  alignment range — a nudge, not a driver. The realised spread (16 to 59
  applications across supervisors) shows the intended clustering.

### D11. Supervisor scoring weights — 0.65 alignment + 0.25 prior mark + 0.10 noise

When supervisors score applicants: subject fit should dominate (0.65) —
staff mainly want projects they can actually supervise. Prior attainment
(0.25) is second because the at-risk literature (Chen & Zhai, 2023)
identifies it as the signal academics actually weigh. The noise term (0.10)
stands in for everything unmodelled — a good proposal, an impressive
conversation. Weights sum to ~1 so scores stay interpretable in [0, 1].

### D12. Entry qualifications and prior-mark distributions

Bands follow the UK degree classification system: First (≈70+), 2:1
(60–69), 2:2 (50–59), plus "International equivalent" for overseas
qualifications mapped by admissions. The generated *prior average marks* are
Gaussians per band — First: mean 74, 2:1: 65, 2:2: 56 — i.e. centred inside
the band that earned the classification, clipped to [40, 90]. The
international band gets mean 64 with a wider SD (6.0) because converted
grades are noisier. The mix (18% First, 38% 2:1, 16% 2:2, 28% international)
reflects a typical UK postgraduate-taught intake with a substantial
international cohort. All in `config.json`.

### D13. Mode: 85% full-time

UK PGT computing cohorts are predominantly full-time (international students
are usually required to be); a 15% part-time minority keeps the attribute
meaningful for later at-risk rules (part-time study changes expected pace).

### D14. Alignment-score internals (`generate.py`, `alignment_score`)

Interest ranks weigh 1.0 / 0.6 / 0.35 (rank 1/2/3) and proficiencies weigh
1.0 / 0.7 / 0.4 (level 3/2/1) — geometric-style decay encoding "your second
interest matters a bit more than half as much as your first; working
knowledge counts less than half of leading expertise". The sum is normalised
by the student's maximum attainable weight so scores are comparable between a
1-interest and a 3-interest student. The exact decay rates are judgement
calls; what matters is monotonicity (rank 1 > rank 2 > rank 3) and
normalisation.

### D15. Email rules

Students: exactly 6 alphanumeric characters (first forced to a letter —
leading digits break some mail systems and validators) at
`student.sunderland.ac.uk`. 36⁵×26 ≈ 1.6 billion combinations, so collisions
are effectively impossible at any realistic cohort size (uniqueness is
enforced anyway). Staff: `firstname.lastname@sunderland.ac.uk`, lowercased,
apostrophes stripped (O'Brien → obrien), numeric suffix on collision.

### D16. Cohort size 240 / 32 and the seed

240/32 sits comfortably above the O1 minimum (200/30) and gives a mean load
of 7.5 students per supervisor — consistent with the D6 capacity model.
The seed `20260709` is today's date (2026-07-09); any integer works, and
changing it produces a fresh but statistically identical cohort.

---

## Part 3 — How to revise a decision

1. Find it: cohort-shape numbers live in `config.json`; structural rules in
   the named constants of `generate.py`.
2. Change it, re-run `generate.py` then `validate.py`.
3. If a group-C check fails, the validator is telling you the realised data
   no longer matches a *declared* assumption — update the declaration and
   the reasoning here, not just the number.
4. Record the change in this file (it is the audit trail the dissertation's
   data-generation protocol will cite).
