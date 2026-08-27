

import dayjs from 'dayjs'
import { fetchFundNetValueRange } from '@/modules/fund/valuation/net-value-range'
import { safeParseFloat } from '@/shared/utils/safe-math'
import { isValidFundCode } from '@/shared/utils/validation'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'

export interface PerformanceItem { title: string; value: number }
export interface AssetAllocationItem { category: string; ratio: number }
export interface TopHoldingItem { stockCode: string; stockName: string; ratio: number; changeRate?: number | null }
export interface HolderStructureItem { holderType: string; ratio: number }

export interface PeriodSeriesItem { name: string; values: number[] }
export interface PeriodSeries { categories: string[]; series: PeriodSeriesItem[] }

export interface ManagerPowerItem { label: string; value: number }
export interface FundManagerItem {
  name: string
  star: number
  workTime: string
  fundSize: string
  powerAvg: number
  power: ManagerPowerItem[]
  tenureReturn: number | null
  peerReturn: number | null
}

export interface ScalePoint { period: string; scale: number; mom: string }
export interface RankPoint { date: string; rank: number; total: number }

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

  managers: FundManagerItem[]
  assetAllocHistory: PeriodSeries | null
  holderHistory: PeriodSeries | null
  scaleHistory: ScalePoint[]
  buySedemption: PeriodSeries | null
  positionTrend: [number, number][]
  peerRankTrend: RankPoint[]
}

interface NetWorthPoint { x: number; y: number | string }

const FUND_TYPE_MAP: Record<string, string> = {
  '001': '股票型', '002': '混合型', '003': '债券型',
  '004': '指数型', '005': 'QDII', '006': 'FOF', '007': '货币型',
}

function parsePeriodSeries(raw: unknown): PeriodSeries | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as { categories?: unknown; series?: unknown }
  const categories = Array.isArray(obj.categories) ? obj.categories.map(c => String(c ?? '')) : []
  if (!Array.isArray(obj.series) || obj.series.length === 0) return null

  const series: PeriodSeriesItem[] = []
  for (const s of obj.series as Array<Record<string, unknown>>) {
    const name = typeof s?.name === 'string' ? s.name : ''
    if (!name || !Array.isArray(s?.data)) continue
    const values = (s.data as unknown[]).map(v => safeParseFloat(v))
    if (values.some(v => Number.isFinite(v))) series.push({ name, values })
  }
  if (series.length === 0) return null
  return { categories, series }
}

function latestOfSeries(ps: PeriodSeries | null): { name: string; value: number }[] {
  if (!ps) return []
  const out: { name: string; value: number }[] = []
  for (const s of ps.series) {
    const idx = s.values.length - 1
    if (idx < 0) continue
    const value = s.values[idx]
    if (Number.isFinite(value)) out.push({ name: s.name, value })
  }
  return out
}

function parseScaleHistory(raw: unknown): ScalePoint[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const obj = raw as { categories?: unknown; series?: unknown }
  if (!Array.isArray(obj.series)) return []
  const categories = Array.isArray(obj.categories) ? obj.categories.map(c => String(c ?? '')) : []
  const out: ScalePoint[] = []
  ;(obj.series as Array<Record<string, unknown>>).forEach((item, i) => {
    const scale = safeParseFloat(item?.y)
    if (!Number.isFinite(scale)) return
    out.push({ period: categories[i] ?? '', scale, mom: typeof item?.mom === 'string' ? item.mom : '' })
  })
  return out
}

function parseManagers(raw: unknown): FundManagerItem[] {
  if (!Array.isArray(raw)) return []
  const out: FundManagerItem[] = []
  for (const m of raw as Array<Record<string, any>>) {
    const name = typeof m?.name === 'string' ? m.name : ''
    if (!name) continue

    const power: ManagerPowerItem[] = []
    const pw = m?.power
    if (pw && Array.isArray(pw.categories) && Array.isArray(pw.data)) {
      pw.categories.forEach((label: unknown, i: number) => {
        const value = safeParseFloat(pw.data[i])
        if (label && Number.isFinite(value)) power.push({ label: String(label), value })
      })
    }

    let tenureReturn: number | null = null
    let peerReturn: number | null = null
    const bars = m?.profit?.series?.[0]?.data
    if (Array.isArray(bars)) {
      const a = safeParseFloat(bars[0]?.y)
      const b = safeParseFloat(bars[1]?.y)
      if (Number.isFinite(a)) tenureReturn = a
      if (Number.isFinite(b)) peerReturn = b
    }

    out.push({
      name,
      star: Math.max(0, Math.min(5, Math.round(safeParseFloat(m?.star)) || 0)),
      workTime: typeof m?.workTime === 'string' ? m.workTime : '',
      fundSize: typeof m?.fundSize === 'string' ? m.fundSize : '',
      powerAvg: safeParseFloat(pw?.avr),
      power,
      tenureReturn,
      peerReturn,
    })
  }
  return out
}

function parsePositionTrend(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return []
  const out: [number, number][] = []
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue
    const t = safeParseFloat(p[0])
    const v = safeParseFloat(p[1])
    if (Number.isFinite(t) && Number.isFinite(v) && t > 0) out.push([t, v])
  }
  return out
}

function parsePeerRankTrend(raw: unknown): RankPoint[] {
  if (!Array.isArray(raw)) return []
  const out: RankPoint[] = []
  for (const p of raw as Array<Record<string, unknown>>) {
    const rank = safeParseFloat(p?.y)
    const total = safeParseFloat(p?.sc)
    const x = safeParseFloat(p?.x)
    if (!Number.isFinite(rank) || rank <= 0) continue
    out.push({
      date: Number.isFinite(x) && x > 0 ? dayjs(x).format('YYYY-MM-DD') : '',
      rank,
      total: Number.isFinite(total) ? total : 0,
    })
  }
  return out
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
      fundManager: '--',
      fundScale: '--',
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
      managers: [],
      assetAllocHistory: null,
      holderHistory: null,
      scaleHistory: [],
      buySedemption: null,
      positionTrend: [],
      peerRankTrend: [],
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

    const assetAllocHistory = parsePeriodSeries(w.Data_assetAllocation)
    const holderHistory = parsePeriodSeries(w.Data_holderStructure)
    const buySedemption = parsePeriodSeries(w.Data_buySedemption)
    const scaleHistory = parseScaleHistory(w.Data_fluctuationScale)
    const managers = parseManagers(w.Data_currentFundManager)
    const positionTrend = parsePositionTrend(w.Data_fundSharesPositions)
    const peerRankTrend = parsePeerRankTrend(w.Data_rateInSimilarType)

    partial.assetAllocHistory = assetAllocHistory
    partial.holderHistory = holderHistory
    partial.buySedemption = buySedemption
    partial.scaleHistory = scaleHistory
    partial.managers = managers
    partial.positionTrend = positionTrend
    partial.peerRankTrend = peerRankTrend

    partial.assetAllocation = latestOfSeries(assetAllocHistory)
      .filter(a => !a.name.includes('净资产') && a.value > 0)
      .map(a => ({ category: a.name.replace(/占净比$/, ''), ratio: a.value }))

    partial.holderStructure = latestOfSeries(holderHistory)
      .filter(h => h.value > 0)
      .map(h => ({ holderType: h.name.replace(/持有比例$/, ''), ratio: h.value }))

    if (managers.length > 0) partial.fundManager = managers.map(m => m.name).join('、')

    if (scaleHistory.length > 0) {
      const latest = scaleHistory[scaleHistory.length - 1]
      partial.fundScale = `${latest.scale.toFixed(2)}亿`
    }

    if (peerRankTrend.length > 0) {
      const latest = peerRankTrend[peerRankTrend.length - 1]
      partial.peerRanking = latest.total > 0 ? `${latest.rank}/${latest.total}` : String(latest.rank)
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
