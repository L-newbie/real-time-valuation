

import type { StockQuote } from '../stock-types'
import { FUND_LOOP_CONFIG } from '@/config/constants'
import { jsonpWithMirrors } from '@/shared/net/em-mirrors'
import { secidFor } from '@/shared/market/secid'
import { normalizeStockCodeTencent } from '@/shared/net/tencent-codec'
import { fetchTencentRealtimeBatch, usExtendedSession } from '@/shared/net/tencent-fetch'
import { detectMarketByEmCode } from '@/shared/market/market-classify'

interface EmQuoteRaw {
  f2: number | null; f3: number | null; f4: number | null; f5: number | null
  f6: number | null; f8: number | null; f9: number | null; f12: string; f14: string
  f15: number | null; f16: number | null; f17: number | null; f18: number | null
  f20: number | null; f21: number | null; f23: number | null
}
interface EmQuoteResponse { data?: { diff?: EmQuoteRaw[] } }

export async function fetchFullStockQuotes(
  codes: string[],
  marketMap?: Map<string, string>,
): Promise<Map<string, StockQuote>> {
  const result = new Map<string, StockQuote>()
  if (codes.length === 0) return result

  const codeToNormalized = new Map<string, string>()
  const secidToCode = new Map<string, string>()
  for (const raw of codes) {
    const { code } = normalizeStockCodeTencent(raw)
    codeToNormalized.set(raw, code)
    const market = marketMap?.get(raw) ?? marketMap?.get(code)
    const secid = secidFor(code, market)
    if (secid) secidToCode.set(secid, code)
  }
  if (secidToCode.size === 0) {
    return result
  }

  const secids = [...secidToCode.keys()]
  const allDiff: EmQuoteRaw[] = []
  for (let i = 0; i < secids.length; i += FUND_LOOP_CONFIG.REALTIME_BATCH) {
    const batch = secids.slice(i, i + FUND_LOOP_CONFIG.REALTIME_BATCH)

    const RETRY_DELAYS = [300, 600, 900]
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      const resp = await jsonpWithMirrors<EmQuoteResponse>(
        '/api/qt/ulist.np/get',
        `fltt=2&secids=${batch.join(',')}&fields=f2,f3,f4,f5,f6,f8,f9,f12,f14,f15,f16,f17,f18,f20,f21,f23`,
        'stk',
      )
      if (resp?.data?.diff) {
        allDiff.push(...resp.data.diff)
        break
      }
      if (attempt < RETRY_DELAYS.length) await new Promise<void>(r => setTimeout(r, RETRY_DELAYS[attempt]))
    }
  }

  const quoteMap = new Map<string, EmQuoteRaw>()
  for (const item of allDiff) quoteMap.set(item.f12, item)

  for (const [raw, normalized] of codeToNormalized) {
    const item = quoteMap.get(normalized)
    const market = marketMap?.get(raw) ?? marketMap?.get(normalized)
    result.set(raw, {
      code: raw,
      name: item?.f14 ?? raw,
      price: item?.f2 ?? 0,
      changeRate: item?.f3 ?? 0,
      changeAmount: item?.f4 ?? 0,
      open: item?.f17 ?? undefined,
      high: item?.f15 ?? undefined,
      low: item?.f16 ?? undefined,
      prevClose: item?.f18 ?? undefined,
      volume: item?.f5 ?? undefined,
      turnover: item?.f6 ?? undefined,
      turnoverRate: item?.f8 ?? undefined,
      peRatio: item?.f9 ?? undefined,
      pbRatio: item?.f23 ?? undefined,
      marketCap: item?.f20 ?? undefined,
      floatCap: item?.f21 ?? undefined,
      emMarketCode: market,
      market: detectMarketByEmCode(market ?? ''),
    })
  }

  await enrichUsExtendedHours(result, codeToNormalized)
  return result
}

async function enrichUsExtendedHours(
  result: Map<string, StockQuote>,
  codeToNormalized: Map<string, string>,
): Promise<void> {
  const usEntries: Array<{ raw: string; code: string }> = []
  for (const [raw, normalized] of codeToNormalized) {
    const q = result.get(raw)
    if (q?.market === 'US') usEntries.push({ raw, code: normalized })
  }
  if (usEntries.length === 0) return

  const fetched = await fetchTencentRealtimeBatch(
    usEntries.map(e => ({ code: e.code, market: 'US' })),
    FUND_LOOP_CONFIG.EM_FALLBACK_TIMEOUT,
  )
  if (fetched.size === 0) return

  const sess = usExtendedSession()
  for (const { raw, code } of usEntries) {
    const raw_q = fetched.get(code)
    if (!raw_q) continue
    const q = result.get(raw)
    if (!q) continue
    q.session = sess
    if (sess === 'PRE') {
      q.changeRate = null
      q.changeAmount = 0
    }
    if (raw_q.extPrice != null && Number.isFinite(raw_q.extPrice)) {
      q.extPrice = raw_q.extPrice
      q.extRate = raw_q.extRate
    }
  }
}
