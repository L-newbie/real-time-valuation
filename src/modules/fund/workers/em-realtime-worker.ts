

import type { WorkerIncomingMessage, WorkerResponse } from '@/shared/worker/worker-protocol'
import type { StockMarket, StockQuoteInfo } from '@/shared/types/common-types'
import { fetchTencentRealtimeBatch } from '@/shared/net/tencent-fetch'
import { buildRealtimeQuote } from '@/modules/fund/calc/realtime-em-calc'

self.onmessage = async (e: MessageEvent<WorkerIncomingMessage>) => {
  const { id, type, payload } = e.data

  if (type === 'realtime-batch') {
    const entries = payload as Array<{ code: string; market: StockMarket }>
    const fetched = await fetchTencentRealtimeBatch(entries, 6000)

    const result = new Map<string, StockQuoteInfo>()
    for (const entry of entries) {
      const raw = fetched.get(entry.code)
      const rate = raw ? raw.changeRate : null
      result.set(entry.code, buildRealtimeQuote(entry.code, entry.market, rate, '腾讯'))
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
