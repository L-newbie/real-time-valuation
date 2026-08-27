

import type { MarketTz, USSession } from '@/shared/types/common-types'
import { resolveMarketTradingDays, yahooBarToTradingDay } from '@/shared/market/trading-day'
import { classifyUSSessionByMs, classifyUSSessionByTs } from '@/shared/market/session'
import type { YahooChartResult } from './yahoo-types'

export type RealtimeSession = 'PRE' | 'REGULAR' | 'POST'

export interface RealtimeRateResult {
  rate: number | null

  date: string | null

  session?: RealtimeSession

  extPrice?: number
}

export function calcRealtimeSimple(result: YahooChartResult, market: MarketTz): RealtimeRateResult {
  const m = result.meta
  if (!m) return { rate: null, date: null }

  const td = resolveMarketTradingDays(market)
  if (td.isNonTradingDay) return { rate: null, date: null }

  if (!td.hasOpened) return { rate: null, date: null }
  const { currentTradingDay } = td
  const rate = m.regularMarketChangePercent
  if (rate != null && Number.isFinite(rate)) {
    return { rate: Math.round(rate * 100) / 100, date: currentTradingDay }
  }

  const price = m.regularMarketPrice
  const prev = m.previousClose
  if (price != null && Number.isFinite(price) && price > 0 && prev != null && Number.isFinite(prev) && prev > 0) {
    return { rate: Math.round((price - prev) / prev * 100 * 100) / 100, date: currentTradingDay }
  }
  return { rate: null, date: null }
}

export function calcRealtimeChangeRateByMarket(result: YahooChartResult, market: MarketTz): RealtimeRateResult {
  const m = result.meta
  if (!m) return { rate: null, date: null }

  const { currentTradingDay } = resolveMarketTradingDays(market)

  const state = m.marketState
  const curSession: USSession = state
    ? (state.includes('POST') ? 'POST' : state.includes('PRE') ? 'PRE' : state === 'REGULAR' ? 'REGULAR' : classifyUSSessionByMs(Date.now()))
    : classifyUSSessionByMs(Date.now())

  if (curSession === 'PRE') {
    if (m.preMarketChangePercent != null && Number.isFinite(m.preMarketChangePercent)) {
      return { rate: Math.round(m.preMarketChangePercent * 100) / 100, date: currentTradingDay, session: 'PRE', ...(validPos(m.preMarketPrice) ? { extPrice: m.preMarketPrice! } : {}) }
    }
    if (validPos(m.preMarketPrice) && validPos(m.regularMarketPrice)) {
      return { rate: rateFrom(m.preMarketPrice!, m.regularMarketPrice!), date: currentTradingDay, session: 'PRE', extPrice: m.preMarketPrice! }
    }
    return { rate: null, date: null }
  }

  if (curSession === 'POST') {
    if (m.postMarketChangePercent != null && Number.isFinite(m.postMarketChangePercent)) {
      return { rate: Math.round(m.postMarketChangePercent * 100) / 100, date: currentTradingDay, session: 'POST', ...(validPos(m.postMarketPrice) ? { extPrice: m.postMarketPrice! } : {}) }
    }
    if (validPos(m.postMarketPrice) && validPos(m.regularMarketPrice)) {
      return { rate: rateFrom(m.postMarketPrice!, m.regularMarketPrice!), date: currentTradingDay, session: 'POST', extPrice: m.postMarketPrice! }
    }
    return { rate: null, date: null }
  }

  if (curSession === 'REGULAR') {
    if (m.regularMarketChangePercent != null && Number.isFinite(m.regularMarketChangePercent)) {
      return { rate: Math.round(m.regularMarketChangePercent * 100) / 100, date: currentTradingDay, session: 'REGULAR' }
    }
    if (validPos(m.regularMarketPrice) && validPos(m.previousClose)) {
      return { rate: rateFrom(m.regularMarketPrice!, m.previousClose!), date: currentTradingDay, session: 'REGULAR' }
    }
  }

  const closesRaw = result.indicators?.quote?.[0]?.close
  const ts = result.timestamp
  if (closesRaw && ts && closesRaw.length > 0) {
    const { lastClosedDay } = resolveMarketTradingDays(market)
    let regLast: { close: number; ts: number } | null = null
    for (let i = 0; i < closesRaw.length; i++) {
      const c = closesRaw[i]
      if (c == null || !Number.isFinite(c) || c <= 0) continue
      if (ts[i] == null) continue
      if (yahooBarToTradingDay(ts[i], market) !== currentTradingDay) continue
      if (classifyUSSessionByTs(ts[i]) !== 'REGULAR') continue
      regLast = { close: c, ts: ts[i] }
    }
    if (regLast && validPos(m.previousClose)) {
      return { rate: rateFrom(regLast.close, m.previousClose!), date: currentTradingDay, session: 'REGULAR' }
    }
  }

  const regClose4 = m.regularMarketPrice
  const prevClose4 = m.previousClose
  if (validPos(regClose4) && validPos(prevClose4)) {
    return { rate: rateFrom(regClose4, prevClose4), date: resolveMarketTradingDays(market).lastClosedDay, session: undefined }
  }
  return { rate: null, date: null }
}

function validPos(v: number | undefined | null): v is number {
  return v != null && Number.isFinite(v) && v > 0
}

function rateFrom(close: number, base: number): number {
  return Math.round((close - base) / base * 100 * 100) / 100
}
