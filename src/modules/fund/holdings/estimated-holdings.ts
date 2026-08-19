

import type {EstimatedHoldings, EstimatedHoldingItem, FundAllHoldings} from '@/modules/fund/fund-types'
import type { StockQuoteInfo } from '@/shared/types/common-types'
import { isValidFundCode } from '@/shared/utils/validation'
import { fetchTop10FromMobileApi } from './f10-mobile-fetch'
import { fetchTop10FromPingzhong, enrichMarketCodeFromPingzhong, enrichNamesFromFundSharesPositions, loadPingzhongHoldings, type PingzhongPreloaded } from './pingzhong-holdings-fetch'
import { fetchDanjuanHoldings } from './danjuan-holdings-fetch'
import { lookupMappedCode, rememberMappedCode } from './stock-code-map'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'

export type FetchStockQuotes = (
  entries: { stockCode: string; emMarketCode?: string; stockName?: string }[],
  mode: 'close' | 'realtime',
) => Promise<Map<string, StockQuoteInfo>>

const noopFetchStockQuotes: FetchStockQuotes = async () => new Map()

type HoldingsSource = 'mobile' | 'pingzhong'

async function loadPingzhongRaw(fundCode: string): Promise<unknown> {
  const g = await loadPingzhong(fundCode)
  return g?.Data_fundSharesPositions ?? null
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/

const CN_SUFFIX = /股份有限公司|有限责任公司|有限公司|控股公司|集团公司|株式会社|公司|控股|集团|\/特拉华州|\/DE/g

const EN_SUFFIX = /(CORPORATION|CORP|INC|LTD|PLC|COMPANY|LIMITED|HOLDINGS?|GROUP|CO)+$/

function normCn(s: string): string {
  return String(s ?? '').replace(/[\s（）()]/g, '').replace(CN_SUFFIX, '').toUpperCase()
}

function normEn(s: string): string {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(EN_SUFFIX, '')
}

function codeVariants(raw: string): string[] {
  const c = String(raw ?? '').trim().toUpperCase()
  if (!c) return []
  const out = [c]

  if (ISIN_RE.test(c)) {
    const body = c.slice(2, 11)
    const digits = body.replace(/\D/g, '')
    if (digits.length >= 6) out.push(digits.slice(0, 6), digits.slice(-6), digits.slice(1, 7))
    const alpha = body.replace(/[^A-Z]/g, '')
    if (alpha.length >= 2) out.push(alpha)
  }

  if (/^\d+$/.test(c)) {
    out.push(String(parseInt(c, 10)))
    if (c.length < 6) out.push(c.padStart(6, '0'))
  }

  const dot = c.indexOf('.')
  if (dot > 0) out.push(c.slice(0, dot), c.slice(dot + 1))

  const ex = new Set(out.filter(Boolean))
  for (const v of Array.from(ex)) {
    if (/^\d+$/.test(v)) {
      ex.add(String(parseInt(v, 10)))
      if (v.length < 6) ex.add(v.padStart(6, '0'))
    }
  }
  return Array.from(ex)
}

type RatioDonor = { stockCode: string; stockName: string; ratio: number; emMarketCode?: string }

function fillRatiosByRounds(
  holdings: FundAllHoldings['holdings'],
  donors: RatioDonor[],
): boolean {
  const pending = holdings.filter(h => !(h.ratio > 0))
  const pool = donors.filter(d => d.ratio > 0)
  if (pending.length === 0 || pool.length === 0) return false

  const taken = new Set<number>()
  let changed = false

  const apply = (h: FundAllHoldings['holdings'][number], i: number): void => {
    const d = pool[i]
    taken.add(i)
    h.ratio = d.ratio
    if (!h.emMarketCode && d.emMarketCode) h.emMarketCode = d.emMarketCode
    if (!h.stockName && d.stockName) h.stockName = d.stockName
    changed = true
  }

  const round = (test: (h: FundAllHoldings['holdings'][number], d: RatioDonor) => boolean): void => {
    for (const h of pending) {
      if (h.ratio > 0) continue
      for (let i = 0; i < pool.length; i++) {
        if (taken.has(i)) continue
        if (test(h, pool[i])) { apply(h, i); break }
      }
    }
  }

  round((h, d) => h.stockCode.trim().toUpperCase() === d.stockCode.trim().toUpperCase())

  round((h, d) => {
    const cached = lookupMappedCode(d.stockCode, d.stockName)
    if (!cached) return false
    const hv = codeVariants(h.stockCode)
    return hv.includes(cached.code) || h.stockCode.trim().toUpperCase() === cached.code
  })

  round((h, d) => {
    const hv = codeVariants(h.stockCode)
    if (hv.length === 0 || !codeVariants(d.stockCode).some(x => hv.includes(x))) return false
    rememberMappedCode(h.stockCode, 'variant', [d.stockCode, d.stockName], h.emMarketCode || d.emMarketCode)
    return true
  })

  round((h, d) => {
    const a = normCn(h.stockName)
    if (a.length === 0 || a !== normCn(d.stockName)) return false
    rememberMappedCode(h.stockCode, 'cn-name', [d.stockCode, d.stockName], h.emMarketCode || d.emMarketCode)
    return true
  })

  round((h, d) => {
    const a = normEn(h.stockName)
    const b = normEn(d.stockName)
    if (a.length < 4 || a !== b) return false
    rememberMappedCode(h.stockCode, 'en-name', [d.stockCode, d.stockName], h.emMarketCode || d.emMarketCode)
    return true
  })

  return changed
}

export async function fetchEstimatedHoldings(
  fundCode: string,
  year?: string,
  fetchStockQuotes: FetchStockQuotes = noopFetchStockQuotes,
  preloaded?: PingzhongPreloaded,
): Promise<EstimatedHoldings | null> {
  if (!isValidFundCode(fundCode)) return null

  let source: HoldingsSource = 'mobile'
  let top10: FundAllHoldings | null = await fetchTop10FromMobileApi(fundCode)
  if (!top10 || top10.holdings.length === 0) {
    source = 'pingzhong'
    top10 = await fetchTop10FromPingzhong(fundCode, preloaded)
  }
  if (top10 && top10.holdings.length > 0) {
    let holdingsEnrichedReady: Promise<void> | undefined
    if (source !== 'pingzhong') {
      if (preloaded?.stockCodesNew != null) {
        const pz = await loadPingzhongHoldings(fundCode, preloaded)
        if (pz) enrichMarketCodeFromPingzhong(top10.holdings, pz)
      } else {
        let resolveEnriched: () => void = () => {}
        holdingsEnrichedReady = new Promise<void>((r) => { resolveEnriched = r })
        void (async () => {
          try {
            const pz = await loadPingzhongHoldings(fundCode)
            if (pz) enrichMarketCodeFromPingzhong(top10!.holdings, pz)
          } catch {  }
          resolveEnriched()
        })()
      }

    }

    if (preloaded?.fundSharesPositions != null) {
      enrichNamesFromFundSharesPositions(top10.holdings, preloaded.fundSharesPositions, 'override')
    }
    if (top10.holdings.some(h => !(h.ratio > 0))) {
      const prev = holdingsEnrichedReady
      let resolveFill: () => void = () => {}
      holdingsEnrichedReady = new Promise<void>((r) => { resolveFill = r })
      void (async () => {
        try {
          if (prev) await prev
          const g = await loadPingzhongRaw(fundCode)
          if (g) enrichNamesFromFundSharesPositions(top10!.holdings, g, 'override')
        } catch {  }
        try {
          if (top10!.holdings.some(h => !(h.ratio > 0))) {
            const dj = await fetchDanjuanHoldings(fundCode)
            if (dj) fillRatiosByRounds(top10!.holdings, dj)
          }
        } catch {  }
        resolveFill()
      })()
    }

    for (const h of top10.holdings) {
      if (!('isEstimated' in h)) (h as EstimatedHoldingItem).isEstimated = false
    }

    const ratioReady = top10.holdings.some(h => h.ratio > 0)

    const result: EstimatedHoldings = {
      fundCode,
      quarterReportDate: top10.reportDate,
      annualReportDate: '',
      description: ratioReady ? '前十大重仓及占比' : '前十大重仓（无占比，无法加权推算）',
      holdings: top10.holdings as EstimatedHoldingItem[],
      optimizationMeta: { method: 'proportional-scaling', navDaysUsed: 0, stockCoverage: 0 },
      holdingsEnrichedReady,
    }

    if (holdingsEnrichedReady) {
      void holdingsEnrichedReady.then(() => {
        if (result.description.includes('无占比') && result.holdings.some(h => h.ratio > 0)) {
          result.description = '前十大重仓及占比'
        }
      }).catch(() => {  })
    }

    return result
  }

  return null
}

export function estimateHoldings(
  fundCode: string,
  quarter: FundAllHoldings,
  annual: FundAllHoldings,
): EstimatedHoldings {
  const qHoldings = quarter.holdings.slice(0, 10)
  const aHoldings = annual.holdings
  const qCodeSet = new Set(qHoldings.map(h => h.stockCode))
  const top10TotalRatio = qHoldings.reduce((sum, h) => sum + h.ratio, 0)
  const remainingRatio = 100 - top10TotalRatio
  const minTop10Ratio = qHoldings.length > 0
    ? qHoldings.reduce((min, h) => Math.min(min, h.ratio), Infinity)
    : 0

  const nonTop10InAnnual = aHoldings.filter(h => !qCodeSet.has(h.stockCode))
  const annualNonTop10Total = nonTop10InAnnual.reduce((sum, h) => sum + h.ratio, 0)

  const results: EstimatedHoldingItem[] = []

  for (const h of qHoldings) {
    results.push({ ...h, isEstimated: false })
  }

  if (annualNonTop10Total > 0 && remainingRatio > 0) {
    const uncapped = nonTop10InAnnual.map(h => ({
      ...h,
      estimatedRatio: (h.ratio / annualNonTop10Total) * remainingRatio,
    }))

    let cappedTotal = 0
    const cappedItems: EstimatedHoldingItem[] = []
    for (const h of uncapped) {
      const raw = Math.min(h.estimatedRatio, minTop10Ratio)
      const rounded = Math.round(raw * 100) / 100
      if (rounded <= 0) continue
      cappedTotal += rounded
      cappedItems.push({ ...h, ratio: rounded, isEstimated: true })
    }

    if (cappedTotal > remainingRatio && cappedItems.length > 0) {
      const scale = remainingRatio / cappedTotal
      for (const item of cappedItems) {
        item.ratio = Math.round(Math.min(item.ratio * scale, minTop10Ratio) * 100) / 100
        if (item.ratio > 0) results.push(item)
      }
    } else {
      results.push(...cappedItems.filter(item => item.ratio > 0))
    }
  }

  results.sort((a, b) => b.ratio - a.ratio)

  return {
    fundCode,
    quarterReportDate: quarter.reportDate,
    annualReportDate: annual.reportDate,
    description: `基于${quarter.reportType}结合${annual.reportDate.substring(0, 4)}年${annual.reportType}持仓计算，共 ${results.length} 支`,
    holdings: results,
    optimizationMeta: { method: 'proportional-scaling', navDaysUsed: 0, stockCoverage: 0 },
  }
}
