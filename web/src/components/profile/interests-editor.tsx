import { ArrowDown, ArrowUp, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { ResearchArea } from "@/lib/types/entities"

interface InterestsEditorProps {
  areas: ResearchArea[]
  initialAreaIds: number[]
  onSave: (interests: { areaId: number; rank: 1 | 2 | 3 }[]) => Promise<void>
}

export function InterestsEditor({ areas, initialAreaIds, onSave }: InterestsEditorProps) {
  const [selected, setSelected] = useState<number[]>(initialAreaIds)
  const [saving, setSaving] = useState(false)

  useEffect(() => setSelected(initialAreaIds), [initialAreaIds])

  const areaById = new Map(areas.map((a) => [a.area_id, a]))
  const available = areas.filter((a) => !selected.includes(a.area_id))

  function move(index: number, delta: number) {
    const next = [...selected]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSelected(next)
  }

  async function handleSave() {
    if (selected.length < 1 || selected.length > 3) {
      toast.error("Choose between 1 and 3 research interests.")
      return
    }
    setSaving(true)
    try {
      await onSave(selected.map((areaId, i) => ({ areaId, rank: (i + 1) as 1 | 2 | 3 })))
      toast.success("Interests saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium">Your ranked interests (1 = primary)</p>
        {selected.length === 0 && (
          <p className="text-sm text-muted-foreground">No interests selected yet — add up to 3 from the right.</p>
        )}
        <div className="space-y-2">
          {selected.map((areaId, i) => (
            <Card key={areaId}>
              <CardContent className="flex items-center justify-between gap-2 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="text-sm">{areaById.get(areaId)?.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={i === selected.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelected(selected.filter((id) => id !== areaId))}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button className="mt-4" onClick={handleSave} disabled={saving}>
          Save interests
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Available research areas</p>
        <div className="flex flex-wrap gap-2">
          {available.map((area) => (
            <button
              key={area.area_id}
              type="button"
              disabled={selected.length >= 3}
              onClick={() => setSelected([...selected, area.area_id])}
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
