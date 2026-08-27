

import type { StockSearchItem } from '../stock-types'
import { API_URLS } from '@/config/constants'
import { jsonpRequest, genCallbackName } from '@/shared/net/jsonp-main'

const EM_MARKET_LABEL: Record<string, string> = {
  '1': '沪', '0': '深', '116': '港', '105': '美', '106': '美',
  '124': '日', '130': '韩', '118': '台',
  '155': '德', '156': '法', '157': '英',
  '173': '巴', '174': '印', '175': '新', '177': '澳',
}

interface EmSuggestResponse {
  QuotationCodeTable?: {
    Data?: Array<{ Code?: string; Name?: string; MktNum?: string }>
  }
}

export async function searchStocks(keyword: string): Promise<StockSearchItem[]> {
  const q = keyword.trim()
  if (!q) return []

  try {
    const cb = genCallbackName('search')
    const url = `${API_URLS.STOCK_SEARCH}?input=${encodeURIComponent(q)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=15&cb=${cb}`
    const data = await jsonpRequest<EmSuggestResponse>(url, cb, 6000)

    if (!data?.QuotationCodeTable?.Data) return []

    const results: StockSearchItem[] = []
    const seen = new Set<string>()
    for (const item of data.QuotationCodeTable.Data) {
      const code = String(item.Code || '')
      const name = String(item.Name || '')
      const mktNum = String(item.MktNum || '')
      if (!code || !name || !mktNum) continue
      const key = `${code}|${mktNum}`
      if (seen.has(key)) continue
      seen.add(key)

      results.push({ code, name, market: EM_MARKET_LABEL[mktNum] ?? '', rawMarket: mktNum })
    }
    return results.slice(0, 15)
  } catch {
    return []
  }
}
