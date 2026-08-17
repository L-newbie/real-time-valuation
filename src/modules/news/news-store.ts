

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NewsItem } from './news-types'
import { STORAGE_KEYS } from '@/config/constants'
import { loadJSON, saveJSON, loadString, saveString } from '@/shared/cache/local-storage-io'
import { fetchTodayNews, fetchMoreNews } from './services/news-service'
import { filterByBlacklist } from './filter/news-blacklist'
import { recordWrite, recordKeys } from '@/shared/cache/hit-stats'
import { defineCache } from '@/shared/cache/define-cache'

const MAX_READ = 500

const newsCache = defineCache<string[]>({
  pool: 'board',
  name: 'news-read',
  ttl: 30 * 24 * 60 * 60 * 1000,
  isEmpty: (v) => !v?.length,
})

export const useNewsStore = defineStore('news', () => {
  const rawNews = ref<NewsItem[]>([])

  const blacklist = ref<string[]>([])

  const readTitles = ref<Set<string>>(new Set())

  const loading = ref(false)

  const news = computed(() => filterByBlacklist(rawNews.value, blacklist.value))

  const unreadCount = computed(() =>
    news.value.filter(item => !readTitles.value.has(item.title)).length,
  )

  async function refresh(): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      const items = await fetchTodayNews()
      rawNews.value = items
    } finally {
      loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (rawNews.value.length === 0) return
    const beforeCtime = rawNews.value[rawNews.value.length - 1].ctime
    const older = await fetchMoreNews(beforeCtime)
    if (older.length > 0) {
      const existing = new Set(rawNews.value.map(n => n.title))
      const fresh = older.filter(n => !existing.has(n.title))
      rawNews.value = [...rawNews.value, ...fresh]
      recordWrite('资讯列表')
      recordKeys('资讯列表', rawNews.value.length)
    }
  }

  function markRead(title: string): void {
    readTitles.value.add(title)
    if (readTitles.value.size > MAX_READ) {
      readTitles.value = new Set([...readTitles.value].slice(-MAX_READ))
    }
    persistRead()
  }

  function isRead(title: string): boolean {
    return readTitles.value.has(title)
  }

  function restoreState(): void {
    blacklist.value = loadJSON<string[]>(STORAGE_KEYS.NEWS_BLACKLIST, [])
    const readArr = loadString(STORAGE_KEYS.NEWS_READ)
    if (readArr) {
      try {
        const parsed = JSON.parse(readArr)
        const list: unknown = Array.isArray(parsed) ? parsed : parsed?.titles
        if (Array.isArray(list)) {
          readTitles.value = new Set(list.slice(-MAX_READ).map(x => String(x)))
        }
      } catch {  }
    }
  }

  function persistRead(): void {
    const list = [...readTitles.value].slice(-MAX_READ)
    newsCache.set('titles', list)
    saveString(STORAGE_KEYS.NEWS_READ, JSON.stringify(list))
  }

  function persistBlacklist(): void {
    saveJSON(STORAGE_KEYS.NEWS_BLACKLIST, blacklist.value)
  }

  function addBlacklist(source: string): void {
    if (!blacklist.value.includes(source)) {
      blacklist.value = [...blacklist.value, source]
      persistBlacklist()
    }
  }

  return {
    rawNews, blacklist, readTitles, loading, isRead,
    news, unreadCount,
    refresh, loadMore, markRead, restoreState, addBlacklist,
  }
})
