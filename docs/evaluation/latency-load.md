# Latency and load test results (NFR-PERF-02 / NFR-PERF-03)

## Environment

- **date**: 2026-08-13T07:10:45.967Z
- **tool**: autocannon 8.0.0
- **node**: v24.16.0
- **os**: Darwin 27.0.0 (arm64)
- **cpu**: Apple M3 Pro × 11
- **memory_gb**: 18
- **postgres**: PostgreSQL 18.4 (Homebrew)
- **server_mode**: tsx, LOG_LEVEL=warn
- **pool_max**: 20
- **dataset**: 500 students × 32 supervisors, published greedy run, flag engine active

Targets: p95 ≤ 500 ms (CRUD), p95 ≤ 2000 ms (dashboard aggregates); 300 concurrent connections within the same targets.
autocannon reports fixed percentiles (p90 / p97.5 / p99); the p95 target is assessed against **p97.5**, which is conservative since p95 ≤ p97.5.

| phase | scenario | class | conn | req/s | avg ms | p50 ms | p90 ms | p97.5 ms | p99 ms | max ms | non-2xx | target p95 | result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| interactive | GET /research-areas | crud-read | 10 | 11303 | 0.25 | 0 | 1 | 2 | 3 | 666 | 0 | 500 | PASS |
| interactive | GET /admin/users?page=1 | crud-read | 10 | 282 | 34.97 | 24 | 59 | 132 | 213 | 1715 | 0 | 500 | PASS |
| interactive | GET /students/:id/tasks | crud-read | 10 | 3214 | 2.6 | 1 | 5 | 8 | 13 | 1311 | 0 | 500 | PASS |
| interactive | GET /meetings?studentId | crud-read | 10 | 5593 | 1.21 | 0 | 2 | 7 | 14 | 1126 | 0 | 500 | PASS |
| interactive | GET /supervisors/:id/applicants | crud-read | 10 | 808 | 11.87 | 12 | 14 | 17 | 18 | 26 | 0 | 500 | PASS |
| interactive | PATCH /tasks/:id | crud-write | 10 | 1037 | 8.99 | 2 | 7 | 76 | 173 | 2460 | 0 | 500 | PASS |
| interactive | GET /admin/cohort-overview | aggregate | 10 | 743 | 12.95 | 10 | 22 | 37 | 52 | 572 | 0 | 2000 | PASS |
| interactive | GET /supervisors/:id/cohort | aggregate | 10 | 709 | 13.61 | 10 | 22 | 41 | 62 | 1137 | 0 | 2000 | PASS |
| interactive | GET /allocation-runs/benchmarks | aggregate | 10 | 28 | 347.8 | 287 | 638 | 930 | 1016 | 2417 | 0 | 2000 | PASS |
| 300-concurrent | GET /research-areas @300 | crud-read | 300 | 3150 | 94.51 | 87 | 131 | 167 | 197 | 758 | 0 | 500 | PASS |
| 300-concurrent | GET /students/:id/tasks @300 | crud-read | 300 | 4594 | 64.87 | 36 | 139 | 198 | 272 | 1310 | 0 | 500 | PASS |
| 300-concurrent | GET /admin/cohort-overview @300 | aggregate | 300 | 2631 | 113.08 | 112 | 124 | 137 | 178 | 220 | 0 | 2000 | PASS |

Login is excluded from the CRUD class: argon2 verification is deliberately CPU-expensive (a security property, FR-AUTH-03/NFR-SEC-01).
