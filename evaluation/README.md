# Evaluation pipeline (O6)

Two-stage, fully reproducible experiment + analysis pipeline for the
dissertation's statistical evaluation of the GA against the manual/random
baselines.

## 1. Run the experiments (TypeScript, reads the live database)

```bash
cd server
npm run experiment:full     # ~3 min: 9 GA configs x 30 seeds + 30 random + greedy
```

Writes `docs/evaluation/experiments-runs.csv` (301 runs) and
`experiments-convergence.csv` (best fitness per generation per run). Every run
is seeded — identical inputs reproduce identical outputs, including the random
baseline.

## 2. Analyse (Python)

```bash
python3 -m venv evaluation/.venv && evaluation/.venv/bin/pip install numpy pandas scipy matplotlib   # once
evaluation/.venv/bin/python evaluation/analyze.py
```

Writes to `docs/evaluation/`:

- `summary-statistics.{csv,md}` — n, median, mean, std, 95% CI, min/max per
  configuration and metric.
- `hypothesis-tests.{csv,md}` — three Holm-corrected test families:
  - **GA vs random baseline**: Mann-Whitney U per configuration and metric,
    with Vargha-Delaney A12 effect sizes.
  - **GA vs greedy baseline** (deterministic, n=1): one-sample Wilcoxon
    signed-rank against the greedy value, plus the fraction of GA runs
    strictly better.
  - **Parameter sensitivity**: Kruskal-Wallis across weight profiles,
    population sizes and mutation rates.
- `fig-meanrank.png`, `fig-workload-variance.png`, `fig-unallocated.png`,
  `fig-fitness.png`, `fig-convergence.png`, `fig-runtime.png`.

Methodology: 30 independent runs per configuration; non-parametric tests
(no normality assumption); effect sizes reported alongside p-values;
Holm-Bonferroni correction within each family — standard practice for
stochastic metaheuristic evaluation.
