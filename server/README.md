# Server — Thesis Management REST API

Fastify + TypeScript + PostgreSQL implementation of the portal backend
(objective O4): a **versioned RESTful JSON API that is the only writer to the
database** (FR-API-01), with JWT authentication (argon2 hashes, expiring
tokens, lockout after 5 failures — FR-AUTH-03/05) and **deny-by-default
server-side RBAC** on every endpoint (FR-AUTH-04). The genetic-algorithm
engine runs beside the API as a batch job in a worker thread, exactly as the
requirements specification's architecture section describes.

## Quick start

```bash
createdb thesis_management        # PostgreSQL 15+ (developed on 18)
cp .env.example .env              # optional — all defaults are dev-safe
npm install
npm run db:migrate                # applies src/db/schema.ts via drizzle-kit
npm run db:seed                   # loads the synthetic dataset + demo accounts
npm run dev                       # http://localhost:3001
```

Interactive OpenAPI docs (FR-API-02): http://localhost:3001/api/docs

The web app (`../web`, `npm run dev`) proxies `/api` here automatically.

**Demo accounts:** every login-capable account uses the shared `DEMO_PASSWORD`
(default `Password123!`) — e.g. admin `jordan.blake@sunderland.ac.uk`.
Bulk-imported students are directory-only (no password hash) and cannot log in.

## Layout

```
src/
├── app.ts            buildApp(): plugins + modules, injectable for tests
├── config.ts         zod-validated env (see .env.example)
├── db/schema.ts      Drizzle schema: 13 baseline tables (synthetic_data/schema.sql)
│                     + accounts, allocation_runs, audit_log, preference_window
├── plugins/auth.ts   JWT verification on every route unless config.public,
│                     requireRole()/assertSelfOr() guards
├── modules/*.module.ts  one file per domain (auth, accounts, profile,
│                     allocation, jobs, agile, meetings, dashboard, cohort…)
├── ga/               instance extraction, baselines, worker_threads host,
│                     single-slot job registry, transactional persistence
└── seed.ts           idempotent seed from ../web/src/lib/data (argon2 hashes)
```

The GA engine itself (`engine.ts`, `alignment.ts`, `prng.ts`, `types.ts`) and
the CSV validator are imported **from `../web/src/lib`** via tsconfig paths —
one source of truth shared by browser and server; the engine's seeded
determinism means both environments produce byte-identical allocations.

## Tests

```bash
npm test              # 36 integration tests via app.inject() — no network
npm run test:coverage # v8 coverage (NFR-MAIN-01 target: ≥70% on core modules)
```

Tests run against a dedicated `thesis_management_test` database that the
global setup creates, migrates and seeds automatically. Covered: login/lockout,
the RBAC 403 matrix (incl. "student token on an admin endpoint → 403"),
preference-window enforcement, exactly-5-preferences, admin guards, publish
exclusivity, atomic cohort import, and the GA job lifecycle with seed
reproducibility.

## Operations

- **Backups (NFR-REL-02):** `pg_dump thesis_management > backup.sql` on a
  daily schedule gives RPO ≤ 24 h; restore with `psql -d <db> < backup.sql`.
- **Deployment:** set `DATABASE_URL`, a real `JWT_SECRET`, `CORS_ORIGIN`, and
  `ALLOW_DEMO_RESET=false`; run behind TLS (NFR-SEC-01). `npm run build`
  produces a bundled `dist/`.
- **Deferred (documented stubs):** password-reset-by-email (FR-AUTH-05,
  Should) and publish notifications (FR-ALLOC-06) need a mail provider;
  the audit log records both events in the meantime.
