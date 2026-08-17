

import type { StockMarket, StockQuoteInfo } from '@/shared/types/common-types'
import { resolveMarketTradingDays } from '@/shared/market/trading-day'
import { stockMarketToTz } from '@/shared/market/market-classify'

export function calcRealtimeRate(price: number, prevClose: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(prevClose) || prevClose <= 0) return null
  return Math.round((price - prevClose) / prevClose * 100 * 100) / 100
}

export function buildRealtimeQuote(
  code: string,
  market: StockMarket,
  rate: number | null,
  source: string,
): StockQuoteInfo {
  const tz = stockMarketToTz(market)
  const td = resolveMarketTradingDays(tz)

  if (td.isNonTradingDay) {
    return { changeRate: null, date: null, market, source: null, closed: true, updatedAt: Date.now() }
  }

  if (!td.hasOpened) {
    return { changeRate: null, date: null, market, source: null, closed: true, updatedAt: Date.now() }
  }
  return {
    changeRate: rate,
    date: rate != null ? td.currentTradingDay : null,
    market,
    source: rate != null ? source : null,
    updatedAt: Date.now(),
  }
}
