import { api, query } from "@/lib/api/client"
import type { AllocationExplanation, AllocationResult, ListParams, Paginated, RunBenchmark } from "@/lib/types/dto"
import type { AllocationAlgorithm } from "@/lib/types/entities"

export interface BaselineRunResult {
  run_id: string
  runtime_ms: number
  instance_size: number
  allocated_count: number
}

export interface QuotaViolation {
  supervisor_id: number
  assigned: number
  quota_min: number
  quota_max: number
  kind: "over_max" | "under_min"
}

export async function getMyAllocation(studentId: number): Promise<AllocationResult | null> {
  return api.get(`/students/${studentId}/allocation`)
}

export async function getSupervisorAllocations(
  supervisorId: number,
  params?: ListParams,
): Promise<Paginated<AllocationResult>> {
  return api.get(`/supervisors/${supervisorId}/allocations${query({ page: params?.page, limit: params?.limit })}`)
}

export async function explainAllocation(allocationId: number): Promise<AllocationExplanation> {
  return api.get(`/allocations/${allocationId}/explanation`)
}

export async function runAllocation(
  algorithm: Extract<AllocationAlgorithm, "greedy-mock" | "random">,
): Promise<BaselineRunResult> {
  const response = await api.post<{ kind: "completed"; summary: BaselineRunResult }>("/allocation-runs", { algorithm })
  return response.summary
}

/** Records a hand-made allocation as a manual baseline run (FR-ALLOC-04). */
export async function submitManualBaseline(
  label: string,
  pairs: { student_id: number; supervisor_id: number }[],
): Promise<BaselineRunResult> {
  const response = await api.post<{ kind: "completed"; summary: BaselineRunResult }>("/allocation-runs/manual", {
    label,
    pairs,
  })
  return response.summary
}

export async function compareRuns(): Promise<RunBenchmark[]> {
  return api.get("/allocation-runs/benchmarks")
}

export async function getQuotaViolations(runId: string): Promise<QuotaViolation[]> {
  return api.get(`/allocation-runs/${encodeURIComponent(runId)}/violations`)
}

/** Flat rows for the per-run allocations CSV export (FR-API-04). */
export async function getRunAllocationRows(runId: string): Promise<Record<string, unknown>[]> {
  return api.get(`/allocation-runs/${encodeURIComponent(runId)}/rows`)
}

export async function publishRun(runId: string): Promise<void> {
  await api.post(`/allocation-runs/${encodeURIComponent(runId)}/publish`)
}
