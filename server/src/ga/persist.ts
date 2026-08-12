/**
 * Transactional persistence for allocation runs (FR-ALLOC-03): allocation
 * rows + run row (+ audit for GA runs) commit atomically — a failed or
 * cancelled run leaves nothing behind.
 */
import { db } from "../db/client.js"
import { allocationRuns, allocations } from "../db/schema.js"
import { writeAudit } from "../lib/audit.js"
import { nowIso } from "../lib/http.js"
import type { GaInstance, GaParams } from "@shared/services/ga/types"

export interface RunSummary {
  run_id: string
  runtime_ms: number
  instance_size: number
  allocated_count: number
}

export async function persistRun(options: {
  instance: GaInstance
  algorithm: "ga" | "greedy-mock" | "random"
  label: string
  params: GaParams | null
  assignment: number[]
  pairScores: number[]
  runtimeMs: number
  actorEmail: string
}): Promise<RunSummary> {
  const { instance, algorithm, label, params, assignment, pairScores, runtimeMs, actorEmail } = options
  const runId = `run-${new Date().toISOString().slice(0, 10)}-${algorithm}-${Date.now()}`
  const createdAt = nowIso()

  const rows: (typeof allocations.$inferInsert)[] = []
  assignment.forEach((gene, i) => {
    if (gene < 0) return
    rows.push({
      run_id: runId,
      algorithm,
      student_id: instance.studentIds[i],
      supervisor_id: instance.supervisors[instance.prefs[i][gene].supIdx].id,
      objective_score: pairScores[i],
      created_at: createdAt,
    })
  })

  await db.transaction(async (tx) => {
    await tx.insert(allocationRuns).values({
      run_id: runId,
      algorithm,
      label,
      created_at: createdAt,
      published: false,
      instance_size: instance.studentIds.length,
      runtime_ms: runtimeMs,
      params,
    })
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(allocations).values(rows.slice(i, i + 500))
    }
    if (algorithm === "ga" && params) {
      await writeAudit(
        tx,
        "allocation_run",
        actorEmail,
        `Ran GA allocation ${runId} (seed ${params.seed}, ${rows.length}/${instance.studentIds.length} allocated).`,
      )
    }
  })

  return {
    run_id: runId,
    runtime_ms: runtimeMs,
    instance_size: instance.studentIds.length,
    allocated_count: rows.length,
  }
}
