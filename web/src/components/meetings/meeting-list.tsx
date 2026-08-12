import { Upload } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { FileAttachmentChip } from "@/components/common/file-attachment-chip"
import { IcsDownloadButton } from "@/components/meetings/ics-download-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Meeting } from "@/lib/types/entities"
import { formatDateTime } from "@/lib/utils/date"

function NotesField({ meeting, onUpdate }: { meeting: Meeting; onUpdate: (patch: { notes: string }) => void }) {
  const [value, setValue] = useState(meeting.notes ?? "")
  return (
    <Textarea
      value={value}
      placeholder="Notes from this meeting…"
      rows={2}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== (meeting.notes ?? "")) onUpdate({ notes: value })
      }}
    />
  )
}

function MeetingLogUpload({
  meeting,
  canUpload,
  onUpload,
  onRemove,
}: {
  meeting: Meeting
  canUpload: boolean
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      await onUpload(file)
      toast.success("Meeting log uploaded.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload log.")
    } finally {
      setUploading(false)
    }
  }

  if (meeting.log_file_name) {
    return (
      <FileAttachmentChip
        fileName={meeting.log_file_name}
        fileType={meeting.log_file_type!}
        fileData={meeting.log_file_data!}
        onRemove={canUpload ? onRemove : undefined}
        removeLabel="Remove log"
      />
    )
  }

  if (!canUpload) {
    return <p className="text-xs text-muted-foreground">No supervision log uploaded yet.</p>
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
      <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="size-3.5" />
        {uploading ? "Uploading…" : "Upload log (PDF or Word)"}
      </Button>
    </div>
  )
}

export function MeetingList({
  meetings,
  counterpartName,
  canUploadLog = false,
  onUpdate,
  onUploadLog,
  onRemoveLog,
}: {
  meetings: Meeting[]
  counterpartName: (meeting: Meeting) => string
  canUploadLog?: boolean
  onUpdate: (meetingId: number, patch: { held?: boolean; notes?: string }) => Promise<void>
  onUploadLog?: (meetingId: number, file: File) => Promise<void>
  onRemoveLog?: (meetingId: number) => Promise<void>
}) {
  return (
    <div className="space-y-3">
      {meetings.map((meeting) => {
        const isFuture = new Date(meeting.scheduled_at).getTime() > Date.now()
        return (
          <Card key={meeting.meeting_id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{counterpartName(meeting)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(meeting.scheduled_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {isFuture && <IcsDownloadButton meetingId={meeting.meeting_id} />}
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={!!meeting.held}
                      onCheckedChange={(checked) => onUpdate(meeting.meeting_id, { held: checked })}
                    />
                    {meeting.held ? "Held" : "Not held"}
                  </label>
                  {isFuture && <Badge variant="secondary">Upcoming</Badge>}
                </div>
              </div>
              <NotesField meeting={meeting} onUpdate={(patch) => onUpdate(meeting.meeting_id, patch)} />
              {(onUploadLog || meeting.log_file_name) && (
                <MeetingLogUpload
                  meeting={meeting}
                  canUpload={canUploadLog}
                  onUpload={(file) => onUploadLog!(meeting.meeting_id, file)}
                  onRemove={() => onRemoveLog!(meeting.meeting_id)}
                />
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
