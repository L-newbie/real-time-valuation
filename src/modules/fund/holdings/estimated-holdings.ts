

import type {EstimatedHoldings, EstimatedHoldingItem, FundAllHoldings} from '@/modules/fund/fund-types'
import type { StockQuoteInfo } from '@/shared/types/common-types'
import { isValidFundCode } from '@/shared/utils/validation'
import { fetchTop10FromMobileApi } from './f10-mobile-fetch'
import { fetchTop10FromPingzhong, enrichMarketCodeFromPingzhong, enrichNamesFromFundSharesPositions, loadPingzhongHoldings, type PingzhongPreloaded } from './pingzhong-holdings-fetch'
import { fetchDanjuanHoldings, fetchDanjuanRatios } from './danjuan-holdings-fetch'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'

export type FetchStockQuotes = (
  entries: { stockCode: string; emMarketCode?: string; stockName?: string }[],
  mode: 'close' | 'realtime',
) => Promise<Map<string, StockQuoteInfo>>

const noopFetchStockQuotes: FetchStockQuotes = async () => new Map()

type HoldingsSource = 'danjuan' | 'mobile' | 'pingzhong'

async function loadPingzhongRaw(fundCode: string): Promise<unknown> {
  const g = await loadPingzhong(fundCode)
  return g?.Data_fundSharesPositions ?? null
}

function fillRatiosFromMap(holdings: FundAllHoldings['holdings'], ratios: Map<string, number>): boolean {
  let changed = false
  for (const h of holdings) {
    if (h.ratio > 0) continue
    const key = h.stockCode.toUpperCase()
    let r = ratios.get(key)
    if (r == null && /^\d+$/.test(key)) r = ratios.get(String(parseInt(key, 10)))
    if (r != null && r > 0) { h.ratio = r; changed = true }
  }
  return changed
}

async function fetchTop10FromDanjuan(fundCode: string): Promise<FundAllHoldings | null> {
  const holdings = await fetchDanjuanHoldings(fundCode)
  if (!holdings || holdings.length === 0) return null
  if (!holdings.some(h => h.ratio > 0)) return null
  return { reportDate: '', reportType: '季报', isFull: false, holdings: holdings.slice(0, 10) }
}

export async function fetchEstimatedHoldings(
  fundCode: string,
  year?: string,
  fetchStockQuotes: FetchStockQuotes = noopFetchStockQuotes,
  preloaded?: PingzhongPreloaded,
): Promise<EstimatedHoldings | null> {
  if (!isValidFundCode(fundCode)) return null

  let source: HoldingsSource = 'danjuan'
  let top10: FundAllHoldings | null = await fetchTop10FromDanjuan(fundCode)
  if (!top10 || top10.holdings.length === 0) {
    source = 'mobile'
    top10 = await fetchTop10FromMobileApi(fundCode)
  }
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
    if (!top10.holdings.some(h => h.ratio > 0)) {
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
          if (source !== 'danjuan' && !top10!.holdings.some(h => h.ratio > 0)) {
            const ratios = await fetchDanjuanRatios(fundCode)
            if (ratios) fillRatiosFromMap(top10!.holdings, ratios)
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
