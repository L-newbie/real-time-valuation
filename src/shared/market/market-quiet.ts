import type { MarketTz } from '@/shared/types/common-types'
import { resolveMarketTradingDays } from './trading-day'

const TRACKED_MARKETS: MarketTz[] = ['A', 'HK', 'US', 'JP', 'KR', 'TW', 'DE', 'FR', 'UK']

export function isMarketQuiet(market: MarketTz, nowMs: number = Date.now()): boolean {
  const td = resolveMarketTradingDays(market, nowMs)
  return td.isClosed || !td.hasOpened
}

export function marketQuietKey(nowMs: number = Date.now()): string {
  const parts: string[] = []
  for (const market of TRACKED_MARKETS) {
    const td = resolveMarketTradingDays(market, nowMs)
    if (!td.isClosed && td.hasOpened) return ''
    parts.push(`${market}:${td.lastClosedDay}`)
  }
  return parts.join('|')
}

export function cnQuietKey(nowMs: number = Date.now()): string {
  const td = resolveMarketTradingDays('A', nowMs)
  if (!td.isClosed && td.hasOpened) return ''
  return `A:${td.lastClosedDay}`
}
