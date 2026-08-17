

import dayjs from 'dayjs'
import { fetchFundNetValueRange } from '@/modules/fund/valuation/net-value-range'
import { safeParseFloat } from '@/shared/utils/safe-math'
import { isValidFundCode } from '@/shared/utils/validation'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'

export interface PerformanceItem { title: string; value: number }
export interface AssetAllocationItem { category: string; ratio: number }
export interface TopHoldingItem { stockCode: string; stockName: string; ratio: number; changeRate?: number | null }
export interface HolderStructureItem { holderType: string; ratio: number }

export interface FundFullInfo {
  fundCode: string
  fundName: string
  fundType: string
  establishDate: string
  fundScale: string
  fundManager: string
  dayGrowthDate: string | null
  performanceItems: PerformanceItem[]
  purchaseStatus: string
  redeemStatus: string
  purchaseRate: string
  minPurchase: string
  assetAllocation: AssetAllocationItem[]
  topHoldings: TopHoldingItem[]
  holderStructure: HolderStructureItem[]
  peerRanking: string
}

interface NetWorthPoint { x: number; y: number | string }

const FUND_TYPE_MAP: Record<string, string> = {
  '001': '股票型', '002': '混合型', '003': '债券型',
  '004': '指数型', '005': 'QDII', '006': 'FOF', '007': '货币型',
}

export async function getFundFullData(fundCode: string): Promise<{
  history: { date: string; value: number }[]
  info: FundFullInfo | null

  pingzhongRaw?: { stockCodesNew?: unknown; fundSharesPositions?: unknown[] }
}> {
  if (!isValidFundCode(fundCode)) return { history: [], info: null }

  const result = await loadPingzhongdataAll(fundCode)

  let history: { date: string; value: number }[] = []
  if (result?.netWorthData && Array.isArray(result.netWorthData)) {
    history = result.netWorthData
      .filter((d) => d && typeof d.x === 'number' && Number.isFinite(Number(d.y)))
      .sort((a, b) => a.x - b.x)
      .map((d) => ({ date: dayjs(d.x).format('YYYY-MM-DD'), value: safeParseFloat(d.y) }))
  }

  if (history.length === 0) {
    try {
      const edate = dayjs().format('YYYY-MM-DD')
      const sdate = dayjs().subtract(3, 'year').format('YYYY-MM-DD')
      const lsjzRows = await fetchFundNetValueRange(fundCode, sdate, edate)
      history = (lsjzRows ?? []).map((row) => ({ date: row.date, value: row.nav }))
    } catch {  }
  }

  let info: FundFullInfo | null = null
  if (result?.windowData) {
    const w = result.windowData
    const partial: Partial<FundFullInfo> = {
      fundCode,
      fundName: w.fS_name ?? '',
      fundType: w.fS_type ? (FUND_TYPE_MAP[String(w.fS_type)] || String(w.fS_type)) : '',
      fundManager: Array.isArray(w.Data_currentFundManager) && w.Data_currentFundManager.length > 0
        ? (w.Data_currentFundManager[0]?.name ?? '--') : '--',
      fundScale: Array.isArray(w.Data_fluctuationScale) && w.Data_fluctuationScale.length > 0
        ? (w.Data_fluctuationScale[w.Data_fluctuationScale.length - 1]?.money
           ?? w.Data_fluctuationScale[w.Data_fluctuationScale.length - 1]?.assetMoney ?? '--') : '--',
      establishDate: history.length > 0 ? history[0].date : '',
      dayGrowthDate: history.length > 0 ? history[history.length - 1].date : null,
      performanceItems: [],
      purchaseStatus: w.fS_purchaseStatus ?? '',
      redeemStatus: w.fS_redeemStatus ?? '',
      purchaseRate: w.fund_Rate ? String(w.fund_Rate) : '',
      minPurchase: w.fund_minsg ? String(w.fund_minsg) : '',
      assetAllocation: [],
      topHoldings: [],
      holderStructure: [],
      peerRanking: '',
    }

    const calcGrowth = (days: number): number | null => {
      if (history.length < 2) return null
      const latest = history[history.length - 1]
      const target = dayjs(latest.date).subtract(days, 'day')
      let closest = history[0]
      let minDist = Infinity
      for (const d of history) {
        if (d.date === latest.date) continue
        const dist = Math.abs(dayjs(d.date).diff(target, 'day'))
        if (dist < minDist) { minDist = dist; closest = d }
      }
      return closest && closest.value > 0 ? safeParseFloat((latest.value - closest.value) / closest.value * 100) : null
    }
    const periods: { title: string; sylKey?: string; days: number }[] = [
      { title: '近1周', days: 7 },
      { title: '近1月', sylKey: 'syl_1y', days: 30 },
      { title: '近3月', sylKey: 'syl_3y', days: 90 },
      { title: '近6月', sylKey: 'syl_6y', days: 180 },
      { title: '近1年', sylKey: 'syl_1n', days: 365 },
    ]
    for (const p of periods) {
      let val: number | null = null
      if (p.sylKey && w[p.sylKey] != null) val = safeParseFloat(w[p.sylKey])
      if (val == null || !Number.isFinite(val)) val = calcGrowth(p.days)
      if (val != null && Number.isFinite(val)) partial.performanceItems!.push({ title: p.title, value: val })
    }

    if (Array.isArray(w.Data_assetAllocation) && w.Data_assetAllocation.length > 0) {
      const latest = w.Data_assetAllocation[w.Data_assetAllocation.length - 1]
      if (latest?.assetAllocationList) {
        partial.assetAllocation = latest.assetAllocationList
          .filter((a: any) => a.name && a.ratio)
          .map((a: any) => ({ category: a.name, ratio: safeParseFloat(a.ratio) }))
      }
    }

    if (Array.isArray(w.Data_fundSharesPositions) && w.Data_fundSharesPositions.length > 0) {
      const latest = w.Data_fundSharesPositions[w.Data_fundSharesPositions.length - 1]
      if (latest?.fundSharesPositionsList) {
        partial.topHoldings = latest.fundSharesPositionsList
          .slice(0, 10)
          .filter((s: any) => s.name && s.ratio)
          .map((s: any) => ({ stockCode: s.code ?? '', stockName: s.name, ratio: safeParseFloat(s.ratio) }))
      }
    }

    if (Array.isArray(w.Data_holderStructure) && w.Data_holderStructure.length > 0) {
      const latest = w.Data_holderStructure[w.Data_holderStructure.length - 1]
      if (latest?.holderStructureList) {
        partial.holderStructure = latest.holderStructureList
          .filter((h: any) => h.name && h.ratio)
          .map((h: any) => ({ holderType: h.name, ratio: safeParseFloat(h.ratio) }))
      }
    }

    if (Array.isArray(w.Data_rateInSimilarType) && w.Data_rateInSimilarType.length > 0) {
      const latest = w.Data_rateInSimilarType[w.Data_rateInSimilarType.length - 1]
      if (latest) {
        const rankStr = String(latest.rank ?? latest.syl ?? '')
        const parts = rankStr.split('|')
        partial.peerRanking = parts.length === 2 ? `${parts[0]}/${parts[1]}` : rankStr || '--'
      }
    }

    info = partial as FundFullInfo
  }

  const pingzhongRaw = result?.windowData
    ? {
        stockCodesNew: result.windowData.stockCodesNew,
        fundSharesPositions: result.windowData.Data_fundSharesPositions,
      }
    : undefined

  return { history, info, pingzhongRaw }
}

async function loadPingzhongdataAll(fundCode: string): Promise<{
  netWorthData: NetWorthPoint[] | null
  windowData: Record<string, any> | null
} | null> {
  const pz = await loadPingzhong(fundCode)
  if (!pz) return null
  return {
    netWorthData: Array.isArray(pz.Data_netWorthTrend) ? pz.Data_netWorthTrend as NetWorthPoint[] : null,
    windowData: pz as unknown as Record<string, any>,
  }
}
