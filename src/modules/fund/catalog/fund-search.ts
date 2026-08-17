

import type { SearchResult } from '@/modules/fund/fund-types'
import { API_URLS, FUND_CATALOG_CONFIG } from '@/config/constants'
import { jsonpRequest, genCallbackName } from '@/shared/net/jsonp-main'

export async function searchFunds(keyword: string): Promise<SearchResult[]> {
  if (!keyword || keyword.trim().length < FUND_CATALOG_CONFIG.SEARCH_MIN_KEYWORD) return []

  const callbackName = genCallbackName('fundSearch')
  const url = `${API_URLS.SEARCH}?m=1&key=${encodeURIComponent(keyword)}&pageSize=${FUND_CATALOG_CONFIG.SEARCH_PAGE_SIZE}&callback=${callbackName}`

  try {
    const response = await jsonpRequest<any>(url, callbackName, FUND_CATALOG_CONFIG.SEARCH_TIMEOUT)
    const datas = response?.Datas ?? []
    return datas
      .map((item: any) => ({
        fundCode: item.CODE ?? item.FundCode ?? '',
        fundName: item.NAME ?? item.FundName ?? '',
        fundType: item.FUNDTYPE ?? item.FundType ?? '',
      }))
      .filter((item: SearchResult) => item.fundCode && item.fundName)
  } catch {
    return []
  }
}
