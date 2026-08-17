

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StockQuote, StockSearchItem } from './stock-types'
import { STORAGE_KEYS } from '@/config/constants'
import { loadJSON, saveJSON, loadString, saveString } from '@/shared/cache/local-storage-io'
import { fetchFullStockQuotes } from './services/stock-service'
import { getBeijingTodayStr } from '@/shared/utils/date-format'
import { detectMarketByEmCode, stockMarketToTz } from '@/shared/market/market-classify'
import { resolveMarketTradingDays } from '@/shared/market/trading-day'
import { recordHit, recordMiss, recordWrite, recordKeys } from '@/shared/cache/hit-stats'
import { defineCache } from '@/shared/cache/define-cache'

export interface WatchlistEntry {
  code: string
  emMarketCode?: string
}

const wQuoteCache = defineCache<StockQuote>({
  pool: 'board',
  name: 'watch-quote',
  ttl: 24 * 60 * 60 * 1000,
  max: 200,
  isEmpty: (v) => !(v?.price > 0),
})

export const useStockStore = defineStore('stock', () => {
  const watchlist = ref<WatchlistEntry[]>([])

  const quoteMap = ref<Map<string, StockQuote>>(new Map())

  const loading = ref(false)

  const count = computed(() => watchlist.value.length)

  function restoreWatchlist(): void {
    const saved = loadJSON<WatchlistEntry[] | null>(STORAGE_KEYS.WATCHLIST, null)
    if (Array.isArray(saved)) watchlist.value = saved
    restoreQuotes()
  }

  function persistWatchlist(): void {
    saveJSON(STORAGE_KEYS.WATCHLIST, watchlist.value)
  }

  function addToWatchlist(item: StockSearchItem): boolean {
    if (watchlist.value.some(e => e.code === item.code)) return false
    watchlist.value = [...watchlist.value, { code: item.code, emMarketCode: item.rawMarket }]
    persistWatchlist()
    return true
  }

  function removeFromWatchlist(code: string): void {
    watchlist.value = watchlist.value.filter(e => e.code !== code)
    const next = new Map(quoteMap.value)
    next.delete(code)
    quoteMap.value = next
    persistWatchlist()
  }

  let quietSnapshot = ''

  // 自选股所属的市场全部收市时行情已定格，缓存齐全就跳过这一轮请求。
  // 快照带上各市场的最后收市日，开盘或跨日后自然对不上，重新拉取。
  function watchlistQuietKey(): string {
    const parts: string[] = []
    const seen = new Set<string>()
    for (const e of watchlist.value) {
      const tz = stockMarketToTz(detectMarketByEmCode(e.emMarketCode ?? ''))
      if (seen.has(tz)) continue
      seen.add(tz)
      const td = resolveMarketTradingDays(tz)
      if (!td.isClosed && td.hasOpened) return ''
      parts.push(`${tz}:${td.lastClosedDay}`)
    }
    return parts.sort().join('|')
  }

  function canSkipFetch(): boolean {
    if (watchlist.value.some(e => !((quoteMap.value.get(e.code)?.price ?? 0) > 0))) return false
    const key = watchlistQuietKey()
    return key !== '' && key === quietSnapshot
  }

  async function refresh(): Promise<void> {
    if (loading.value) {
      return
    }
    if (watchlist.value.length === 0) {
      return
    }
    if (canSkipFetch()) {
      recordHit('自选股行情', quoteMap.value.size)
      return
    }
    loading.value = true
    try {
      const codes = watchlist.value.map(e => e.code)
      const marketMap = new Map<string, string>()
      for (const e of watchlist.value) {
        if (e.emMarketCode) marketMap.set(e.code, e.emMarketCode)
      }
      recordMiss('自选股行情', codes.length)
      const fetched = await fetchFullStockQuotes(codes, marketMap)
      if (fetched.size > 0) {
        const merged = new Map(quoteMap.value)
        for (const [code, q] of fetched) {
          if (q.price > 0) merged.set(code, q)
        }
        quoteMap.value = merged
        for (const [k, v] of merged) wQuoteCache.set(k, v)
        recordWrite('自选股行情')
        recordKeys('自选股行情', merged.size)
        persistQuotes()
        quietSnapshot = watchlistQuietKey()
      }
    } finally {
      loading.value = false
    }
  }

  function restoreQuotes(): void {
    if (loadString(STORAGE_KEYS.STOCK_QUOTES_DATE) !== getBeijingTodayStr()) {
      quoteMap.value = new Map()
      return
    }
    const obj = loadJSON<Record<string, StockQuote> | null>(STORAGE_KEYS.STOCK_QUOTES_CACHE, null)
    if (obj && typeof obj === 'object') {
      const codes = new Set(watchlist.value.map(e => e.code))
      const filtered = new Map<string, StockQuote>()
      for (const [code, q] of Object.entries(obj)) {
        if (codes.has(code)) filtered.set(code, q)
      }
      if (filtered.size > 0) {
        quoteMap.value = filtered
        for (const [k, v] of filtered) wQuoteCache.set(k, v)
        recordHit('自选股行情', filtered.size)
        recordKeys('自选股行情', filtered.size)
      }
    }
  }

  function persistQuotes(): void {
    const obj: Record<string, StockQuote> = {}
    for (const [key, value] of quoteMap.value) obj[key] = value
    saveJSON(STORAGE_KEYS.STOCK_QUOTES_CACHE, obj)
    saveString(STORAGE_KEYS.STOCK_QUOTES_DATE, getBeijingTodayStr())
  }

  return {
    watchlist, quoteMap, loading, count,
    restoreWatchlist, restoreQuotes, persistWatchlist, persistQuotes,
    addToWatchlist, removeFromWatchlist, refresh,
  }
})
