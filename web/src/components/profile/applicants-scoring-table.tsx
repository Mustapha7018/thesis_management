import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ApplicantView } from "@/lib/types/dto"

function ScoreInput({ applicant, onScore }: { applicant: ApplicantView; onScore: (score: number) => Promise<void> }) {
  const [value, setValue] = useState(applicant.current_score?.toString() ?? "")

  async function commit() {
    const parsed = Number(value)
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
      toast.error("Score must be between 0 and 1.")
      setValue(applicant.current_score?.toString() ?? "")
      return
    }
    await onScore(parsed)
  }

  return (
    <Input
      type="number"
      min={0}
      max={1}
      step={0.01}
      value={value}
      placeholder="0.00–1.00"
      className="w-24"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
    />
  )
}

export function ApplicantsScoringTable({
  applicants,
  onScore,
}: {
  applicants: ApplicantView[]
  onScore: (studentId: number, score: number) => Promise<void>
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Their rank</TableHead>
            <TableHead>Interests</TableHead>
            <TableHead>Score (0–1)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applicants.map((a) => (
            <TableRow key={a.student_id}>
              <TableCell className="font-medium">
                {a.first_name} {a.last_name}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{a.programme}</TableCell>
              <TableCell>
                <Badge variant="secondary">#{a.rank_given}</Badge>
              </TableCell>
              <TableCell className="max-w-56 whitespace-normal break-words text-xs text-muted-foreground">
                {a.interest_area_names.join(", ")}
              </TableCell>
              <TableCell>
                <ScoreInput applicant={a} onScore={(score) => onScore(a.student_id, score)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
