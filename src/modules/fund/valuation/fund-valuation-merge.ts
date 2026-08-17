

import type { FundValuation } from '@/modules/fund/fund-types'
import { FUND_VALUATION_CONFIG } from '@/config/constants'
import { isValidFundCode } from '@/shared/utils/validation'
import { fetchFundgz, fetchPrevNav, type PrevNavInfo } from './fundgz-fetch'
import { fetchLsjzRealData, type LsjzRealData } from './lsjz-fetch'
import { detectDelayDays } from './fund-type'
import { getPreviousNTradingDay, getBusinessDay, getPreviousCalendarTradingDay } from './cn-trading-day'
import type { FundTypeAndName } from '@/modules/fund/catalog/fund-code-catalog'
import { fetchValuationBatch } from './valuation-batch-fetch'

export type FundTypeResolver = (fundCode: string) => Promise<FundTypeAndName>

export async function getFundValuation(
  fundCode: string,
  getFundType: FundTypeResolver,
  preGz?: FundValuation | null,
): Promise<FundValuation | null> {
  if (!isValidFundCode(fundCode)) return null

  // 新接口 FundValuationLast 只提供今日实时估值（GSZ/GSZZL/GZTIME），
  // 不含昨日净值。命中批量时仍单独走 sina 取 pre_nav/pre_date —— 那是
  // 「前一日净值」的权威来源，不能用今日净值顶替。
  const [gzFetched, prevNav, lsjzResult, typeAndName] = await Promise.all([
    preGz !== undefined ? Promise.resolve(preGz) : fetchFundgz(fundCode),
    preGz != null ? fetchPrevNav(fundCode).catch(() => null) : Promise.resolve(null),
    fetchLsjzRealData(fundCode),
    getFundType(fundCode),
  ])
  const gzResult = gzFetched

  if (!gzResult && !lsjzResult) return null

  const fundName = gzResult?.name || typeAndName.fundName || ''
  const delayDays = detectDelayDays(typeAndName.fundType)

  const result: FundValuation = gzResult
    ? { ...gzResult, dwjz: gzResult.dwjz > 0 ? gzResult.dwjz : (lsjzResult?.dwjz ?? 0), isEstimated: true }
    : {
        fundcode: fundCode,
        name: `基金(${fundCode})`,
        gztime: '',
        gz: 0,
        dwjz: lsjzResult ? lsjzResult.dwjz : 0,
        gszzl: 0,
        jzrq: lsjzResult?.jzrq ?? '',
        isEstimated: true,
      }
  result.delayDays = delayDays

  if ((!result.name || result.name === `基金(${fundCode})`) && fundName) {
    result.name = fundName
  }

  fillPrevConfirmedNav(result, lsjzResult, delayDays, prevNav)

  if (lsjzResult) {
    mergeLsjzConfirmation(result, lsjzResult, delayDays)
  }

  return result
}

function fillPrevConfirmedNav(
  result: FundValuation,
  lsjzResult: LsjzRealData | null,
  delayDays: 1 | 2,
  prevNav?: PrevNavInfo | null,
): void {
  const cutoffDate = getPreviousNTradingDay(delayDays)

  // 优先按净值序列定位：它同时提供净值与当日涨跌幅，两者同源不会错配。
  if (lsjzResult?.recentNavs?.length) {
    const recent = lsjzResult.recentNavs

    let idx = -1
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].date <= cutoffDate) { idx = i; break }
    }
    if (idx >= 0 && recent[idx].nav > 0) {
      result.prevConfirmedNav = recent[idx].nav

      if (Number.isFinite(recent[idx].growth)) {
        result.prevConfirmedGszzl = recent[idx].growth ?? 0
      } else if (idx >= 1 && recent[idx - 1].nav > 0) {
        result.prevConfirmedGszzl = Math.round(((recent[idx].nav - recent[idx - 1].nav) / recent[idx - 1].nav * 100) * 100) / 100
      } else {
        result.prevConfirmedGszzl = 0
      }
      return
    }
  }

  // 净值序列不可用时，退到 sina 的 pre_nav/pre_date（语义即前一日净值）。
  // sina 不提供该日涨跌幅，故涨跌留空而不是填 0 —— 填 0 会被显示成 0.00%，
  // 让人误以为当天真的没涨没跌。
  if (prevNav && prevNav.dwjz > 0 && prevNav.jzrq && prevNav.jzrq <= cutoffDate) {
    result.prevConfirmedNav = prevNav.dwjz
    result.prevConfirmedGszzl = undefined
    return
  }

  result.prevConfirmedNav = undefined
  result.prevConfirmedGszzl = undefined
}

function mergeLsjzConfirmation(
  result: FundValuation,
  lsjzResult: LsjzRealData,
  delayDays: 1 | 2,
): void {
  if (delayDays === 2) {
    const prevTradingDay = getPreviousCalendarTradingDay()
    if (lsjzResult.jzrq >= prevTradingDay) {
      result.dwjz = lsjzResult.dwjz
      result.gszzl = lsjzResult.gszzl
      result.gz = lsjzResult.gz
      result.jzrq = lsjzResult.jzrq
      result.isEstimated = false
      result.gztime = lsjzResult.jzrq
    } else {
      result.dwjz = lsjzResult.dwjz
      result.jzrq = lsjzResult.jzrq
      result.confirmedGszzl = lsjzResult.gszzl
    }
  } else {
    const gzDate = result.gztime?.substring(0, 10)
    const today = getBusinessDay()
    const isConfirmed = gzDate
      ? lsjzResult.jzrq >= gzDate
      : lsjzResult.jzrq >= today
    if (isConfirmed) {
      result.dwjz = lsjzResult.dwjz
      result.gszzl = lsjzResult.gszzl
      result.gz = lsjzResult.gz
      result.jzrq = lsjzResult.jzrq
      result.isEstimated = false
    } else {
      result.dwjz = lsjzResult.dwjz
      result.jzrq = lsjzResult.jzrq
      result.confirmedGszzl = lsjzResult.gszzl
    }
  }
}

export async function batchGetValuation(
  fundCodes: string[],
  getFundType: FundTypeResolver,
): Promise<Map<string, FundValuation>> {
  const result = new Map<string, FundValuation>()
  if (fundCodes.length === 0) return result

  let preMap = new Map<string, FundValuation>()
  try {
    preMap = await fetchValuationBatch(fundCodes)
  } catch {
  }

  const concurrency = FUND_VALUATION_CONFIG.BATCH_CONCURRENCY
  for (let i = 0; i < fundCodes.length; i += concurrency) {
    const batch = fundCodes.slice(i, i + concurrency)
    const settled = await Promise.allSettled(
      batch.map((code) => {
        const hit = preMap.get(code)
        return hit ? getFundValuation(code, getFundType, hit) : getFundValuation(code, getFundType)
      }),
    )
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j]
      if (r.status === 'fulfilled' && r.value) {
        result.set(batch[j], r.value)
      }
    }
  }
  return result
}
