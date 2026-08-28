

export function parseEastmoneyTime(timeStr: string): number | null {
  if (!timeStr) return null

  const ts = parseInt(timeStr)
  if (ts > 1000000000) return ts

  const d = new Date(timeStr.replace(/-/g, '/'))
  if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000)
  return null
}

export function formatTimestamp(ctime: number): string {
  const d = new Date(ctime * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatTime(ctime: number): string {
  const d = new Date(ctime * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
