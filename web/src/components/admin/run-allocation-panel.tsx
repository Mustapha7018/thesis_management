import { CheckCircle2, Play } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getQuotaViolations, runAllocation } from "@/lib/services/allocation.service"
import type { MockRunResult } from "@/lib/services/mock-allocation-algorithm"
import type { AllocationAlgorithm } from "@/lib/types/entities"

export function RunAllocationPanel({ onRunComplete }: { onRunComplete: () => void }) {
  const [running, setRunning] = useState<AllocationAlgorithm | null>(null)
  const [lastResult, setLastResult] = useState<(MockRunResult & { violations: number }) | null>(null)

  async function handleRun(algorithm: Extract<AllocationAlgorithm, "greedy-mock" | "random">) {
    setRunning(algorithm)
    try {
      const result = await runAllocation(algorithm)
      const violations = await getQuotaViolations(result.run_id)
      setLastResult({ ...result, violations: violations.length })
      onRunComplete()
      toast.success(`Run complete: ${result.allocated_count}/${result.instance_size} allocated.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed.")
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Placeholder algorithm</AlertTitle>
        <AlertDescription>
          The real genetic-algorithm allocation engine is a separate, later piece of work (task 5.0). These runs use a
          simple greedy / shuffled first-fit over the ranked preference lists — enough to exercise the run / compare /
          publish workflow end-to-end, but not the real optimisation.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Greedy baseline (mock)</CardTitle>
            <CardDescription>Each student gets the first available supervisor from their ranked list, in student order.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => handleRun("greedy-mock")} disabled={running !== null}>
              <Play className="size-4" />
              {running === "greedy-mock" ? "Running…" : "Run"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Random baseline</CardTitle>
            <CardDescription>Student order and preference order are both shuffled before the same first-fit rule.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => handleRun("random")} disabled={running !== null}>
              <Play className="size-4" />
              {running === "random" ? "Running…" : "Run"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              Last run result
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Allocated</p>
              <p className="font-medium">
                {lastResult.allocated_count}/{lastResult.instance_size}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Runtime</p>
              <p className="font-medium">{lastResult.runtime_ms}ms</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Quota violations</p>
              <Badge
                className={
                  lastResult.violations === 0
                    ? "border-transparent bg-success text-success-foreground"
                    : "border-transparent bg-destructive text-destructive-foreground"
                }
              >
                {lastResult.violations}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Run ID</p>
              <p className="truncate font-mono text-xs">{lastResult.run_id}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
