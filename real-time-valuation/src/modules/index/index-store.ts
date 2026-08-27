

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IndexQuote } from './index-types'
import { STORAGE_KEYS, DEFAULT_SELECTED_INDICES, INDEX_PRESETS } from '@/config/constants'
import { loadJSON, saveJSON, loadString, saveString } from '@/shared/cache/local-storage-io'
import { fetchGlobalIndexQuotes } from './index-service'
import { getBeijingTodayStr } from '@/shared/utils/date-format'
import { marketQuietKey } from '@/shared/market/market-quiet'
import { recordHit, recordMiss, recordWrite, recordReject, recordKeys } from '@/shared/cache/hit-stats'
import { defineCache } from '@/shared/cache/define-cache'

export type IndexSortMode = 'desc' | 'asc' | 'none'

function loadIndexSort(): IndexSortMode {
  const raw = loadString(STORAGE_KEYS.INDEX_SORT)
  return raw === 'asc' || raw === 'none' ? raw : 'desc'
}

const quoteCache = defineCache<IndexQuote>({
  pool: 'shared',
  name: 'index-quote',
  ttl: 24 * 60 * 60 * 1000,
  max: 40,
  isEmpty: (v) => !(v?.price > 0),
})

export const useIndexStore = defineStore('index', () => {
  const indexQuotes = ref<Map<string, IndexQuote>>(new Map())

  const selectedIndices = ref<string[]>([...DEFAULT_SELECTED_INDICES])

  const loading = ref(false)

  const sortMode = ref<IndexSortMode>(loadIndexSort())

  function setSortMode(m: IndexSortMode): void {
    sortMode.value = m
    saveString(STORAGE_KEYS.INDEX_SORT, m)
  }

  const selectedQuotes = computed<IndexQuote[]>(() => {
    const list = selectedIndices.value
      .map(secid => indexQuotes.value.get(secid))
      .filter((q): q is IndexQuote => !!q)

    if (sortMode.value === 'none') return list
    const dir = sortMode.value === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = a.price > 0 ? a.changeRate : null
      const vb = b.price > 0 ? b.changeRate : null
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return (va - vb) * dir
    })
  })

  const allIndices = computed(() =>
    INDEX_PRESETS.map(p => ({
      ...p,
      selected: selectedIndices.value.includes(p.secid),
    })),
  )

  let quietSnapshot = ''

  // 全球市场都已收市时，报价不会再变：缓存里已有数据就直接用，
  // 不必每个刷新周期都打一遍接口。收市快照按最后收市日标识，跨日自动失效。
  function canSkipFetch(): boolean {
    if (indexQuotes.value.size === 0) return false
    const key = marketQuietKey()
    return key !== '' && key === quietSnapshot
  }

  async function refresh(): Promise<void> {
    if (loading.value) {
      return
    }
    if (canSkipFetch()) {
      recordHit('指数报价', indexQuotes.value.size)
      return
    }
    loading.value = true
    try {
      const quotes = await fetchGlobalIndexQuotes()
      if (quotes.size === 0) recordReject('指数报价')
      if (quotes.size > 0) {
        recordWrite('指数报价')
        const merged = new Map(indexQuotes.value)
        for (const [secid, q] of quotes) {
          if (q.price > 0) merged.set(secid, q)
        }
        indexQuotes.value = merged
        for (const [k, v] of merged) quoteCache.set(k, v)
        recordKeys('指数报价', merged.size)
        persistQuotes()
        quietSnapshot = marketQuietKey()
      }
    } finally {
      loading.value = false
    }
  }

  function restoreQuotes(): void {
    if (loadString(STORAGE_KEYS.INDEX_QUOTES_DATE) !== getBeijingTodayStr()) return
    const obj = loadJSON<Record<string, IndexQuote> | null>(STORAGE_KEYS.INDEX_QUOTES_CACHE, null)
    if (obj && typeof obj === 'object') {
      indexQuotes.value = new Map(Object.entries(obj))
      for (const [k, v] of indexQuotes.value) quoteCache.set(k, v)
      recordHit('指数报价', indexQuotes.value.size)
      recordKeys('指数报价', indexQuotes.value.size)
    }
  }

  function persistQuotes(): void {
    const obj: Record<string, IndexQuote> = {}
    for (const [key, value] of indexQuotes.value) obj[key] = value
    saveJSON(STORAGE_KEYS.INDEX_QUOTES_CACHE, obj)
    saveString(STORAGE_KEYS.INDEX_QUOTES_DATE, getBeijingTodayStr())
  }

  function restoreSelected(): void {
    const saved = loadJSON<string[] | null>(STORAGE_KEYS.SELECTED_INDICES, null)
    if (Array.isArray(saved) && saved.length > 0) {
      selectedIndices.value = saved
    }
    restoreQuotes()
  }

  function persistSelected(): void {
    saveJSON(STORAGE_KEYS.SELECTED_INDICES, selectedIndices.value)
  }

  function toggleIndex(secid: string): void {
    const idx = selectedIndices.value.indexOf(secid)
    if (idx >= 0) {
      selectedIndices.value = selectedIndices.value.filter(s => s !== secid)
    } else {
      selectedIndices.value = [...selectedIndices.value, secid]
    }
    persistSelected()
  }

  return {
    indexQuotes, selectedIndices, loading, selectedQuotes, allIndices,
    sortMode, setSortMode,
    refresh, restoreSelected, restoreQuotes, persistQuotes, toggleIndex,
  }
})
