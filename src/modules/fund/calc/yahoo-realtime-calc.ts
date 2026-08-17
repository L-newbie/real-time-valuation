

import type { MarketTz, USSession } from '@/shared/types/common-types'
import { resolveMarketTradingDays, yahooBarToTradingDay } from '@/shared/market/trading-day'
import { classifyUSSessionByMs, classifyUSSessionByTs } from '@/shared/market/session'
import type { YahooChartResult } from './yahoo-types'

export type RealtimeSession = 'PRE' | 'REGULAR' | 'POST'

export interface RealtimeRateResult {
  rate: number | null

  date: string | null

  session?: RealtimeSession
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

  let metaRate: number | null = null
  let session: RealtimeSession | undefined
  if (curSession === 'PRE' && m.preMarketChangePercent != null && Number.isFinite(m.preMarketChangePercent)) {
    metaRate = m.preMarketChangePercent; session = 'PRE'
  } else if (curSession === 'POST' && m.postMarketChangePercent != null && Number.isFinite(m.postMarketChangePercent)) {
    metaRate = m.postMarketChangePercent; session = 'POST'
  } else if (curSession === 'REGULAR' && m.regularMarketChangePercent != null && Number.isFinite(m.regularMarketChangePercent)) {
    metaRate = m.regularMarketChangePercent; session = 'REGULAR'
  }
  if (metaRate != null && Number.isFinite(metaRate)) {
    return { rate: Math.round(metaRate * 100) / 100, date: currentTradingDay, session }
  }

  if (curSession === 'PRE' && validPos(m.preMarketPrice) && validPos(m.regularMarketPrice)) {
    return { rate: rateFrom(m.preMarketPrice!, m.regularMarketPrice!), date: currentTradingDay, session: 'PRE' }
  }
  if (curSession === 'POST' && validPos(m.postMarketPrice) && validPos(m.regularMarketPrice)) {
    return { rate: rateFrom(m.postMarketPrice!, m.regularMarketPrice!), date: currentTradingDay, session: 'POST' }
  }
  if (curSession === 'REGULAR' && validPos(m.regularMarketPrice) && validPos(m.previousClose)) {
    return { rate: rateFrom(m.regularMarketPrice!, m.previousClose!), date: currentTradingDay, session: 'REGULAR' }
  }

  const closesRaw = result.indicators?.quote?.[0]?.close
  const ts = result.timestamp
  if (closesRaw && ts && closesRaw.length > 0) {
    const { lastClosedDay } = resolveMarketTradingDays(market)
    let postLast: { close: number; ts: number } | null = null
    let preLast: { close: number; ts: number } | null = null
    let regLast: { close: number; ts: number } | null = null
    let usedFallbackDay = false

    for (let i = 0; i < closesRaw.length; i++) {
      const c = closesRaw[i]
      if (c == null || !Number.isFinite(c) || c <= 0) continue
      if (ts[i] == null) continue
      if (yahooBarToTradingDay(ts[i], market) !== currentTradingDay) continue
      const pt = { close: c, ts: ts[i] }
      const sess = classifyUSSessionByTs(ts[i])
      if (sess === 'POST') postLast = pt
      else if (sess === 'PRE') preLast = pt
      else if (sess === 'REGULAR') regLast = pt
    }

    if (!postLast && !preLast && !regLast) {
      for (let i = 0; i < closesRaw.length; i++) {
        const c = closesRaw[i]
        if (c == null || !Number.isFinite(c) || c <= 0) continue
        if (ts[i] == null) continue
        if (yahooBarToTradingDay(ts[i], market) !== lastClosedDay) continue
        if (classifyUSSessionByTs(ts[i]) !== 'POST') continue
        postLast = { close: c, ts: ts[i] }
        usedFallbackDay = true
      }
    }

    const prevClose = m.previousClose
    const regClose = m.regularMarketPrice
    type Cand = { close: number; ts: number; base: number; sess: RealtimeSession }
    const cands: Cand[] = []
    if (postLast && validPos(regClose)) cands.push({ close: postLast.close, ts: postLast.ts, base: regClose!, sess: 'POST' })
    if (preLast && validPos(regClose)) cands.push({ close: preLast.close, ts: preLast.ts, base: regClose!, sess: 'PRE' })
    if (regLast && validPos(prevClose)) cands.push({ close: regLast.close, ts: regLast.ts, base: prevClose!, sess: 'REGULAR' })
    if (cands.length > 0) {
      const best = cands.reduce((a, b) => b.ts > a.ts ? b : a)

      const date = usedFallbackDay ? lastClosedDay : currentTradingDay
      return { rate: rateFrom(best.close, best.base), date, session: best.sess }
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
