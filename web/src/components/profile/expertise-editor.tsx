import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ResearchArea } from "@/lib/types/entities"

interface ExpertiseEntry {
  areaId: number
  proficiency: 1 | 2 | 3
}

const PROFICIENCY_LABELS: Record<1 | 2 | 3, string> = {
  1: "Working knowledge",
  2: "Established",
  3: "Leading",
}

export function ExpertiseEditor({
  areas,
  initial,
  onSave,
}: {
  areas: ResearchArea[]
  initial: ExpertiseEntry[]
  onSave: (expertise: ExpertiseEntry[]) => Promise<void>
}) {
  const [entries, setEntries] = useState<ExpertiseEntry[]>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => setEntries(initial), [initial])

  const selectedAreaIds = new Set(entries.map((e) => e.areaId))
  const available = areas.filter((a) => !selectedAreaIds.has(a.area_id))

  async function handleSave() {
    if (entries.length < 2 || entries.length > 4) {
      toast.error("Choose between 2 and 4 expertise areas.")
      return
    }
    setSaving(true)
    try {
      await onSave(entries)
      toast.success("Expertise saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium">Your expertise areas ({entries.length}/4)</p>
        <div className="space-y-2">
          {entries.map((entry) => {
            const area = areas.find((a) => a.area_id === entry.areaId)
            return (
              <Card key={entry.areaId}>
                <CardContent className="flex items-center justify-between gap-2 py-3">
                  <span className="text-sm">{area?.name}</span>
                  <div className="flex items-center gap-1">
                    <Select
                      value={String(entry.proficiency)}
                      onValueChange={(value) =>
                        setEntries(
                          entries.map((e) =>
                            e.areaId === entry.areaId ? { ...e, proficiency: Number(value) as 1 | 2 | 3 } : e,
                          ),
                        )
                      }
                    >
                      <SelectTrigger size="sm" className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {([1, 2, 3] as const).map((p) => (
                          <SelectItem key={p} value={String(p)}>
                            {PROFICIENCY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEntries(entries.filter((e) => e.areaId !== entry.areaId))}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        <Button className="mt-4" onClick={handleSave} disabled={saving}>
          Save expertise
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Available research areas</p>
        <div className="flex flex-wrap gap-2">
          {available.map((area) => (
            <button
              key={area.area_id}
              type="button"
              disabled={entries.length >= 4}
              onClick={() => setEntries([...entries, { areaId: area.area_id, proficiency: 2 }])}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {area.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
