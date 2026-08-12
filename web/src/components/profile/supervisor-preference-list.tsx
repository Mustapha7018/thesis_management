import { ArrowDown, ArrowUp, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { SupervisorBrief } from "@/lib/types/dto"

interface SupervisorPreferenceListProps {
  supervisors: SupervisorBrief[]
  initialSupervisorIds: number[]
  windowOpen: boolean
  onSave: (supervisorIdsInRankOrder: number[]) => Promise<void>
}

export function SupervisorPreferenceList({
  supervisors,
  initialSupervisorIds,
  windowOpen,
  onSave,
}: SupervisorPreferenceListProps) {
  const [selected, setSelected] = useState<number[]>(initialSupervisorIds)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => setSelected(initialSupervisorIds), [initialSupervisorIds])

  const supervisorById = useMemo(() => new Map(supervisors.map((s) => [s.supervisor_id, s])), [supervisors])
  const available = supervisors.filter(
    (s) =>
      !selected.includes(s.supervisor_id) &&
      `${s.first_name} ${s.last_name} ${s.expertise_area_names.join(" ")}`.toLowerCase().includes(search.toLowerCase()),
  )

  function move(index: number, delta: number) {
    const next = [...selected]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSelected(next)
  }

  async function handleSave() {
    if (selected.length !== 5) {
      toast.error("You must rank exactly 5 distinct supervisors.")
      return
    }
    setSaving(true)
    try {
      await onSave(selected)
      toast.success("Preference list saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {!windowOpen && (
        <Alert variant="destructive">
          <AlertTitle>Preference window closed</AlertTitle>
          <AlertDescription>
            The administrator has closed preference submissions. You can review your list but not change it.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Your ranked list ({selected.length}/5)</p>
          <div className="space-y-2">
            {selected.map((supervisorId, i) => {
              const s = supervisorById.get(supervisorId)
              if (!s) return null
              return (
                <Card key={supervisorId}>
                  <CardContent className="flex items-center justify-between gap-2 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm leading-tight">
                          {s.title} {s.first_name} {s.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.expertise_area_names.join(", ")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!windowOpen || i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!windowOpen || i === selected.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!windowOpen}
                        onClick={() => setSelected(selected.filter((id) => id !== supervisorId))}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <Button className="mt-4" onClick={handleSave} disabled={saving || !windowOpen}>
            Save preference list
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Available supervisors</p>
          <Input
            placeholder="Search by name or research area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!windowOpen}
            className="mb-3"
          />
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {available.map((s) => (
              <button
                key={s.supervisor_id}
                type="button"
                disabled={!windowOpen || selected.length >= 5}
                onClick={() => setSelected([...selected, s.supervisor_id])}
                className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {s.title} {s.first_name} {s.last_name}
                </span>
                <div className="flex gap-1">
                  {s.expertise_area_names.slice(0, 2).map((name) => (
                    <Badge key={name} variant="secondary" className="text-[10px]">
                      {name}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
