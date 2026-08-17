

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FundCache } from '@/modules/fund/fund-types'
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/config/constants'
import { loadJSON, saveJSON } from '@/shared/cache/local-storage-io'
import { isCacheValid } from '@/shared/utils/date-format'
import { getBusinessDay } from '@/modules/fund/valuation/cn-trading-day'
import { recordHit, recordMiss, recordWrite, recordReject, recordKeys } from '@/shared/cache/hit-stats'
import { defineCache } from '@/shared/cache/define-cache'

const valuationCache = defineCache<FundCache>({
  pool: 'fund',
  name: 'valuation',
  ttl: DEFAULT_SETTINGS.CACHE_DURATION,
  max: 200,
  isEmpty: (v) => !v?.fundCode,
})

export const useCacheStore = defineStore('cache', () => {
  const cacheMap = ref<Map<string, FundCache>>(new Map())

  let restored = false

  function getCache(fundCode: string): FundCache | undefined {
    return cacheMap.value.get(fundCode)
  }

  function getValidCache(fundCode: string): FundCache | null {
    const cache = cacheMap.value.get(fundCode)
    if (!cache || cache.cachedDate !== getBusinessDay() || !isCacheValid(cache.cachedAt, DEFAULT_SETTINGS.CACHE_DURATION)) {
      recordMiss('基金估值')
      return null
    }
    recordHit('基金估值')
    return cache
  }
  function hasValidCache(fundCode: string): boolean {
    return getValidCache(fundCode) !== null
  }

  function saveCache(cache: FundCache): void {
    cacheMap.value.set(cache.fundCode, cache)
    valuationCache.set(cache.fundCode, cache)
    persistCache()
  }
  function saveBatchCache(caches: FundCache[]): void {
    for (const cache of caches) {
      cacheMap.value.set(cache.fundCode, cache)
      valuationCache.set(cache.fundCode, cache)
    }
    persistCache()
  }
  function removeCache(fundCode: string): void {
    cacheMap.value.delete(fundCode)
    valuationCache.del(fundCode)
    persistCache()
  }
  function clearAllCache(): void {
    cacheMap.value.clear()
    valuationCache.clear()
    saveJSON(STORAGE_KEYS.FUND_CACHE, {})
  }

  function clearExpiredCache(): void {
    let changed = false
    for (const [key, cache] of cacheMap.value) {
      if (!isCacheValid(cache.cachedAt, DEFAULT_SETTINGS.CACHE_DURATION)) {
        cacheMap.value.delete(key)
        changed = true
      }
    }
    if (changed) persistCache()
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  function persistCache(): void {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      const obj: Record<string, FundCache> = {}
      for (const [key, value] of cacheMap.value) obj[key] = value
      saveJSON(STORAGE_KEYS.FUND_CACHE, obj)
      persistTimer = null
    }, 2000)
  }
  function flushPersist(): void {
    if (!restored) return
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null }
    const obj: Record<string, FundCache> = {}
    for (const [key, value] of cacheMap.value) obj[key] = value
    saveJSON(STORAGE_KEYS.FUND_CACHE, obj)
  }

  function restoreCache(): void {
    const obj = loadJSON<Record<string, FundCache> | null>(STORAGE_KEYS.FUND_CACHE, null)
    if (obj && typeof obj === 'object') {
      cacheMap.value = new Map(Object.entries(obj))
    }
    restored = true
  }

  return {
    cacheMap,
    getCache, getValidCache, hasValidCache,
    saveCache, saveBatchCache, removeCache, clearAllCache, clearExpiredCache,
    restoreCache, persistCache, flushPersist,
  }
})
