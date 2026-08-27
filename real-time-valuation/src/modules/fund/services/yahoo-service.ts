

import { workerManager } from '@/shared/worker/worker-manager'
import { WORKER_NAMES, YAHOO_CONFIG, FUND_LOOP_CONFIG } from '@/config/constants'
import type { StockMarket, StockQuoteInfo, MarketTz } from '@/shared/types/common-types'
import { useFundStore, type StockEntry } from '@/modules/fund/fund-store'
import type { YahooQuoteResult } from '@/modules/fund/workers/yahoo-worker'
import { guessYahooSymbol, detectMarketFromSymbol, type SearchYahooSymbol, type YahooSearchResult } from './yahoo-symbol'
import { normalizeStockCodeTencent } from '@/shared/net/tencent-codec'
import { stockMarketToTz } from '@/shared/market/market-classify'
import { resolveMarketTradingDays } from '@/shared/market/trading-day'
import { usExtendedSession } from '@/shared/net/tencent-fetch'
import { runConcurrent } from '@/shared/net/rate-limiter'

import { defineJob, startJob, stopJob, wakeJob } from '@/shared/net/scheduler'

const JOB_KEY = 'fund:yahoo'

const RETRY_INTERVAL = 3 * 1000

let registered = false
let placeholderSet = false

let failedCodes = new Set<string>()

function ensureRegistered(): void {
  if (registered) return
  registered = true
  workerManager.registerWorker(WORKER_NAMES.FUND_YAHOO, () =>
    new Worker(new URL('../workers/yahoo-worker.ts', import.meta.url), { type: 'module' }),
  )
}

export function startYahooLoop(): void {
  ensureRegistered()
  defineJob({
    key: JOB_KEY,
    interval: FUND_LOOP_CONFIG.HEARTBEAT_INTERVAL,
    phase: 2,
    run: async () => {
      const hadMissing = await tickOnce()
      return { complete: true, nextDelay: hadMissing ? RETRY_INTERVAL : FUND_LOOP_CONFIG.HEARTBEAT_INTERVAL }
    },
  })
  startJob(JOB_KEY)
}

export function stopYahooLoop(): void {
  stopJob(JOB_KEY)
}

export function wakeYahooLoop(): void {
  wakeJob(JOB_KEY)
}

const searchViaWorker: SearchYahooSymbol = async (keyword, count, includeEtf) => {
  try {
    const r = await workerManager.request<
      { keyword: string; count: number; includeEtf: boolean },
      { results: YahooSearchResult[]; proxyFailed: boolean }
    >(WORKER_NAMES.FUND_YAHOO, 'yahoo-search', { keyword, count, includeEtf }, FUND_LOOP_CONFIG.WORKER_TIMEOUT)
    return r.results
  } catch {
    return []
  }
}

async function tickOnce(): Promise<boolean> {
  const store = useFundStore()

  if (store.expireStaleRealtimeCache()) store.recomputeAllFromCache()

  if (!placeholderSet && store.fundCodes.length > 0) {
    placeholderSet = true
    let changed = false
    for (const code of store.fundCodes) {
      const v = store.getValuation(code)
      if (!v || v.delayDays !== 2) continue
      if (v.realtimeGszzl == null) {
        v.realtimeGszzl = 0
        v.realtimeSource = '实时'
        changed = true
      }
    }
    if (changed) store.valuationMap = new Map(store.valuationMap)
  }

  const { overseas: overseasMissing } = store.collectMissingStocks()
  const overseasAll = store.collectOverseasAll()
  const usAll = store.collectUsAll()
  const isUsPre = usExtendedSession() === 'PRE'
  const usPreEntries = isUsPre ? usAll : []
  if (overseasAll.length === 0 && usPreEntries.length === 0) {
    return false
  }
  const closeMissing = overseasMissing.length > 0
  let hadMissing = false

  const allEntries = closeMissing
    ? dedupeEntries([...overseasMissing, ...overseasAll, ...usPreEntries])
    : dedupeEntries([...overseasAll, ...usPreEntries])
  const symbolMap = await resolveSymbols(allEntries)

  try {
    const tasks: Promise<{ mode: 'close' | 'realtime'; fetched: Map<string, StockQuoteInfo> }>[] = []

    if (closeMissing) {
      const closeEntries = overseasMissing
        .map(e => ({ e, sym: symbolMap.get(normalizeStockCodeTencent(e.stockCode).code) }))
        .filter(x => x.sym) as Array<{ e: StockEntry; sym: { symbol: string; market: StockMarket } }>
      tasks.push(runMode(closeEntries, 'close').then(fetched => ({ mode: 'close' as const, fetched })))
    }

    const rtEntries = (isUsPre ? [...overseasAll, ...usAll] : overseasAll)
      .map(e => ({ e, sym: symbolMap.get(normalizeStockCodeTencent(e.stockCode).code) }))
      .filter(x => x.sym) as Array<{ e: StockEntry; sym: { symbol: string; market: StockMarket } }>

    const rtCache = store.stockRealtimeCache
    const priorityOf = (x: { e: StockEntry }): number => {
      const { code } = normalizeStockCodeTencent(x.e.stockCode)
      if (failedCodes.has(code)) return 0
      const info = rtCache.get(code) ?? rtCache.get(x.e.stockCode)
      if (!info || info.changeRate == null) return 1
      return 2
    }
    const staleAtOf = (x: { e: StockEntry }): number => {
      const { code } = normalizeStockCodeTencent(x.e.stockCode)
      const info = rtCache.get(code) ?? rtCache.get(x.e.stockCode)
      return info?.updatedAt ?? 0
    }
    rtEntries.sort((a, b) => (priorityOf(a) - priorityOf(b)) || (staleAtOf(a) - staleAtOf(b)))

    tasks.push(
      runMode(rtEntries, 'realtime', async (partial, chunkEntries) => {
        await store.mergeRealtimeToCache(partial, chunkEntries)
      }).then(fetched => ({ mode: 'realtime' as const, fetched })),
    )

    const results = await Promise.all(tasks)
    for (const { mode, fetched } of results) {
      if (mode === 'close' && fetched.size > 0) {
        await store.mergeStockQuotesToCache(fetched, overseasMissing)
      }

      if (mode === 'close' && fetched.size < overseasMissing.length) hadMissing = true
      if (mode === 'realtime' && fetched.size < rtEntries.length) hadMissing = true
    }
  } catch {
    hadMissing = true
  }

  return hadMissing
}

async function resolveSymbols(entries: StockEntry[]): Promise<Map<string, { symbol: string; market: StockMarket }>> {
  const result = new Map<string, { symbol: string; market: StockMarket }>()
  const unresolved: string[] = []
  await runConcurrent(entries, YAHOO_CONFIG.SYMBOL_CONCURRENCY, async (e) => {
    const { code } = normalizeStockCodeTencent(e.stockCode)
    const symbol = await guessYahooSymbol(code, e.emMarketCode, e.stockName, searchViaWorker)

    const market: StockMarket = detectMarketFromSymbol(symbol || '')
    if (symbol) result.set(code, { symbol, market })
    else unresolved.push(`${code}(emCode=${e.emMarketCode ?? '无'})`)
  })
  if (unresolved.length) {
    // eslint-disable-next-line no-console
    console.warn(`[yahoo] symbol未解析 ${unresolved.length} 只: ${unresolved.join(', ')}`)
  }
  return result
}

async function runMode(
  entries: Array<{ e: StockEntry; sym: { symbol: string; market: StockMarket } }>,
  mode: 'close' | 'realtime',
  onChunk?: (partial: Map<string, StockQuoteInfo>, entries: StockEntry[]) => Promise<void>,
): Promise<Map<string, StockQuoteInfo>> {
  const result = new Map<string, StockQuoteInfo>()
  if (entries.length === 0) return result

  let fetchEntries = entries
  if (mode === 'realtime') {
    fetchEntries = []
    const closedMap = new Map<string, StockQuoteInfo>()
    const closedEntries: StockEntry[] = []
    for (const x of entries) {
      if (x.sym.market === 'US' && usExtendedSession() !== 'PRE') continue
      const tz = stockMarketToTz(x.sym.market)
      const td = resolveMarketTradingDays(tz)
      const isUsPreStock = x.sym.market === 'US' && usExtendedSession() === 'PRE'
      if (!isUsPreStock && (td.isNonTradingDay || !td.hasOpened)) {
        const { code } = normalizeStockCodeTencent(x.e.stockCode)
        const info: StockQuoteInfo = {
          changeRate: null, date: null, market: x.sym.market,
          source: null, closed: true, updatedAt: Date.now(),
        }
        result.set(code, info)
        closedMap.set(code, info)
        closedEntries.push(x.e)
      } else {
        fetchEntries.push(x)
      }
    }
    if (onChunk && closedMap.size > 0) await onChunk(closedMap, closedEntries)
    if (fetchEntries.length === 0) return result
  }

  await acquireSlot(mode)
  try {
    const batch = fetchEntries.map(x => ({
      symbol: x.sym.symbol,
      market: stockMarketToTz(x.sym.market) as MarketTz,
      mode,
    }))
    const fetched = await workerManager.request<typeof batch, Map<string, YahooQuoteResult>>(
      WORKER_NAMES.FUND_YAHOO, 'yahoo-quote-batch', batch, FUND_LOOP_CONFIG.WORKER_TIMEOUT,
    )
    let nullCnt = 0
    const chunkResult = new Map<string, StockQuoteInfo>()
    for (const x of fetchEntries) {
      const { code } = normalizeStockCodeTencent(x.e.stockCode)
      const r = fetched.get(x.sym.symbol)
      if (r && r.rate != null) {
        const date = r.date ?? (mode === 'realtime' ? resolveMarketTradingDays(stockMarketToTz(x.sym.market)).currentTradingDay : null)
        const info: StockQuoteInfo = {
          changeRate: r.rate,
          date,
          market: x.sym.market,
          source: r.source ?? 'Yahoo',
          session: r.session,
          ...(r.extPrice != null ? { extPrice: r.extPrice } : {}),
          ...(r.price != null ? { price: r.price } : {}),
          ...(r.prevClose != null ? { prevClose: r.prevClose } : {}),
          updatedAt: mode === 'realtime' ? Date.now() : undefined,
        }
        result.set(code, info)
        chunkResult.set(code, info)
        if (mode === 'realtime') failedCodes.delete(code)
      } else {
        nullCnt++
        if (mode === 'realtime') failedCodes.add(code)
      }
    }
    if (nullCnt) {
      // eslint-disable-next-line no-console
      console.warn(`[yahoo] ${mode}取数失败 ${nullCnt}/${fetchEntries.length}（多为代理波动，loop 会接力重试）`)
    }
    if (onChunk && chunkResult.size > 0) await onChunk(chunkResult, fetchEntries.map(x => x.e))
  } finally {
    releaseSlot(mode)
  }
  return result
}

const closeInFlight = { count: 0 }
const realtimeInFlight = { count: 0 }
const closeQueue: Array<() => void> = []
const realtimeQueue: Array<() => void> = []

function slotState(mode: 'close' | 'realtime') {
  return mode === 'realtime'
    ? { inFlight: realtimeInFlight, queue: realtimeQueue }
    : { inFlight: closeInFlight, queue: closeQueue }
}
function acquireSlot(mode: 'close' | 'realtime'): Promise<void> {
  const { inFlight, queue } = slotState(mode)
  if (inFlight.count < YAHOO_CONFIG.SLOT_CAP_PER_SOURCE) {
    inFlight.count++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    queue.push(() => { inFlight.count++; resolve() })
  })
}
function releaseSlot(mode: 'close' | 'realtime'): void {
  const { inFlight, queue } = slotState(mode)
  inFlight.count--
  const next = queue.shift()
  if (next) next()
}

function dedupeEntries(entries: StockEntry[]): StockEntry[] {
  const map = new Map<string, StockEntry>()
  for (const e of entries) {
    const { code } = normalizeStockCodeTencent(e.stockCode)
    if (!map.has(code)) map.set(code, e)
  }
  return Array.from(map.values())
}
