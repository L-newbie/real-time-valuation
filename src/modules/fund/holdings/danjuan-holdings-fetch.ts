import type { HoldingDetailItem } from '@/modules/fund/fund-types'
import { isValidFundCode } from '@/shared/utils/validation'
import { withBudget } from '@/shared/net/net-budget'

interface DanjuanStock {
  code?: string
  name?: string
  percent?: number | string
  percent_double?: number | string
  xq_symbol?: string
  amarket?: boolean
}

interface DanjuanDetail {
  data?: {
    stock_list?: DanjuanStock[]
    fund_position?: {
      stock_list?: DanjuanStock[]
      position_date?: string
    }
  }
}

const PROXIES: Array<(u: string) => string> = [
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
]

const XQ_PREFIX_TO_EM: Record<string, string> = {
  SH: '1', SZ: '0', HK: '116',
}

function emMarketFromXqSymbol(symbol?: string): string {
  if (!symbol) return ''
  const m = symbol.match(/^([A-Z]{2})/)
  if (!m) return ''
  return XQ_PREFIX_TO_EM[m[1]] ?? ''
}

function parsePercent(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace('%', '').trim())
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100) / 100
}

async function fetchViaProxy(url: string, timeoutMs: number): Promise<unknown | null> {
  for (const build of PROXIES) {
    const proxied = build(url)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const resp = await withBudget(proxied, () => fetch(proxied, { signal: ctrl.signal }))
      clearTimeout(timer)
      if (!resp.ok) continue
      const text = await resp.text()
      if (!text) continue
      try {
        return JSON.parse(text)
      } catch {
        continue
      }
    } catch {
      clearTimeout(timer)
    }
  }
  return null
}

export async function fetchDanjuanRatios(fundCode: string): Promise<Map<string, number> | null> {
  const list = await fetchDanjuanHoldings(fundCode)
  if (!list) return null
  const map = new Map<string, number>()
  for (const h of list) {
    if (h.ratio > 0) map.set(h.stockCode.toUpperCase(), h.ratio)
  }
  return map.size > 0 ? map : null
}

const DANJUAN_TIMEOUT = 3500

export async function fetchDanjuanHoldings(fundCode: string): Promise<HoldingDetailItem[] | null> {
  if (!isValidFundCode(fundCode)) return null

  const url = `https://danjuanfunds.com/djapi/fund/detail/${fundCode}`
  const json = await fetchViaProxy(url, DANJUAN_TIMEOUT)
  if (!json) return null

  const data = (json as DanjuanDetail)?.data
  const stocks = data?.stock_list ?? data?.fund_position?.stock_list
  if (!Array.isArray(stocks) || stocks.length === 0) return null

  const holdings: HoldingDetailItem[] = []
  for (const s of stocks) {
    const code = String(s.code || '').trim()
    if (!code) continue
    holdings.push({
      stockCode: code,
      stockName: String(s.name || '').trim(),
      ratio: parsePercent(s.percent_double ?? s.percent),
      emMarketCode: emMarketFromXqSymbol(s.xq_symbol),
      rawEntry: code,
    })
  }

  return holdings.length > 0 ? holdings : null
}
