

import { API_URLS, FUND_LOOP_CONFIG } from '@/config/constants'
import { jsonpRequest, genCallbackName } from '@/shared/net/jsonp-main'
import { secidFor } from '@/shared/market/secid'

interface EmKlineResponse {
  data?: {
    code?: string
    name?: string
    klines?: string[]
  }
}

export async function fetchEmKline(
  code: string,
  emMarketCode?: string,
  limit: number = 30,
): Promise<string[] | null> {
  const secid = secidFor(code, emMarketCode)
  if (!secid) return null

  const cb = genCallbackName('kl')
  const url =
    `${API_URLS.STOCK_KLINE}?secid=${secid}` +
    `&fields1=f1,f2,f3,f4,f5,f6` +
    `&fields2=f51,f52,f53,f54,f55,f56,f57` +
    `&klt=101&fqt=1&beg=0&end=20500101&lmt=${limit}` +
    `&cb=${cb}`

  try {
    const resp = await jsonpRequest<EmKlineResponse>(url, cb, FUND_LOOP_CONFIG.EM_FALLBACK_TIMEOUT)
    const klines = resp?.data?.klines
    if (!Array.isArray(klines) || klines.length === 0) return null
    return klines
  } catch {
    return null
  }
}
