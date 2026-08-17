

import type { FundValuation } from '@/modules/fund/fund-types'
import { API_URLS, FUND_VALUATION_CONFIG } from '@/config/constants'
import { jsonpRequest, genCallbackName } from '@/shared/net/jsonp-main'
import { safeParseFloat } from '@/shared/utils/safe-math'
import { isValidFundCode } from '@/shared/utils/validation'

export interface PrevNavInfo {
  dwjz: number

  jzrq: string
}

export async function fetchPrevNav(fundCode: string): Promise<PrevNavInfo | null> {
  const r = await fetchFundgz(fundCode)
  if (!r || !(r.dwjz > 0) || !r.jzrq) return null
  return { dwjz: r.dwjz, jzrq: r.jzrq }
}

export async function fetchFundgz(fundCode: string): Promise<FundValuation | null> {
  if (!isValidFundCode(fundCode)) return null

  for (let attempt = 1; attempt <= FUND_VALUATION_CONFIG.FUNDGZ_RETRIES; attempt++) {
    try {
      const result = await fetchSinaEstimate(fundCode)
      if (result) return result
    } catch {
    }
    if (attempt < FUND_VALUATION_CONFIG.FUNDGZ_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, attempt * FUND_VALUATION_CONFIG.FUNDGZ_RETRY_BACKOFF))
    }
  }
  return null
}

interface SinaNetworthPoint {
  min_time?: string
  pre_nav?: number | string
  growthrate?: number | string
  pre_date?: string
}

async function fetchSinaEstimate(fundCode: string): Promise<FundValuation | null> {
  const callbackName = genCallbackName('jsonp_sina_gz')
  const url = `${API_URLS.INTRADAY_ESTIMATE}?symbol=${fundCode}&callback=${callbackName}`

  const response: any = await jsonpRequest<any>(url, callbackName, FUND_VALUATION_CONFIG.FUNDGZ_TIMEOUT)

  const networth: SinaNetworthPoint[] | undefined = response?.result?.data?.networth
  if (!Array.isArray(networth) || networth.length === 0) return null

  const last = networth[networth.length - 1]
  const gz = safeParseFloat(last.pre_nav)
  if (!Number.isFinite(gz) || gz <= 0) return null

  const gszzl = Math.round(safeParseFloat(last.growthrate) * 100 * 100) / 100

  let gztime = ''
  if (last.pre_date && last.min_time) {
    gztime = `${last.pre_date} ${last.min_time}`.replace(/:(\d{2}):\d{2}$/, ':$1')
  } else if (last.pre_date) {
    gztime = last.pre_date
  }

  return {
    fundcode: fundCode,
    name: response?.result?.data?.name || response?.result?.data?.fund_name || '',
    gztime,
    gz,
    dwjz: gz,
    gszzl,
    jzrq: last.pre_date || '',
    isEstimated: true,
  }
}
