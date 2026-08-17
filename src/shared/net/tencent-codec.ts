

import type { StockMarket } from '@/shared/types/common-types'

export function tencentKlineCode(code: string, market: StockMarket): string {
  if (market === 'A') {
    if (/^(6|68|9)/.test(code)) return `sh${code}`
    if (/^(0|30|2)/.test(code)) return `sz${code}`
    if (/^[84]/.test(code)) return `bj${code}`
    return `sh${code}`
  }
  if (market === 'HK') return `hk${code.padStart(5, '0')}`
  if (market === 'US') return `us${code.toUpperCase()}.OQ`
  return code
}

export function tencentQuoteCode(code: string, market: StockMarket): string {
  if (market === 'A') return tencentKlineCode(code, market)
  if (market === 'HK') return tencentKlineCode(code, market)
  if (market === 'US') return `us${code.toUpperCase()}`
  return code
}

const SUFFIX_RULES: ReadonlyArray<{ re: RegExp; m: StockMarket }> = [
  { s: 'JP', m: 'JP' }, { s: 'KR', m: 'KR' }, { s: 'TW', m: 'TW' },
  { s: 'DE', m: 'DE' }, { s: 'FR', m: 'FR' }, { s: 'UK', m: 'UK' },
  { s: 'BR', m: 'BR' }, { s: 'IN', m: 'IN' }, { s: 'SG', m: 'SG' },
  { s: 'AU', m: 'AU' }, { s: 'US', m: 'US' },
  { s: 'HK', m: 'HK' }, { s: 'SZ', m: 'A' }, { s: 'SH', m: 'A' },
].map(({ s, m }) => ({ re: new RegExp(`[.]?${s}$`, 'i'), m: m as StockMarket }))

const normalizeCache = new Map<string, { code: string; market?: StockMarket }>()
const NORMALIZE_CACHE_MAX = 2000

export function normalizeStockCodeTencent(raw: string): { code: string; market?: StockMarket } {
  const hit = normalizeCache.get(raw)
  if (hit) return hit

  let code = raw
  let market: StockMarket | undefined
  for (const { re, m } of SUFFIX_RULES) {
    if (re.test(code)) {
      code = code.replace(re, '')
      market = m
      break
    }
  }
  const result = { code, market }
  if (normalizeCache.size >= NORMALIZE_CACHE_MAX) normalizeCache.clear()
  normalizeCache.set(raw, result)
  return result
}
