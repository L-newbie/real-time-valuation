

import type { IntradayPoint, FundValuation } from '@/modules/fund/fund-types'
import { INTRADAY_CONFIG } from '@/config/constants'
import { getBusinessDay, isCnTradingDay } from '@/modules/fund/valuation/cn-trading-day'
import { beijingNow } from '@/shared/utils/date-format'

const CN_MARKET_OPEN = '09:30'

export function isCnMarketOpenForIntraday(): boolean {
  if (!isCnTradingDay()) return false
  return beijingNow().format('HH:mm') >= CN_MARKET_OPEN
}

export function isTodayPoints(points: IntradayPoint[] | undefined): boolean {
  if (!points || points.length === 0) return false
  const today = getBusinessDay()
  return points.every(p => p.date === today)
}

export function keepTodayPoints(points: IntradayPoint[] | undefined): IntradayPoint[] {
  if (!points || points.length === 0) return []
  const today = getBusinessDay()
  return points.filter(p => p.date === today)
}

export function generateIntradayPoints(
  valuation: FundValuation,
  prevPoints: IntradayPoint[] = [],
): IntradayPoint[] | null {
  const today = getBusinessDay()

  const prev = keepTodayPoints(prevPoints)

  const isT2 = valuation.delayDays === 2 ||
    (valuation.delayDays == null && !!valuation.gztime && !valuation.gztime.includes(':'))

  if (isT2 && (valuation.gz > 0 || valuation.dwjz > 0)) {
    const value = valuation.gz > 0 ? valuation.gz : valuation.dwjz
    if (value > 0) {
      return generateT2FlatPoints(value, today)
    }
    return null
  }

  if (valuation.gz > 0 && valuation.gztime) {
    const timePart = valuation.gztime.includes(' ')
      ? valuation.gztime.split(' ')[1]?.substring(0, 5) ?? ''
      : ''
    if (timePart) {
      const gzDate = valuation.gztime.split(' ')[0]
      if (gzDate && gzDate !== today) return null
      const lastPoint = prev[prev.length - 1]
      if (lastPoint && lastPoint.time === timePart) {
        return [...prev.slice(0, -1), { time: timePart, value: valuation.gz, date: today }]
      }
      return [...prev, { time: timePart, value: valuation.gz, date: today }]
    }
  }
  return null
}

function generateT2FlatPoints(value: number, date: string): IntradayPoint[] {
  const now = new Date()
  const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  let endTime = '16:00'
  if (curTime >= '09:30' && curTime < '11:30') endTime = curTime
  else if (curTime >= '11:30' && curTime < '13:00') endTime = '11:30'
  else if (curTime >= '13:00' && curTime < '16:00') endTime = curTime

  const points: IntradayPoint[] = []
  const step = INTRADAY_CONFIG.INTERVAL_MINUTES
  const addSegment = (startH: number, startM: number, endH: number, endM: number) => {
    let h = startH, m = startM
    while (h < endH || (h === endH && m <= endM)) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      if (time > endTime) return
      points.push({ time, value, date })
      m += step
      if (m >= 60) { m -= 60; h++ }
    }
  }
  addSegment(9, 30, 11, 30)
  addSegment(13, 0, 16, 0)

  if (points.length < 2) {
    points.push({ time: '09:30', value, date }, { time: endTime, value, date })
  }
  return points
}
