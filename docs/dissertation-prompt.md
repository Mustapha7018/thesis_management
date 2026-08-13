# Prompt for Claude Cowork — MSc Dissertation Assembly

You are writing my MSc Computer Science dissertation (University of Sunderland, module
PROM02) from the completed project in this folder. The project — an AI-driven web portal
for thesis project management using a genetic algorithm for student–supervisor
allocation — is fully built, tested, statistically evaluated and deployed. Your job is
to assemble the dissertation from the real evidence in this repository. You are not
inventing content; you are curating, structuring and writing up work that exists.

## Ground rules (read first, these override everything else)

1. **Every number, claim and decision must be traceable to a file in this repository.**
   Never invent, estimate, round differently, or "improve" a result. If you state a
   p-value, median, latency, coverage percentage or line of reasoning, it must come
   verbatim from the evidence files listed below. If something you need is missing,
   insert `[TODO: <what is needed>]` and list all TODOs at the end — do not fill gaps
   with plausible text.
2. **No AI writing artifacts.** Concretely banned: "delve", "leverage", "seamless",
   "robust" (except quoting a source), "landscape", "crucial role", "It is important to
   note", "In conclusion" as a paragraph opener, "Moreover/Furthermore" chains, rule-of-
   three sentence patterns, bullet lists inside discursive chapters (prose only, except
   where the template itself uses lists), symmetrical filler paragraphs that could
   describe any project, and hedging without content ("various", "numerous", "a range
   of"). Write in plain UK English academic register, past tense for completed work,
   first person singular where the template's voice allows ("I chose X because…").
   A marker familiar with AI text must find nothing generic here: every paragraph must
   contain project-specific facts.
3. **Honesty over polish.** Where results are mixed (e.g. default-weight GA trades mean
   rank against greedy; SUS testing not yet conducted), report them plainly and discuss
   them — the trade-off discussion is worth more marks than a hidden weakness.
4. Follow the structure of `docs/Dissertation_Template.docx` **exactly** — same chapter
   and section numbering, keep the Declaration/Abstract/Contents apparatus, fill the
   bracketed fields (student, supervisor, title, date) from `docs/project_planning.docx`.
   Fill the word count in the Declaration when finished.

## Source inventory (all paths relative to this folder)

- `docs/Dissertation_Template.docx` — the required structure and front matter.
- `docs/project_planning.docx` — Terms of Reference: aims, objectives O1–O6, task/effort
  plan, evaluation plan, SELP issues table. Becomes Ch.1 content + Appendix A.
- `docs/literature_review_tasks_2.1-2.4.docx` — the complete literature review (search
  protocol, themes A–C, gap analysis). Becomes Chapter 2, lightly edited for flow and
  cross-referenced forward to the design decisions it motivated.
- `docs/requirements_specification.docx` — 42 functional requirements, 19 NFRs,
  architecture commitment, MoSCoW, traceability. Feeds Ch.3 and the traceability matrix.
- `docs/DEVELOPMENT_LOG.md` — **the methodology backbone.** Dated record of every
  feature, design decision with rationale, correction, and verification, from the
  localStorage prototype through the GA engine, the Fastify+PostgreSQL backend, the
  rule-based flagging engine, cohort batches, and the statistical evaluation. Chapter 3
  is largely a narrative restructuring of this file; the decisions-and-rationale
  "changelog" character must survive into the dissertation (a methodology that shows
  its reasoning, including reversed decisions like replace-cohort → batch history).
- `docs/evaluation/` — the statistical evidence:
  - `summary-statistics.{csv,md}` — 30-run descriptive stats per configuration.
  - `hypothesis-tests.{csv,md}` — Mann–Whitney U vs random with Vargha–Delaney A12,
    one-sample Wilcoxon vs greedy, Kruskal–Wallis sensitivity, all Holm-corrected.
  - `fig-meanrank.png`, `fig-workload-variance.png`, `fig-unallocated.png`,
    `fig-fitness.png`, `fig-convergence.png`, `fig-runtime.png` — use these directly
    as numbered figures in Chapter 4.
  - `latency-load.{csv,md}` — autocannon latency/load evidence incl. environment.
  - `experiments-runs.csv`, `experiments-convergence.csv` — raw data (cite counts).
- `evaluation/analyze.py`, `evaluation/README.md`, `server/scripts/experiment-runner.ts`,
  `server/scripts/load-test.ts` — the experiment methodology to describe in Ch.3/4.
- `synthetic_data/README.md` and `synthetic_data/info.md` — the dataset generation
  protocol and decision ledger D1–D16 (dataset methodology section of Ch.3).
- Code (read for accuracy, quote sparingly): `web/src/lib/services/ga/engine.ts` (the
  GA), `server/src/modules/flag-rules.ts` (at-risk rules), `server/src/db/schema.ts`
  (data model), `server/README.md` (API architecture), `.github/workflows/ci.yml`.
- Git history (`git log`) — corroborates the timeline; cite commit dates if useful.

## Chapter mapping

- **Abstract** (~250 words): problem, method (GA + deployed portal + synthetic
  benchmark), headline quantified results (pure-preference GA beats greedy on mean rank
  in 30/30 runs, median 1.165 vs 1.205, Holm p = 3×10⁻⁵, A12 = 1.0 vs random, 0%
  unallocated, <1 s runtime at 500×32; API p97.5 latencies within NFR targets at 300
  concurrent connections), contribution.
- **Ch.1 Introduction**: background and motivation from the planning doc; aims;
  objectives O1–O6 verbatim; research approach (design-science/experimental hybrid:
  build the artefact, evaluate it statistically against baselines); report structure;
  SELP considerations from planning §4 updated with what was actually built (argon2 +
  JWT + deny-by-default RBAC, audit log, synthetic-data-only, GDPR-by-design,
  BCS Code, explainable allocations per pairing).
- **Ch.2 Literature Review**: the existing review, integrated; end each theme by
  pointing at the design decision it produced (Theme B → direct encoding,
  repair-not-penalise, weighted-sum objective; Alnaji et al. → workload-derived quotas;
  explainability literature → FR-ALLOC-07 explanations and rule_code'd flags).
- **Ch.3 Practical Research Methodology**: rename the template's "Approach 1/2"
  subsections sensibly. Cover: (3.x) synthetic dataset design incl. ledger decisions
  and validation; (3.x) system architecture and the frontend-first strategy (service
  layer shaped like the future REST API, then the real Fastify+PostgreSQL swap with no
  UI rework — evidence this worked); (3.x) GA design in full (encoding, fitness,
  repair with termination argument, operators, determinism); (3.x) the platform
  features that operationalise the research (cohort batches, rule-based at-risk
  engine with thresholds/cool-down/grace period, universal logins replacing
  placeholder data); (3.x) evaluation methodology — 30 seeded runs per configuration,
  non-parametric tests with effect sizes and Holm correction, why; autocannon
  latency/load protocol with the p97.5-vs-p95 conservatism note; test suite (55 tests:
  14 GA unit + 41 API integration incl. the RBAC 403 matrix), coverage 82%/87% vs the
  70% target, CI. Weave in decisions AND corrections from the dev log (e.g. the
  NO_RECENT_MEETING grace period found through testing; the reversed cohort-import
  semantics) — reviewers reward visible engineering judgement.
- **Ch.4 Analysis of Results**: "Model Results" = GA statistics (walk through each
  figure and table; report medians, CIs, p_holm, A12, and interpret); "Real-time
  Results" = the deployed system evidence (latency/load tables, screenshots of the
  working flows, flag engine causality); "Comparison with Existing Literature" = set
  results against Sanchez-Anguix et al. and the SPA literature from Ch.2.
- **Ch.5 Evaluation and Reflection**: objectives O1–O6 reviewed one by one against
  evidence (include a **requirements traceability matrix** — every FR/NFR → where
  implemented → how verified — assembled from the dev log and requirements doc; put
  the full table in an appendix if long, summary in-chapter). Methodology critique
  (single developer, synthetic data only, SUS pending, shared demo password as a
  documented demo device, single-node deployment). Honest personal reflection.
- **Ch.6 Conclusion and Recommendations**: answer the research question with the
  numbers; recommendations = the dev log's "Planned / next" items plus deployment
  hardening and running the SUS study.
- **Ch.7 References**: harvest from the literature review + any new sources; Harvard
  style, consistent; **never fabricate a reference** — only cite what appears in the
  source documents or is verifiable (autocannon, Fastify, Drizzle, PostgreSQL docs may
  be cited as software with versions from the dev log).
- **Appendix A**: research proposal from the planning document. Additional appendices:
  full traceability matrix; statistical tables; API surface summary (from
  `/api/docs` OpenAPI or server README); reproduction guide (commands to reseed, run
  `npm run experiment:full`, `evaluation/analyze.py`, `npm run experiment:load`).

## Diagrams (all publication quality — this matters)

Produce as vector-first (SVG, exported to high-resolution PNG for the .docx), one
consistent style across all: same font (a clean sans-serif), 2–3 muted colours max,
readable at print size, no drop shadows or clip-art, every element labelled, numbered
captions ("Figure 4.2: …") referenced from the body text. Required set:

1. **System architecture** — browser SPA (React/Vite) → REST API `/api/v1`
   (Fastify/Node) → PostgreSQL; GA worker thread as the batch process beside the API;
   JWT auth boundary; matches the requirements spec's context description.
2. **GA pipeline** — instance extraction (DB → GaInstance with D14 alignment
   precompute) → seeded population → selection/crossover/mutation → two-phase quota
   repair → fitness → early stopping → transactional persistence; annotate the
   determinism boundary (single PRNG stream).
3. **Database schema (ERD)** — from `server/src/db/schema.ts`: the 13 baseline tables
   plus cohorts, accounts, allocation_runs, audit_log, preference_window; mark keys
   and the one-published-run partial unique index.
4. **Allocation workflow** — admin journey: import batch → students submit
   preferences → run GA (job: POST → poll → done) → compare/benchmark → publish →
   student/supervisor views + explanations.
5. **At-risk flag lifecycle** — rule evaluation on read → raised → reviewed → cleared,
   with cool-down and grace-period annotations.
6. **Evaluation pipeline** — experiment runner (30 seeds × 9 configs + baselines) →
   CSVs → analyze.py → statistics + figures.

Reuse the six existing result figures from `docs/evaluation/` as-is (they are already
generated from the data; do not redraw them).

## Screenshots

Capture from the deployed site (fallback: `npm run dev` locally in `web/` + `server/`)
at a consistent 1440-px-wide viewport, light theme, real seeded data, no browser chrome:
login page; admin dashboard with search/pagination; Cohorts and Import (with the
file-format dialog open); Run Allocation with GA progress mid-run; Compare Runs with
the benchmark table; Publish; a student dashboard, preference builder and Kanban board;
a supervisor dashboard with an engine-raised at-risk flag and the flag lifecycle; the
allocation explanation card; the audit log. Caption each with what it evidences and
reference from Ch.3/4. Demo credentials: any roster email with the shared demo password
(`jordan.blake@sunderland.ac.uk` / student `gvn1d6@…` / supervisor `hao.roberts@…`,
password `Password123!`).

## Process

Work chapter by chapter in this order: 3 → 4 → 5 → 1 → 2 (integration) → 6 → Abstract →
front/back matter. After drafting each chapter, run a self-audit pass: (a) every
quantitative claim checked against its source file, with a claims→source list kept in
a working file; (b) banned-phrase scan; (c) every figure/table referenced in text.
Deliver as a .docx matching the template's styles (or a clean markdown master +
conversion, if .docx editing is unavailable — but the final artefact must open in Word
with the template's front matter intact). Keep all working files in a `dissertation/`
folder. Finish with: the total word count, the complete TODO list (items only a human
can supply: signature, date, SUS study results if still pending, viva materials), and
the claims→source audit list.
