

import type { WorkerIncomingMessage, WorkerResponse } from '@/shared/worker/worker-protocol'
import type { StockMarket } from '@/shared/types/common-types'
import { FUND_LOOP_CONFIG } from '@/config/constants'
import { fetchTencentKline } from '@/shared/net/tencent-fetch'
import { calcPrevDayFromKlines, type PrevDayResult } from '@/modules/fund/calc/prev-day-calc'

self.onmessage = async (e: MessageEvent<WorkerIncomingMessage>) => {
  const { id, type, payload } = e.data

  if (type === 'prev-day') {
    const { code, market } = payload as { code: string; market: StockMarket }
    const klines = await fetchTencentKline(code, market, 6000)
    const result: PrevDayResult = klines ? calcPrevDayFromKlines(klines, market) : null

    reply(id, true, { code, result })
    return
  }

  if (type === 'prev-day-batch') {
    const entries = payload as Array<{ code: string; market: StockMarket }>
    const results = new Map<string, PrevDayResult>()

    const BATCH = FUND_LOOP_CONFIG.KLINE_WORKER_CONCURRENCY
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH)
      await Promise.all(batch.map(async (entry) => {
        const klines = await fetchTencentKline(entry.code, entry.market, 6000)
        results.set(entry.code, klines ? calcPrevDayFromKlines(klines, entry.market) : null)
      }))
    }
    reply(id, true, results)
    return
  }

  reply(id, false, undefined, `em-close-worker 未实现请求类型: ${type}`)
}

function reply(id: number, ok: boolean, data?: unknown, err?: string): void {
  const resp: WorkerResponse = { id, ok, data, err }
  ;(self as any).postMessage(resp)
}

export {}
