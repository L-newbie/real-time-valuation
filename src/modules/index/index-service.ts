

import type { IndexQuote } from './index-types'
import { INDEX_PRESETS, FUND_LOOP_CONFIG } from '@/config/constants'
import { jsonpWithMirrors } from '@/shared/net/em-mirrors'

export interface EmBaseQuote {
  code: string
  name: string
  price: number
  changeRate: number
  changeAmount: number
}

interface EmQuoteRaw {
  f2: number | null
  f3: number | null
  f4: number | null
  f12: string
  f14: string
}

interface EmQuoteResponse {
  data?: { diff?: EmQuoteRaw[] }
}

export async function fetchGlobalIndexQuotes(): Promise<Map<string, IndexQuote>> {
  const result = new Map<string, IndexQuote>()
  const secids = INDEX_PRESETS.map(p => p.secid)
  const quoteMap = await fetchQuotesBySecid(secids)

  for (const preset of INDEX_PRESETS) {
    const q = quoteMap.get(preset.secid) ?? quoteMap.get(preset.code)
    result.set(preset.secid, {
      secid: preset.secid,
      code: preset.code,
      name: q?.name || preset.name,
      price: q?.price ?? 0,
      changeRate: q?.changeRate ?? 0,
      changeAmount: q?.changeAmount ?? 0,
    })
  }
  return result
}

export async function fetchQuotesBySecid(secids: string[]): Promise<Map<string, EmBaseQuote>> {
  const result = new Map<string, EmBaseQuote>()
  if (secids.length === 0) return result

  const allDiff: EmQuoteRaw[] = []
  for (let i = 0; i < secids.length; i += FUND_LOOP_CONFIG.REALTIME_BATCH) {
    const batch = secids.slice(i, i + FUND_LOOP_CONFIG.REALTIME_BATCH)
    const resp = await jsonpWithMirrors<EmQuoteResponse>(
      '/api/qt/ulist.np/get',
      `fltt=2&secids=${batch.join(',')}&fields=f2,f3,f4,f12,f14`,
      'idx',
    )
    if (resp?.data?.diff) allDiff.push(...resp.data.diff)
  }

  for (const item of allDiff) {
    result.set(item.f12, {
      code: item.f12,
      name: item.f14 || item.f12,
      price: item.f2 ?? 0,
      changeRate: item.f3 ?? 0,
      changeAmount: item.f4 ?? 0,
    })
  }
  return result
}
