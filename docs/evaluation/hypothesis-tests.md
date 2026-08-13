# Hypothesis tests

Non-parametric tests, Holm-Bonferroni adjusted per family (alpha = 0.05).
`a12_better`: for Mann-Whitney rows, Vargha-Delaney A12 = P(GA run better than random run);
for Wilcoxon rows, the fraction of GA runs strictly better than the greedy value.

| family | config | metric | ga_median | reference | statistic | p_raw | a12_better | p_holm | significant_0.05 | effect |
|---|---|---|---|---|---|---|---|---|---|---|
| GA vs random (Mann-Whitney U) | default | meanRank | 1.419 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | default | workloadVariance | 7.1406 | 9.1812 | 116.0 | 0.0 | 0.8711 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | default | pctUnallocated | 0.0 | 0.6 | 45.0 | 0.0 | 0.95 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | pure-preference | meanRank | 1.165 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | pure-preference | workloadVariance | 7.5781 | 9.1812 | 206.0 | 0.0003 | 0.7711 | 0.0006 | True | large |
| GA vs random (Mann-Whitney U) | pure-preference | pctUnallocated | 0.0 | 0.6 | 45.0 | 0.0 | 0.95 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | pure-expertise | meanRank | 2.652 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | pure-expertise | workloadVariance | 8.8281 | 9.1812 | 453.5 | 0.9646 | 0.4961 | 0.9646 | False | negligible |
| GA vs random (Mann-Whitney U) | pure-expertise | pctUnallocated | 0.0 | 0.6 | 45.0 | 0.0 | 0.95 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | pure-balance | meanRank | 2.1543 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | pure-balance | workloadVariance | 7.4531 | 9.1812 | 175.5 | 0.0001 | 0.805 | 0.0002 | True | large |
| GA vs random (Mann-Whitney U) | pure-balance | pctUnallocated | 0.0 | 0.6 | 66.5 | 0.0 | 0.9261 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | equal-weights | meanRank | 1.651 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | equal-weights | workloadVariance | 7.2969 | 9.1812 | 149.5 | 0.0 | 0.8339 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | equal-weights | pctUnallocated | 0.0 | 0.6 | 45.0 | 0.0 | 0.95 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | population-50 | meanRank | 1.406 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | population-50 | workloadVariance | 7.4531 | 9.1812 | 135.5 | 0.0 | 0.8494 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | population-50 | pctUnallocated | 0.0 | 0.6 | 45.0 | 0.0 | 0.95 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | population-200 | meanRank | 1.4 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | population-200 | workloadVariance | 7.2031 | 9.1812 | 142.0 | 0.0 | 0.8422 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | population-200 | pctUnallocated | 0.0 | 0.6 | 45.0 | 0.0 | 0.95 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | mutation-0.005 | meanRank | 1.32 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | mutation-0.005 | workloadVariance | 6.5469 | 9.1812 | 65.0 | 0.0 | 0.9278 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | mutation-0.005 | pctUnallocated | 0.0 | 0.6 | 45.0 | 0.0 | 0.95 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | mutation-0.05 | meanRank | 1.569 | 3.006 | 0.0 | 0.0 | 1.0 | 0.0 | True | large |
| GA vs random (Mann-Whitney U) | mutation-0.05 | workloadVariance | 7.3906 | 9.1812 | 173.5 | 0.0 | 0.8072 | 0.0002 | True | large |
| GA vs random (Mann-Whitney U) | mutation-0.05 | pctUnallocated | 0.0 | 0.6 | 45.0 | 0.0 | 0.95 | 0.0 | True | large |
| GA vs greedy (Wilcoxon signed-rank) | default | meanRank | 1.419 | 1.2048 | 0.0 | 0.0 | 0.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | default | workloadVariance | 7.1406 | 7.3086 | 175.0 | 0.2368 | 0.5667 | 1.0 | False |  |
| GA vs greedy (Wilcoxon signed-rank) | default | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-preference | meanRank | 1.165 | 1.2048 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-preference | workloadVariance | 7.5781 | 7.3086 | 141.0 | 0.0598 | 0.4333 | 0.4184 | False |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-preference | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-expertise | meanRank | 2.652 | 1.2048 | 0.0 | 0.0 | 0.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-expertise | workloadVariance | 8.8281 | 7.3086 | 24.0 | 0.0 | 0.1 | 0.0001 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-expertise | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-balance | meanRank | 2.1543 | 1.2048 | 0.0 | 0.0 | 0.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-balance | workloadVariance | 7.4531 | 7.3086 | 165.0 | 0.1649 | 0.4 | 0.9894 | False |  |
| GA vs greedy (Wilcoxon signed-rank) | pure-balance | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 0.9667 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | equal-weights | meanRank | 1.651 | 1.2048 | 0.0 | 0.0 | 0.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | equal-weights | workloadVariance | 7.2969 | 7.3086 | 232.0 | 0.9918 | 0.5667 | 1.0 | False |  |
| GA vs greedy (Wilcoxon signed-rank) | equal-weights | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | population-50 | meanRank | 1.406 | 1.2048 | 0.0 | 0.0 | 0.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | population-50 | workloadVariance | 7.4531 | 7.3086 | 217.0 | 0.7498 | 0.4667 | 1.0 | False |  |
| GA vs greedy (Wilcoxon signed-rank) | population-50 | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | population-200 | meanRank | 1.4 | 1.2048 | 0.0 | 0.0 | 0.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | population-200 | workloadVariance | 7.2031 | 7.3086 | 213.0 | 0.6883 | 0.6 | 1.0 | False |  |
| GA vs greedy (Wilcoxon signed-rank) | population-200 | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | mutation-0.005 | meanRank | 1.32 | 1.2048 | 0.0 | 0.0 | 0.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | mutation-0.005 | workloadVariance | 6.5469 | 7.3086 | 1.0 | 0.0 | 0.9667 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | mutation-0.005 | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | mutation-0.05 | meanRank | 1.569 | 1.2048 | 0.0 | 0.0 | 0.0 | 0.0 | True |  |
| GA vs greedy (Wilcoxon signed-rank) | mutation-0.05 | workloadVariance | 7.3906 | 7.3086 | 205.0 | 0.5715 | 0.4667 | 1.0 | False |  |
| GA vs greedy (Wilcoxon signed-rank) | mutation-0.05 | pctUnallocated | 0.0 | 0.4 | 0.0 | 0.0 | 1.0 | 0.0 | True |  |
| weights sensitivity (Kruskal-Wallis) | default | pure-preference | pure-expertise | pure-balance | equal-weights | meanRank | 1.419 | nan | 143.0301 | 0.0 | nan | 0.0 | True |  |
| weights sensitivity (Kruskal-Wallis) | default | pure-preference | pure-expertise | pure-balance | equal-weights | workloadVariance | 7.1406 | nan | 36.6981 | 0.0 | nan | 0.0 | True |  |
| weights sensitivity (Kruskal-Wallis) | default | pure-preference | pure-expertise | pure-balance | equal-weights | bestFitness | 0.7864 | nan | 143.0484 | 0.0 | nan | 0.0 | True |  |
| population sensitivity (Kruskal-Wallis) | population-50 | default | population-200 | bestFitness | 0.7806 | nan | 68.8622 | 0.0 | nan | 0.0 | True |  |
| population sensitivity (Kruskal-Wallis) | population-50 | default | population-200 | runtimeMs | 153.5 | nan | 78.2481 | 0.0 | nan | 0.0 | True |  |
| mutation sensitivity (Kruskal-Wallis) | mutation-0.005 | default | mutation-0.05 | bestFitness | 0.8053 | nan | 79.1209 | 0.0 | nan | 0.0 | True |  |
| mutation sensitivity (Kruskal-Wallis) | mutation-0.005 | default | mutation-0.05 | generationsRun | 245.5 | nan | 60.9008 | 0.0 | nan | 0.0 | True |  |
