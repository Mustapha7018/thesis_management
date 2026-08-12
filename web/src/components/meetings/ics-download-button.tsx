import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { getMeetingIcsContent } from "@/lib/services/meetings.service"
import { downloadIcsFile } from "@/lib/utils/ics"

export function IcsDownloadButton({ meetingId }: { meetingId: number }) {
  async function handleDownload() {
    try {
      downloadIcsFile(await getMeetingIcsContent(meetingId), `meeting-${meetingId}.ics`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download .ics file.")
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDownload}>
      <Download className="size-3.5" />
      .ics
    </Button>
  )
}
