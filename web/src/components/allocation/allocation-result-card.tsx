import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AllocationResult } from "@/lib/types/dto"

const ALGORITHM_LABELS: Record<string, string> = {
  "greedy-mock": "Greedy (mock — GA pending)",
  ga: "Genetic algorithm",
  random: "Random baseline",
  manual: "Manual baseline",
}

interface AllocationResultCardProps {
  result: AllocationResult
  perspective: "student" | "supervisor"
}

export function AllocationResultCard({ result, perspective }: AllocationResultCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">
            {perspective === "student" ? result.supervisor_name : result.student_name}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {perspective === "student" ? "Your allocated supervisor" : "Allocated student"}
          </p>
        </div>
        <Badge variant="secondary">{ALGORITHM_LABELS[result.algorithm] ?? result.algorithm}</Badge>
      </CardHeader>
      <CardContent className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Objective score</span>
        <span className="font-medium">{result.objective_score?.toFixed(2) ?? "—"}</span>
      </CardContent>
    </Card>
  )
}
