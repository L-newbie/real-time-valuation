

import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type {
  FundValuation, EstimatedHoldings, EstimatedHoldingItem,
  IntradayPoint, FundAllHoldings, FundCache, ViewMode, SortField, SortDirection, ColumnConfig,
} from '@/modules/fund/fund-types'
import type { StockQuoteInfo, StockMarket } from '@/shared/types/common-types'
import { RefreshStatus } from '@/config/enums'
import {STORAGE_KEYS, DEFAULT_SETTINGS, ESTIMATE_CONFIG, INTRADAY_CONFIG} from '@/config/constants'
import { loadJSON, saveJSON, loadString, saveString, removeKey } from '@/shared/cache/local-storage-io'
import { isValidFundCode } from '@/shared/utils/validation'
import { getBeijingTodayStr, getPreviousTradingDay, isCnTradingDay, getBusinessDay, getPreviousBusinessTradingDay } from '@/modules/fund/valuation/cn-trading-day'
import { classifyShare } from '@/shared/market/market-classify'
import { stockMarketToTz, detectMarketByEmCode } from '@/shared/market/market-classify'
import { resolveMarketTradingDays, isMarketLive } from '@/shared/market/trading-day'
import { normalizeStockCodeTencent } from '@/shared/net/tencent-codec'
import { usExtendedSession } from '@/shared/net/tencent-fetch'
import { computeEstimatedGszzlFromPrevDay } from '@/modules/fund/calc/gszzl-weight'
import { beijingNow } from '@/shared/utils/date-format'
import { fetchEstimatedHoldings, type FetchStockQuotes } from '@/modules/fund/holdings/estimated-holdings'
import { fetchTop10FromMobileApi } from '@/modules/fund/holdings/f10-mobile-fetch'
import { fetchTop10FromPingzhong } from '@/modules/fund/holdings/pingzhong-holdings-fetch'
import type { PingzhongPreloaded } from '@/modules/fund/holdings/pingzhong-holdings-fetch'
import { generateIntradayPoints, isCnMarketOpenForIntraday, keepTodayPoints } from '@/modules/fund/intraday/intraday-points'
import { fetchIntradayEstimate } from '@/modules/fund/intraday/intraday-estimate-fetch'
import { batchGetValuation } from '@/modules/fund/valuation/fund-valuation-merge'
import { getFundType } from '@/modules/fund/catalog/fund-code-catalog'
import { useCacheStore } from '@/modules/fund/cache-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { recordHit, recordMiss, recordWrite, recordReject, recordKeys } from '@/shared/cache/hit-stats'
import { defineCache } from '@/shared/cache/define-cache'

interface EstimatedCacheEntry { data: EstimatedHoldings; cachedDate: string }

interface T1CacheEntry { data: FundAllHoldings; cachedDate: string }

export interface StockEntry { stockCode: string; emMarketCode?: string; stockName?: string }

const MAX_ESTIMATED_CACHE = ESTIMATE_CONFIG.MAX_ESTIMATED_CACHE

const prevDayCache = defineCache<StockQuoteInfo>({
  pool: 'shared',
  name: 'stock-prev-day',
  ttl: 24 * 60 * 60 * 1000,
  max: 800,
  isEmpty: (v) => v?.changeRate == null && !v?.closed,
})

const realtimeCache = defineCache<StockQuoteInfo>({
  pool: 'shared',
  name: 'stock-realtime',
  ttl: 24 * 60 * 60 * 1000,
  max: 800,
  isEmpty: (v) => v?.changeRate == null && !v?.closed,
})

const intradayCache = defineCache<IntradayPoint[]>({
  pool: 'fund',
  name: 'intraday',
  ttl: 24 * 60 * 60 * 1000,
  max: 60,
  isEmpty: (v) => !v?.length,
})

const holdingsCache = defineCache<EstimatedHoldings>({
  pool: 'fund',
  name: 'holdings',
  ttl: 100 * 24 * 60 * 60 * 1000,
  max: MAX_ESTIMATED_CACHE,
  isEmpty: (v) => !v?.holdings?.length,
  quality: (v) => (v.holdings.some(h => h.ratio > 0) ? 100 : 40),
})

const t1Cache = defineCache<FundAllHoldings>({
  pool: 'fund',
  name: 't1-holdings',
  ttl: 100 * 24 * 60 * 60 * 1000,
  max: MAX_ESTIMATED_CACHE,
  isEmpty: (v) => !v?.holdings?.length,
})

function expectedConfirmDate(delayDays?: 1 | 2): string {
  return delayDays === 2 ? getPreviousBusinessTradingDay() : getBusinessDay()
}

function isConfirmationFresh(v: { jzrq?: string; delayDays?: 1 | 2 } | undefined): boolean {
  if (!v?.jzrq) return false
  return v.jzrq >= expectedConfirmDate(v.delayDays)
}

function isValuationFresh(v: { jzrq?: string; delayDays?: 1 | 2; gztime?: string } | undefined): boolean {
  if (!v) return false
  if (isConfirmationFresh(v)) return true
  return (v.gztime?.substring(0, 10) || '') === getBusinessDay()
}

export const useFundStore = defineStore('fund', () => {
  const fundCodes = ref<string[]>([])

  const fundNameMap = ref<Record<string, string>>({})

  const valuationMap = ref<Map<string, FundValuation>>(new Map())

  const estimatedGszzlMap = ref<Map<string, number>>(new Map())

  const stockPrevDayCache = shallowRef<Map<string, StockQuoteInfo>>(new Map())

  const stockRealtimeCache = shallowRef<Map<string, StockQuoteInfo>>(new Map())

  const t1HoldingsCache = ref<Map<string, T1CacheEntry>>(new Map())

  const estimatedHoldingsCache = ref<Map<string, EstimatedCacheEntry>>(new Map())

  const intradayMap = ref<Record<string, IntradayPoint[]>>({})

  const refreshStatus = ref<RefreshStatus>(RefreshStatus.Idle)

  const lastRefreshTime = ref<number>(0)

  const lastBusinessDay = ref<string>('')

  const viewMode = ref<ViewMode>('table')

  const sortField = ref<SortField>('changeRate')

  const sortDirection = ref<SortDirection>('desc')

  const columnConfig = ref<ColumnConfig[]>(initColumnConfig())

  const pendingT1Requests = new Map<string, Promise<FundAllHoldings | null>>()
  const pendingEstimationRequests = new Map<string, Promise<EstimatedHoldings | null>>()

  const isLoading = computed(() => refreshStatus.value === RefreshStatus.Loading)
  const fundCount = computed(() => fundCodes.value.length)

  const t2HintPending = ref(false)

  const HOLDINGS_MAX_AGE_DAYS = 100

  function isHoldingsUsable(entry: EstimatedCacheEntry | undefined): entry is EstimatedCacheEntry {
    if (!entry?.data?.holdings?.length) return false
    if (entry.cachedDate === getBusinessDay()) return true
    const age = dayDiff(entry.cachedDate, getBusinessDay())
    return age >= 0 && age <= HOLDINGS_MAX_AGE_DAYS
  }

  function isT1HoldingsUsable(entry: T1CacheEntry | undefined): entry is T1CacheEntry {
    if (!entry?.data?.holdings?.length) return false
    if (entry.cachedDate === getBusinessDay()) return true
    const age = dayDiff(entry.cachedDate, getBusinessDay())
    return age >= 0 && age <= HOLDINGS_MAX_AGE_DAYS
  }

  function dayDiff(from: string, to: string): number {
    const a = Date.parse(from), b = Date.parse(to)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.MAX_SAFE_INTEGER
    return Math.round((b - a) / 86400000)
  }

  function getValuation(fundCode: string): FundValuation | undefined {
    return valuationMap.value.get(fundCode)
  }

  function isSameBusinessDayAsLastRefresh(): boolean {
    return !!lastBusinessDay.value && lastBusinessDay.value === getBusinessDay()
  }

  function addFund(code: string, name?: string, groupId?: string): boolean {
    if (!isValidFundCode(code)) return false
    const isNew = !fundCodes.value.includes(code)
    if (isNew) {
      fundCodes.value = [...fundCodes.value, code]
      invalidateStockIndex()
      persistFundCodes()
    }
    if (name) setFundName(code, name)

    const groupStore = useGroupStore()
    groupStore.addToGroup(groupId ?? groupStore.activeGroupId, [code])

    return isNew
  }

  function removeFund(code: string): void {
    fundCodes.value = fundCodes.value.filter(c => c !== code)
    invalidateStockIndex()
    persistFundCodes()

    const groupStore = useGroupStore()
    for (const gid of groupStore.groupsOf(code)) groupStore.removeFromGroup(gid, code)

    useHoldingStore().removeHoldingsByFund(code)

    valuationMap.value.delete(code)
    valuationMap.value = new Map(valuationMap.value)
    estimatedHoldingsCache.value.delete(code)
    invalidateStockIndex()
    t1HoldingsCache.value.delete(code)
    estimatedGszzlMap.value.delete(code)
    if (intradayMap.value[code]) {
      const next = { ...intradayMap.value }
      delete next[code]
      intradayMap.value = next
    }
    useCacheStore().removeCache(code)

    persistEstimatedHoldingsCache()
    persistEstimatedGszzlMap()
    persistIntradayMap()
  }

  function batchAddFunds(items: (string | { code: string; name?: string })[], groupId?: string): number {
    const valid = items.filter((it): it is { code: string; name?: string } => {
      const code = typeof it === 'string' ? it : it.code
      return isValidFundCode(code) && !fundCodes.value.includes(code)
    })
    fundCodes.value = [...fundCodes.value, ...valid.map(v => v.code)]
    invalidateStockIndex()
    for (const v of valid) if (v.name) setFundName(v.code, v.name)
    persistFundCodes()

    const groupStore = useGroupStore()
    const target = groupId ?? groupStore.activeGroupId
    const codes = items.map(it => (typeof it === 'string' ? it : it.code)).filter(c => isValidFundCode(c))
    groupStore.addToGroup(target, codes)

    return valid.length
  }

  function setFundName(code: string, name: string): void {
    if (!name || fundNameMap.value[code] === name) return
    fundNameMap.value = { ...fundNameMap.value, [code]: name }
    saveJSON(STORAGE_KEYS.FUND_NAMES, fundNameMap.value)
  }

  function getFundName(code: string): string {
    return fundNameMap.value[code] ?? ''
  }

  function resolveFundName(code: string): string {
    const raw = getValuation(code)?.name ?? ''
    if (raw && !raw.startsWith('基金(')) return raw
    return getFundName(code) || code
  }

  function stripPlaceholderName(name: string | undefined, code: string): string {
    if (!name) return ''
    if (name === `基金(${code})`) return ''
    return name
  }

  function restoreFundCodes(): void {
    const codes = loadJSON<string[]>(STORAGE_KEYS.FUND_CODES, [])
    fundCodes.value = codes.filter(c => isValidFundCode(c))
    invalidateStockIndex()
  }

  function restoreFundNames(): void {
    fundNameMap.value = loadJSON<Record<string, string>>(STORAGE_KEYS.FUND_NAMES, {})
  }

  function persistFundCodes(): void {
    saveJSON(STORAGE_KEYS.FUND_CODES, fundCodes.value)
  }

  function restoreLastBusinessDay(): void {
    lastBusinessDay.value = loadString(STORAGE_KEYS.LAST_BUSINESS_DAY) ?? ''
  }

  function persistLastBusinessDay(): void {
    saveString(STORAGE_KEYS.LAST_BUSINESS_DAY, lastBusinessDay.value)
  }

  function restoreStockCaches(): void {
    const raw = loadJSON<Record<string, StockQuoteInfo> | null>(STORAGE_KEYS.STOCK_PREV_DAY_CACHE, null)
    if (raw) {
      const kept = new Map<string, StockQuoteInfo>()
      let changed = false
      for (const [code, info] of Object.entries(raw)) {
        if (!info || !prevDayEntryStillValid(info)) { changed = true; continue }
        kept.set(code, info)
      }
      stockPrevDayCache.value = kept

      if (changed) persistStockPrevDayCache()
      if (kept.size === 0) {
        removeKey(STORAGE_KEYS.STOCK_PREV_DAY_CACHE)
        removeKey(STORAGE_KEYS.STOCK_PREV_DAY_DATE)
      }
    } else {
      stockPrevDayCache.value = new Map()
    }
    const rtDate = loadString(STORAGE_KEYS.STOCK_REALTIME_DATE)
    if (rtDate) {
      const raw = loadJSON<Record<string, StockQuoteInfo> | null>(STORAGE_KEYS.STOCK_REALTIME_CACHE, null)
      if (raw) {
        const kept = new Map<string, StockQuoteInfo>()
        let changed = false
        for (const [code, info] of Object.entries(raw)) {
          if (!info || !realtimeEntryStillValid(info)) { changed = true; continue }
          kept.set(code, info)
        }
        stockRealtimeCache.value = kept

        if (changed) persistStockRealtimeCache()
      } else {
        stockRealtimeCache.value = new Map()
        removeKey(STORAGE_KEYS.STOCK_REALTIME_CACHE)
        removeKey(STORAGE_KEYS.STOCK_REALTIME_DATE)
      }
    } else {
      stockRealtimeCache.value = new Map()
    }
  }

  function isFundMarketQuiet(holdings: EstimatedHoldingItem[]): boolean {
    let known = false
    for (const h of holdings) {
      const { code } = normalizeStockCodeTencent(h.stockCode)

      const em = h.emMarketCode ?? ''
      const market = em ? detectMarketByEmCode(em) : classifyShare(em, code)
      const tz = stockMarketToTz(market)
      if (tz === 'unknown') continue
      known = true

      if (tz === 'US') return false
      if (isMarketLive(tz)) return false
    }
    return known
  }

  function realtimeEntryStillValid(info: StockQuoteInfo): boolean {
    if (info.closed) return true
    if (!info.market) return false
    const tz = stockMarketToTz(info.market)

    if (tz === 'unknown') return false
    if (!info.date || info.date !== resolveMarketTradingDays(tz).currentTradingDay) return false

    if (info.market === 'US') {
      const cur = usExtendedSession()
      if (cur === 'PRE' && info.session !== 'PRE') return false
      if (cur === 'POST' && info.session !== 'POST') return false
    }
    return true
  }

  function prevDayEntryStillValid(info: StockQuoteInfo): boolean {
    if (info.closed) return true
    if (!info.market) return false
    const tz = stockMarketToTz(info.market)
    if (tz === 'unknown') return false
    if (!info.date) return false
    return info.date === resolveMarketTradingDays(tz).lastClosedDay
  }

  function getRealtimeCacheDay(): string {
    return isCnTradingDay() ? getBeijingTodayStr() : getPreviousTradingDay()
  }

  function persistStockPrevDayCache(): void {
    const obj: Record<string, StockQuoteInfo> = {}
    for (const [code, info] of stockPrevDayCache.value) obj[code] = info
    saveJSON(STORAGE_KEYS.STOCK_PREV_DAY_CACHE, obj)
  }

  function persistStockRealtimeCache(): void {
    const obj: Record<string, StockQuoteInfo> = {}
    for (const [code, info] of stockRealtimeCache.value) obj[code] = info
    saveJSON(STORAGE_KEYS.STOCK_REALTIME_CACHE, obj)
    saveString(STORAGE_KEYS.STOCK_REALTIME_DATE, getRealtimeCacheDay())
  }

  function restoreEstimatedGszzlMap(): void {
    const date = loadString(STORAGE_KEYS.ESTIMATED_GSZZL_DATE)
    if (date !== getBusinessDay()) {
      removeKey(STORAGE_KEYS.ESTIMATED_GSZZL_CACHE)
      removeKey(STORAGE_KEYS.ESTIMATED_GSZZL_DATE)
      return
    }
    const raw = loadJSON<Record<string, number> | null>(STORAGE_KEYS.ESTIMATED_GSZZL_CACHE, null)
    if (raw && typeof raw === 'object') {
      estimatedGszzlMap.value = new Map(Object.entries(raw))
    }
  }

  function persistEstimatedGszzlMap(): void {
    const obj: Record<string, number> = {}
    for (const [code, gszzl] of estimatedGszzlMap.value) obj[code] = gszzl
    saveJSON(STORAGE_KEYS.ESTIMATED_GSZZL_CACHE, obj)
    saveString(STORAGE_KEYS.ESTIMATED_GSZZL_DATE, getBusinessDay())
  }

  function restoreT1HoldingsCache(): void {
    const date = loadString(STORAGE_KEYS.T1_HOLDINGS_DATE)
    if (!date || dayDiff(date, getBusinessDay()) > HOLDINGS_MAX_AGE_DAYS) {
      removeKey(STORAGE_KEYS.T1_HOLDINGS_CACHE)
      removeKey(STORAGE_KEYS.T1_HOLDINGS_DATE)
      return
    }
    const raw = loadJSON<Record<string, { data: FundAllHoldings; cachedDate: string }> | null>(STORAGE_KEYS.T1_HOLDINGS_CACHE, null)
    if (raw && typeof raw === 'object') {
      const map = new Map<string, T1CacheEntry>()
      for (const [code, entry] of Object.entries(raw)) {
        if (entry?.data?.holdings?.length) map.set(code, { data: entry.data, cachedDate: date })
      }
      t1HoldingsCache.value = map
    }
  }

  function persistT1HoldingsCache(): void {
    for (const [code, e] of t1HoldingsCache.value) t1Cache.set(code, e.data)
    recordWrite('T+1持仓')
    recordKeys('T+1持仓', t1HoldingsCache.value.size)
    const obj: Record<string, { data: FundAllHoldings; cachedDate: string }> = {}
    for (const [code, entry] of t1HoldingsCache.value) obj[code] = { data: entry.data, cachedDate: entry.cachedDate }
    saveJSON(STORAGE_KEYS.T1_HOLDINGS_CACHE, obj)
    saveString(STORAGE_KEYS.T1_HOLDINGS_DATE, getBusinessDay())
  }

  function restoreEstimatedHoldingsCache(): void {
    const date = loadString(STORAGE_KEYS.ESTIMATED_HOLDINGS_DATE)
    if (!date || dayDiff(date, getBusinessDay()) > HOLDINGS_MAX_AGE_DAYS) {
      removeKey(STORAGE_KEYS.ESTIMATED_HOLDINGS_CACHE)
      removeKey(STORAGE_KEYS.ESTIMATED_HOLDINGS_DATE)
      return
    }
    const raw = loadJSON<Record<string, { data: EstimatedHoldings; cachedDate: string }> | null>(STORAGE_KEYS.ESTIMATED_HOLDINGS_CACHE, null)
    if (raw && typeof raw === 'object') {
      const map = new Map<string, EstimatedCacheEntry>()
      for (const [code, entry] of Object.entries(raw)) {
        if (entry?.data?.holdings?.length) {
          if (!entry.data.holdings.some(h => h.ratio > 0)) continue
          entry.data.stockQuoteMap = undefined
          entry.data.stockQuotesReady = undefined
          entry.data.holdingsEnrichedReady = undefined
          map.set(code, { data: entry.data, cachedDate: date })
        }
      }
      estimatedHoldingsCache.value = map
      invalidateStockIndex()
    }
  }

  function persistEstimatedHoldingsCache(): void {
    for (const [code, e] of estimatedHoldingsCache.value) holdingsCache.set(code, e.data)
    recordWrite('推算持仓')
    recordKeys('推算持仓', estimatedHoldingsCache.value.size)
    const obj: Record<string, { data: EstimatedHoldings; cachedDate: string }> = {}
    for (const [code, entry] of estimatedHoldingsCache.value) {
      const data: EstimatedHoldings = {
        ...entry.data,
        stockQuoteMap: undefined,
        stockQuotesReady: undefined,
        holdingsEnrichedReady: undefined,
      }
      obj[code] = { data, cachedDate: entry.cachedDate }
    }
    saveJSON(STORAGE_KEYS.ESTIMATED_HOLDINGS_CACHE, obj)
    saveString(STORAGE_KEYS.ESTIMATED_HOLDINGS_DATE, getBusinessDay())
  }

  function restoreIntradayMap(): void {
    if (loadString(STORAGE_KEYS.INTRADAY_MAP_DATE) !== getBusinessDay()) {
      removeKey(STORAGE_KEYS.INTRADAY_MAP)
      removeKey(STORAGE_KEYS.INTRADAY_MAP_DATE)
      return
    }
    const raw = loadJSON<Record<string, IntradayPoint[]> | null>(STORAGE_KEYS.INTRADAY_MAP, null)
    if (!raw || typeof raw !== 'object') return
    const kept: Record<string, IntradayPoint[]> = {}
    for (const [code, points] of Object.entries(raw)) {
      const todayPoints = keepTodayPoints(points)
      if (todayPoints.length > 0) kept[code] = todayPoints
    }
    intradayMap.value = kept
  }

  function persistIntradayMap(): void {
    for (const [code, pts] of Object.entries(intradayMap.value)) intradayCache.set(code, pts)
    saveJSON(STORAGE_KEYS.INTRADAY_MAP, intradayMap.value)
    saveString(STORAGE_KEYS.INTRADAY_MAP_DATE, getBusinessDay())
  }

  let prevDayDirty: Set<string> | null = null
  let realtimeDirty: Set<string> | null = null
  let flushPromise: Promise<void> | null = null

  function scheduleQuoteFlush(): Promise<void> {
    if (flushPromise) return flushPromise
    flushPromise = Promise.resolve().then(() => {
      flushPromise = null
      return flushQuoteBatch()
    })
    return flushPromise
  }

  async function flushQuoteBatch(): Promise<void> {
    const prevKeys = prevDayDirty
    const rtKeys = realtimeDirty
    prevDayDirty = null
    realtimeDirty = null

    const touched = new Set<string>()

    if (prevKeys && prevKeys.size > 0) {
      stockPrevDayCache.value = new Map(stockPrevDayCache.value)
      recordKeys('股票昨收', stockPrevDayCache.value.size)
      persistStockPrevDayCache()
      for (const k of prevKeys) touched.add(k)
    }
    if (rtKeys && rtKeys.size > 0) {
      stockRealtimeCache.value = new Map(stockRealtimeCache.value)
      recordKeys('股票实时', stockRealtimeCache.value.size)
      persistStockRealtimeCache()
      for (const k of rtKeys) touched.add(k)
    }

    if (touched.size > 0) await recomputeFundsForStocks(touched)
  }

  function applyQuotes(
    target: Map<string, StockQuoteInfo>,
    quoteMap: Map<string, StockQuoteInfo>,
    holdings: { stockCode: string }[],
    label: '股票昨收' | '股票实时',
  ): Set<string> {
    const accepted = new Set<string>()
    for (const [code, info] of quoteMap) {
      if (info.changeRate != null || info.closed) { target.set(code, info); accepted.add(code) }
      else recordReject(label)
    }
    recordWrite(label)

    for (const h of holdings) {
      const { code: normalizedCode } = normalizeStockCodeTencent(h.stockCode)
      const info = target.get(normalizedCode) ?? target.get(h.stockCode)
      if (info) target.set(h.stockCode, info)
    }
    return accepted
  }

  async function mergeStockQuotesToCache(
    quoteMap: Map<string, StockQuoteInfo>,
    holdings: { stockCode: string }[],
  ): Promise<void> {
    if (quoteMap.size === 0) return
    const accepted = applyQuotes(stockPrevDayCache.value, quoteMap, holdings, '股票昨收')
    for (const [k, v] of quoteMap) if (v.changeRate != null || v.closed) prevDayCache.set(k, v)
    invalidateHoldingScan()

    if (!prevDayDirty) prevDayDirty = new Set()
    for (const k of accepted) prevDayDirty.add(k)
    await scheduleQuoteFlush()
  }

  async function mergeRealtimeToCache(
    quoteMap: Map<string, StockQuoteInfo>,
    holdings: { stockCode: string }[],
  ): Promise<void> {
    if (quoteMap.size === 0) return
    const accepted = applyQuotes(stockRealtimeCache.value, quoteMap, holdings, '股票实时')
    for (const [k, v] of quoteMap) if (v.changeRate != null || v.closed) realtimeCache.set(k, v)

    if (!realtimeDirty) realtimeDirty = new Set()
    for (const k of accepted) realtimeDirty.add(k)
    await scheduleQuoteFlush()
  }

  interface HoldingScan {
    aStock: StockEntry[]
    hkStock: StockEntry[]
    usStock: StockEntry[]
    overseas: StockEntry[]
    aHkAll: StockEntry[]
    overseasAll: StockEntry[]
    usAll: StockEntry[]
  }

  let scanCache: { at: number; data: HoldingScan } | null = null

  const SCAN_TTL = 500

  function invalidateHoldingScan(): void {
    scanCache = null
  }

  let stockToFunds: Map<string, Set<string>> | null = null

  function invalidateStockIndex(): void {
    stockToFunds = null
    scanCache = null
  }

  function setHoldingsEntry(fundCode: string, entry: EstimatedCacheEntry): void {
    lruSet(estimatedHoldingsCache.value, fundCode, entry, MAX_ESTIMATED_CACHE)
    invalidateStockIndex()
  }

  function buildStockIndex(): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>()
    for (const fundCode of fundCodes.value) {
      const cached = estimatedHoldingsCache.value.get(fundCode)
      if (!isHoldingsUsable(cached)) continue

      for (const h of cached.data.holdings) {
        const nc = normalizeStockCodeTencent(h.stockCode).code
        for (const key of [h.stockCode, nc]) {
          let set = index.get(key)
          if (!set) { set = new Set(); index.set(key, set) }
          set.add(fundCode)
        }
      }
    }
    return index
  }

  function fundsHoldingStocks(stockCodes: Iterable<string>): Map<string, EstimatedHoldingItem[]> {
    if (!stockToFunds) stockToFunds = buildStockIndex()

    const candidates = new Set<string>()
    for (const sc of stockCodes) {
      const funds = stockToFunds.get(sc)
      if (funds) for (const f of funds) candidates.add(f)
    }

    const result = new Map<string, EstimatedHoldingItem[]>()
    for (const fundCode of candidates) {
      const v = valuationMap.value.get(fundCode)
      if (!v) continue
      if (v.delayDays !== 1 && v.delayDays !== 2) continue
      const cached = estimatedHoldingsCache.value.get(fundCode)
      if (!isHoldingsUsable(cached)) continue
      result.set(fundCode, cached.data.holdings)
    }
    return result
  }

  async function recomputeFundsForStocks(stockCodes: Iterable<string>): Promise<void> {
    const settingsStore = useSettingsStore()
    const predictionEnabled = settingsStore.enablePrediction
    const affectedFunds = fundsHoldingStocks(stockCodes)
    let gszzlDirty = false
    for (const [fundCode, holdings] of affectedFunds) {
      const v = valuationMap.value.get(fundCode)
      if (!v) continue

      if (v.delayDays === 2 && v.isEstimated) {
        const gszzl = computeEstimatedGszzlFromPrevDay(holdings, stockPrevDayCache.value)
        if (gszzl != null) {
          v.gszzl = gszzl
          if (v.dwjz > 0) v.gz = v.dwjz * (1 + gszzl / 100)
          estimatedGszzlMap.value.set(fundCode, gszzl)
          gszzlDirty = true
        }
      }

      if (!predictionEnabled) {
        valuationMap.value.set(fundCode, v)
        continue
      }
      const rtLabel = '实时'
      const realtimeMapForFund = new Map<string, StockQuoteInfo>()
      let allHoldingsCached = true
      for (const h of holdings) {
        const nc = normalizeStockCodeTencent(h.stockCode).code
        const info = stockRealtimeCache.value.get(nc) ?? stockRealtimeCache.value.get(h.stockCode)
        if (!info) { allHoldingsCached = false; continue }

        if (info.changeRate == null) continue
        if (!realtimeEntryStillValid(info)) { allHoldingsCached = false; continue }
        realtimeMapForFund.set(h.stockCode, info)
      }
      const rtGszzl = computeEstimatedGszzlFromPrevDay(holdings, realtimeMapForFund)
      if (rtGszzl != null) {
        v.realtimeGszzl = rtGszzl
        v.realtimeSource = rtLabel
        v.realtimeUpdatedAt = beijingNow().format('HH:mm')
      } else if (allHoldingsCached && realtimeMapForFund.size === 0) {
        v.realtimeGszzl = 0
        v.realtimeSource = '休盘'
        v.realtimeUpdatedAt = beijingNow().format('HH:mm')
      } else if (isFundMarketQuiet(holdings)) {
        v.realtimeGszzl = 0
        v.realtimeSource = '休盘'
        v.realtimeUpdatedAt = undefined
      }
      valuationMap.value.set(fundCode, v)

      const isFreshT2Estimate = v.delayDays === 2 && v.isEstimated && isSameBusinessDayAsLastRefresh()
      if (!isValuationFresh(v) && !isFreshT2Estimate) continue
      const cs = useCacheStore()
      const existing = cs.getCache(fundCode)
      cs.saveCache({
        fundCode,
        fundName: existing?.fundName || getFundName(fundCode) || '',
        valuation: v,
        info: existing?.info ?? null,
        cachedAt: Date.now(),
        cachedDate: getBusinessDay(),
      })
    }

    if (gszzlDirty) persistEstimatedGszzlMap()
    valuationMap.value = new Map(valuationMap.value)
  }

  function recomputeAllFromCache(): void {
    const allStockCodes = new Set<string>()
    const today = getBusinessDay()
    for (const [, entry] of estimatedHoldingsCache.value) {
      if (entry.cachedDate !== today) continue
      for (const h of entry.data.holdings) {
        allStockCodes.add(h.stockCode)
        allStockCodes.add(normalizeStockCodeTencent(h.stockCode).code)
      }
    }
    if (allStockCodes.size === 0) return
    void recomputeFundsForStocks(allStockCodes)
  }

  function holdingsQuality(e: EstimatedHoldings): number {
    if (!e.holdings?.length) return 0
    let q = 10
    if (e.holdings.some(h => h.ratio > 0)) q += 50
    if (e.holdings.some(h => h.emMarketCode)) q += 20
    if (e.holdings.some(h => h.stockName)) q += 15
    if (e.quarterReportDate) q += 5
    return q
  }

  function mergeEstimation(prev: EstimatedHoldings, next: EstimatedHoldings): EstimatedHoldings {
    if (!prev.holdings?.length) return next
    if (!next.holdings?.length) return prev
    if (holdingsQuality(next) >= holdingsQuality(prev)) {
      carryOverRatios(prev, next)
      return next
    }
    carryOverRatios(next, prev)
    return prev
  }

  function carryOverRatios(prev: EstimatedHoldings, next: EstimatedHoldings): void {
    if (!prev.holdings?.length || !next.holdings?.length) return

    const byCode = new Map<string, { ratio: number; name: string; em: string }>()
    for (const h of prev.holdings) {
      byCode.set(h.stockCode.toUpperCase(), {
        ratio: h.ratio,
        name: h.stockName ?? '',
        em: h.emMarketCode ?? '',
      })
    }
    if (byCode.size === 0) return

    let filledRatio = false
    for (const h of next.holdings) {
      const p = byCode.get(h.stockCode.toUpperCase())
      if (!p) continue
      if (!(h.ratio > 0) && p.ratio > 0) { h.ratio = p.ratio; filledRatio = true }
      if (!h.stockName && p.name) h.stockName = p.name
      if (!h.emMarketCode && p.em) h.emMarketCode = p.em
    }
    if (filledRatio && next.description.includes('无占比')) {
      next.description = '前十大重仓及占比'
    }
  }

  async function refreshHoldingsInBackground(
    fundCode: string,
    fetchStockQuotes: FetchStockQuotes,
    preloaded?: PingzhongPreloaded,
  ): Promise<void> {
    try {
      const fetched = await fetchEstimatedHoldings(fundCode, undefined, fetchStockQuotes, preloaded)
      if (!fetched) return
      const prev = estimatedHoldingsCache.value.get(fundCode)?.data
      const est = prev ? mergeEstimation(prev, fetched) : fetched
      setHoldingsEntry(fundCode, { data: est, cachedDate: getBusinessDay() })
      persistEstimatedHoldingsCache()
      void recomputeFundsForStocks(est.holdings.map(h => h.stockCode))
    } catch {  }
  }

  function getEstimatedHoldings(
    fundCode: string,
    fetchStockQuotes: FetchStockQuotes,
    preloaded?: PingzhongPreloaded,
  ): Promise<EstimatedHoldings | null> {
    const today = getBusinessDay()
    const cached = estimatedHoldingsCache.value.get(fundCode)
    if (cached?.cachedDate === today) {
      recordHit('推算持仓')
      return Promise.resolve(cached.data)
    }
    if (isHoldingsUsable(cached)) {
      recordHit('推算持仓')
      if (!pendingEstimationRequests.has(fundCode)) {
        void refreshHoldingsInBackground(fundCode, fetchStockQuotes, preloaded)
      }
      return Promise.resolve(cached!.data)
    }

    recordMiss('推算持仓')
    const pending = pendingEstimationRequests.get(fundCode)
    if (pending) return pending

    const promise = (async (): Promise<EstimatedHoldings | null> => {
      try {
        const fetched = await fetchEstimatedHoldings(fundCode, undefined, fetchStockQuotes, preloaded)
        let est = fetched
        if (fetched) {
          const prev = estimatedHoldingsCache.value.get(fundCode)?.data
          const est = prev ? mergeEstimation(prev, fetched) : fetched
          setHoldingsEntry(fundCode, { data: est, cachedDate: today })
          persistEstimatedHoldingsCache()

          if (est.stockQuoteMap && est.stockQuoteMap.size > 0) {
            void mergeStockQuotesToCache(est.stockQuoteMap, est.holdings)
          }

          if (est.stockQuotesReady) {
            est.stockQuotesReady.then(() => {
              if (est.stockQuoteMap && est.stockQuoteMap.size > 0) {
                void mergeStockQuotesToCache(est.stockQuoteMap, est.holdings)
              }
            }).catch(() => {  })
          }

          if (est.holdingsEnrichedReady) {
            est.holdingsEnrichedReady.then(() => {
              try {
                setHoldingsEntry(fundCode, { data: est, cachedDate: getBusinessDay() })
                persistEstimatedHoldingsCache()

                void recomputeFundsForStocks(est.holdings.map(h => h.stockCode))
              } catch {  }
            }).catch(() => {  })
          }
        }
        return estimatedHoldingsCache.value.get(fundCode)?.data ?? fetched
      } finally {
        pendingEstimationRequests.delete(fundCode)
      }
    })()

    pendingEstimationRequests.set(fundCode, promise)
    return promise
  }

  function getT1Holdings(fundCode: string): Promise<FundAllHoldings | null> {
    const today = getBusinessDay()
    const cached = t1HoldingsCache.value.get(fundCode)
    if (cached?.cachedDate === today) {
      recordHit('T+1持仓')
      return Promise.resolve(cached.data)
    }
    if (isT1HoldingsUsable(cached)) {
      recordHit('T+1持仓')
      return Promise.resolve(cached.data)
    }
    recordMiss('T+1持仓')

    const pending = pendingT1Requests.get(fundCode)
    if (pending) return pending

    const promise = (async (): Promise<FundAllHoldings | null> => {
      try {
        const est = estimatedHoldingsCache.value.get(fundCode)
        let result: FundAllHoldings | null =
          isHoldingsUsable(est)
            ? {
                reportDate: est.data.quarterReportDate,
                reportType: '季报',
                isFull: false,
                holdings: est.data.holdings,
              }
            : null

        if (!result) {
          result = await fetchTop10FromMobileApi(fundCode)
          if (!result || result.holdings.length === 0) {
            result = await fetchTop10FromPingzhong(fundCode)
          }
        }
        if (result) {
          lruSet(t1HoldingsCache.value, fundCode, { data: result, cachedDate: today }, MAX_ESTIMATED_CACHE)
          persistT1HoldingsCache()
        }
        return result
      } finally {
        pendingT1Requests.delete(fundCode)
      }
    })()

    pendingT1Requests.set(fundCode, promise)
    return promise
  }

  function setT1Holdings(fundCode: string, data: FundAllHoldings): void {
    const today = getBusinessDay()
    lruSet(t1HoldingsCache.value, fundCode, { data, cachedDate: today }, MAX_ESTIMATED_CACHE)
    persistT1HoldingsCache()
  }

  function setEstimatedHoldingsCache(fundCode: string, data: EstimatedHoldings): void {
    const today = getBusinessDay()
    setHoldingsEntry(fundCode, { data, cachedDate: today })
    persistEstimatedHoldingsCache()
  }

  function scanHoldings(): HoldingScan {
    const now = Date.now()
    if (scanCache && now - scanCache.at < SCAN_TTL) return scanCache.data

    const aStockMap = new Map<string, StockEntry>()
    const hkStockMap = new Map<string, StockEntry>()
    const usStockMap = new Map<string, StockEntry>()
    const overseasMap = new Map<string, StockEntry>()
    const aHkAllMap = new Map<string, StockEntry>()
    const overseasAllMap = new Map<string, StockEntry>()
    const usAllMap = new Map<string, StockEntry>()

    let hits = 0
    let misses = 0

    for (const code of fundCodes.value) {
      const v = valuationMap.value.get(code)
      if (!v) continue
      if (v.delayDays !== 1 && v.delayDays !== 2) continue

      const estCached = estimatedHoldingsCache.value.get(code)
      if (!isHoldingsUsable(estCached)) continue

      for (const h of estCached.data.holdings) {
        const { code: normalizedCode } = normalizeStockCodeTencent(h.stockCode)
        const entry: StockEntry = { stockCode: h.stockCode, emMarketCode: h.emMarketCode, stockName: h.stockName }
        const market: StockMarket = classifyShare(h.emMarketCode, normalizedCode)

        if (market === 'A' || market === 'HK') aHkAllMap.set(normalizedCode, entry)
        else if (market === 'US') usAllMap.set(normalizedCode, entry)
        else overseasAllMap.set(normalizedCode, entry)

        const cached = stockPrevDayCache.value.get(normalizedCode)
        if (cached && (cached.changeRate != null || cached.closed)) { hits++; continue }
        misses++

        if (market === 'A') aStockMap.set(normalizedCode, entry)
        else if (market === 'HK') hkStockMap.set(normalizedCode, entry)
        else if (market === 'US') usStockMap.set(normalizedCode, entry)
        else overseasMap.set(normalizedCode, entry)
      }
    }

    if (hits > 0) recordHit('股票昨收', hits)
    if (misses > 0) recordMiss('股票昨收', misses)

    const data: HoldingScan = {
      aStock: Array.from(aStockMap.values()),
      hkStock: Array.from(hkStockMap.values()),
      usStock: Array.from(usStockMap.values()),
      overseas: Array.from(overseasMap.values()),
      aHkAll: Array.from(aHkAllMap.values()),
      overseasAll: Array.from(overseasAllMap.values()),
      usAll: Array.from(usAllMap.values()),
    }
    scanCache = { at: now, data }
    return data
  }

  function collectMissingStocks(): { aStock: StockEntry[]; hkStock: StockEntry[]; usStock: StockEntry[]; overseas: StockEntry[] } {
    const s = scanHoldings()
    return { aStock: s.aStock, hkStock: s.hkStock, usStock: s.usStock, overseas: s.overseas }
  }

  function collectOverseasAll(): StockEntry[] {
    return scanHoldings().overseasAll
  }

  function collectAHkAll(): StockEntry[] {
    return scanHoldings().aHkAll
  }

  function collectUsAll(): StockEntry[] {
    return scanHoldings().usAll
  }

  function wakeQuoteLoops(): void {
    void import('@/modules/fund/services/em-close-service')
      .then(m => m.wakeEmCloseLoop())
      .catch(() => {  })
    void import('@/modules/fund/services/em-realtime-service')
      .then(m => m.wakeEmRealtimeLoop())
      .catch(() => {  })
    void import('@/modules/fund/services/yahoo-service')
      .then(m => m.wakeYahooLoop())
      .catch(() => {  })
  }

  async function fetchValuation(fundCode: string): Promise<FundValuation | null> {
    const { getFundValuation } = await import('@/modules/fund/valuation/fund-valuation-merge')
    const data = await getFundValuation(fundCode, getFundType)
    if (data) {
      reconcileValuation(fundCode, data)
      valuationMap.value.set(fundCode, data)

      const realName = stripPlaceholderName(data.name, fundCode)
      if (realName) setFundName(fundCode, realName)
      updateIntradayPoints(fundCode, data)

      void getEstimatedHoldings(fundCode, async () => new Map())
        .then(est => {
          if (est?.holdings.length) {
            void recomputeFundsForStocks(est.holdings.map(h => h.stockCode))
            wakeQuoteLoops()
          }
        })
        .catch(() => {  })
    }
    return data
  }

  function startStockPreload(): void {
  }

  function startRealtimeEstimate(): void {
  }

  function reconcileValuation(code: string, valuation: FundValuation): void {
    const existing = valuationMap.value.get(code)

    const existingFresh = isConfirmationFresh(existing)

    const t2SkipConfirm = valuation.delayDays === 2 && !isCnTradingDay()
    if (existing && existingFresh && !existing.isEstimated && valuation.isEstimated && !t2SkipConfirm) {
      valuation.isEstimated = false
      valuation.confirmedGszzl = existing.confirmedGszzl
      valuation.jzrq = existing.jzrq

      valuation.dwjz = existing.dwjz
      valuation.gszzl = existing.gszzl
      valuation.gz = existing.gz
      if (intradayMap.value[code]) intradayMap.value = { ...intradayMap.value, [code]: [] }
    }

    if (valuation.delayDays === 2 && valuation.isEstimated) {
      const estGszzl = estimatedGszzlMap.value.get(code)

      if (estGszzl != null) {
        valuation.gszzl = estGszzl
        if (valuation.dwjz > 0) valuation.gz = valuation.dwjz * (1 + estGszzl / 100)
      } else if (existing && isSameBusinessDayAsLastRefresh() && existing.gszzl !== 0) {
        valuation.gszzl = existing.gszzl
        valuation.gz = existing.gz
      } else {
        valuation.gszzl = 0
        valuation.gz = 0
      }
    }

    if (existing && existing.realtimeGszzl != null) {
      valuation.realtimeGszzl = existing.realtimeGszzl
      valuation.realtimeSource = existing.realtimeSource
      valuation.realtimeUpdatedAt = existing.realtimeUpdatedAt
    }

    if (valuation.delayDays !== 2 && valuation.isEstimated && !valuation.gztime
        && valuation.gszzl === 0 && existing?.isEstimated) {
      const existingDate = existing.gztime?.substring(0, 10) || ''
      if (existingDate === getBusinessDay() && existing.gszzl !== 0) {
        valuation.gszzl = existing.gszzl
        valuation.gz = existing.gz
        valuation.gztime = existing.gztime
      }
    }
  }

  function needsValuationRefresh(code: string): boolean {
    const v = valuationMap.value.get(code)
    if (!v) return true
    if (v.isEstimated !== false) return true
    return !isConfirmationFresh(v)
  }

  async function refreshAllValuations(): Promise<void> {
    if (refreshStatus.value === RefreshStatus.Loading) return
    if (fundCodes.value.length === 0) return

    const targets = fundCodes.value.filter(needsValuationRefresh)
    if (targets.length === 0) {
      lastRefreshTime.value = Date.now()
      return
    }

    refreshStatus.value = RefreshStatus.Loading
    try {
      const result = await batchGetValuation(targets, getFundType)
      const refreshedCodes = new Set(result.keys())
      const intradayUpdates: Record<string, IntradayPoint[]> = {}

      for (const [code, valuation] of result) {
        reconcileValuation(code, valuation)
        valuationMap.value.set(code, valuation)

        if (valuation.delayDays === 2 || (valuation.delayDays == null && valuation.gztime && !valuation.gztime.includes(':'))) {
          const points = generateIntradayPoints(valuation, intradayMap.value[code] || [])
          if (points) intradayUpdates[code] = points
          continue
        }

        if (valuation.gz > 0 && valuation.gztime) {
          const timePart = valuation.gztime.includes(' ')
            ? valuation.gztime.split(' ')[1]?.substring(0, 5) ?? ''
            : ''
          const gzDate = valuation.gztime.split(' ')[0]

          if (timePart && gzDate === getBusinessDay()) {
            const ex = keepTodayPoints(intradayMap.value[code])
            const lastPoint = ex[ex.length - 1]
            const today = getBusinessDay()
            if (lastPoint && lastPoint.time === timePart) {
              intradayUpdates[code] = [...ex.slice(0, -1), { time: timePart, value: valuation.gz, date: today }]
            } else {
              intradayUpdates[code] = [...ex, { time: timePart, value: valuation.gz, date: today }]
            }
          }
        }
      }

      valuationMap.value = new Map(valuationMap.value)
      for (const [code, points] of Object.entries(intradayUpdates)) {
        intradayMap.value[code] = points
      }
      if (Object.keys(intradayUpdates).length > 0) persistIntradayMap()

      if (refreshedCodes.size > 0) {
        const attempted = new Set(targets)
        for (const [code, v] of valuationMap.value) {
          if (!attempted.has(code)) continue
          if (refreshedCodes.has(code)) continue
          if (isValuationFresh(v)) continue

          if (v.delayDays === 2 && v.isEstimated && estimatedGszzlMap.value.has(code)) continue
          v.isEstimated = true
        }
      }
      refreshStatus.value = RefreshStatus.Success
      lastRefreshTime.value = Date.now()

      lastBusinessDay.value = getBusinessDay()
      persistLastBusinessDay()

      const cacheStore = useCacheStore()
      const caches: FundCache[] = []
      for (const code of refreshedCodes) {
        const valuation = valuationMap.value.get(code)
        if (!valuation) continue
        const existingCache = cacheStore.getCache(code)

        const realName = stripPlaceholderName(valuation.name, code)
        if (realName) setFundName(code, realName)
        caches.push({
          fundCode: code,
          fundName: realName || existingCache?.fundName || getFundName(code),
          valuation,
          info: existingCache?.info ?? null,
          cachedAt: Date.now(),
          cachedDate: getBusinessDay(),
        })
      }
      cacheStore.saveBatchCache(caches)

      const holdingStore = useHoldingStore()

      void holdingStore.executePendingActions(valuationMap.value).catch(() => {  })
      holdingStore.syncYesterdayAmounts(valuationMap.value)
      void holdingStore.replayGappedHoldings(valuationMap.value).catch(() => {  })
    } catch {
      refreshStatus.value = RefreshStatus.Failed
    }
  }

  function expireStaleRealtimeCache(): boolean {
    const cur = stockRealtimeCache.value
    if (cur.size === 0) return false
    const kept = new Map<string, StockQuoteInfo>()
    let changed = false
    for (const [code, info] of cur) {
      if (!info || !realtimeEntryStillValid(info)) { changed = true; continue }
      kept.set(code, info)
    }
    if (changed) {
      stockRealtimeCache.value = kept
      if (kept.size === 0) {
        removeKey(STORAGE_KEYS.STOCK_REALTIME_CACHE)
        removeKey(STORAGE_KEYS.STOCK_REALTIME_DATE)
      } else {
        persistStockRealtimeCache()
      }
    }
    return changed
  }

  function clearCrossDayCaches(): void {
    stockPrevDayCache.value = new Map()
    stockRealtimeCache.value = new Map()
    estimatedGszzlMap.value = new Map()
    removeKey(STORAGE_KEYS.ESTIMATED_GSZZL_CACHE)
    removeKey(STORAGE_KEYS.ESTIMATED_GSZZL_DATE)
    intradayMap.value = {}
    expireCrossDayValuations()
    lastBusinessDay.value = getBusinessDay()
    persistLastBusinessDay()
  }

  function expireCrossDayValuations(): void {
    if (!lastBusinessDay.value) return
    const prevDay = lastBusinessDay.value
    if (prevDay === getBusinessDay()) return

    intradayMap.value = {}
    let changed = false
    for (const [, v] of valuationMap.value) {
      if (isValuationFresh(v)) continue
      v.isEstimated = true
      v.staleAsOf = v.gztime?.substring(0, 10) || v.jzrq || prevDay
      v.realtimeGszzl = undefined
      v.realtimeSource = undefined
      v.realtimeUpdatedAt = undefined
      changed = true
    }

    if (changed) valuationMap.value = new Map(valuationMap.value)
  }

  function clearCacheDataInMemory(): void {
    prevDayCache.clear()
    realtimeCache.clear()
    intradayCache.clear()
    holdingsCache.clear()
    t1Cache.clear()
    stockPrevDayCache.value = new Map()
    stockRealtimeCache.value = new Map()
    estimatedHoldingsCache.value = new Map()
    invalidateStockIndex()
    t1HoldingsCache.value = new Map()
    estimatedGszzlMap.value = new Map()
    removeKey(STORAGE_KEYS.STOCK_PREV_DAY_CACHE)
    removeKey(STORAGE_KEYS.STOCK_PREV_DAY_DATE)
    removeKey(STORAGE_KEYS.STOCK_REALTIME_CACHE)
    removeKey(STORAGE_KEYS.STOCK_REALTIME_DATE)
    removeKey(STORAGE_KEYS.INTRADAY_MAP)
    removeKey(STORAGE_KEYS.INTRADAY_MAP_DATE)
    removeKey(STORAGE_KEYS.T1_HOLDINGS_CACHE)
    removeKey(STORAGE_KEYS.T1_HOLDINGS_DATE)
    removeKey(STORAGE_KEYS.ESTIMATED_GSZZL_CACHE)
    removeKey(STORAGE_KEYS.ESTIMATED_GSZZL_DATE)
    removeKey(STORAGE_KEYS.ESTIMATED_HOLDINGS_CACHE)
    removeKey(STORAGE_KEYS.ESTIMATED_HOLDINGS_DATE)
    intradayMap.value = {}
    fundNameMap.value = {}
    valuationMap.value = new Map()
  }

  function setSort(field: SortField, direction?: SortDirection): void {
    if (sortField.value === field && !direction) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = direction ?? 'asc'
    }
  }

  function updateIntradayPoints(code: string, valuation: FundValuation): void {
    const points = generateIntradayPoints(valuation, intradayMap.value[code] ?? [])
    if (points) {
      intradayMap.value = { ...intradayMap.value, [code]: points }
      persistIntradayMap()
    }
  }

  async function fetchIntradayHistory(): Promise<void> {
    if (fundCodes.value.length === 0) return
    if (!isCnMarketOpenForIntraday()) return
    const updates: Record<string, IntradayPoint[]> = {}
    let hasUpdate = false
    const BATCH = INTRADAY_CONFIG.FETCH_BATCH
    for (let i = 0; i < fundCodes.value.length; i += BATCH) {
      const batch = fundCodes.value.slice(i, i + BATCH)
      const results = await Promise.allSettled(batch.map(code => fetchIntradayEstimate(code)))
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        if (r.status !== 'fulfilled' || !r.value.length) continue
        const code = batch[j]

        const v0 = valuationMap.value.get(code)
        if (v0 && (v0.delayDays === 2 || (v0.delayDays == null && v0.gztime && !v0.gztime.includes(':')))) continue

        const merged = new Map<string, number>()
        for (const p of r.value) merged.set(p.time, p.value)
        for (const p of keepTodayPoints(intradayMap.value[code])) merged.set(p.time, p.value)
        const today = getBusinessDay()
        updates[code] = Array.from(merged.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([time, value]) => ({ time, value, date: today }))
        hasUpdate = true
      }
    }
    if (hasUpdate) {
      intradayMap.value = { ...intradayMap.value, ...updates }
      persistIntradayMap()
    }
  }

  function seedFromCache(cacheMap: Map<string, FundCache>): void {
    const today = getBusinessDay()
    let seeded = false
    for (const [code, cache] of cacheMap) {
      if (!cache.valuation || !fundCodes.value.includes(code)) continue
      if (cache.cachedDate !== today) continue

      const t2NonTradingSeed = cache.valuation.delayDays === 2 && !isCnTradingDay()
      const isT2Estimate = cache.valuation.delayDays === 2 && (cache.valuation.isEstimated || t2NonTradingSeed)
      if (t2NonTradingSeed) cache.valuation.isEstimated = true
      if (!isT2Estimate && !isValuationFresh(cache.valuation)) continue

      if (cache.valuation.delayDays === 2 && cache.valuation.isEstimated) {
        const estGszzl = estimatedGszzlMap.value.get(code)
        if (estGszzl != null) {
          cache.valuation.gszzl = estGszzl
          if (cache.valuation.dwjz > 0) cache.valuation.gz = cache.valuation.dwjz * (1 + estGszzl / 100)
        } else {
          cache.valuation.gszzl = 0
          cache.valuation.gz = 0
          cache.valuation.realtimeGszzl = undefined
          cache.valuation.realtimeSource = undefined
          cache.valuation.realtimeUpdatedAt = undefined
        }
      }
      valuationMap.value.set(code, cache.valuation)
      seeded = true
    }

    if (seeded) valuationMap.value = new Map(valuationMap.value)
  }

  function saveColumnConfig(columns: ColumnConfig[]): void {
    columnConfig.value = columns
    saveJSON(STORAGE_KEYS.COLUMN_CONFIG, columns)
  }

  function restoreColumnConfig(): void {
    const saved = loadJSON<ColumnConfig[] | null>(STORAGE_KEYS.COLUMN_CONFIG, null)
    if (Array.isArray(saved) && saved.length > 0) {
      columnConfig.value = saved
    }
  }

  function lruSet<K, V>(map: Map<K, V>, key: K, value: V, maxSize: number): void {
    if (map.has(key)) {
      map.delete(key)
    } else if (map.size >= maxSize) {
      const firstKey = map.keys().next().value
      if (firstKey !== undefined) map.delete(firstKey)
    }
    map.set(key, value)
  }

  function initColumnConfig(): ColumnConfig[] {
    return DEFAULT_SETTINGS.VISIBLE_COLUMNS.map(key => ({
      key, title: key, width: 120, sortable: true, visible: true,
    }))
  }

  return {
    fundCodes, fundNameMap, valuationMap, estimatedGszzlMap, stockPrevDayCache, stockRealtimeCache,
    t1HoldingsCache, estimatedHoldingsCache, intradayMap, refreshStatus,
    lastRefreshTime, lastBusinessDay, viewMode, sortField, sortDirection, columnConfig,
    t2HintPending,

    isLoading, fundCount,

    getValuation, getFundName, resolveFundName,

    addFund, removeFund, batchAddFunds, setFundName,

    restoreFundCodes, restoreFundNames, persistFundCodes, restoreStockCaches,
    persistStockPrevDayCache, persistStockRealtimeCache, restoreIntradayMap,
    restoreEstimatedGszzlMap, persistEstimatedGszzlMap,
    restoreEstimatedHoldingsCache, persistEstimatedHoldingsCache,
    recomputeAllFromCache,

    mergeStockQuotesToCache, mergeRealtimeToCache, recomputeFundsForStocks,

    getEstimatedHoldings, getT1Holdings, setT1Holdings, setEstimatedHoldingsCache,

    collectMissingStocks, collectOverseasAll, collectAHkAll, collectUsAll,

    restoreLastBusinessDay, restoreT1HoldingsCache, clearCrossDayCaches, clearCacheDataInMemory, expireStaleRealtimeCache, expireCrossDayValuations,

    setSort, updateIntradayPoints, fetchIntradayHistory, seedFromCache, saveColumnConfig, restoreColumnConfig,
    fetchValuation, refreshAllValuations,
    startStockPreload, startRealtimeEstimate,
  }
})
