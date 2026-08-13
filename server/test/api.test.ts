/**
 * Integration tests over the full Fastify app via inject() — no network.
 * Covers the acceptance criteria the dissertation evaluates: auth + lockout
 * (FR-AUTH-03/05), deny-by-default RBAC incl. the explicit "student token on
 * an admin endpoint → 403" check (FR-AUTH-04), server-side business rules,
 * publish exclusivity (FR-ALLOC-06), cohort import atomicity (FR-PROF-06)
 * and the GA job lifecycle (FR-ALLOC-01/02/03).
 */
import type { FastifyInstance } from "fastify"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { buildApp } from "../src/app.js"

const DEMO_PASSWORD = "Password123!"
const ADMIN_EMAIL = "jordan.blake@sunderland.ac.uk"
const STUDENT_EMAIL = "z47nuz@student.sunderland.ac.uk" // student-2, Samuel Zhang

let app: FastifyInstance
let adminToken: string
let studentToken: string
let studentRefId: number
let supervisorToken: string
let supervisorRefId: number

async function login(email: string, password = DEMO_PASSWORD) {
  const res = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } })
  return res
}

async function tokenFor(email: string): Promise<{ token: string; ref_id: number | null }> {
  const res = await login(email)
  if (res.statusCode !== 200) console.error("LOGIN FAILED", email, res.statusCode, res.body)
  expect(res.statusCode).toBe(200)
  const body = res.json() as { token: string; session: { ref_id: number | null } }
  return { token: body.token, ref_id: body.session.ref_id }
}

beforeAll(async () => {
  app = await buildApp()
  adminToken = (await tokenFor(ADMIN_EMAIL)).token
  const student = await tokenFor(STUDENT_EMAIL)
  studentToken = student.token
  studentRefId = student.ref_id!
  // A login-capable supervisor demo account from the seed.
  const supervisor = await tokenFor("fatima.diallo@sunderland.ac.uk")
  supervisorToken = supervisor.token
  supervisorRefId = supervisor.ref_id!
})

afterAll(async () => {
  await app.close()
  const { pool } = await import("../src/db/client.js")
  await pool.end()
})

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

describe("auth (FR-AUTH-02/03/05)", () => {
  it("rejects malformed university emails with a clear error", async () => {
    const res = await login("someone@gmail.com")
    expect(res.statusCode).toBe(400)
  })

  it("rejects a wrong password without leaking which field failed", async () => {
    const res = await login(ADMIN_EMAIL, "wrong-password")
    expect(res.statusCode).toBe(401)
    expect(res.json().error.message).toBe("Invalid email or password.")
  })

  it("rejects directory-only accounts (no password hash) even with the demo password", async () => {
    // gvn1d6 is student-1 in the directory but has no login (not a demo account).
    const res = await login("gvn1d6@student.sunderland.ac.uk")
    expect(res.statusCode).toBe(401)
  })

  it("locks an account after 5 consecutive failures", async () => {
    const email = "samuel.gupta@sunderland.ac.uk"
    for (let i = 0; i < 4; i++) {
      expect((await login(email, "nope")).statusCode).toBe(401)
    }
    const fifth = await login(email, "nope")
    expect(fifth.statusCode).toBe(401)
    expect(fifth.json().error.message).toContain("locked")
    // Correct password is also rejected while locked.
    const locked = await login(email)
    expect(locked.statusCode).toBe(401)
    expect(locked.json().error.message).toContain("locked")
  })

  it("requires a token on every non-public route (deny by default)", async () => {
    expect((await app.inject({ method: "GET", url: "/api/v1/research-areas" })).statusCode).toBe(401)
    expect(
      (await app.inject({ method: "GET", url: "/api/v1/research-areas", headers: { Authorization: "Bearer garbage" } }))
        .statusCode,
    ).toBe(401)
  })
})

describe("RBAC (FR-AUTH-04: deny by default, 403 on wrong role)", () => {
  it("returns 403 when a student token calls an admin endpoint", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/users", headers: auth(studentToken) })
    expect(res.statusCode).toBe(403)
  })

  it("returns 403 when a supervisor token calls an admin endpoint", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/audit-log", headers: auth(supervisorToken) })
    expect(res.statusCode).toBe(403)
  })

  it("blocks a student from writing another student's data", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/students/${studentRefId + 1}/interests`,
      headers: auth(studentToken),
      payload: { interests: [{ areaId: 1, rank: 1 }] },
    })
    expect(res.statusCode).toBe(403)
  })

  it("blocks a student from reading at-risk flags entirely", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/at-risk-flags", headers: auth(studentToken) })
    expect(res.statusCode).toBe(403)
  })
})

describe("profile business rules (FR-PROF-02/04/05)", () => {
  it("rejects preference submission while the window is closed, server-side", async () => {
    await app.inject({
      method: "PUT",
      url: "/api/v1/preference-window",
      headers: auth(adminToken),
      payload: { is_open: false },
    })
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/students/${studentRefId}/preferences`,
      headers: auth(studentToken),
      payload: { supervisorIdsInRankOrder: [1, 2, 3, 4, 5] },
    })
    expect(res.statusCode).toBe(403)
    await app.inject({
      method: "PUT",
      url: "/api/v1/preference-window",
      headers: auth(adminToken),
      payload: { is_open: true },
    })
  })

  it("requires exactly 5 distinct supervisors", async () => {
    const four = await app.inject({
      method: "PUT",
      url: `/api/v1/students/${studentRefId}/preferences`,
      headers: auth(studentToken),
      payload: { supervisorIdsInRankOrder: [1, 2, 3, 4] },
    })
    expect(four.statusCode).toBe(400)
    const dupes = await app.inject({
      method: "PUT",
      url: `/api/v1/students/${studentRefId}/preferences`,
      headers: auth(studentToken),
      payload: { supervisorIdsInRankOrder: [1, 2, 3, 4, 4] },
    })
    expect(dupes.statusCode).toBe(400)
  })

  it("only lets supervisors score students who actually applied", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/supervisors/${supervisorRefId}/applicants/99999/score`,
      headers: auth(supervisorToken),
      payload: { score: 0.5 },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe("admin account guards (FR-AUTH-06)", () => {
  it("creates, patches and deletes an admin, but never the caller's own account", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/admin/admins",
      headers: auth(adminToken),
      payload: { displayName: "Test Admin", email: "test.admin@sunderland.ac.uk" },
    })
    expect(created.statusCode).toBe(201)
    const accountId = (created.json() as { account_id: string }).account_id

    const dupe = await app.inject({
      method: "POST",
      url: "/api/v1/admin/admins",
      headers: auth(adminToken),
      payload: { displayName: "Dupe", email: "test.admin@sunderland.ac.uk" },
    })
    expect(dupe.statusCode).toBe(409)

    const badEmail = await app.inject({
      method: "POST",
      url: "/api/v1/admin/admins",
      headers: auth(adminToken),
      payload: { displayName: "Bad", email: "bad@gmail.com" },
    })
    expect(badEmail.statusCode).toBe(400)

    // Self-delete forbidden (jordan is admin-1).
    const selfDelete = await app.inject({
      method: "DELETE",
      url: "/api/v1/admin/admins/admin-1",
      headers: auth(adminToken),
    })
    expect(selfDelete.statusCode).toBe(403)

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/admins/${accountId}`,
      headers: auth(adminToken),
    })
    expect(deleted.statusCode).toBe(204)
  })

  it("never retires the last active admin", async () => {
    // jordan (admin-1) is the only active admin again after the delete above;
    // a self-retire is blocked as not-self first, so use the generic user route.
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/users/admin-1",
      headers: auth(adminToken),
      payload: { active: false },
    })
    expect([400, 403]).toContain(res.statusCode)
  })
})

describe("allocation runs (FR-ALLOC-03/04/06) and GA job (FR-ALLOC-01/02)", () => {
  it("runs a baseline synchronously and persists it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/allocation-runs",
      headers: auth(adminToken),
      payload: { algorithm: "greedy-mock" },
    })
    expect(res.statusCode).toBe(200)
    const { summary } = res.json() as { summary: { run_id: string; allocated_count: number } }
    expect(summary.allocated_count).toBeGreaterThan(0)
    const rows = await app.inject({
      method: "GET",
      url: `/api/v1/allocation-runs/${summary.run_id}/rows`,
      headers: auth(adminToken),
    })
    expect((rows.json() as unknown[]).length).toBe(summary.allocated_count)
  })

  it("keeps exactly one run published", async () => {
    const benchmarks = async () =>
      (
        await app.inject({ method: "GET", url: "/api/v1/allocation-runs/benchmarks", headers: auth(adminToken) })
      ).json() as { run_id: string; published: boolean }[]

    const runs = await benchmarks()
    expect(runs.length).toBeGreaterThanOrEqual(2)
    await app.inject({
      method: "POST",
      url: `/api/v1/allocation-runs/${runs[0].run_id}/publish`,
      headers: auth(adminToken),
    })
    await app.inject({
      method: "POST",
      url: `/api/v1/allocation-runs/${runs[1].run_id}/publish`,
      headers: auth(adminToken),
    })
    const after = await benchmarks()
    expect(after.filter((r) => r.published)).toHaveLength(1)
    expect(after.find((r) => r.published)?.run_id).toBe(runs[1].run_id)
  })

  it("runs the GA as a job: 202, progress, done, persisted, zero violations, reproducible", async () => {
    const params = {
      weights: { preference: 0.5, expertise: 0.3, balance: 0.2 },
      seed: 4242,
      population: 40,
      generations: 60,
      mutationRate: 0.02,
      elitism: 2,
      stagnationWindow: 60,
    }
    const runOnce = async () => {
      const started = await app.inject({
        method: "POST",
        url: "/api/v1/allocation-runs",
        headers: auth(adminToken),
        payload: { algorithm: "ga", params },
      })
      expect(started.statusCode).toBe(202)
      const { job_id } = started.json() as { job_id: string }
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 200))
        const status = await app.inject({
          method: "GET",
          url: `/api/v1/allocation-jobs/${job_id}`,
          headers: auth(adminToken),
        })
        const job = status.json() as { status: string; summary: { run_id: string; best_fitness: number } | null; error: string | null }
        if (job.status === "done") return job.summary!
        if (job.status === "error") throw new Error(job.error ?? "job failed")
      }
      throw new Error("GA job did not finish in time")
    }

    const first = await runOnce()
    const violations = await app.inject({
      method: "GET",
      url: `/api/v1/allocation-runs/${first.run_id}/violations`,
      headers: auth(adminToken),
    })
    expect(violations.json()).toEqual([])

    // FR-ALLOC-01 acceptance: same seed + weights reproduce the same result.
    const second = await runOnce()
    expect(second.best_fitness).toBe(first.best_fitness)
  })

  it("records a manual baseline identically to algorithmic runs (FR-ALLOC-04)", async () => {
    const dupe = await app.inject({
      method: "POST",
      url: "/api/v1/allocation-runs/manual",
      headers: auth(adminToken),
      payload: { pairs: [{ student_id: 1, supervisor_id: 1 }, { student_id: 1, supervisor_id: 2 }] },
    })
    expect(dupe.statusCode).toBe(400)

    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/allocation-runs/manual",
      headers: auth(adminToken),
      payload: { pairs: [{ student_id: 1, supervisor_id: 99999 }] },
    })
    expect(unknown.statusCode).toBe(400)

    const ok = await app.inject({
      method: "POST",
      url: "/api/v1/allocation-runs/manual",
      headers: auth(adminToken),
      payload: { label: "Dept spreadsheet 2026", pairs: [{ student_id: 1, supervisor_id: 1 }, { student_id: 2, supervisor_id: 2 }] },
    })
    expect(ok.statusCode).toBe(200)
    const { summary } = ok.json() as { summary: { run_id: string; allocated_count: number } }
    expect(summary.allocated_count).toBe(2)

    const benchmarks = (
      await app.inject({ method: "GET", url: "/api/v1/allocation-runs/benchmarks", headers: auth(adminToken) })
    ).json() as { run_id: string; algorithm: string; label: string }[]
    const manual = benchmarks.find((r) => r.run_id === summary.run_id)
    expect(manual?.algorithm).toBe("manual")
    expect(manual?.label).toBe("Dept spreadsheet 2026")
  })

  it("rejects GA runs from non-admin tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/allocation-runs",
      headers: auth(supervisorToken),
      payload: { algorithm: "greedy-mock" },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe("cohort import (FR-PROF-06) — destructive, runs last", () => {
  const header = "student_id,first_name,last_name,email,programme,mode,entry_year,entry_qualification,prior_avg_mark,created_at"

  it("rejects an invalid CSV atomically with row-level details", async () => {
    const before = await app.inject({ method: "GET", url: "/api/v1/admin/cohort/summary", headers: auth(adminToken) })
    const csv = `${header}\n1,Ada,Lovelace,abc123@student.sunderland.ac.uk,MSc Data Science,FT,2026,First,95,2026-08-01T00:00:00Z`
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cohort/import",
      headers: auth(adminToken),
      payload: { file_name: "students.csv", content: csv },
    })
    expect(res.statusCode).toBe(400)
    const details = (res.json() as { error: { details: { errors: { message: string }[] } } }).error.details
    expect(details.errors[0].message).toContain("prior_avg_mark")
    const after = await app.inject({ method: "GET", url: "/api/v1/admin/cohort/summary", headers: auth(adminToken) })
    expect((after.json() as { studentCount: number }).studentCount).toBe(
      (before.json() as { studentCount: number }).studentCount,
    )
  })

  it("imports a valid CSV, replacing the cohort and clearing dependants", async () => {
    const csv = [
      header,
      "1,Ada,Lovelace,abc123@student.sunderland.ac.uk,MSc Data Science,FT,2026,First,80,2026-08-01T00:00:00Z",
      "2,Alan,Turing,xyz789@student.sunderland.ac.uk,MSc Computer Science,FT,2026,2:1,75,2026-08-01T00:00:00Z",
    ].join("\n")
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/cohort/import",
      headers: auth(adminToken),
      payload: { file_name: "students.csv", content: csv },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { imported: number; cleared: { runs: number } }
    expect(body.imported).toBe(2)
    expect(body.cleared.runs).toBeGreaterThan(0)

    const summary = await app.inject({ method: "GET", url: "/api/v1/admin/cohort/summary", headers: auth(adminToken) })
    expect((summary.json() as { studentCount: number }).studentCount).toBe(2)

    // Restore the full demo dataset for anything running after.
    const reset = await app.inject({ method: "POST", url: "/api/v1/admin/reset-demo", headers: auth(adminToken) })
    expect(reset.statusCode).toBe(200)
  })
})
