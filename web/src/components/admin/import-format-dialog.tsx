import { Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const HEADER =
  "student_id,first_name,last_name,email,programme,mode,entry_year,entry_qualification,prior_avg_mark,created_at"
const EXAMPLE = "9001,Ada,Lovelace,ab12cd@student.sunderland.ac.uk,MSc Data Science,FT,2026,First,72.5,2026-08-01"

const FIELDS: [string, string][] = [
  ["student_id", "positive integer, unique across all batches"],
  ["email", "6-character code @student.sunderland.ac.uk, unique across all batches"],
  [
    "programme",
    "MSc Data Science · MSc Computer Science · MSc Cybersecurity · MSc Applied Cybersecurity · MSc Computer Science with Data Science · MSc Computer Science with Cyber Security",
  ],
  ["mode", "FT or PT"],
  ["entry_year", "2000–2100"],
  ["entry_qualification", "First · 2:1 · 2:2 · International equivalent"],
  ["prior_avg_mark", "40–90"],
  ["created_at", "date, e.g. 2026-08-01"],
]

export function ImportFormatDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lightbulb className="size-4" />
          File format
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>students.csv format</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 max-w-full space-y-4 overflow-hidden text-sm">
          <div>
            <p className="mb-1 font-medium">Header row</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{HEADER}</pre>
          </div>
          <div>
            <p className="mb-1 font-medium">Example row</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{EXAMPLE}</pre>
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            {FIELDS.map(([field, rule]) => (
              <div key={field} className="flex gap-3 border-b border-border px-3 py-1.5 last:border-b-0">
                <span className="w-40 shrink-0 font-mono text-xs leading-5">{field}</span>
                <span className="text-muted-foreground">{rule}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground">
            The import is all-or-nothing: any invalid row rejects the whole file.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
