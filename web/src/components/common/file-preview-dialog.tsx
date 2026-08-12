import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  fileType: string
  fileData: string
}

export function FilePreviewDialog({ open, onOpenChange, fileName, fileType, fileData }: FilePreviewDialogProps) {
  const isPdf = fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")
  const isDocx = fileType === DOCX_MIME || fileName.toLowerCase().endsWith(".docx")

  const [docxHtml, setDocxHtml] = useState<string | null>(null)
  const [docxError, setDocxError] = useState(false)

  useEffect(() => {
    if (!open || !isDocx) return
    setDocxHtml(null)
    setDocxError(false)
    let cancelled = false
    ;(async () => {
      try {
        const mammoth = await import("mammoth")
        const arrayBuffer = await (await fetch(fileData)).arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer })
        if (!cancelled) setDocxHtml(result.value)
      } catch {
        if (!cancelled) setDocxError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, isDocx, fileData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[95vw] max-w-6xl flex-col overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="flex-row items-center gap-4 border-b border-border px-6 py-4">
          <DialogTitle className="truncate">{fileName}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-6 py-4">
          {isPdf && <iframe title={fileName} src={fileData} className="h-full min-h-[70vh] w-full rounded border border-border bg-background" />}
          {isDocx && (
            <div className="mx-auto max-w-4xl rounded border border-border bg-background px-10 py-8 shadow-sm">
              {docxError && (
                <p className="text-sm text-muted-foreground">Couldn't render a preview for this document.</p>
              )}
              {!docxError && !docxHtml && <p className="text-sm text-muted-foreground">Loading preview…</p>}
              {docxHtml && (
                <div
                  className="max-w-none space-y-3 text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:p-1"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              )}
            </div>
          )}
          {!isPdf && !isDocx && <p className="text-sm text-muted-foreground">Preview not available for this file type.</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
