

import { workerManager } from '@/shared/worker/worker-manager'
import { WORKER_NAMES, FUND_LOOP_CONFIG } from '@/config/constants'
import type { StockMarket, StockQuoteInfo } from '@/shared/types/common-types'
import { useFundStore, type StockEntry } from '@/modules/fund/fund-store'
import { classifyShare, stockMarketToTz } from '@/shared/market/market-classify'
import { secidFor } from '@/shared/market/secid'
import { normalizeStockCodeTencent } from '@/shared/net/tencent-codec'
import { resolveMarketTradingDays } from '@/shared/market/trading-day'
import { jsonpWithMirrors } from '@/shared/net/em-mirrors'
import { runBatched } from '@/shared/net/rate-limiter'
import { buildRealtimeQuote } from '@/modules/fund/calc/realtime-em-calc'
import { waitUntilVisible } from '@/shared/net/page-visibility'

let registered = false
let loopRunning = false
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatResolve: (() => void) | null = null

let closedSnapshotTaken = false

let lastSnapshotDay = ''

let preOpenPlaceholderDay = ''

let placeholderSet = false

let failedCodes = new Set<string>()

const RETRY_INTERVAL = 3000

function ensureRegistered(): void {
  if (registered) return
  registered = true
  workerManager.registerWorker(WORKER_NAMES.FUND_EM_REALTIME, () =>
    new Worker(new URL('../workers/em-realtime-worker.ts', import.meta.url), { type: 'module' }),
  )
}

export function startEmRealtimeLoop(): void {
  if (loopRunning) return
  ensureRegistered()
  loopRunning = true
  closedSnapshotTaken = false
  lastSnapshotDay = ''
  preOpenPlaceholderDay = ''
  placeholderSet = false
  void startWithPhase(0)
}

async function startWithPhase(slot: number): Promise<void> {
  const delay = (FUND_LOOP_CONFIG.LOOP_PHASE_JITTER / 3) * slot
  if (delay > 0) await new Promise<void>(r => setTimeout(r, delay))
  if (!loopRunning) return
  void runRelayLoop()
}

export function stopEmRealtimeLoop(): void {
  loopRunning = false
  if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null }
  if (heartbeatResolve) { const r = heartbeatResolve; heartbeatResolve = null; r() }
}

export function wakeEmRealtimeLoop(): void {
  if (!loopRunning) return
  closedSnapshotTaken = false
  preOpenPlaceholderDay = ''
  if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null }
  if (heartbeatResolve) { const r = heartbeatResolve; heartbeatResolve = null; r() }
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    heartbeatResolve = resolve
    heartbeatTimer = setTimeout(() => {
      heartbeatTimer = null
      heartbeatResolve = null
      resolve()
    }, ms)
  })
}

async function runRelayLoop(): Promise<void> {
  while (loopRunning) {
    await waitUntilVisible()
    if (!loopRunning) break
    const aTd = resolveMarketTradingDays('A')
    const hkTd = resolveMarketTradingDays('HK')
    const aNonTrading = aTd.isNonTradingDay
    const hkNonTrading = hkTd.isNonTradingDay

    const todayKey = aTd.currentTradingDay
    if (lastSnapshotDay && lastSnapshotDay !== todayKey) {
      closedSnapshotTaken = false
    }
    lastSnapshotDay = todayKey

    if (aNonTrading && hkNonTrading) {
      if (!closedSnapshotTaken) {
        await tickOnce()
        closedSnapshotTaken = true
      }
      await sleep(FUND_LOOP_CONFIG.HEARTBEAT_INTERVAL)
      continue
    }

    const aDone = aNonTrading || aTd.isClosed
    const hkDone = hkNonTrading || hkTd.isClosed
    if (aDone && hkDone) {
      if (!closedSnapshotTaken) {
        const got = await tickOnce()
        if (got > 0 && realtimeCacheCovered()) closedSnapshotTaken = true
      }
      await sleep(closedSnapshotTaken ? FUND_LOOP_CONFIG.HEARTBEAT_INTERVAL : RETRY_INTERVAL)
      continue
    }

    const aPreOpen = !aNonTrading && !aTd.hasOpened
    const hkPreOpen = !hkNonTrading && !hkTd.hasOpened
    if ((aPreOpen || aNonTrading) && (hkPreOpen || hkNonTrading)) {
      if (preOpenPlaceholderDay !== todayKey) {
        await tickOnce()
        preOpenPlaceholderDay = todayKey
      }
      await sleep(FUND_LOOP_CONFIG.HEARTBEAT_INTERVAL)
      continue
    }

    await tickOnce()
    await sleep(RETRY_INTERVAL)
  }
}

function realtimeCacheCovered(): boolean {
  if (failedCodes.size > 0) return false
  const store = useFundStore()
  const entries = store.collectAHkAll()
  if (entries.length === 0) return true
  const cache = store.stockRealtimeCache
  return entries.every((e) => {
    const { code } = normalizeStockCodeTencent(e.stockCode)
    return cache.has(code) || cache.has(e.stockCode)
  })
}

async function tickOnce(): Promise<number> {
  const store = useFundStore()

  if (!placeholderSet) {
    placeholderSet = true
    let changed = false
    for (const code of store.fundCodes) {
      const v = store.getValuation(code)
      if (!v || v.delayDays !== 1) continue
      if (v.realtimeGszzl == null) {
        v.realtimeGszzl = 0
        v.realtimeSource = '实时'
        changed = true
      }
    }
    if (changed) store.valuationMap = new Map(store.valuationMap)
  }

  const rtEntries = store.collectAHkAll()
  if (rtEntries.length === 0) return 0

  const closedMap = new Map<string, StockQuoteInfo>()
  const openEntries: Array<{ code: string; market: StockMarket }> = []
  const openRtEntries: StockEntry[] = []
  for (const e of rtEntries) {
    const { code } = normalizeStockCodeTencent(e.stockCode)
    const market = classifyShare(e.emMarketCode, code) as StockMarket
    const tz = stockMarketToTz(market)
    const td = resolveMarketTradingDays(tz)
    if (td.isNonTradingDay) {
      closedMap.set(code, buildRealtimeQuote(code, market, null, '休盘'))
    } else if (!td.hasOpened) {
      closedMap.set(code, buildRealtimeQuote(code, market, null, '未开盘'))
    } else {
      openEntries.push({ code, market })
      openRtEntries.push(e)
    }
  }

  if (closedMap.size > 0) await store.mergeRealtimeToCache(closedMap, rtEntries)

  if (openEntries.length === 0) return closedMap.size

  try {
    const result = await workerManager.request<
      Array<{ code: string; market: StockMarket }>,
      Map<string, StockQuoteInfo>
    >(WORKER_NAMES.FUND_EM_REALTIME, 'realtime-batch', openEntries, FUND_LOOP_CONFIG.WORKER_TIMEOUT)

    const rtMap = new Map<string, StockQuoteInfo>(result)

    const fallbackEntries: StockEntry[] = []
    for (let i = 0; i < openEntries.length; i++) {
      if (!rtMap.has(openEntries[i].code)) {
        fallbackEntries.push(openRtEntries[i])
      }
    }

    if (rtMap.size > 0) {
      await store.mergeRealtimeToCache(rtMap, openRtEntries)
    }

    if (fallbackEntries.length > 0) {
      const stillFailed = new Set<string>()
      await runBatched(fallbackEntries, FUND_LOOP_CONFIG.REALTIME_FALLBACK_CONCURRENCY, 0, async (e) => {
        const info = await fetchEmRealtimeFallback(e)
        const { code } = normalizeStockCodeTencent(e.stockCode)
        if (info) {
          const batchMap = new Map<string, StockQuoteInfo>()
          batchMap.set(code, info)
          await store.mergeRealtimeToCache(batchMap, [e])
        } else {
          stillFailed.add(code)
        }
      })
      failedCodes = stillFailed
    } else {
      failedCodes = new Set()
    }
    return rtMap.size + closedMap.size
  } catch {
    return closedMap.size
  }
}

async function fetchEmRealtimeFallback(entry: StockEntry): Promise<StockQuoteInfo | null> {
  const { code } = normalizeStockCodeTencent(entry.stockCode)
  const market = classifyShare(entry.emMarketCode, code)
  const secid = secidFor(code, entry.emMarketCode)
  if (!secid) return null

  try {
    const data = await jsonpWithMirrors<any>(
      '/api/qt/ulist.np/get',
      `secids=${secid}&fields=f3`,
      'rt',
      FUND_LOOP_CONFIG.EM_FALLBACK_TIMEOUT,
    )
    const rate = data?.data?.diff?.[0]?.f3
    if (!Number.isFinite(rate)) return null
    return buildRealtimeQuote(code, market, rate, '东财')
  } catch {
    return null
  }
}
