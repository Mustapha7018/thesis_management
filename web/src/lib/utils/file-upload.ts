const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
}
const ALLOWED_EXTENSIONS = [".pdf", ".docx"]
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024

export function validateUploadFile(file: File): string | null {
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  const hasAllowedType = file.type in ALLOWED_TYPES
  if (!hasAllowedExtension && !hasAllowedType) {
    return "Only PDF or Word (.docx) files are accepted."
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large — max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`
  }
  return null
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
}
