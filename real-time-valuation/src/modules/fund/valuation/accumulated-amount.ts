

import dayjs from 'dayjs'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'
import {roundMoney} from '@/shared/utils/safe-math'
import { isValidFundCode } from '@/shared/utils/validation'

interface NetWorthPoint {
  x: number

  y: number | string
}

export interface AccumulatedAmountResult {
  amount: number

  lastConfirmedDate: string
}

export async function computeAccumulatedAmountFromRatesWithDate(
  fundCode: string,
  holdingDate: string,
  initialAmount: number,
): Promise<AccumulatedAmountResult> {
  if (initialAmount <= 0) return { amount: initialAmount, lastConfirmedDate: '' }
  if (!isValidFundCode(fundCode)) return { amount: initialAmount, lastConfirmedDate: '' }

  try {
    const pz = await loadPingzhong(fundCode)
    const data = pz?.Data_netWorthTrend as NetWorthPoint[] | undefined
    if (!Array.isArray(data) || data.length < 2) return { amount: initialAmount, lastConfirmedDate: '' }

    const navSeries = data
      .filter((d) => d && typeof d.x === 'number' && Number.isFinite(Number(d.y)))
      .map((d) => ({ date: dayjs(d.x).format('YYYY-MM-DD'), value: Number(d.y) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    if (navSeries.length < 2) return { amount: initialAmount, lastConfirmedDate: '' }

    const holdingDateOnly = holdingDate.slice(0, 10)

    const startIdx = navSeries.findIndex((d) => d.date >= holdingDateOnly)
    if (startIdx < 0) return { amount: initialAmount, lastConfirmedDate: navSeries[navSeries.length - 1].date }

    let amount = initialAmount
    for (let i = startIdx + 1; i < navSeries.length; i++) {
      const prev = navSeries[i - 1].value
      const curr = navSeries[i].value
      if (prev <= 0) continue
      const rate = (curr / prev - 1) * 100
      amount = amount * (1 + rate / 100)
    }

    const lastConfirmedDate = navSeries[navSeries.length - 1].date
    return { amount: roundMoney(amount), lastConfirmedDate }
  } catch {
    return { amount: initialAmount, lastConfirmedDate: '' }
  }
}

export async function computeAccumulatedAmountFromRates(
  fundCode: string,
  holdingDate: string,
  initialAmount: number,
): Promise<number> {
  const r = await computeAccumulatedAmountFromRatesWithDate(fundCode, holdingDate, initialAmount)
  return r.amount
}
