

import dayjs from 'dayjs'
import { beijingNow, getBeijingTodayStr } from '@/shared/utils/date-format'

export { getBeijingTodayStr }
import { resolveMarketTradingDays } from '@/shared/market/trading-day'

const HOLIDAYS_2024 = [
  '2024-01-01',
  '2024-02-10', '2024-02-11', '2024-02-12', '2024-02-13', '2024-02-14', '2024-02-15', '2024-02-16', '2024-02-17',
  '2024-04-04', '2024-04-05', '2024-04-06',
  '2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-05-05',
  '2024-06-08', '2024-06-09', '2024-06-10',
  '2024-09-15', '2024-09-16', '2024-09-17',
  '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06', '2024-10-07',
]

const HOLIDAYS_2025 = [
  '2025-01-01',
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
  '2025-04-04', '2025-04-05', '2025-04-06',
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
  '2025-05-31', '2025-06-01', '2025-06-02',
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
]

const HOLIDAYS_2026 = [
  '2026-01-01',
  '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
]

const ALL_HOLIDAYS = new Set([...HOLIDAYS_2024, ...HOLIDAYS_2025, ...HOLIDAYS_2026])

function isWeekend(d: dayjs.Dayjs): boolean {
  const day = d.day()
  return day === 0 || day === 6
}

function isHoliday(d: dayjs.Dayjs): boolean {
  return ALL_HOLIDAYS.has(d.format('YYYY-MM-DD'))
}

export function isCnTradingDay(date?: dayjs.Dayjs): boolean {
  const d = date ?? beijingNow()
  return !isWeekend(d) && !isHoliday(d)
}

export function getPreviousTradingDay(date?: dayjs.Dayjs): string {
  return getPreviousNTradingDay(1, date)
}

export function getNextTradingDay(date?: dayjs.Dayjs): string {
  return getNextNTradingDay(1, date)
}

export function getNextNTradingDay(n: number = 1, date?: dayjs.Dayjs): string {
  let d = date ?? beijingNow()
  let count = 0
  while (count < n) {
    d = d.add(1, 'day')
    if (isCnTradingDay(d)) count++
  }
  return d.format('YYYY-MM-DD')
}

export function getPreviousNTradingDay(n: number, date?: dayjs.Dayjs): string {
  let d = date ?? beijingNow()
  let count = 0
  while (count < n) {
    d = d.subtract(1, 'day')
    if (isCnTradingDay(d)) count++
  }
  return d.format('YYYY-MM-DD')
}

export function getTradingDayFromToday(n: number, date?: dayjs.Dayjs): string {
  let d = date ?? beijingNow()

  while (!isCnTradingDay(d)) d = d.add(1, 'day')
  if (n <= 0) return d.format('YYYY-MM-DD')
  return getNextNTradingDay(n, d)
}

export const BUSINESS_DAY_ROLLOVER_HOUR = 5

export function getBusinessDay(): string {
  let d = beijingNow().subtract(BUSINESS_DAY_ROLLOVER_HOUR, 'hour')
  while (!isCnTradingDay(d)) d = d.subtract(1, 'day')
  return d.format('YYYY-MM-DD')
}

export function getPreviousBusinessTradingDay(n: number = 1): string {
  return getPreviousNTradingDay(n, dayjs(getBusinessDay()))
}

export function getCalendarBusinessDay(): string {
  return beijingNow().subtract(BUSINESS_DAY_ROLLOVER_HOUR, 'hour').format('YYYY-MM-DD')
}

export function getPreviousCalendarTradingDay(n: number = 1): string {
  return getPreviousNTradingDay(n, dayjs(getCalendarBusinessDay()))
}

export function getBaseDay(): string {
  return resolveMarketTradingDays('US').lastClosedDay
}

export function getNowStr(): string {
  const d = beijingNow()
  return `${d.format('YYYY-MM-DD')} ${String(d.hour()).padStart(2, '0')}:${String(d.minute()).padStart(2, '0')}:${String(d.second()).padStart(2, '0')}`
}
