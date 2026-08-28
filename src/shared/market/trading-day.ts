

import type { MarketTz } from '@/shared/types/common-types'

const MARKET_CLOSE_LOCAL: Record<MarketTz, string> = {
  A: '15:00', HK: '16:00', US: '16:00',
  JP: '15:00', KR: '15:30', TW: '13:30',
  DE: '17:30', FR: '17:30', UK: '16:30',
  unknown: '16:00',
}

const MARKET_OPEN_LOCAL: Record<MarketTz, string> = {
  A: '09:30', HK: '09:30', US: '09:30',
  JP: '09:00', KR: '09:00', TW: '09:00',
  DE: '09:00', FR: '09:00', UK: '08:00',
  unknown: '09:30',
}

function isDST(year: number, month1: number, dom: number, dow: number): boolean {
  const marchSecondSunday = secondSunday(year, 3)
  const novFirstSunday = firstSunday(year, 11)
  const cur = month1 * 100 + dom
  const start = 3 * 100 + marchSecondSunday
  const end = 11 * 100 + novFirstSunday
  return cur >= start && cur < end
  void dow
}

function secondSunday(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month - 1, 1))
  const dow = d.getUTCDay()
  const offset = (7 - dow) % 7
  return 1 + offset + 7
}
function firstSunday(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month - 1, 1))
  const dow = d.getUTCDay()
  const offset = (7 - dow) % 7
  return 1 + offset
}

function marketUtcOffsetMin(market: MarketTz, nowMs: number): number {
  const d = new Date(nowMs)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  const dom = d.getUTCDate()
  const dow = d.getUTCDay()
  const dst = isDST(year, month, dom, dow)
  switch (market) {
    case 'A': case 'HK': case 'TW': return 8 * 60
    case 'JP': case 'KR': return 9 * 60
    case 'US': return dst ? -4 * 60 : -5 * 60
    case 'DE': case 'FR': return dst ? 2 * 60 : 1 * 60
    case 'UK': return dst ? 1 * 60 : 0
    default: return 8 * 60
  }
}

function toMarketLocal(market: MarketTz, nowMs: number): { y: number; mo: number; d: number; hh: number; mm: number; dow: number } {
  const offsetMin = marketUtcOffsetMin(market, nowMs)
  const localMs = nowMs + offsetMin * 60000
  const dt = new Date(localMs)
  return {
    y: dt.getUTCFullYear(),
    mo: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
    hh: dt.getUTCHours(),
    mm: dt.getUTCMinutes(),
    dow: dt.getUTCDay(),
  }
}

function isWeekendDow(dow: number): boolean {
  return dow === 0 || dow === 6
}

const tradingDaysMemo = new Map<string, MarketTradingDays>()

const marketHolidays: Record<MarketTz, Set<string>> = {
  A: new Set(), HK: new Set(), US: new Set(),
  JP: new Set(), KR: new Set(), TW: new Set(),
  DE: new Set(), FR: new Set(), UK: new Set(),
  unknown: new Set(),
}

export function setMarketHolidays(market: MarketTz, dates: string[]): void {
  marketHolidays[market] = new Set(dates)
  tradingDaysMemo.clear()
}

function isMarketHoliday(market: MarketTz, dateStr: string): boolean {
  return marketHolidays[market]?.has(dateStr) ?? false
}

function fmtDate(y: number, mo: number, d: number): string {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export interface MarketTradingDays {
  todayTradingDay: string

  lastClosedDay: string

  isClosed: boolean

  currentTradingDay: string

  previousClosedDay: string

  isNonTradingDay: boolean

  hasOpened: boolean
}

export function resolveMarketTradingDays(market: MarketTz, nowMs: number = Date.now()): MarketTradingDays {
  const bucket = Math.floor(nowMs / 60000)
  const key = `${market}|${bucket}`
  const hit = tradingDaysMemo.get(key)
  if (hit) return hit

  const computed = computeMarketTradingDays(market, nowMs)
  if (tradingDaysMemo.size > 64) tradingDaysMemo.clear()
  tradingDaysMemo.set(key, computed)
  return computed
}

function computeMarketTradingDays(market: MarketTz, nowMs: number): MarketTradingDays {
  const local = toMarketLocal(market, nowMs)
  const closeStr = MARKET_CLOSE_LOCAL[market] || '16:00'
  const [closeH, closeM] = closeStr.split(':').map(Number)
  const openStr = MARKET_OPEN_LOCAL[market] || '09:30'
  const [openH, openM] = openStr.split(':').map(Number)
  const nowMinutes = local.hh * 60 + local.mm
  const closedToday = nowMinutes >= closeH * 60 + closeM
  const openedToday = nowMinutes >= openH * 60 + openM
  const todayDateStr = fmtDate(local.y, local.mo, local.d)
  const todayIsTradingDay = !isWeekendDow(local.dow) && !isMarketHoliday(market, todayDateStr)

  if (todayIsTradingDay) {
    if (closedToday) {
      return {
        currentTradingDay: todayDateStr,
        todayTradingDay: todayDateStr,
        lastClosedDay: todayDateStr,
        previousClosedDay: previousTradingDayFrom(local.y, local.mo, local.d, market),
        isClosed: true,
        isNonTradingDay: false,
        hasOpened: true,
      }
    }
    const prev = previousTradingDayFrom(local.y, local.mo, local.d, market)
    return {
      currentTradingDay: todayDateStr,
      todayTradingDay: todayDateStr,
      lastClosedDay: prev,
      previousClosedDay: prev,
      isClosed: false,
      isNonTradingDay: false,
      hasOpened: openedToday,
    }
  }

  const lastClosed = previousTradingDayFrom(local.y, local.mo, local.d, market)
  const nextTd = nextTradingDayFrom(local.y, local.mo, local.d, market)
  return {
    currentTradingDay: lastClosed,
    todayTradingDay: nextTd,
    lastClosedDay: lastClosed,
    previousClosedDay: lastClosed,
    isClosed: true,
    isNonTradingDay: true,
    hasOpened: false,
  }
}

function previousTradingDayFrom(y: number, mo: number, d: number, market: MarketTz): string {
  let dt = new Date(Date.UTC(y, mo - 1, d))
  for (let i = 0; i < 10; i++) {
    dt = new Date(dt.getTime() - 86400000)
    const ds = fmtDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
    if (!isWeekendDow(dt.getUTCDay()) && !isMarketHoliday(market, ds)) {
      return ds
    }
  }
  return fmtDate(y, mo, d)
}

function nextTradingDayFrom(y: number, mo: number, d: number, market: MarketTz): string {
  let dt = new Date(Date.UTC(y, mo - 1, d))
  for (let i = 0; i < 10; i++) {
    dt = new Date(dt.getTime() + 86400000)
    const ds = fmtDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
    if (!isWeekendDow(dt.getUTCDay()) && !isMarketHoliday(market, ds)) {
      return ds
    }
  }
  return fmtDate(y, mo, d)
}

export function yahooBarToTradingDay(tsSec: number, market: MarketTz): string {
  const ms = tsSec * 1000
  const local = toMarketLocal(market, ms)
  return fmtDate(local.y, local.mo, local.d)
}

export function classifyUSSessionByMs(ms: number): import('@/shared/types/common-types').USSession {
  const { hh, mm } = toMarketLocal('US', ms)
  const mins = hh * 60 + mm
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'PRE'
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return 'REGULAR'
  if (mins >= 16 * 60 && mins < 20 * 60) return 'POST'
  return 'OFF'
}

export function classifyUSSessionByTs(tsSec: number): import('@/shared/types/common-types').USSession {
  return classifyUSSessionByMs(tsSec * 1000)
}

export function isMarketLive(market: MarketTz, nowMs: number = Date.now()): boolean {
  if (market === 'unknown') return false
  if (market === 'US') return classifyUSSessionByMs(nowMs) !== 'OFF'
  const td = resolveMarketTradingDays(market, nowMs)
  return !td.isNonTradingDay && !td.isClosed && td.hasOpened
}
