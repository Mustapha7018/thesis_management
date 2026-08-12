export function today(): Date {
  return new Date()
}

export function isPast(isoDate: string): boolean {
  return new Date(isoDate).getTime() < today().getTime()
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function isoNow(): string {
  return new Date().toISOString()
}

export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
