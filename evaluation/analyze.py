"""Statistical analysis of the GA evaluation experiments (O6).

Consumes docs/evaluation/experiments-runs.csv and experiments-convergence.csv
(produced by `npm run experiment:full` in server/) and writes tables + figures
back into docs/evaluation/:

  summary-statistics.csv / .md   per-configuration descriptive statistics
  hypothesis-tests.csv / .md     Mann-Whitney vs random, Wilcoxon vs greedy,
                                 Vargha-Delaney A12, Holm-adjusted p-values,
                                 Kruskal-Wallis parameter sensitivity
  fig-*.png                      box plots and convergence curves

Methodology follows standard evolutionary-computation practice: 30 independent
seeded runs per configuration, non-parametric tests (no normality assumption),
effect sizes alongside p-values, Holm-Bonferroni correction per test family.

Usage: evaluation/.venv/bin/python evaluation/analyze.py
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "evaluation"

# Lower is better for these metrics; used to orient effect sizes.
METRICS = {
    "meanRank": "lower",
    "workloadVariance": "lower",
    "pctUnallocated": "lower",
    "bestFitness": "higher",
    "runtimeMs": "lower",
}
COMPARISON_METRICS = ["meanRank", "workloadVariance", "pctUnallocated"]

runs = pd.read_csv(DATA / "experiments-runs.csv")
convergence = pd.read_csv(DATA / "experiments-convergence.csv")

ga = runs[runs.algorithm == "ga"]
random_runs = runs[runs.algorithm == "random"]
greedy = runs[runs.algorithm == "greedy"].iloc[0]

GA_CONFIG_ORDER = [
    "default",
    "pure-preference",
    "pure-expertise",
    "pure-balance",
    "equal-weights",
    "population-50",
    "population-200",
    "mutation-0.005",
    "mutation-0.05",
]


# ---------------------------------------------------------------------------
# Descriptive statistics
# ---------------------------------------------------------------------------

def ci95(x: np.ndarray) -> tuple[float, float]:
    """95% t-interval for the mean."""
    if len(x) < 2:
        return (float("nan"), float("nan"))
    se = stats.sem(x)
    half = se * stats.t.ppf(0.975, len(x) - 1)
    return (float(np.mean(x) - half), float(np.mean(x) + half))


summary_rows = []
for config in GA_CONFIG_ORDER + ["random-baseline", "greedy-baseline"]:
    grp = runs[runs.config == config]
    for metric in ["bestFitness", "meanRank", "workloadVariance", "pctUnallocated", "generationsRun", "runtimeMs"]:
        x = pd.to_numeric(grp[metric], errors="coerce").dropna().to_numpy()
        if len(x) == 0:
            continue
        lo, hi = ci95(x)
        summary_rows.append(
            {
                "config": config,
                "metric": metric,
                "n": len(x),
                "median": np.median(x),
                "mean": np.mean(x),
                "std": np.std(x, ddof=1) if len(x) > 1 else 0.0,
                "ci95_lo": lo,
                "ci95_hi": hi,
                "min": np.min(x),
                "max": np.max(x),
            }
        )
summary = pd.DataFrame(summary_rows).round(4)
summary.to_csv(DATA / "summary-statistics.csv", index=False)


# ---------------------------------------------------------------------------
# Effect size and correction helpers
# ---------------------------------------------------------------------------

def a12(x: np.ndarray, y: np.ndarray, better: str) -> float:
    """Vargha-Delaney A12: probability a run of x is BETTER than a run of y."""
    diff = x[:, None] - y[None, :]
    if better == "lower":
        wins = (diff < 0).sum() + 0.5 * (diff == 0).sum()
    else:
        wins = (diff > 0).sum() + 0.5 * (diff == 0).sum()
    return float(wins / (len(x) * len(y)))


def a12_magnitude(a: float) -> str:
    """Conventional thresholds (Vargha & Delaney 2000) on |A12 - 0.5|."""
    d = abs(a - 0.5)
    if d < 0.06:
        return "negligible"
    if d < 0.14:
        return "small"
    if d < 0.21:
        return "medium"
    return "large"


def holm(pvalues: list[float]) -> list[float]:
    """Holm-Bonferroni adjusted p-values (step-down, monotone, capped at 1)."""
    m = len(pvalues)
    order = np.argsort(pvalues)
    adjusted = np.empty(m)
    running_max = 0.0
    for rank, idx in enumerate(order):
        adj = min(1.0, (m - rank) * pvalues[idx])
        running_max = max(running_max, adj)
        adjusted[idx] = running_max
    return adjusted.tolist()


# ---------------------------------------------------------------------------
# Family A: each GA configuration vs the random baseline (Mann-Whitney U)
# Family B: each GA configuration vs the greedy value (one-sample Wilcoxon)
# ---------------------------------------------------------------------------

test_rows = []
family_a: list[dict] = []
family_b: list[dict] = []

for config in GA_CONFIG_ORDER:
    grp = ga[ga.config == config]
    for metric in COMPARISON_METRICS:
        x = grp[metric].to_numpy(dtype=float)
        y = random_runs[metric].to_numpy(dtype=float)
        u, p = stats.mannwhitneyu(x, y, alternative="two-sided")
        family_a.append(
            {
                "family": "GA vs random (Mann-Whitney U)",
                "config": config,
                "metric": metric,
                "ga_median": np.median(x),
                "reference": np.median(y),
                "statistic": u,
                "p_raw": p,
                "a12_better": a12(x, y, METRICS[metric]),
            }
        )

        g = float(greedy[metric])
        d = x - g
        if np.all(d == 0):
            w, pw = float("nan"), 1.0
        else:
            w, pw = stats.wilcoxon(d, alternative="two-sided")
        better = (d < 0).mean() if METRICS[metric] == "lower" else (d > 0).mean()
        family_b.append(
            {
                "family": "GA vs greedy (Wilcoxon signed-rank)",
                "config": config,
                "metric": metric,
                "ga_median": np.median(x),
                "reference": g,
                "statistic": w,
                "p_raw": pw,
                "a12_better": better,  # here: fraction of runs strictly better than greedy
            }
        )

for family in (family_a, family_b):
    adjusted = holm([row["p_raw"] for row in family])
    for row, p_adj in zip(family, adjusted):
        row["p_holm"] = p_adj
        row["significant_0.05"] = p_adj < 0.05
        row["effect"] = a12_magnitude(row["a12_better"]) if "Mann" in row["family"] else ""
        test_rows.append(row)

# ---------------------------------------------------------------------------
# Family C: parameter sensitivity (Kruskal-Wallis across configuration levels)
# ---------------------------------------------------------------------------

families_c = [
    ("weights", ["default", "pure-preference", "pure-expertise", "pure-balance", "equal-weights"],
     ["meanRank", "workloadVariance", "bestFitness"]),
    ("population", ["population-50", "default", "population-200"], ["bestFitness", "runtimeMs"]),
    ("mutation", ["mutation-0.005", "default", "mutation-0.05"], ["bestFitness", "generationsRun"]),
]
family_c_rows = []
for name, levels, metrics in families_c:
    for metric in metrics:
        groups = [ga[ga.config == lvl][metric].to_numpy(dtype=float) for lvl in levels]
        h, p = stats.kruskal(*groups)
        family_c_rows.append(
            {
                "family": f"{name} sensitivity (Kruskal-Wallis)",
                "config": " | ".join(levels),
                "metric": metric,
                "ga_median": np.median(groups[0]),
                "reference": float("nan"),
                "statistic": h,
                "p_raw": p,
                "a12_better": float("nan"),
            }
        )
adjusted = holm([row["p_raw"] for row in family_c_rows])
for row, p_adj in zip(family_c_rows, adjusted):
    row["p_holm"] = p_adj
    row["significant_0.05"] = p_adj < 0.05
    row["effect"] = ""
    test_rows.append(row)

tests = pd.DataFrame(test_rows)
tests_out = tests.copy()
for col in ["ga_median", "reference", "statistic", "a12_better", "p_raw", "p_holm"]:
    tests_out[col] = pd.to_numeric(tests_out[col], errors="coerce").round(6)
tests_out.to_csv(DATA / "hypothesis-tests.csv", index=False)


# ---------------------------------------------------------------------------
# Markdown reports
# ---------------------------------------------------------------------------

def df_to_md(df: pd.DataFrame) -> str:
    header = "| " + " | ".join(df.columns) + " |"
    sep = "|" + "|".join(["---"] * len(df.columns)) + "|"
    body = "\n".join("| " + " | ".join(str(v) for v in row) + " |" for row in df.itertuples(index=False))
    return f"{header}\n{sep}\n{body}"


(DATA / "summary-statistics.md").write_text(
    "# Summary statistics (30 seeded runs per configuration)\n\n"
    "Greedy baseline is deterministic (n=1). Generated by evaluation/analyze.py.\n\n"
    + df_to_md(summary)
    + "\n"
)
(DATA / "hypothesis-tests.md").write_text(
    "# Hypothesis tests\n\n"
    "Non-parametric tests, Holm-Bonferroni adjusted per family (alpha = 0.05).\n"
    "`a12_better`: for Mann-Whitney rows, Vargha-Delaney A12 = P(GA run better than random run);\n"
    "for Wilcoxon rows, the fraction of GA runs strictly better than the greedy value.\n\n"
    + df_to_md(tests_out.round(4))
    + "\n"
)


# ---------------------------------------------------------------------------
# Figures
# ---------------------------------------------------------------------------

plt.rcParams.update({"figure.dpi": 150, "font.size": 9})

WEIGHT_CONFIGS = ["default", "pure-preference", "pure-expertise", "pure-balance", "equal-weights"]


def boxplot(metric: str, title: str, ylabel: str, filename: str, greedy_line: bool = True):
    configs = WEIGHT_CONFIGS + ["random-baseline"]
    data = [pd.to_numeric(runs[runs.config == c][metric], errors="coerce").dropna() for c in configs]
    fig, ax = plt.subplots(figsize=(7.2, 3.8))
    ax.boxplot(data, tick_labels=[c.replace("-baseline", "") for c in configs], showmeans=True)
    if greedy_line:
        ax.axhline(float(greedy[metric]), linestyle="--", linewidth=1, color="tab:red", label="greedy baseline")
        ax.legend(frameon=False)
    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.tick_params(axis="x", rotation=20)
    fig.tight_layout()
    fig.savefig(DATA / filename)
    plt.close(fig)


boxplot("meanRank", "Mean satisfied preference rank by configuration (30 runs)", "mean rank (lower = better)", "fig-meanrank.png")
boxplot("workloadVariance", "Supervisor workload variance by configuration (30 runs)", "variance (lower = better)", "fig-workload-variance.png")
boxplot("pctUnallocated", "% unallocated students by configuration (30 runs)", "% unallocated", "fig-unallocated.png")

# Fitness across all GA configs (no baseline — fitness is GA-specific).
fig, ax = plt.subplots(figsize=(7.2, 3.8))
data = [ga[ga.config == c]["bestFitness"].astype(float) for c in GA_CONFIG_ORDER]
ax.boxplot(data, tick_labels=GA_CONFIG_ORDER, showmeans=True)
ax.set_title("Best fitness by GA configuration (30 runs)")
ax.set_ylabel("best fitness")
ax.tick_params(axis="x", rotation=20)
fig.tight_layout()
fig.savefig(DATA / "fig-fitness.png")
plt.close(fig)

# Convergence: median best fitness per generation with IQR band.
fig, ax = plt.subplots(figsize=(7.2, 3.8))
for config in ["default", "population-50", "population-200"]:
    sub = convergence[convergence.config == config]
    by_gen = sub.groupby("generation")["bestFitness"]
    gens = by_gen.median().index.to_numpy()
    ax.plot(gens, by_gen.median().to_numpy(), label=config)
    ax.fill_between(gens, by_gen.quantile(0.25).to_numpy(), by_gen.quantile(0.75).to_numpy(), alpha=0.2)
ax.set_title("Convergence: median best fitness per generation (IQR band, 30 runs)")
ax.set_xlabel("generation")
ax.set_ylabel("best fitness")
ax.legend(frameon=False)
fig.tight_layout()
fig.savefig(DATA / "fig-convergence.png")
plt.close(fig)

# Runtime by configuration.
fig, ax = plt.subplots(figsize=(7.2, 3.8))
data = [ga[ga.config == c]["runtimeMs"].astype(float) for c in GA_CONFIG_ORDER]
ax.boxplot(data, tick_labels=GA_CONFIG_ORDER, showmeans=True)
ax.set_title("GA runtime by configuration (30 runs, 500 students x 32 supervisors)")
ax.set_ylabel("runtime (ms)")
ax.tick_params(axis="x", rotation=20)
fig.tight_layout()
fig.savefig(DATA / "fig-runtime.png")
plt.close(fig)

print("Wrote summary-statistics.{csv,md}, hypothesis-tests.{csv,md} and 6 figures to", DATA)

# Console headline for a quick sanity read.
head = tests[(tests.config == "pure-preference") & (tests.metric == "meanRank")].iloc[0]
print(
    f"\nHeadline: pure-preference GA median meanRank {head.ga_median:.3f} vs greedy {float(greedy['meanRank']):.3f} "
    f"(Wilcoxon row) / vs random median {random_runs.meanRank.median():.3f}"
)
