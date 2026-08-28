

import type { StockMarket } from '@/shared/types/common-types'
import { resolveMarketTradingDays } from '@/shared/market/trading-day'
import { stockMarketToTz } from '@/shared/market/market-classify'

export type PrevDayResult =
  | { changeRate: number; date: string; realtimeRate: number | null }
  | { closed: true }
  | null

export function calcPrevDayFromKlines(klines: string[], market: StockMarket): PrevDayResult {
  if (!klines || klines.length < 2) return null

  const parsed: { date: string; close: number }[] = []
  for (const line of klines) {
    const parts = line.split(',')
    if (parts.length < 5) continue
    const date = parts[0].trim()
    const close = parseFloat(parts[2])
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(close) || close <= 0) continue
    parsed.push({ date, close })
  }
  if (parsed.length < 2) return null

  const tz = stockMarketToTz(market)

  const { currentTradingDay: today } = resolveMarketTradingDays(tz)

  const yesterday = resolveMarketTradingDays('US').lastClosedDay

  let yesterdayIdx = -1
  for (let i = parsed.length - 1; i >= 0; i--) {
    if (parsed[i].date === yesterday) { yesterdayIdx = i; break }
  }

  if (yesterdayIdx < 0) return { closed: true }

  let prevIdx = -1
  for (let i = yesterdayIdx - 1; i >= 0; i--) {
    if (parsed[i].close > 0) { prevIdx = i; break }
  }
  if (prevIdx < 0) return null

  const yesterdayBar = parsed[yesterdayIdx]
  const prevDay = parsed[prevIdx]
  if (prevDay.close <= 0) return null
  const changeRate = Math.round((yesterdayBar.close - prevDay.close) / prevDay.close * 100 * 100) / 100

  let realtimeRate: number | null = null
  const lastBar = parsed[parsed.length - 1]
  if (lastBar.date === today && yesterdayBar.close > 0) {
    realtimeRate = Math.round((lastBar.close - yesterdayBar.close) / yesterdayBar.close * 100 * 100) / 100
  }

  return { changeRate, date: yesterdayBar.date, realtimeRate }
}
