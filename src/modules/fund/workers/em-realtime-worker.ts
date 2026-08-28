

import type { WorkerIncomingMessage, WorkerResponse } from '@/shared/worker/worker-protocol'
import type { StockMarket, StockQuoteInfo } from '@/shared/types/common-types'
import { fetchTencentRealtimeBatch, usExtendedSession } from '@/shared/net/tencent-fetch'
import { buildRealtimeQuote } from '@/modules/fund/calc/realtime-em-calc'

self.onmessage = async (e: MessageEvent<WorkerIncomingMessage>) => {
  const { id, type, payload } = e.data

  if (type === 'realtime-batch') {
    const entries = payload as Array<{ code: string; market: StockMarket }>
    const fetched = await fetchTencentRealtimeBatch(entries, 6000)

    const result = new Map<string, StockQuoteInfo>()
    const sess = usExtendedSession()
    for (const entry of entries) {
      if (entry.market === 'US' && sess === 'PRE') continue
      const raw = fetched.get(entry.code)
      const rate = raw ? (raw.extRate ?? raw.changeRate) : null
      const quote = buildRealtimeQuote(entry.code, entry.market, rate, '腾讯')
      if (raw?.extRate != null && sess !== 'REGULAR') quote.session = sess
      if (raw && quote.changeRate != null) {
        quote.price = raw.price
        quote.prevClose = raw.prevClose
        if (raw.extPrice != null) quote.extPrice = raw.extPrice
      }
      result.set(entry.code, quote)
    }
    reply(id, true, result)
    return
  }

  reply(id, false, undefined, `em-realtime-worker 未实现请求类型: ${type}`)
}

function reply(id: number, ok: boolean, data?: unknown, err?: string): void {
  const resp: WorkerResponse = { id, ok, data, err }
  ;(self as any).postMessage(resp)
}

export {}
