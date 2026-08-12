import { Download, FileText, Trash2 } from "lucide-react"
import { useState } from "react"
import { FilePreviewDialog } from "@/components/common/file-preview-dialog"
import { Button } from "@/components/ui/button"
import { downloadDataUrl } from "@/lib/utils/file-upload"

interface FileAttachmentChipProps {
  fileName: string
  fileType: string
  fileData: string
  onRemove?: () => void
  removeLabel?: string
}

export function FileAttachmentChip({ fileName, fileType, fileData, onRemove, removeLabel = "Remove file" }: FileAttachmentChipProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm sm:max-w-xs">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-link hover:underline"
          onClick={() => setOpen(true)}
        >
          {fileName}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={() => downloadDataUrl(fileData, fileName)}
          aria-label={`Download ${fileName}`}
        >
          <Download className="size-3.5" />
        </Button>
        {onRemove && (
          <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={onRemove} aria-label={removeLabel}>
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      <FilePreviewDialog open={open} onOpenChange={setOpen} fileName={fileName} fileType={fileType} fileData={fileData} />
    </>
  )
}
