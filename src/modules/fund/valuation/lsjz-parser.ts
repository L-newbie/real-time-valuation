

export interface LsjzRow {
  date: string

  nav: number

  growth: number | null
}

export function parseLsjzContent(content: string): LsjzRow[] {
  if (!content || content.includes('暂无数据')) return []

  const rowMatches = content.match(/<tr[\s\S]*?<\/tr>/gi) || []
  const results: LsjzRow[] = []

  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>(.*?)<\/td>/gi) || []
    if (!cells.length) continue

    const getText = (td: string) => td.replace(/<[^>]+>/g, '').trim()
    const dateStr = getText(cells[0] || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue

    const navStr = getText(cells[1] || '')
    const nav = parseFloat(navStr)
    if (!Number.isFinite(nav)) continue

    let growth: number | null = null
    for (const c of cells) {
      const txt = getText(c)
      const m = txt.match(/([-+]?\d+(?:\.\d+)?)\s*%/)
      if (m) {
        growth = parseFloat(m[1])
        break
      }
    }

    results.push({ date: dateStr, nav, growth })
  }

  return results.reverse()
}
