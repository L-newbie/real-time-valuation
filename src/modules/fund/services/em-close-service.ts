

import { workerManager } from '@/shared/worker/worker-manager'
import { WORKER_NAMES, FUND_LOOP_CONFIG } from '@/config/constants'
import type { StockMarket, StockQuoteInfo } from '@/shared/types/common-types'
import { useFundStore, type StockEntry } from '@/modules/fund/fund-store'
import type { PrevDayResult } from '@/modules/fund/calc/prev-day-calc'
import { calcPrevDayFromKlines } from '@/modules/fund/calc/prev-day-calc'
import { classifyShare } from '@/shared/market/market-classify'
import { normalizeStockCodeTencent } from '@/shared/net/tencent-codec'
import { runBatched } from '@/shared/net/rate-limiter'
import { fetchEmKline } from './em-kline-fetch'
import { waitUntilVisible } from '@/shared/net/page-visibility'

let registered = false
let loopRunning = false
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null

function ensureRegistered(): void {
  if (registered) return
  registered = true
  workerManager.registerWorker(WORKER_NAMES.FUND_EM_CLOSE, () =>
    new Worker(new URL('../workers/em-close-worker.ts', import.meta.url), { type: 'module' }),
  )
}

export function startEmCloseLoop(): void {
  if (loopRunning) return
  ensureRegistered()
  loopRunning = true
  void startWithPhase(1)
}

async function startWithPhase(slot: number): Promise<void> {
  const delay = (FUND_LOOP_CONFIG.LOOP_PHASE_JITTER / 3) * slot
  if (delay > 0) await new Promise<void>(r => setTimeout(r, delay))
  if (!loopRunning) return
  void runRelayLoop()
}

export function stopEmCloseLoop(): void {
  loopRunning = false
  if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null }
}

async function runRelayLoop(): Promise<void> {
  while (loopRunning) {
    await waitUntilVisible()
    if (!loopRunning) break
    const hadMissing = await tickOnce()
    if (!loopRunning) break
    if (hadMissing) {
      continue
    }

    await new Promise<void>((resolve) => {
      heartbeatTimer = setTimeout(() => { heartbeatTimer = null; resolve() }, FUND_LOOP_CONFIG.HEARTBEAT_INTERVAL)
    })
  }
}

async function tickOnce(): Promise<boolean> {
  const store = useFundStore()
  const { aStock, hkStock, usStock } = store.collectMissingStocks()
  if (aStock.length === 0 && hkStock.length === 0 && usStock.length === 0) {
    return false
  }

  if (aStock.length > 0) await processGroup(aStock)
  if (hkStock.length > 0) await processGroup(hkStock)
  if (usStock.length > 0) await processGroup(usStock)

  return true
}

async function processGroup(target: StockEntry[]): Promise<void> {
  const store = useFundStore()

  const entries = target.map(e => {
    const { code } = normalizeStockCodeTencent(e.stockCode)
    const market = classifyShare(e.emMarketCode, code)
    return { code, market: market as StockMarket }
  })

  const SERVICE_BATCH = FUND_LOOP_CONFIG.KLINE_SERVICE_BATCH

  try {
    for (let i = 0; i < entries.length; i += SERVICE_BATCH) {
      const batchEntries = entries.slice(i, i + SERVICE_BATCH)
      const batchTarget = target.slice(i, i + SERVICE_BATCH)
      const result = await workerManager.request<
        Array<{ code: string; market: StockMarket }>,
        Map<string, PrevDayResult>
      >(WORKER_NAMES.FUND_EM_CLOSE, 'prev-day-batch', batchEntries, FUND_LOOP_CONFIG.WORKER_TIMEOUT)

      const prevDayMap = new Map<string, StockQuoteInfo>()
      const tencentFailed: StockEntry[] = []
      for (let j = 0; j < batchEntries.length; j++) {
        const entry = batchEntries[j]
        const r = result.get(entry.code)
        if (r && 'closed' in r) {
          prevDayMap.set(entry.code, {
            changeRate: null, date: null, market: entry.market, source: '休盘', closed: true,
          })
        } else if (r && 'changeRate' in r) {
          prevDayMap.set(entry.code, {
            changeRate: r.changeRate, date: r.date, market: entry.market, source: '腾讯',
          })
        } else {
          tencentFailed.push(batchTarget[j])
        }
      }

      if (prevDayMap.size > 0) {
        await store.mergeStockQuotesToCache(prevDayMap, batchTarget)
      }

      if (tencentFailed.length > 0) {
        await runBatched(tencentFailed, FUND_LOOP_CONFIG.KLINE_BATCH, FUND_LOOP_CONFIG.KLINE_BATCH_GAP, async (e) => {
          const emInfo = await fetchEmCloseFallback(e)
          if (!emInfo) return
          const batchMap = new Map<string, StockQuoteInfo>()
          const { code } = normalizeStockCodeTencent(e.stockCode)
          batchMap.set(code, emInfo)
          await store.mergeStockQuotesToCache(batchMap, [e])
        })
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[em-close] processGroup 异常', e)
  }
}

async function fetchEmCloseFallback(entry: StockEntry): Promise<StockQuoteInfo | null> {
  const { code } = normalizeStockCodeTencent(entry.stockCode)
  const market = classifyShare(entry.emMarketCode, code)

  const klines = await fetchEmKline(code, entry.emMarketCode)
  if (klines && klines.length >= 2) {
    const r = calcPrevDayFromKlines(klines, market)
    if (r && 'closed' in r) {
      return { changeRate: null, date: null, market, source: '休盘', closed: true }
    }
    if (r && 'changeRate' in r) {
      return { changeRate: r.changeRate, date: r.date, market, source: '东财' }
    }
  }

  return null
}
