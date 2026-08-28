

import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import type { EstimatedHoldings } from '@/modules/fund/fund-types'
import type { StockQuoteInfo } from '@/shared/types/common-types'
import { useFundStore } from '@/modules/fund/fund-store'
import { computeEstimatedGszzlFromPrevDay } from '@/modules/fund/calc/gszzl-weight'
import { normalizeStockCodeTencent } from '@/shared/net/tencent-codec'
import { searchStocks } from '@/modules/stock/search/stock-search'
import { loadPingzhongHoldings, enrichMarketCodeFromPingzhong } from '@/modules/fund/holdings/pingzhong-holdings-fetch'
import { runConcurrent } from '@/shared/net/rate-limiter'
import { FUND_VALUATION_CONFIG } from '@/config/constants'

export function useEstimatedHoldings(fundCode: Ref<string> | string, delayDays: Ref<number> | number) {
  const estimated = ref<EstimatedHoldings | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const prevDayMap = ref<Map<string, StockQuoteInfo>>(new Map())
  const estimatedGszzl = ref<number | null>(null)

  const realtimeMap = ref<Map<string, StockQuoteInfo>>(new Map())

  const code = computed(() => typeof fundCode === 'string' ? fundCode : fundCode.value)
  const isT2 = computed(() => {
    const days = typeof delayDays === 'number' ? delayDays : delayDays.value
    return days === 2
  })

  const holdingsList = computed(() => {
    return estimated.value?.holdings ?? []
  })

  async function loadEstimation(preloaded?: { stockCodesNew?: unknown; fundSharesPositions?: unknown[] }): Promise<void> {
    const fc = code.value
    if (!fc) return

    loading.value = true
    error.value = null

    estimated.value = null
    prevDayMap.value = new Map()
    realtimeMap.value = new Map()

    const fundStore = useFundStore()
    let estData = fundStore.estimatedHoldingsCache.get(fc)?.data ?? null

    if (!estData) {
      try {
        estData = await fundStore.getEstimatedHoldings(fc, async () => new Map(), preloaded)
      } catch {  }
    } else if (preloaded?.stockCodesNew != null && estData.holdings.some(h => !h.emMarketCode)) {
      try {
        const pz = await loadPingzhongHoldings(fc, preloaded)
        if (pz && enrichMarketCodeFromPingzhong(estData.holdings, pz)) {
          fundStore.setEstimatedHoldingsCache(fc, estData)
        }
      } catch {  }
    }

    if (estData) {
      estimated.value = estData

      void fillStockNames(estData, fc)
    }

    refreshPrevDayFromCache()
    refreshRealtimeFromCache()

    if (isT2.value) {
      const v = fundStore.getValuation(fc)

      if (estData && estData.holdings.length > 0 && v && v.isEstimated && v.gszzl === 0) {
        const gszzl = computeEstimatedGszzlFromPrevDay(estData.holdings, fundStore.stockPrevDayCache)
        if (gszzl != null) {
          v.gszzl = gszzl
          if (v.dwjz > 0) v.gz = v.dwjz * (1 + gszzl / 100)
          fundStore.valuationMap.set(fc, v)
          fundStore.estimatedGszzlMap.set(fc, gszzl)
          fundStore.persistEstimatedGszzlMap()
          estimatedGszzl.value = gszzl
        } else {
          estimatedGszzl.value = v?.gszzl ?? null
        }
      } else {
        estimatedGszzl.value = v?.gszzl ?? null
      }
    }

    loading.value = false
  }

  async function fillStockNames(est: EstimatedHoldings, fc: string): Promise<void> {
    const items = est.holdings.filter(h => !h.stockName)
    if (items.length === 0) return
    const results: Array<{ h: typeof items[number]; res: Awaited<ReturnType<typeof searchStocks>> }> = []
    await runConcurrent(items, FUND_VALUATION_CONFIG.BATCH_CONCURRENCY, async (h) => {
      results.push({ h, res: await searchStocks(h.stockCode) })
    })

    if (code.value !== fc) return
    const NON_STOCK_MARKETS = new Set(['150', '151', '152', '153'])
    const isAShare = (m: string) => m === '1' || m === '0'
    let changed = false
    for (const { h, res } of results) {
      const normCode = normalizeStockCodeTencent(h.stockCode).code
      const candidates = res.filter(r => r.code === h.stockCode || r.code === normCode)

      let hit = candidates.find(r => r.rawMarket === h.emMarketCode)

      if (!hit) {
        const overseas = candidates.filter(r => !isAShare(r.rawMarket) && !NON_STOCK_MARKETS.has(r.rawMarket))
        hit = overseas[0] ?? candidates[0]
      }
      if (hit?.name) { h.stockName = hit.name; changed = true }
    }
    if (changed) estimated.value = { ...est, holdings: [...est.holdings] }
  }

  function refreshPrevDayFromCache(): void {
    const holdings = holdingsList.value
    if (holdings.length === 0) return
    const fundStore = useFundStore()
    const globalCache = fundStore.stockPrevDayCache
    const stockMap = new Map<string, StockQuoteInfo>()
    for (const h of holdings) {
      const nc = normalizeStockCodeTencent(h.stockCode).code
      const info = globalCache.get(h.stockCode) ?? globalCache.get(nc)
      if (info) stockMap.set(h.stockCode, info)
    }
    prevDayMap.value = stockMap
  }

  function refreshRealtimeFromCache(): void {
    const holdings = holdingsList.value
    if (holdings.length === 0) return
    const fundStore = useFundStore()
    const globalCache = fundStore.stockRealtimeCache
    const stockMap = new Map<string, StockQuoteInfo>()
    for (const h of holdings) {
      const nc = normalizeStockCodeTencent(h.stockCode).code
      const info = globalCache.get(h.stockCode) ?? globalCache.get(nc)
      if (info) stockMap.set(h.stockCode, info)
    }
    realtimeMap.value = stockMap
  }

  function refreshFromCache(): void {
    refreshPrevDayFromCache()
    refreshRealtimeFromCache()
  }

  const stopWatchPrevDay = watch(() => useFundStore().stockPrevDayCache, () => {
    refreshPrevDayFromCache()
  })
  const stopWatchRealtime = watch(() => useFundStore().stockRealtimeCache, () => {
    refreshRealtimeFromCache()
  })

  function getPrevDayRate(stockCode: string): number | null {
    return prevDayMap.value.get(stockCode)?.changeRate ?? null
  }
  function prevDayClass(stockCode: string): string {
    const rate = getPrevDayRate(stockCode)
    if (rate == null) return ''
    if (rate > 0) return 'text-rise'
    if (rate < 0) return 'text-fall'
    return 'text-flat'
  }
  function formatRate(rate: number | null): string {
    if (rate == null) return '--'
    const sign = rate > 0 ? '+' : ''
    return `${sign}${rate.toFixed(2)}%`
  }

  function getRealtimeRate(stockCode: string): number | null {
    return realtimeMap.value.get(stockCode)?.changeRate ?? null
  }

  function getRealtimeSession(stockCode: string): 'PRE' | 'REGULAR' | 'POST' | undefined {
    return realtimeMap.value.get(stockCode)?.session
  }

  function getRealtimeUpdatedAt(stockCode: string): number | undefined {
    return realtimeMap.value.get(stockCode)?.updatedAt
  }
  function realtimeClass(stockCode: string): string {
    const rate = getRealtimeRate(stockCode)
    if (rate == null) return ''
    if (rate > 0) return 'text-rise'
    if (rate < 0) return 'text-fall'
    return 'text-flat'
  }

  onUnmounted(() => {
    stopWatchPrevDay()
    stopWatchRealtime()
    estimated.value = null
    prevDayMap.value = new Map()
    estimatedGszzl.value = null
    realtimeMap.value = new Map()
  })

  return {
    estimated,
    loading,
    error,
    isT2,
    estimatedGszzl,
    loadEstimation,
    refreshFromCache,
    getPrevDayRate,
    prevDayClass,
    formatRate,
    prevDayMap,
    realtimeMap,
    getRealtimeRate,
    getRealtimeSession,
    getRealtimeUpdatedAt,
    realtimeClass,
  }
}
