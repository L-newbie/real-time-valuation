

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&lsquo;': "'",
  '&rsquo;': "'",
}

function decodeEntities(s: string): string {
  let out = s
  for (const [k, v] of Object.entries(ENTITIES)) {
    out = out.split(k).join(v)
  }

  return out.replace(/&#(\d+);/g, (_, code) => {
    const n = Number(code)
    return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''
  })
}

export function toParagraphs(html: string | undefined | null): string[] {
  if (!html) return []

  let s = String(html)

  s = s.replace(/<(script|style|iframe|noscript)[\s\S]*?<\/\1>/gi, '')

  s = s.replace(/<\/(p|div|section|article|h[1-6]|li|blockquote)>/gi, '\n\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')

  s = s.replace(/<[^>]+>/g, '')

  s = decodeEntities(s)

  return s
    .split(/\n{2,}/)
    .map(p => p.replace(/[ \t ]+/g, ' ').trim())

    .filter(p => p.length >= 8)
}

export function toExcerpt(html: string | undefined | null, max = 60): string {
  const paras = toParagraphs(html)
  if (paras.length === 0) return ''
  const text = paras.join(' ')
  return text.length <= max ? text : text.slice(0, max) + '…'
}
