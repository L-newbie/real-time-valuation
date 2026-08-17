<template>
  <div class="news-full-page" ref="rootEl">
    <header class="nv-head">
      <div class="nv-head-bar">
        <span class="nv-head-glow" aria-hidden="true" />
        <span class="nv-head-k">LIVE</span>
        <span class="nv-head-count">
          <template v-if="newsItems.length > 0">
            已加载 <b class="font-number">{{ newsItems.length }}</b>
            <template v-if="noMoreNews"> · 今日全部</template>
          </template>
          <template v-else>{{ newsStore.loading ? '加载中…' : '暂无资讯' }}</template>
        </span>
        <button
          class="nv-head-btn"
          :class="{ active: blacklistKeywords.length > 0 }"
          title="关键词过滤"
          @click="showBlacklist = true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          <span v-if="blacklistKeywords.length > 0" class="nv-head-dot" aria-hidden="true" />
        </button>
        <button
          class="nv-head-btn"
          :class="{ active: !pinned }"
          :title="pinned ? '已定住，点击继续自动播放' : '自动播放中，点击定住'"
          @click="pinned = !pinned"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="pinned"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" /></template>
            <template v-else><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></template>
          </svg>
        </button>
        <RefreshControl
          toggle-key="newsAutoRefresh"
          interval-key="newsRefreshInterval"
          :options="[30, 60, 120, 300]"
        />
        <RingRefresh
          :interval="settingsStore.newsRefreshInterval"
          :countdown="countdown"
          :enabled="settingsStore.newsAutoRefresh"
          :spinning="refreshing"
          @refresh="refreshNews"
        />
      </div>
    </header>
    <div class="nv-split">
      <aside
        ref="railRef"
        class="nv-rail"
        :class="{ pinned: pinned }"
        @mouseenter="hovering = true"
        @mouseleave="hovering = false"
      >
        <div class="nv-rail-label">
          <span class="nv-rail-label-txt">简讯</span>
          <span class="nv-rail-rule" aria-hidden="true" />
        </div>
        <Transition name="nv-drop">
          <button v-if="pendingCount > 0" type="button" class="nv-new" @click.stop="applyPending">
            <span class="nv-new-dot" aria-hidden="true" />
            <span class="nv-new-txt">{{ pendingCount }} 条新简讯</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </Transition>
        <div class="nv-rail-inner">
          <button
            v-for="(item, i) in newsItems"
            :key="item.title + item.ctime"
            type="button"
            class="nv-tile"
            :class="{ on: i === activeIndex, read: isRead(item.title), opened: isOpened(item.url) }"
            :style="sourceStyle(item.source)"
            @click="onTileClick(i)"
          >
            <span class="nv-tile-corner c-tl" aria-hidden="true" />
            <span class="nv-tile-corner c-br" aria-hidden="true" />
            <span class="nv-tile-head">
              <span class="nv-tile-no font-number">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="nv-tile-fill" aria-hidden="true" />
              <span class="nv-tile-time font-number">{{ item.time }}</span>
            </span>
            <span class="nv-tile-title">{{ item.title }}</span>
            <span class="nv-tile-foot">
              <span class="nv-tile-src">{{ item.source }}</span>
              <span v-if="isOpened(item.url)" class="nv-tile-seen" title="已打开原文">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </span>
            <span v-if="i === activeIndex" class="nv-tile-scan" aria-hidden="true" />
          </button>
          <template v-if="newsStore.loading && newsItems.length === 0">
            <span v-for="i in 8" :key="`sk${i}`" class="nv-skel animate-shimmer" />
          </template>
          <p v-else-if="newsItems.length === 0" class="nv-rail-empty">暂无今日资讯</p>
          <p v-else-if="loadingMore" class="nv-rail-empty">加载更多…</p>
          <p v-else-if="noMoreNews" class="nv-rail-empty">— 已全部加载 —</p>
        </div>
        <button
          v-show="showRailTop"
          type="button"
          class="nv-totop"
          title="回到顶部"
          @click.stop="scrollRailTop"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          <span class="nv-totop-txt">TOP</span>
        </button>
      </aside>
      <section class="nv-read" ref="readRef">
        <template v-if="active">
          <header class="nv-read-head" :style="sourceStyle(active.source)">
            <div class="nv-read-specs">
              <span class="nv-spec">
                <span class="nv-spec-k">ID</span>
                <span class="nv-spec-fill" aria-hidden="true" />
                <span class="nv-spec-v font-number">{{ String(activeIndex + 1).padStart(3, '0') }}</span>
              </span>
              <span class="nv-spec">
                <span class="nv-spec-k">SRC</span>
                <span class="nv-spec-fill" aria-hidden="true" />
                <span class="nv-spec-v nv-spec-src">{{ active.source }}</span>
              </span>
              <span class="nv-spec">
                <span class="nv-spec-k">TIME</span>
                <span class="nv-spec-fill" aria-hidden="true" />
                <span class="nv-spec-v font-number">{{ active.time }}</span>
              </span>
              <span class="nv-spec">
                <span class="nv-spec-k">POS</span>
                <span class="nv-spec-fill" aria-hidden="true" />
                <span class="nv-spec-v font-number">{{ activeIndex + 1 }}/{{ newsItems.length }}</span>
              </span>
            </div>
            <h1 class="nv-read-title">{{ active.title }}</h1>
            <div class="nv-read-prog">
              <span class="nv-read-bar" aria-hidden="true">
                <span class="nv-read-bar-fill" :class="{ paused: pinned || hovering || !canAutoPlay }" :key="activeIndex" />
              </span>
              <span class="nv-read-prog-k">{{ pinned ? 'HOLD' : canAutoPlay ? 'AUTO' : 'IDLE' }}</span>
            </div>
          </header>
          <article v-if="activeParagraphs.length > 0" class="nv-read-body">
            <p v-for="(p, i) in activeParagraphs" :key="i" class="nv-para">{{ p }}</p>
          </article>
          <div v-else class="nv-read-none">
            <a
              v-if="active.url"
              class="nv-open"
              :href="active.url"
              target="_blank"
              rel="noopener noreferrer"
              @click="markOpened(active.url)"
            >
              打开原文
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
              </svg>
            </a>
          </div>
        </template>
        <div v-else class="nv-read-none">
          <p class="nv-none-title">{{ newsStore.loading ? '加载中…' : '暂无今日资讯' }}</p>
        </div>
      </section>
    </div>
    <BottomSheet :visible="showBlacklist" title="关键词过滤" center @update:visible="showBlacklist = $event">
      <div class="bl-body">
        <p class="bl-hint">输入关键词后回车添加，匹配来源或标题的资讯将被过滤</p>
        <div class="bl-add">
          <input
            v-model="blacklistInput"
            class="bl-input"
            placeholder="输入关键词，回车添加"
            @keydown.enter.prevent="addKeyword"
          />
          <button type="button" class="bl-add-btn" @click="addKeyword">添加</button>
        </div>
        <div v-if="blacklistKeywords.length > 0" class="bl-tags">
          <span v-for="(kw, idx) in blacklistKeywords" :key="idx" class="bl-tag">
            {{ kw }}
            <button type="button" class="bl-tag-x" title="移除" @click="removeKeyword(idx)">&times;</button>
          </span>
        </div>
        <p v-else class="bl-empty">尚未添加关键词，所有资讯都会显示</p>
      </div>
    </BottomSheet>
  </div>
</template>
<script setup lang="ts">

import { ref, computed, nextTick, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useNewsStore } from '@/modules/news/news-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { STORAGE_KEYS } from '@/config/constants'
import { saveJSON } from '@/shared/cache/local-storage-io'
import type { NewsItem } from '@/modules/news/news-types'
import { fetchMoreNews } from '@/modules/news/services/news-service'
import { toParagraphs } from '@/modules/news/format/news-content'
import { usePageAutoRefresh } from '@/composables/use-page-auto-refresh'
import BottomSheet from '@/components/shared/bottom-sheet.vue'
import RingRefresh from '@/components/shared/ring-refresh.vue'
import RefreshControl from '@/components/shared/refresh-control.vue'

defineOptions({ name: 'NewsFull' })

const newsStore = useNewsStore()
const settingsStore = useSettingsStore()

const newsItems = ref<NewsItem[]>([])

const railRef = ref<HTMLElement | null>(null)
const readRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const pinned = ref(false)
const hovering = ref(false)

const active = computed<NewsItem | null>(() => newsItems.value[activeIndex.value] ?? null)

const activeParagraphs = computed(() => toParagraphs(active.value?.content))

const AUTO_STEP_MS = 6000
let autoTimer: ReturnType<typeof setInterval> | null = null
let visibleTimer: ReturnType<typeof setInterval> | null = null

const rootEl = ref<HTMLElement | null>(null)
const pageVisible = ref(true)
const inViewport = ref(true)
const canAutoPlay = computed(() => pageVisible.value && inViewport.value)

let io: IntersectionObserver | null = null

function onVisibilityChange(): void {
  pageVisible.value = document.visibilityState === 'visible'
}

function watchViewport(): void {
  const el = rootEl.value
  if (!el || typeof IntersectionObserver === 'undefined') return

  io = new IntersectionObserver((entries) => {
    const e = entries[0]
    if (!e) return
    const geometricallyVisible = e.isIntersecting

    const el2 = el as HTMLElement & { checkVisibility?: (o?: object) => boolean }
    const reallyVisible = typeof el2.checkVisibility === 'function'
      ? el2.checkVisibility({ opacityProperty: true, visibilityProperty: true } as object)
      : geometricallyVisible
    inViewport.value = geometricallyVisible && reallyVisible
  }, { threshold: 0.01 })
  io.observe(el)
}

function recheckVisible(): void {
  const el = rootEl.value as (HTMLElement & { checkVisibility?: (o?: object) => boolean }) | null
  if (!el || typeof el.checkVisibility !== 'function') return
  inViewport.value = el.checkVisibility({ opacityProperty: true, visibilityProperty: true } as object)
}

function startAuto(): void {
  if (autoTimer) return
  autoTimer = setInterval(() => {
    if (!canAutoPlay.value || pinned.value || hovering.value || newsItems.value.length === 0) return
    activeIndex.value = (activeIndex.value + 1) % newsItems.value.length
  }, AUTO_STEP_MS)
}
function stopAuto(): void {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
}

function onTileClick(i: number): void {
  if (pinned.value && i === activeIndex.value) {
    pinned.value = false
    return
  }
  activeIndex.value = i
  pinned.value = true
}

watch(activeIndex, () => {
  markAsRead(active.value?.title ?? '')
  nextTick(() => {
    const rail = railRef.value
    if (rail) {
      const el = rail.querySelector<HTMLElement>('.nv-tile.on')
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }

    readRef.value?.scrollTo({ top: 0, behavior: 'auto' })
  })
})

watch(() => newsItems.value.length, (n) => {
  if (activeIndex.value >= n) activeIndex.value = 0
})

const showBlacklist = ref(false)
const refreshing = ref(false)
const loadingMore = ref(false)
const noMoreNews = ref(false)

const MAX_READ = 500

const readTitles = reactive(new Set<string>())

function loadReadTitles(): void {
  const raw = localStorage.getItem(STORAGE_KEYS.NEWS_READ)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    const list: unknown = Array.isArray(parsed) ? parsed : parsed?.titles
    if (Array.isArray(list)) {
      for (const t of list.slice(-MAX_READ)) readTitles.add(String(t))
    }
  } catch {  }
}

function saveReadTitles(): void {
  const list = [...readTitles].slice(-MAX_READ)
  localStorage.setItem(STORAGE_KEYS.NEWS_READ, JSON.stringify({ titles: list }))
}

function markAsRead(title: string): void {
  if (readTitles.has(title)) return
  readTitles.add(title)
  if (readTitles.size > MAX_READ) {
    const keep = [...readTitles].slice(-MAX_READ)
    readTitles.clear()
    for (const k of keep) readTitles.add(k)
  }
  saveReadTitles()
}

function isRead(title: string): boolean {
  return readTitles.has(title)
}

const openedUrls = reactive(new Set<string>())

function loadOpened(): void {
  const raw = localStorage.getItem(STORAGE_KEYS.NEWS_OPENED)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    const today = new Date().toISOString().slice(0, 10)

    if (parsed?.date === today && Array.isArray(parsed.urls)) {
      for (const u of parsed.urls) openedUrls.add(u)
    } else {
      localStorage.removeItem(STORAGE_KEYS.NEWS_OPENED)
    }
  } catch {  }
}

function markOpened(url: string): void {
  if (!url || openedUrls.has(url)) return
  openedUrls.add(url)
  if (openedUrls.size > MAX_READ) {
    const keep = [...openedUrls].slice(-MAX_READ)
    openedUrls.clear()
    for (const k of keep) openedUrls.add(k)
  }
  localStorage.setItem(STORAGE_KEYS.NEWS_OPENED, JSON.stringify({
    date: new Date().toISOString().slice(0, 10),
    urls: [...openedUrls],
  }))
}

function isOpened(url: string): boolean {
  return !!url && openedUrls.has(url)
}

let scrollTimer: number | null = null

const showRailTop = ref(false)

function scrollRailTop(): void {
  railRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  pinned.value = true
}

function onRailScroll(): void {
  if (scrollTimer) cancelAnimationFrame(scrollTimer)
  scrollTimer = requestAnimationFrame(() => {
    const el = railRef.value
    if (!el) return
    showRailTop.value = el.scrollTop > 320
    const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (scrollBottom < 240) loadMoreNews()
  })
}

async function loadMoreNews(): Promise<void> {
  if (loadingMore.value || noMoreNews.value) return
  const items = newsItems.value
  if (items.length === 0) return
  const oldestCtime = items[items.length - 1].ctime
  if (!oldestCtime) return

  loadingMore.value = true
  try {
    const more = await fetchMoreNews(oldestCtime)
    if (more.length > 0) {
      const existingTitles = new Set(items.map(i => i.title))
      const newItems = more.filter(i => !existingTitles.has(i.title))
      if (newItems.length > 0) {
        newsItems.value = [...items, ...newItems]
      }
    } else {
      noMoreNews.value = true
    }
  } finally {
    loadingMore.value = false
  }
}

function sourceHue(source: string): number {
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i)
    hash |= 0
  }
  return 185 + (Math.abs(hash) % 105)
}
function sourceStyle(source: string): Record<string, string> {
  return { '--src-h': String(sourceHue(source)) }
}

const pendingNews = ref<NewsItem[] | null>(null)
const pendingCount = computed(() => {
  if (!pendingNews.value) return 0
  const known = new Set(newsItems.value.map(i => i.title))
  return pendingNews.value.filter(i => !known.has(i.title)).length
})

function applyPending(): void {
  if (!pendingNews.value) return
  newsItems.value = pendingNews.value
  pendingNews.value = null
  noMoreNews.value = false
  activeIndex.value = 0

  railRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

async function refreshNews(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await newsStore.refresh()
    const fresh = [...newsStore.news]

    if (newsItems.value.length === 0) {
      newsItems.value = fresh
      noMoreNews.value = false
    } else {
      const known = new Set(newsItems.value.map(i => i.title))

      if (fresh.some(i => !known.has(i.title))) pendingNews.value = fresh
    }
    resetCountdown()
  } finally {
    refreshing.value = false
  }
}

const { countdown, resetCountdown } = usePageAutoRefresh({
  enabled: () => settingsStore.newsAutoRefresh,
  interval: () => settingsStore.newsRefreshInterval,
  onTick: refreshNews,
})

const blacklistKeywords = ref<string[]>([])
const blacklistInput = ref('')

function initBlacklist(): void {
  blacklistKeywords.value = [...newsStore.blacklist]
}

function addKeyword(): void {
  const kw = blacklistInput.value.trim()
  if (!kw) return

  if (blacklistKeywords.value.some(k => k.toLowerCase() === kw.toLowerCase())) {
    blacklistInput.value = ''
    return
  }
  blacklistKeywords.value.push(kw)
  blacklistInput.value = ''
  applyBlacklist()
}

function removeKeyword(idx: number): void {
  blacklistKeywords.value.splice(idx, 1)
  applyBlacklist()
}

function applyBlacklist(): void {
  newsStore.blacklist = [...blacklistKeywords.value]
  saveJSON(STORAGE_KEYS.NEWS_BLACKLIST, newsStore.blacklist)
  newsItems.value = [...newsStore.news]
}

onMounted(async () => {
  const preconnectDomains = ['https://finance.sina.com.cn']
  for (const domain of preconnectDomains) {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = domain
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }

  loadReadTitles()
  loadOpened()

  newsStore.restoreState()
  initBlacklist()

  await newsStore.refresh()
  newsItems.value = [...newsStore.news]

  startAuto()
  railRef.value?.addEventListener('scroll', onRailScroll, { passive: true })

  document.addEventListener('visibilitychange', onVisibilityChange)
  watchViewport()

  visibleTimer = setInterval(recheckVisible, 1000)
})

onUnmounted(() => {
  railRef.value?.removeEventListener('scroll', onRailScroll)
  stopAuto()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  io?.disconnect()
  io = null
  if (visibleTimer) { clearInterval(visibleTimer); visibleTimer = null }
})
</script>
<style scoped>
.news-full-page {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nv-head { flex-shrink: 0; margin-bottom: var(--spacing-sm); }
.nv-head-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  height: 42px;
  padding: 0 6px 0 var(--spacing-md);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--bg-card);
}

.nv-head-glow {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 55%;
  height: 130%;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, var(--color-primary-glow) 0%, transparent 68%);
  opacity: 0.35;
  pointer-events: none;
}

.nv-head-k {
  position: relative;
  z-index: 1;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--color-primary);
  flex-shrink: 0;
}

.nv-head-count {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 2px 9px;
  white-space: nowrap;
  border-radius: var(--radius-full);
  background: var(--color-primary-glow);
  color: var(--color-primary);
  font-size: var(--font-xs);
  font-weight: 600;

  margin-right: auto;
}
.nv-head-count b {
  font-size: var(--font-sm);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.nv-head-btn {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.nv-head-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.nv-head-btn.active { color: var(--color-primary); }
.nv-head-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

.nv-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 4fr;
  gap: var(--spacing-sm);
}

.nv-rail {
  position: relative;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border-radius: var(--radius-lg);

  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  padding-top: 0;

  padding-bottom: var(--spacing-xs);
}
.nv-rail::-webkit-scrollbar { display: none; width: 0; }

.nv-rail-label {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 6px;
  background: var(--bg-base);
}
.nv-rail-label-txt {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text-muted);
}

.nv-rail-rule {
  flex: 1;
  height: 1px;
  background-image: linear-gradient(90deg, var(--border-default) 50%, transparent 50%);
  background-size: 4px 1px;
  background-repeat: repeat-x;
}

.nv-new {
  position: sticky;
  top: 28px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: calc(100% - 10px);
  margin: 0 5px 4px;
  padding: 7px 6px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 18px var(--color-primary-glow);
  transition: filter var(--transition-fast);
}
.nv-new:hover { filter: brightness(1.1); }
.nv-new-txt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.nv-new-dot {
  width: 5px;
  height: 5px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: currentColor;
  animation: nvPulse 1.6s ease-in-out infinite;
}
@keyframes nvPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.nv-drop-enter-active, .nv-drop-leave-active {
  transition: transform var(--duration-fast) var(--ease-out-expo),
              opacity var(--duration-fast) var(--ease-out-expo);
}
.nv-drop-enter-from, .nv-drop-leave-to { transform: translateY(-8px); opacity: 0; }

.nv-rail-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 5px 5px;
}

.nv-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 7px 8px 7px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast),
              border-color var(--transition-fast),
              color var(--transition-fast);
}

.nv-tile::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: var(--radius-full);
  background: hsl(var(--src-h, 210) 65% 58% / 0.55);
  transition: background-color var(--transition-fast);
}

.nv-tile-corner {
  position: absolute;
  width: 6px;
  height: 6px;
  border-color: hsl(var(--src-h, 210) 65% 62% / 0.35);
  border-style: solid;
  border-width: 0;
  opacity: 0;
  transition: opacity var(--transition-fast), border-color var(--transition-fast);
}
.c-tl { top: 4px; left: 4px; border-top-width: 1px; border-left-width: 1px; }
.c-br { right: 4px; bottom: 4px; border-bottom-width: 1px; border-right-width: 1px; }
.nv-tile:hover .nv-tile-corner { opacity: 0.6; }
.nv-tile.on .nv-tile-corner {
  opacity: 1;
  border-color: hsl(var(--src-h, 210) 72% 66%);
}

.nv-tile-fill {
  flex: 1;
  height: 1px;
  min-width: 6px;
  background-image: linear-gradient(90deg, var(--border-default) 50%, transparent 50%);
  background-size: 3px 1px;
  background-repeat: repeat-x;
  opacity: 0.7;
}
.nv-tile:hover { background: var(--bg-card-hover); }
.nv-tile.on {
  background: linear-gradient(
    135deg,
    hsl(var(--src-h, 210) 60% 52% / 0.18),
    var(--bg-card) 72%
  );
  border-color: hsl(var(--src-h, 210) 62% 58% / 0.55);
  color: var(--text-primary);
  box-shadow: 0 0 0 1px hsl(var(--src-h, 210) 62% 58% / 0.18),
              0 4px 18px hsl(var(--src-h, 210) 60% 45% / 0.20);
}

.nv-tile-scan {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 1px;
  overflow: hidden;
  border-radius: var(--radius-full);
}
.nv-tile-scan::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, hsl(var(--src-h, 210) 80% 72%), transparent);
  animation: nvScan 2.6s var(--ease-out-expo) infinite;
}
@keyframes nvScan {
  0%   { transform: translateX(-100%); }
  60%, 100% { transform: translateX(100%); }
}

.nv-tile-head {
  display: flex;
  align-items: center;
  gap: 5px;
}

.nv-tile-no {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: hsl(var(--src-h, 210) 62% 62% / 0.6);
  font-variant-numeric: tabular-nums;
}
.nv-tile.on .nv-tile-no { color: hsl(var(--src-h, 210) 72% 66%); }
.nv-tile.on::before { background: hsl(var(--src-h, 210) 70% 62%); }

.nv-tile.read:not(.on) { opacity: 0.5; }

.nv-tile-time {
  font-size: 8px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.nv-tile-title {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.nv-tile.on .nv-tile-title { color: var(--text-primary); }

.nv-tile-foot {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.nv-tile-seen {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary-glow);
  color: var(--color-primary);
}

.nv-tile.opened::before { background: var(--color-primary); }

.nv-tile-src {
  font-size: 8px;
  min-width: 0;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nv-skel {
  height: 58px;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  opacity: 0.5;
}

.nv-rail-empty {
  margin: 0;
  padding: var(--spacing-lg) var(--spacing-xs);
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
}

.nv-totop {
  position: sticky;
  bottom: 5px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: calc(100% - 10px);
  padding: 7px 0;
  margin: 4px 5px 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary);
  background: var(--color-primary-glow);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: var(--color-primary);
  cursor: pointer;
  font-family: inherit;
  box-shadow: var(--shadow-md);
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.nv-totop:hover { background: var(--color-primary); color: var(--color-on-primary); }
.nv-totop-txt {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.nv-read {
  position: relative;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  padding: var(--spacing-lg);

  padding-top: calc(var(--spacing-lg) + 8px);
}

.nv-read::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 10px;
  height: 10px;
  border-right: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
  pointer-events: none;
}

.nv-read::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 180px;
  background: linear-gradient(180deg, hsl(var(--src-h, 210) 60% 50% / 0.10), transparent);
  pointer-events: none;
}
.nv-read::-webkit-scrollbar { display: none; width: 0; }

.nv-read-head {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-lg);

  border-bottom: 1px dashed var(--border-default);
}

.nv-read-specs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: 4px var(--spacing-lg);
}
.nv-spec {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.nv-spec-k {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--text-muted);
  flex-shrink: 0;
}
.nv-spec-fill {
  flex: 1;
  height: 1px;
  min-width: 8px;
  background-image: linear-gradient(90deg, var(--border-default) 50%, transparent 50%);
  background-size: 3px 1px;
  background-repeat: repeat-x;
}
.nv-spec-v {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}

.nv-spec-src {
  color: hsl(var(--src-h, 210) 72% 66%);
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nv-read-title {
  margin: 0;

  font-size: clamp(19px, 2.4vw, 28px);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.nv-read-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  max-width: 65ch;
  padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) 0;
}

.nv-read-body .nv-para:first-child {
  font-size: var(--font-lg);
  line-height: 1.7;
  color: var(--text-primary);
  text-indent: 0;
  font-weight: 500;
}
.nv-para {
  position: relative;
  margin: 0;
  padding-left: var(--spacing-md);
  font-size: var(--font-md);
  line-height: 1.85;
  color: var(--text-secondary);

  text-indent: 2em;
}

.nv-para::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.7em;
  width: 2px;
  height: 12px;
  border-radius: var(--radius-full);
  background: hsl(var(--src-h, 210) 60% 55% / 0.4);
}

.nv-read-none {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 45%;
  color: var(--text-muted);
  text-align: center;
}

.nv-open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 20px;
  border-radius: var(--radius-full);
  background: hsl(var(--src-h, 210) 65% 55%);
  color: var(--bg-base);
  font-size: var(--font-sm);
  font-weight: 700;
  text-decoration: none;
  transition: filter var(--transition-fast), transform var(--transition-fast);
}
.nv-open:hover { filter: brightness(1.12); transform: translateY(-1px); }
.nv-none-title {
  margin: 0;
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-secondary);
}

.bl-body { display: flex; flex-direction: column; gap: var(--spacing-md); }
.bl-hint {
  margin: 0;
  font-size: var(--font-xs);
  color: var(--text-muted);
  line-height: 1.6;
}
.bl-add { display: flex; gap: var(--spacing-sm); }
.bl-input {
  flex: 1;
  min-width: 0;
  padding: 10px var(--spacing-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-sm);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.bl-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}
.bl-input::placeholder { color: var(--text-muted); }
.bl-add-btn {
  flex-shrink: 0;
  padding: 0 var(--spacing-lg);
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-family: inherit;
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.bl-add-btn:hover { background: var(--color-primary-light); }

.bl-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.bl-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 6px 4px 11px;
  border-radius: var(--radius-full);

  background: var(--color-rise-glow);
  border: 1px solid var(--color-rise-glow);
  color: var(--color-rise);
  font-size: var(--font-xs);
}
.bl-tag-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.65;
  transition: opacity var(--transition-fast), background-color var(--transition-fast);
}
.bl-tag-x:hover { opacity: 1; background: var(--color-rise-glow); }
.bl-empty {
  margin: 0;
  padding: var(--spacing-sm) 0;
  text-align: center;
  font-size: var(--font-xs);
  color: var(--text-muted);
}

@media (max-width: 767px) {
  .nv-split { grid-template-columns: 1fr 3fr; gap: var(--spacing-xs); }
  .nv-read { padding: var(--spacing-md); padding-top: calc(var(--spacing-md) + 6px); }
  .nv-tile { padding: 6px 5px 6px 8px; }

  .nv-tile-title {
    font-size: 9px;
    font-weight: 400;
    line-height: 1.5;
  }
  .nv-tile.on .nv-tile-title { font-weight: 600; }
  .nv-tile-time, .nv-tile-no { font-size: 7px; }

  .nv-tile-src { display: none; }
  .nv-tile-foot:empty { display: none; }
  .nv-para { font-size: var(--font-sm); line-height: 1.75; }
}

@media (max-height: 760px) and (min-width: 768px) {
  .nv-read { padding: var(--spacing-md); padding-top: calc(var(--spacing-md) + 6px); }
  .nv-para { line-height: 1.7; }
  .nv-read-head { padding-bottom: var(--spacing-sm); margin-bottom: var(--spacing-sm); }
}


</style>
