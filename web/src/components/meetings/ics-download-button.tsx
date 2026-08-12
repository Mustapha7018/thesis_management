import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMeetingIcsContent } from "@/lib/services/meetings.service"
import { downloadIcsFile } from "@/lib/utils/ics"

export function IcsDownloadButton({ meetingId }: { meetingId: number }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => downloadIcsFile(getMeetingIcsContent(meetingId), `meeting-${meetingId}.ics`)}
    >
      <Download className="size-3.5" />
      .ics
    </Button>
  )
}
