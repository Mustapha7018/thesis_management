import { Upload } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { FileAttachmentChip } from "@/components/common/file-attachment-chip"
import { Button } from "@/components/ui/button"
import type { Milestone } from "@/lib/types/entities"

export function MilestoneAttachment({
  milestone,
  onUpload,
  onRemove,
}: {
  milestone: Milestone
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
      toast.success("Deliverable uploaded.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload deliverable.")
    } finally {
      setUploading(false)
    }
  }

  if (milestone.attachment_name) {
    return (
      <FileAttachmentChip
        fileName={milestone.attachment_name}
        fileType={milestone.attachment_type!}
        fileData={milestone.attachment_data!}
        onRemove={onRemove}
        removeLabel="Remove deliverable"
      />
    )
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
      <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="size-3.5" />
        {uploading ? "Uploading…" : "Attach deliverable"}
      </Button>
    </div>
  )
}
