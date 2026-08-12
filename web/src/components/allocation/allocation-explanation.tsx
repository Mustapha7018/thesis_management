import { Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AllocationExplanation as AllocationExplanationDto } from "@/lib/types/dto"

export function AllocationExplanation({ explanation }: { explanation: AllocationExplanationDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="size-4 text-muted-foreground" />
          Why this pairing?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{explanation.summary}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Student's rank</p>
            <p className="font-medium">{explanation.student_rank ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Supervisor's score</p>
            <p className="font-medium">{explanation.supervisor_score?.toFixed(2) ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Objective score</p>
            <p className="font-medium">{explanation.objective_score?.toFixed(2) ?? "—"}</p>
          </div>
        </div>
        {explanation.shared_area_names.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Shared research areas</p>
            <div className="flex flex-wrap gap-1">
              {explanation.shared_area_names.map((name) => (
                <Badge key={name} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
