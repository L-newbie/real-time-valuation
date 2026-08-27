

import type { FundAllHoldings, HoldingDetailItem } from '@/modules/fund/fund-types'
import { isValidFundCode } from '@/shared/utils/validation'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'

export interface PingzhongPreloaded {
  stockCodesNew?: unknown
  fundSharesPositions?: unknown[]
}

export async function fetchTop10FromPingzhong(
  fundCode: string,
  preloaded?: PingzhongPreloaded,
): Promise<FundAllHoldings | null> {
  if (!isValidFundCode(fundCode)) return null

  let stockCodesNew = preloaded?.stockCodesNew
  let positions: unknown = preloaded?.fundSharesPositions
  if (stockCodesNew == null || positions == null) {
    const g = await loadPingzhong(fundCode)
    stockCodesNew = stockCodesNew ?? g?.stockCodesNew
    positions = positions ?? g?.Data_fundSharesPositions
  }

  let entries: string[]
  if (Array.isArray(stockCodesNew)) {
    entries = stockCodesNew.map(s => String(s).trim()).filter(Boolean)
  } else if (typeof stockCodesNew === 'string' && stockCodesNew) {
    entries = stockCodesNew.split(',').map(s => s.trim()).filter(Boolean)
  } else {
    return null
  }
  if (entries.length === 0) return null

  const holdings = parseStockCodesNew(entries)

  if (holdings.length === 0) return null

  enrichNamesFromFundSharesPositions(holdings, positions)

  return {
    reportDate: '',
    reportType: '季报',
    isFull: false,
    holdings,
  }
}

export function parseStockCodesNew(entries: string[]): HoldingDetailItem[] {
  const holdings: HoldingDetailItem[] = []
  for (const entry of entries.slice(0, 10)) {
    const dot = entry.indexOf('.')
    if (dot > 0) {
      const emMarketCode = entry.substring(0, dot)
      const stockCode = entry.substring(dot + 1)
      if (stockCode) {
        holdings.push({ stockCode, stockName: '', ratio: 0, emMarketCode, rawEntry: entry })
        continue
      }
    }
    const bareCode = entry.split(/\s+/)[0]
    if (bareCode) {
      holdings.push({ stockCode: bareCode, stockName: '', ratio: 0, emMarketCode: '', rawEntry: entry })
    }
  }
  return holdings
}

export async function loadPingzhongHoldings(
  fundCode: string,
  preloaded?: PingzhongPreloaded,
): Promise<HoldingDetailItem[] | null> {
  if (!isValidFundCode(fundCode)) return null
  const stockCodesNew = preloaded?.stockCodesNew ?? (await loadPingzhong(fundCode))?.stockCodesNew
  let entries: string[]
  if (Array.isArray(stockCodesNew)) {
    entries = stockCodesNew.map(s => String(s).trim()).filter(Boolean)
  } else if (typeof stockCodesNew === 'string' && stockCodesNew) {
    entries = stockCodesNew.split(',').map(s => s.trim()).filter(Boolean)
  } else {
    return null
  }
  if (entries.length === 0) return null
  return parseStockCodesNew(entries)
}

export function enrichMarketCodeFromPingzhong(
  holdings: { stockCode: string; emMarketCode?: string; rawEntry?: string }[],
  pzHoldings: { stockCode: string; emMarketCode?: string; rawEntry?: string }[],
): boolean {
  if (!holdings.length || !pzHoldings.length) return false

  const byCode = new Map<string, { emMarketCode: string; rawEntry: string }>()
  const byUpper = new Map<string, { emMarketCode: string; rawEntry: string }>()
  const byNumTrimmed = new Map<string, { emMarketCode: string; rawEntry: string }>()
  for (const p of pzHoldings) {
    const em = (p.emMarketCode || '').trim()
    if (!em) continue
    const c = p.stockCode
    const raw = p.rawEntry || c
    const v = { emMarketCode: em, rawEntry: raw }
    byCode.set(c, v)
    byUpper.set(c.toUpperCase(), v)
    if (/^\d+$/.test(c) && c.length !== 6) {
      byNumTrimmed.set(String(parseInt(c, 10)), v)
    }
  }
  if (!byCode.size && !byUpper.size && !byNumTrimmed.size) return false

  let changed = false
  for (const h of holdings) {
    const c = h.stockCode
    const matched =
      byCode.get(c) ??
      byUpper.get(c.toUpperCase()) ??
      (/^\d+$/.test(c) && c.length !== 6 ? byNumTrimmed.get(String(parseInt(c, 10))) : undefined)
    if (matched && matched.emMarketCode && matched.emMarketCode !== h.emMarketCode) {
      h.emMarketCode = matched.emMarketCode
      h.rawEntry = matched.rawEntry
      changed = true
    }
  }
  return changed
}

const RATIO_FIELDS = ['ratio', 'zjzbl', 'ZJZBL', 'jzbl', 'JZBL', 'proportion', 'percent', 'weight'] as const

function pickRatio(item: Record<string, unknown>): number {
  for (const key of RATIO_FIELDS) {
    const raw = item[key]
    if (raw == null) continue
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace('%', '').trim())
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100
  }
  return 0
}

export function enrichNamesFromFundSharesPositions(
  holdings: HoldingDetailItem[],
  fundSharesPositionsRaw?: unknown,
  mode: 'fill' | 'override' = 'fill',
): void {
  if (!holdings.length || !fundSharesPositionsRaw || !Array.isArray(fundSharesPositionsRaw)) return
  const reports = fundSharesPositionsRaw as Array<{ fundSharesPositionsList?: Array<Record<string, unknown>> }>
  const latest = reports[reports.length - 1]
  const list = latest?.fundSharesPositionsList
  if (!Array.isArray(list) || list.length === 0) return

  type Entry = { name: string; ratio: number }
  const byCode = new Map<string, Entry>()
  const byUpper = new Map<string, Entry>()
  const byNumTrimmed = new Map<string, Entry>()
  for (const item of list) {
    const code = typeof item?.code === 'string' ? item.code : ''
    const name = typeof item?.name === 'string' ? item.name : ''
    if (!code) continue
    const entry: Entry = { name, ratio: pickRatio(item) }
    byCode.set(code, entry)
    byUpper.set(code.toUpperCase(), entry)
    if (/^\d+$/.test(code) && code.length !== 6) {
      byNumTrimmed.set(String(parseInt(code, 10)), entry)
    }
  }

  for (const h of holdings) {
    const c = h.stockCode
    const matched =
      byCode.get(c) ??
      byUpper.get(c.toUpperCase()) ??
      (/^\d+$/.test(c) && c.length !== 6 ? byNumTrimmed.get(String(parseInt(c, 10))) : undefined)
    if (!matched) continue
    if (matched.name && !(mode === 'fill' && h.stockName)) h.stockName = matched.name
    if (!(h.ratio > 0) && matched.ratio > 0) h.ratio = matched.ratio
  }
}
