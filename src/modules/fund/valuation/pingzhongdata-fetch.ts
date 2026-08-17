

import dayjs from 'dayjs'
import type { LsjzRow } from './lsjz-parser'
import { safeParseFloat } from '@/shared/utils/safe-math'
import { isValidFundCode } from '@/shared/utils/validation'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'

export interface LsjzRealData {
  dwjz: number

  gszzl: number

  gz: number

  jzrq: string

  recentNavs: LsjzRow[]
}

interface PingzhongTrendPoint {
  x: number

  y: number | string

  equityReturn?: number | null
}

export async function fetchPingzhongNavData(fundCode: string): Promise<LsjzRealData | null> {
  if (!isValidFundCode(fundCode)) return null

  const trend = await loadPingzhongTrend(fundCode)
  if (!trend || trend.length === 0) return null

  const valid = trend
    .filter((d) => d && typeof d.x === 'number' && Number.isFinite(Number(d.y)))
    .sort((a, b) => a.x - b.x)
  if (valid.length === 0) return null

  const latest = valid[valid.length - 1]
  const dwjz = safeParseFloat(latest.y)
  let gszzl = Number.isFinite(latest.equityReturn as number) ? safeParseFloat(latest.equityReturn) : 0

  if (gszzl === 0 && valid.length >= 2) {
    const prev = valid[valid.length - 2]
    const prevNav = safeParseFloat(prev.y)
    if (prevNav > 0) {
      gszzl = Math.round(((dwjz - prevNav) / prevNav * 100) * 100) / 100
    }
  }

  const recentNavs: LsjzRow[] = valid.slice(-10).map((d) => ({
    date: dayjs(d.x).format('YYYY-MM-DD'),
    nav: safeParseFloat(d.y),
    growth: Number.isFinite(d.equityReturn as number) ? safeParseFloat(d.equityReturn) : null,
  }))

  return {
    dwjz,
    gszzl,
    gz: dwjz,
    jzrq: dayjs(latest.x).format('YYYY-MM-DD'),
    recentNavs,
  }
}

export async function fetchPingzhongNavSeries(fundCode: string): Promise<LsjzRow[] | null> {
  if (!isValidFundCode(fundCode)) return null

  const trend = await loadPingzhongTrend(fundCode)

  if (trend == null) return null

  return trend
    .filter((d) => d && typeof d.x === 'number' && Number.isFinite(Number(d.y)))
    .sort((a, b) => a.x - b.x)
    .map((d) => ({
      date: dayjs(d.x).format('YYYY-MM-DD'),
      nav: safeParseFloat(d.y),
      growth: Number.isFinite(d.equityReturn as number) ? safeParseFloat(d.equityReturn) : null,
    }))
}

async function loadPingzhongTrend(fundCode: string): Promise<PingzhongTrendPoint[] | null> {
  const pz = await loadPingzhong(fundCode)
  const trend = pz?.Data_netWorthTrend
  return Array.isArray(trend) ? trend as PingzhongTrendPoint[] : null
}
