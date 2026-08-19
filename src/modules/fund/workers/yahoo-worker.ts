

import type { WorkerIncomingMessage, WorkerResponse } from '@/shared/worker/worker-protocol'
import type { MarketTz } from '@/shared/types/common-types'
import { API_URLS } from '@/config/constants'
import { fetchWithProxyRotation } from '@/shared/net/proxy-rotation'
import { fetchTencentRealtimeBatch } from '@/shared/net/tencent-fetch'
import { classifyUSSessionByMs } from '@/shared/market/trading-day'
import { calcCloseChangeRateByMarket } from '@/modules/fund/calc/yahoo-close-calc'
import { calcRealtimeChangeRateByMarket, calcRealtimeSimple } from '@/modules/fund/calc/yahoo-realtime-calc'
import type { YahooChartResponse, YahooChartResult } from '@/modules/fund/calc/yahoo-types'

export interface YahooQuoteResult {
  rate: number | null

  date: string | null

  session?: 'PRE' | 'REGULAR' | 'POST'

  proxyFailed: boolean

  source?: '腾讯' | 'Yahoo'
}

type Mode = 'close' | 'realtime'

async function fetchYahooQuote(
  symbol: string,
  market: MarketTz,
  mode: Mode,
): Promise<YahooQuoteResult> {
  const interval = mode === 'realtime' ? '2m' : '1d'
  const range = mode === 'realtime' ? '1d' : '1mo'
  const targetUrl = `${API_URLS.YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=true`

  const timeout = 3000
  const { data, proxyFailed } = await fetchWithProxyRotation(targetUrl, timeout)
  if (proxyFailed || !data) {
    return { rate: null, date: null, proxyFailed }
  }

  const result: YahooChartResult | undefined = (data as YahooChartResponse)?.chart?.result?.[0]
  if (!result?.meta) {
    // eslint-disable-next-line no-console
    console.warn(`[yahoo-worker] ${symbol} ${mode}: 代理成功但无chart.result.meta，原始结构异常`)
    return { rate: null, date: null, proxyFailed: false }
  }

  if (mode === 'close') {
    const r = calcCloseChangeRateByMarket(result, market)
    return { rate: r.rate, date: r.date, proxyFailed: false, source: 'Yahoo' }
  }
  const r = market === 'US'
    ? calcRealtimeChangeRateByMarket(result, market)
    : calcRealtimeSimple(result, market)
  return {
    rate: r.rate,
    date: r.date,
    session: r.session,
    proxyFailed: false,
    source: 'Yahoo',
  }
}

self.onmessage = async (e: MessageEvent<WorkerIncomingMessage>) => {
  const { id, type, payload } = e.data

  if (type === 'yahoo-quote') {
    const { symbol, market, mode } = payload as { symbol: string; market: MarketTz; mode: Mode }
    const result = await fetchYahooQuote(symbol, market, mode)
    reply(id, true, { symbol, result })
    return
  }

  if (type === 'yahoo-quote-batch') {
    const entries = payload as Array<{ symbol: string; market: MarketTz; mode: Mode }>
    const results = new Map<string, YahooQuoteResult>()

    if (classifyUSSessionByMs(Date.now()) === 'REGULAR') {
      const usRtEntries = entries
        .filter(e => e.market === 'US' && e.mode === 'realtime')
        .map(e => ({ symbol: e.symbol, code: e.symbol }))
      if (usRtEntries.length > 0) {
        const tcEntries = usRtEntries.map(e => ({ code: e.code, market: 'US' as const }))
        const tcMap = await fetchTencentRealtimeBatch(tcEntries, 6000)
        for (const e of usRtEntries) {
          const q = tcMap.get(e.code)
          if (q && Number.isFinite(q.changeRate)) {
            results.set(e.symbol, {
              rate: q.changeRate,
              date: null,
              session: 'REGULAR',
              proxyFailed: false,
              source: '腾讯',
            })
          }
        }
      }
    }

    const yahooEntries = entries.filter(e => !results.has(e.symbol))

    const BATCH_CONCURRENCY = 4
    let idx = 0
    const size = Math.min(BATCH_CONCURRENCY, yahooEntries.length)
    const workers = Array.from({ length: size }, async () => {
      while (idx < yahooEntries.length) {
        const i = idx++
        const entry = yahooEntries[i]
        try {
          results.set(entry.symbol, await fetchYahooQuote(entry.symbol, entry.market, entry.mode))
        } catch {  }
      }
    })
    await Promise.all(workers)
    reply(id, true, results)
    return
  }

  if (type === 'yahoo-search') {
    const { keyword, count, includeEtf } = payload as { keyword: string; count: number; includeEtf: boolean }
    const targetUrl = `${API_URLS.YAHOO_SEARCH}?q=${encodeURIComponent(keyword)}&quotesCount=${count}&newsCount=0`
    const { data, proxyFailed } = await fetchWithProxyRotation(targetUrl, 6000)
    if (proxyFailed || !data) {
      reply(id, true, { results: [], proxyFailed })
      return
    }
    const quotes = (data as { quotes?: YahooSearchQuote[] })?.quotes ?? []
    const results = quotes
      .filter((q) => q.symbol && (includeEtf
        ? (q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
        : q.quoteType === 'EQUITY'))
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || '',
        quoteType: q.quoteType || '',
      }))
    reply(id, true, { results, proxyFailed: false })
    return
  }

  reply(id, false, undefined, `yahoo-worker 未实现请求类型: ${type}`)
}

interface YahooSearchQuote {
  symbol: string
  shortname?: string
  longname?: string
  exchange?: string
  quoteType?: string
}

function reply(id: number, ok: boolean, data?: unknown, err?: string): void {
  const resp: WorkerResponse = { id, ok, data, err }
  ;(self as any).postMessage(resp)
}

export {}
