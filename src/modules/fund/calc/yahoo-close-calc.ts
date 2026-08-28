

import type { MarketTz } from '@/shared/types/common-types'
import { resolveMarketTradingDays, yahooBarToTradingDay } from '@/shared/market/trading-day'
import type { YahooChartResult } from './yahoo-types'

export interface CloseRateResult {
  rate: number | null

  date: string | null
}

export function calcCloseChangeRateByMarket(result: YahooChartResult, market: MarketTz): CloseRateResult {
  const closesRaw = result.indicators?.quote?.[0]?.close
  const ts = result.timestamp
  if (!closesRaw || closesRaw.length < 2 || !ts) return { rate: null, date: null }

  const yesterday = resolveMarketTradingDays('US').lastClosedDay

  type Pt = { ts: number; close: number; day: string }
  const pts: Pt[] = []
  for (let i = 0; i < closesRaw.length; i++) {
    const c = closesRaw[i]
    if (c == null || !Number.isFinite(c) || c <= 0) continue
    if (ts[i] == null) continue
    const day = yahooBarToTradingDay(ts[i], market)
    if (day > yesterday) continue
    pts.push({ ts: ts[i], close: c, day })
  }
  if (pts.length < 2) return { rate: null, date: null }

  pts.sort((a, b) => a.ts - b.ts)

  const byDay = new Map<string, number>()
  for (const p of pts) byDay.set(p.day, p.close)
  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))
  if (days.length < 2) return { rate: null, date: null }

  const [lastDay, lastClose] = days[days.length - 1]
  const [, prevClose] = days[days.length - 2]
  if (prevClose <= 0) return { rate: null, date: null }

  return {
    rate: Math.round((lastClose - prevClose) / prevClose * 100 * 100) / 100,
    date: lastDay,
  }
}
