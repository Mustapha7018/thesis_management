import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { PreferenceWindow } from "@/lib/types/entities"

export function PreferenceWindowToggle({
  window: preferenceWindow,
  onSave,
}: {
  window: PreferenceWindow
  onSave: (patch: Partial<PreferenceWindow>) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(preferenceWindow.is_open)
  const [opensAt, setOpensAt] = useState(preferenceWindow.opens_at.slice(0, 16))
  const [closesAt, setClosesAt] = useState(preferenceWindow.closes_at.slice(0, 16))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        is_open: isOpen,
        opens_at: new Date(opensAt).toISOString(),
        closes_at: new Date(closesAt).toISOString(),
      })
      toast.success("Preference window updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Preference submission window</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="window-open">Window open</Label>
          <Switch id="window-open" checked={isOpen} onCheckedChange={setIsOpen} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="opens-at">Opens</Label>
          <Input id="opens-at" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="closes-at">Closes</Label>
          <Input id="closes-at" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          Save
        </Button>
      </CardContent>
    </Card>
  )
}
