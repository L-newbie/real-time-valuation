

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export function beijingNow(): dayjs.Dayjs {
  return dayjs().utcOffset(8)
}

export function getBeijingTodayStr(): string {
  return beijingNow().format('YYYY-MM-DD')
}

export function getNowStr(): string {
  return beijingNow().format('YYYY-MM-DD HH:mm:ss')
}

export function isCrossDay(lastUpdateDate: string): boolean {
  if (!lastUpdateDate) return false
  return lastUpdateDate !== getBeijingTodayStr()
}

export function isCacheValid(cachedAt: number, durationMs: number): boolean {
  return Date.now() - cachedAt < durationMs
}

export function formatHoldingDate(dateStr: string): string {
  if (!dateStr) return '--'
  return dateStr
}

export function formatValuationTime(valuationTime: string): string {
  if (!valuationTime) return '--'

  return valuationTime.length > 10 ? valuationTime.slice(11, 16) : valuationTime
}

export function formatValuationTimeWithSeconds(valuationTime: string): string {
  if (!valuationTime) return '--'
  if (!dayjs(valuationTime).isValid()) return valuationTime
  const hasTime = /[ T]\d{2}:\d{2}/.test(valuationTime)
  return hasTime
    ? dayjs(valuationTime).format('YYYY-MM-DD HH:mm:ss')
    : dayjs(valuationTime).format('YYYY-MM-DD')
}
