

import type { IntradayPoint } from '@/modules/fund/fund-types'
import { API_URLS, INTRADAY_CONFIG } from '@/config/constants'
import { jsonpRequest, genCallbackName } from '@/shared/net/jsonp-main'
import { safeParseFloat } from '@/shared/utils/safe-math'
import { isValidFundCode } from '@/shared/utils/validation'
import { getBusinessDay } from '@/modules/fund/valuation/cn-trading-day'
import { isCnMarketOpenForIntraday } from './intraday-points'

export async function fetchIntradayEstimate(fundCode: string): Promise<IntradayPoint[]> {
  if (!isValidFundCode(fundCode)) return []

  if (!isCnMarketOpenForIntraday()) return []

  const callbackName = genCallbackName('jsonp_sina')
  const url = `${API_URLS.INTRADAY_ESTIMATE}?symbol=${fundCode}&callback=${callbackName}`
  const today = getBusinessDay()

  try {
    const response = await jsonpRequest<any>(url, callbackName, INTRADAY_CONFIG.FETCH_TIMEOUT)
    const networth = response?.result?.data?.networth
    if (!Array.isArray(networth) || networth.length === 0) return []

    return networth
      .filter((p: any) => p.min_time && p.pre_nav != null)
      .map((p: any) => ({ time: p.min_time, value: safeParseFloat(p.pre_nav), date: today }))
      .filter((p: IntradayPoint) => p.value > 0)
  } catch {
    return []
  }
}
