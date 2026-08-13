import { CheckCircle2, ChevronDown, ChevronRight, Play, Square } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { getQuotaViolations, runAllocation, submitManualBaseline } from "@/lib/services/allocation.service"
import { checkQuotaMinFeasibility, runGaAllocation } from "@/lib/services/ga/ga.service"
import type { GaRunHandle } from "@/lib/services/ga/ga.service"
import type { GaParams, GaProgress } from "@/lib/services/ga/types"
import { DEFAULT_GA_PARAMS } from "@/lib/services/ga/types"
import type { AllocationAlgorithm } from "@/lib/types/entities"

interface RunResult {
  run_id: string
  runtime_ms: number
  instance_size: number
  allocated_count: number
  violations: number
}

const D = DEFAULT_GA_PARAMS

export function RunAllocationPanel({ onRunComplete }: { onRunComplete: () => void }) {
  const [running, setRunning] = useState<AllocationAlgorithm | null>(null)
  const [lastResult, setLastResult] = useState<RunResult | null>(null)

  // GA configuration held as strings so partial input while typing is fine.
  const [weightPref, setWeightPref] = useState(String(D.weights.preference))
  const [weightExp, setWeightExp] = useState(String(D.weights.expertise))
  const [weightBal, setWeightBal] = useState(String(D.weights.balance))
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1_000_000)))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [population, setPopulation] = useState(String(D.population))
  const [generations, setGenerations] = useState(String(D.generations))
  const [mutationRate, setMutationRate] = useState(String(D.mutationRate))
  const [elitism, setElitism] = useState(String(D.elitism))
  const [stagnation, setStagnation] = useState(String(D.stagnationWindow))

  const [gaProgress, setGaProgress] = useState<GaProgress | null>(null)
  const [manualPairs, setManualPairs] = useState("")
  const gaHandle = useRef<GaRunHandle | null>(null)

  function parseGaParams(): GaParams | string {
    const nums = {
      weightPref: Number(weightPref),
      weightExp: Number(weightExp),
      weightBal: Number(weightBal),
      seed: Number(seed),
      population: Number(population),
      generations: Number(generations),
      mutationRate: Number(mutationRate),
      elitism: Number(elitism),
      stagnation: Number(stagnation),
    }
    if (Object.values(nums).some((v) => Number.isNaN(v))) return "All GA fields must be numbers."
    if (nums.weightPref < 0 || nums.weightExp < 0 || nums.weightBal < 0) return "Weights must not be negative."
    if (nums.weightPref + nums.weightExp + nums.weightBal <= 0) return "Weights must sum to a positive value."
    if (!Number.isInteger(nums.seed)) return "Seed must be an integer."
    if (!Number.isInteger(nums.population) || nums.population < 2) return "Population must be an integer of at least 2."
    if (!Number.isInteger(nums.generations) || nums.generations < 1) return "Generations must be a positive integer."
    if (nums.mutationRate < 0 || nums.mutationRate > 1) return "Mutation rate must be between 0 and 1."
    if (!Number.isInteger(nums.elitism) || nums.elitism < 0 || nums.elitism >= nums.population) {
      return "Elitism must be a non-negative integer smaller than the population."
    }
    if (!Number.isInteger(nums.stagnation) || nums.stagnation < 1) return "Stagnation window must be a positive integer."
    return {
      weights: { preference: nums.weightPref, expertise: nums.weightExp, balance: nums.weightBal },
      seed: nums.seed,
      population: nums.population,
      generations: nums.generations,
      mutationRate: nums.mutationRate,
      elitism: nums.elitism,
      stagnationWindow: nums.stagnation,
    }
  }

  async function handleRunGa() {
    const params = parseGaParams()
    if (typeof params === "string") {
      toast.error(params)
      return
    }
    const infeasible = await checkQuotaMinFeasibility()
    if (infeasible.length > 0) {
      toast.warning(
        `Supervisor${infeasible.length === 1 ? "" : "s"} ${infeasible.join(", ")} ha${infeasible.length === 1 ? "s" : "ve"} fewer applicants than their quota_min — the minimum cannot be met.`,
      )
    }

    setRunning("ga")
    setGaProgress(null)
    try {
      const handle = runGaAllocation(params, setGaProgress)
      gaHandle.current = handle
      const outcome = await handle.promise
      if (outcome.status === "cancelled") {
        toast.info("Run cancelled — nothing was saved.")
        return
      }
      const summary = outcome.summary
      const violations = await getQuotaViolations(summary.run_id)
      setLastResult({ ...summary, violations: violations.length })
      onRunComplete()
      toast.success(
        `GA run complete: ${summary.allocated_count}/${summary.instance_size} allocated in ${summary.generations_run} generations (best fitness ${summary.best_fitness.toFixed(3)}).`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "GA run failed.")
    } finally {
      gaHandle.current = null
      setGaProgress(null)
      setRunning(null)
    }
  }

  async function handleManualBaseline() {
    const lines = manualPairs
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("student_id"))
    const pairs: { student_id: number; supervisor_id: number }[] = []
    for (const [index, line] of lines.entries()) {
      const [studentPart, supervisorPart, ...rest] = line.split(",").map((p) => p.trim())
      const student_id = Number(studentPart)
      const supervisor_id = Number(supervisorPart)
      if (rest.length > 0 || !Number.isInteger(student_id) || !Number.isInteger(supervisor_id)) {
        toast.error(`Line ${index + 1} is not "student_id,supervisor_id".`)
        return
      }
      pairs.push({ student_id, supervisor_id })
    }
    if (pairs.length === 0) {
      toast.error("Paste at least one student_id,supervisor_id pair.")
      return
    }

    setRunning("manual")
    try {
      const result = await submitManualBaseline("Manual baseline", pairs)
      const violations = await getQuotaViolations(result.run_id)
      setLastResult({ ...result, violations: violations.length })
      setManualPairs("")
      onRunComplete()
      toast.success(`Manual baseline recorded: ${result.allocated_count} pairings.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record manual baseline.")
    } finally {
      setRunning(null)
    }
  }

  async function handleRunBaseline(algorithm: Extract<AllocationAlgorithm, "greedy-mock" | "random">) {
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

  const gaRunning = running === "ga"

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Genetic algorithm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="ga-w-pref">Preference weight</Label>
              <Input id="ga-w-pref" type="number" min="0" step="0.05" value={weightPref} disabled={gaRunning} onChange={(e) => setWeightPref(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ga-w-exp">Expertise weight</Label>
              <Input id="ga-w-exp" type="number" min="0" step="0.05" value={weightExp} disabled={gaRunning} onChange={(e) => setWeightExp(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ga-w-bal">Workload weight</Label>
              <Input id="ga-w-bal" type="number" min="0" step="0.05" value={weightBal} disabled={gaRunning} onChange={(e) => setWeightBal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ga-seed">Seed</Label>
              <Input id="ga-seed" type="number" step="1" value={seed} disabled={gaRunning} onChange={(e) => setSeed(e.target.value)} />
            </div>
          </div>

          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            Advanced options
          </Button>
          {showAdvanced && (
            <div className="grid gap-3 sm:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="ga-pop">Population</Label>
                <Input id="ga-pop" type="number" min="2" step="1" value={population} disabled={gaRunning} onChange={(e) => setPopulation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ga-gen">Generations</Label>
                <Input id="ga-gen" type="number" min="1" step="1" value={generations} disabled={gaRunning} onChange={(e) => setGenerations(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ga-mut">Mutation rate</Label>
                <Input id="ga-mut" type="number" min="0" max="1" step="0.005" value={mutationRate} disabled={gaRunning} onChange={(e) => setMutationRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ga-elite">Elitism</Label>
                <Input id="ga-elite" type="number" min="0" step="1" value={elitism} disabled={gaRunning} onChange={(e) => setElitism(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ga-stag">Stagnation window</Label>
                <Input id="ga-stag" type="number" min="1" step="1" value={stagnation} disabled={gaRunning} onChange={(e) => setStagnation(e.target.value)} />
              </div>
            </div>
          )}

          {gaRunning ? (
            <div className="space-y-2">
              <Progress value={gaProgress ? (gaProgress.generation / gaProgress.totalGenerations) * 100 : 0} />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {gaProgress
                    ? `Generation ${gaProgress.generation} / ${gaProgress.totalGenerations} — best fitness ${gaProgress.bestFitness.toFixed(3)}`
                    : "Starting…"}
                </p>
                <Button variant="outline" size="sm" onClick={() => gaHandle.current?.cancel()}>
                  <Square className="size-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleRunGa} disabled={running !== null}>
              <Play className="size-4" />
              Run genetic algorithm
            </Button>
          )}
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Baselines (O6 benchmark)</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Greedy baseline</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => handleRunBaseline("greedy-mock")} disabled={running !== null}>
                <Play className="size-4" />
                {running === "greedy-mock" ? "Running…" : "Run"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Random baseline</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => handleRunBaseline("random")} disabled={running !== null}>
                <Play className="size-4" />
                {running === "random" ? "Running…" : "Run"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manual baseline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={3}
                placeholder={"1,17\n2,4\n3,22"}
                value={manualPairs}
                disabled={running !== null}
                onChange={(e) => setManualPairs(e.target.value)}
              />
              <Button variant="outline" onClick={handleManualBaseline} disabled={running !== null || !manualPairs.trim()}>
                <Play className="size-4" />
                {running === "manual" ? "Recording…" : "Record"}
              </Button>
            </CardContent>
          </Card>
        </div>
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
