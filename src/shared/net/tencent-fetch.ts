

import { TENCENT_URLS, FUND_LOOP_CONFIG } from '@/config/constants'
import type { StockMarket } from '@/shared/types/common-types'
import { tencentKlineCode, tencentQuoteCode } from './tencent-codec'
import { withBudget } from '@/shared/net/net-budget'

type TencentKlineBar = [string, string, string, string, string, string, ...unknown[]]

export function klinesFromTencent(rawArr: unknown[] | undefined): string[] | null {
  if (!rawArr || !Array.isArray(rawArr) || rawArr.length === 0) return null

  const parsed: { date: string; ts: number; line: string }[] = []
  for (const bar of rawArr) {
    if (!Array.isArray(bar) || bar.length < 6) continue
    const [date, open, close, high, low, vol] = bar as TencentKlineBar
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const c = parseFloat(close)
    if (!Number.isFinite(c) || c <= 0) continue
    const ts = Date.parse(date)
    if (!Number.isFinite(ts)) continue
    parsed.push({ date, ts, line: `${date},${open},${close},${high},${low},${vol},${vol}` })
  }
  if (parsed.length === 0) return null

  const maxTs = parsed.reduce((max, p) => Math.max(max, p.ts), -Infinity)
  const maxDaysMs = FUND_LOOP_CONFIG.KLINE_DIRTY_BAR_MAX_DAYS * 24 * 60 * 60 * 1000
  const out = parsed
    .filter((p) => maxTs - p.ts <= maxDaysMs)
    .map((p) => p.line)
  return out.length > 0 ? out : null
}

export async function fetchTencentKline(
  code: string,
  market: StockMarket,
  timeoutMs: number = 5000,
): Promise<string[] | null> {
  const tCode = tencentKlineCode(code, market)
  const klines = await fetchTencentKlineByCode(tCode, timeoutMs)
  if (klines && klines.length >= 2) return klines

  if (market === 'US' && (klines == null || klines.length < 2)) {
    const fallbackCode = `us${code.toUpperCase()}`
    const retry = await fetchTencentKlineByCode(fallbackCode, timeoutMs)
    if (retry && retry.length >= 2) return retry
  }
  return null
}

async function fetchTencentKlineByCode(tCode: string, timeoutMs: number): Promise<string[] | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const kurl = `${TENCENT_URLS.FQKLINE}?param=${tCode},day,,,8,qfq`
    const resp = await withBudget(kurl, () => fetch(kurl, { signal: ctrl.signal }))
    clearTimeout(timer)
    if (!resp.ok) return null
    const payload = await resp.json() as any
    const block = payload?.data?.[tCode]
    const rawArr = block?.qfqday || block?.day
    return klinesFromTencent(rawArr)
  } catch {
    clearTimeout(timer)
    return null
  }
}

export async function fetchTencentRealtimeBatch(
  entries: { code: string; market: StockMarket }[],
  timeoutMs: number = 5000,
): Promise<Map<string, { price: number; prevClose: number; changeRate: number; name?: string }>> {
  const result = new Map<string, { price: number; prevClose: number; changeRate: number; name?: string }>()
  if (entries.length === 0) return result

  const codeToEntry = new Map<string, { code: string; market: StockMarket }>()
  const qParams: string[] = []
  for (const e of entries) {
    const tCode = tencentQuoteCode(e.code, e.market)
    codeToEntry.set(tCode, e)
    qParams.push(tCode)
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let text: string
  try {
    const qurl = `${TENCENT_URLS.QUOTE}${qParams.join(',')}`
    const resp = await withBudget(qurl, () => fetch(qurl, { signal: ctrl.signal }))
    clearTimeout(timer)
    if (!resp.ok) return result

    const buf = await resp.arrayBuffer()
    try {
      text = new TextDecoder('gbk').decode(buf)
    } catch {
      text = new TextDecoder().decode(buf)
    }
  } catch {
    clearTimeout(timer)
    return result
  }
  if (!text) return result

  const re = /v_([^=]+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const tCode = m[1]
    const val = m[2]
    const entry = codeToEntry.get(tCode)
    if (!entry) continue
    const parts = val.split('~')
    if (parts.length < 5) continue
    const price = parseFloat(parts[3])
    const prevClose = parseFloat(parts[4])
    if (!Number.isFinite(price) || !Number.isFinite(prevClose) || prevClose <= 0) continue
    const changeRate = Math.round((price - prevClose) / prevClose * 100 * 100) / 100
    const name = extractStockName(parts, entry.market)
    result.set(entry.code, { price, prevClose, changeRate, ...(name ? { name } : {}) })
  }
  return result
}

function extractStockName(parts: string[], market: StockMarket): string {
  const clean = (s: string | undefined): string => {
    if (!s) return ''
    return s.replace(/�/g, '').trim()
  }
  if (market === 'US') {
    const p1 = clean(parts[1])
    if (p1) return p1
    const p46 = clean(parts[46])
    return p46
  }
  return clean(parts[1])
}
