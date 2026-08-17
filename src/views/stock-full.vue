<template>
  <div class="stock-full-page">
    <header class="sk-head">
      <div class="sk-search" :class="{ focused: showAddStock }">
        <span class="sk-glow" aria-hidden="true" />
        <svg class="sk-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref="stockInputRef"
          v-model="stockInput"
          class="sk-input"
          placeholder="搜索代码或名称，添加自选"
          @keydown="onSearchKeydown"
          @focus="expandSearch"
          @blur="onSearchBlur"
        />
        <span v-if="stockStore.watchlist.length > 0" class="sk-count font-number">{{ stockStore.watchlist.length }}</span>
        <RefreshControl
          class="sk-refresh-ctrl"
          toggle-key="marketAutoRefresh"
          interval-key="marketRefreshInterval"
          :options="[5, 10, 15, 30, 60, 120]"
        />
        <RingRefresh
          class="sk-refresh"
          :interval="settingsStore.marketRefreshInterval"
          :countdown="countdown"
          :enabled="settingsStore.marketAutoRefresh"
          :spinning="refreshing"
          @refresh="manualRefresh"
        />
        <div v-if="showDropdown" class="search-dropdown">
          <div v-if="searching" class="dropdown-status">搜索中...</div>
          <template v-else-if="searchResults.length > 0">
            <div
              v-for="(item, idx) in searchResults"
              :key="item.code"
              :class="['search-result-item', { highlighted: idx === searchHighlight }]"
              @mousedown.prevent="selectSearchResult(item)"
              @mouseenter="searchHighlight = idx"
            >
              <span class="sr-name">{{ item.name }}</span>
              <span class="sr-code">{{ item.code }}</span>
              <span class="sr-market">{{ item.market }}</span>
            </div>
          </template>
          <div v-else class="dropdown-status">未找到匹配股票</div>
        </div>
      </div>
    </header>
    <div class="market-body" ref="marketBodyRef">
    <section class="watchlist-panel">
      <span v-if="addError" class="add-error">{{ addError }}</span>
      <div v-if="stockStore.loading && stockStore.watchlist.length === 0" class="watchlist-grid">
        <div v-for="i in 4" :key="i" class="wc wc-skel">
          <div class="wc-head"><span class="skel-line skel-name"></span></div>
          <div class="wc-main"><span class="skel-line skel-price"></span></div>
          <span class="skel-line skel-range"></span>
        </div>
      </div>
      <div v-else-if="stockStore.watchlist.length === 0 && !showAddStock" class="empty-text">
        在上方搜索框输入代码或名称，添加自选股票
      </div>
      <div v-else class="watchlist-grid">
        <div
          v-for="item in sortedWatchlist"
          :key="item.code"
          :class="['wc', watchTint(item)]"
        >
          <span class="wc-glow" aria-hidden="true" />
          <div class="wc-head">
            <div class="wc-ident">
              <span class="wc-nameline">
                <span class="wc-name">{{ item.name }}</span>
                <span v-if="item.marketCap" class="wc-cap font-number" title="总市值">{{ fmtTurnover(item.marketCap) }}</span>
              </span>
              <span class="wc-code font-number">{{ item.code }}</span>
            </div>
            <button class="wc-x" title="移除自选" @click.stop="stockStore.removeFromWatchlist(item.code)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="wc-main">
            <span class="wc-price font-number">{{ item.price > 0 ? item.price.toFixed(2) : '--' }}</span>
            <span v-if="item.price > 0" :class="['wc-chg', watchRate(item)]">
              <svg class="wc-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline v-if="item.changeRate >= 0" points="5 16 11 10 15 14 19 8" />
                <polyline v-else points="5 8 11 14 15 10 19 16" />
              </svg>
              <span class="wc-chg-rate font-number">{{ item.changeRate >= 0 ? '+' : '' }}{{ item.changeRate.toFixed(2) }}%</span>
              <span v-if="item.changeAmount" class="wc-chg-amt font-number">{{ item.changeAmount >= 0 ? '+' : '' }}{{ item.changeAmount.toFixed(2) }}</span>
            </span>
            <span v-else class="wc-chg text-muted">--</span>
          </div>
          <div v-if="rangePct(item) !== null" class="wc-range">
            <span class="wc-range-lo font-number">{{ fmtPrice(item.low) }}</span>
            <span class="wc-range-track">
              <span class="wc-range-dot" :class="watchRate(item)" :style="{ left: rangePct(item) + '%' }" />
            </span>
            <span class="wc-range-hi font-number">{{ fmtPrice(item.high) }}</span>
          </div>
          <button
            type="button"
            class="wc-toggle"
            :aria-expanded="isCardOpen(item.code)"
            @click.stop="toggleCard(item.code)"
          >
            <span class="wc-toggle-txt">{{ isCardOpen(item.code) ? '收起' : '详细' }}</span>
            <svg class="toggle-arrow" :class="{ open: isCardOpen(item.code) }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div class="wc-more-wrap" :class="{ 'is-open': isCardOpen(item.code) }">
            <div class="wc-more-body">
              <div class="wc-more">
                <div class="wc-cell"><span class="wc-cell-k">今开</span><span class="wc-cell-v font-number" :class="priceTone(item.open, item.prevClose)">{{ fmtPrice(item.open) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">昨收</span><span class="wc-cell-v font-number">{{ fmtPrice(item.prevClose) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">最高</span><span class="wc-cell-v font-number" :class="priceTone(item.high, item.prevClose)">{{ fmtPrice(item.high) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">最低</span><span class="wc-cell-v font-number" :class="priceTone(item.low, item.prevClose)">{{ fmtPrice(item.low) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">振幅</span><span class="wc-cell-v font-number">{{ fmtRate(amplitude(item)) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">换手率</span><span class="wc-cell-v font-number">{{ fmtRate(item.turnoverRate) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">成交量</span><span class="wc-cell-v font-number">{{ fmtVolume(item.volume) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">成交额</span><span class="wc-cell-v font-number">{{ fmtTurnover(item.turnover) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">流通值</span><span class="wc-cell-v font-number">{{ fmtTurnover(item.floatCap) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">市盈率</span><span class="wc-cell-v font-number">{{ fmtRatio(item.peRatio) }}</span></div>
                <div class="wc-cell"><span class="wc-cell-k">市净率</span><span class="wc-cell-v font-number">{{ fmtRatio(item.pbRatio) }}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <button v-show="showBackTop" type="button" class="back-to-top" @click="scrollToTop" title="回到顶部">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span class="back-to-top-txt">TOP</span>
    </button>
    </div>
  </div>
</template>
<script setup lang="ts">

defineOptions({ name: 'StockFull' })

import { ref, computed, watch, onMounted, onUnmounted, onActivated } from 'vue'
import { useStockStore } from '@/modules/stock/stock-store'
import { useIndexStore } from '@/modules/index/index-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { searchStocks } from '@/modules/stock/search/stock-search'
import type { StockSearchItem, StockQuote } from '@/modules/stock/stock-types'
import { formatTurnover } from '@/shared/utils/money-format'
import { usePageAutoRefresh } from '@/composables/use-page-auto-refresh'
import RingRefresh from '@/components/shared/ring-refresh.vue'
import RefreshControl from '@/components/shared/refresh-control.vue'

const stockStore = useStockStore()
const indexStore = useIndexStore()
const settingsStore = useSettingsStore()

const showAddStock = ref(true)
const stockInput = ref('')

const stockInputRef = ref<HTMLInputElement | null>(null)
const addingStock = ref(false)
const addError = ref('')
const showBackTop = ref(false)
const refreshing = ref(false)

const searchResults = ref<StockSearchItem[]>([])
const showDropdown = ref(false)
const searching = ref(false)
const searchHighlight = ref(-1)
let searchTimer: ReturnType<typeof setTimeout> | null = null

let scrollTimer: number | null = null
const marketBodyRef = ref<HTMLElement | null>(null)

const openCards = ref<Set<string>>(new Set())

function isCardOpen(code: string): boolean {
  return openCards.value.has(code)
}

function toggleCard(code: string): void {
  const next = new Set(openCards.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  openCards.value = next
}

const sortedWatchlist = computed<StockQuote[]>(() => {
  const rows = stockStore.watchlist.map(entry => {
    const q = stockStore.quoteMap.get(entry.code)
    if (q) return q

    return {
      code: entry.code,
      name: entry.code,
      price: 0,
      changeRate: 0,
      changeAmount: 0,
      emMarketCode: entry.emMarketCode,
    } as StockQuote
  })
  return rows.sort((a, b) => {
    const aValid = a.price > 0
    const bValid = b.price > 0
    if (aValid !== bValid) return aValid ? -1 : 1
    return b.changeRate - a.changeRate
  })
})

function handleScroll(): void {
  if (scrollTimer) cancelAnimationFrame(scrollTimer)
  scrollTimer = requestAnimationFrame(() => {
    showBackTop.value = (marketBodyRef.value?.scrollTop ?? 0) > 400
  })
}

function scrollToTop(): void {
  marketBodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function expandSearch(): void {
  if (!showAddStock.value) {
    showAddStock.value = true
  }
}

function onSearchBlur(e: FocusEvent): void {
  const related = e.relatedTarget as HTMLElement | null
  if (related?.closest('.search-dropdown')) return

  setTimeout(() => {
    closeDropdown()
  }, 150)
}

function resetSearchInput(): void {
  stockInput.value = ''
  closeDropdown()
  addError.value = ''
}

function closeDropdown(): void {
  showDropdown.value = false
  searchResults.value = []
  searchHighlight.value = -1
  searching.value = false
}

watch(stockInput, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  const q = val.trim()
  if (!q) {
    closeDropdown()
    return
  }

  showDropdown.value = true
  searching.value = true
  searchResults.value = []
  searchHighlight.value = -1

  searchTimer = setTimeout(async () => {
    try {
      searchResults.value = await searchStocks(q)
      searchHighlight.value = -1
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 200)
})

function onSearchKeydown(e: KeyboardEvent): void {
  if (!showDropdown.value || searchResults.value.length === 0) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddStock()
    }
    if (e.key === 'Escape') closeDropdown()
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      searchHighlight.value = (searchHighlight.value + 1) % searchResults.value.length
      break
    case 'ArrowUp':
      e.preventDefault()
      searchHighlight.value = searchHighlight.value <= 0
        ? searchResults.value.length - 1
        : searchHighlight.value - 1
      break
    case 'Enter':
      e.preventDefault()
      if (searchHighlight.value >= 0) {
        selectSearchResult(searchResults.value[searchHighlight.value])
      } else {
        handleAddStock()
      }
      break
    case 'Escape':
      closeDropdown()
      break
  }
}

async function selectSearchResult(item: StockSearchItem): Promise<void> {
  addError.value = ''
  addingStock.value = true
  try {
    const ok = stockStore.addToWatchlist(item)
    if (!ok) {
      addError.value = '已在自选中或添加失败'
    } else {
      resetSearchInput()
      stockInputRef.value?.focus()

      void stockStore.refresh()
    }
  } finally {
    addingStock.value = false
  }
}

async function handleAddStock(): Promise<void> {
  const code = stockInput.value.trim()
  if (!code || addingStock.value) return

  addError.value = ''
  addingStock.value = true
  try {
    const item: StockSearchItem = { code, name: code, market: '', rawMarket: '' }
    const ok = stockStore.addToWatchlist(item)
    if (ok) {
      resetSearchInput()
      stockInputRef.value?.focus()

      void stockStore.refresh()
    } else {
      addError.value = '已在自选中或添加失败'
    }
  } finally {
    addingStock.value = false
  }
}

async function autoRefresh(): Promise<void> {
  await indexStore.refresh()
  await stockStore.refresh()
}

const { countdown, resetCountdown } = usePageAutoRefresh({
  enabled: () => settingsStore.marketAutoRefresh,
  interval: () => settingsStore.marketRefreshInterval,
  onTick: autoRefresh,
})

async function manualRefresh(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await indexStore.refresh()
    await stockStore.refresh()
    resetCountdown()
  } finally {
    refreshing.value = false
  }
}

function ensureQuotes(): void {
  if (stockStore.watchlist.length === 0) {
    stockStore.restoreWatchlist()
  }
  if (stockStore.watchlist.length === 0) return

  const needsFetch = stockStore.watchlist.some(
    e => !stockStore.quoteMap.get(e.code) || (stockStore.quoteMap.get(e.code)?.price ?? 0) <= 0,
  )
  if (needsFetch) void stockStore.refresh()
}

onMounted(() => {
  ensureQuotes()
  marketBodyRef.value?.addEventListener('scroll', handleScroll, { passive: true })
})

onActivated(ensureQuotes)

onUnmounted(() => {
  marketBodyRef.value?.removeEventListener('scroll', handleScroll)
})

function watchTint(w: StockQuote): string {
  if (w.price <= 0) return ''
  return w.changeRate > 0 ? 'tint-rise' : w.changeRate < 0 ? 'tint-fall' : ''
}
function watchRate(w: StockQuote): string {
  if (w.price <= 0) return ''
  return w.changeRate > 0 ? 'text-rise' : w.changeRate < 0 ? 'text-fall' : 'text-flat'
}

function fmtPrice(v: number | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '--'
  return v.toFixed(2)
}
function fmtRate(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return '--'
  return `${v.toFixed(2)}%`
}

function rangePct(item: StockQuote): number | null {
  const low = item.low ?? 0
  const high = item.high ?? 0
  const price = item.price ?? 0
  if (low <= 0 || high <= 0 || price <= 0 || high <= low) return null
  const pct = ((price - low) / (high - low)) * 100

  return Math.min(98, Math.max(2, pct))
}

function fmtRatio(v: number | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '--'
  return v.toFixed(2)
}
function fmtTurnover(v: number | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '--'
  return formatTurnover(v)
}

function fmtVolume(v: number | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '--'
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿手`
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万手`
  return `${v.toFixed(0)}手`
}

function amplitude(item: StockQuote): number | undefined {
  const { high, low, prevClose } = item
  if (high == null || low == null || prevClose == null) return undefined
  if (!(high > 0) || !(low > 0) || !(prevClose > 0)) return undefined
  return ((high - low) / prevClose) * 100
}

function priceTone(v: number | undefined, prevClose: number | undefined): string {
  if (v == null || prevClose == null || !(v > 0) || !(prevClose > 0)) return ''
  return v > prevClose ? 'text-rise' : v < prevClose ? 'text-fall' : 'text-flat'
}
</script>
<style scoped>
.stock-full-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: var(--spacing-sm);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}
.back-btn:hover { color: var(--text-primary); border-color: var(--border-hover); }

.sk-head {
  flex-shrink: 0;

  position: relative;
  z-index: 200;
}

.sk-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  height: 46px;
  padding: 0 6px 0 var(--spacing-md);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  overflow: visible;
  transition: border-color var(--duration-fast) var(--ease-out-expo),
              box-shadow var(--duration-fast) var(--ease-out-expo);
}

.sk-search.focused {
  border-color: var(--color-primary);
  box-shadow:
    inset 0 0 0 1px var(--color-primary-glow),
    0 0 0 4px var(--color-primary-glow),
    0 0 28px var(--color-primary-glow);
}

.sk-glow {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 55%;
  height: 130%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    var(--color-primary-glow) 0%,
    transparent 68%
  );
  opacity: 0.35;
  pointer-events: none;
  transition: opacity var(--duration-normal) var(--ease-out-expo);
}
.sk-search.focused .sk-glow { opacity: 1; }

.sk-search-icon {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  color: var(--text-muted);
  transition: color var(--transition-fast);
}
.sk-search.focused .sk-search-icon { color: var(--color-primary); }

.sk-input {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-sm);
  outline: none;
}
.sk-input::placeholder { color: var(--text-muted); }

.sk-count {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding: 2px 9px;
  border-radius: var(--radius-full);
  background: var(--color-primary-glow);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.sk-refresh { position: relative; z-index: 1; }

.market-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 var(--spacing-xs);
  flex-shrink: 0;
}

.market-body {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  box-sizing: border-box;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.logo-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.market-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-secondary);
}

.market-sub {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.refresh-icon { flex-shrink: 0; }
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-lg);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.panel-header:hover {
  background: var(--bg-card-hover);
}

.panel-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-icon:hover,
.btn-icon.active {
  border-color: var(--color-primary);
  color: var(--color-primary-light);
  background: var(--color-primary-glow);
}

.toggle-arrow {
  transition: transform var(--transition-fast);
  color: var(--text-muted);
  flex-shrink: 0;
}

.toggle-arrow.open {
  transform: rotate(180deg);
}

.loading-text,
.empty-text {
  font-size: var(--font-sm);
  color: var(--text-muted);
  text-align: center;
  padding: var(--spacing-lg);
}

.skel-line {
  display: block;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);

  background-image: linear-gradient(90deg, var(--bg-card) 0%, var(--bg-card-hover) 50%, var(--bg-card) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .skel-line { animation: none; }
}

.watchlist-panel {
  padding: 0;
  overflow: visible;
  position: relative;
}

.add-error {
  display: block;
  font-size: var(--font-xs);
  color: var(--color-rise);
  padding: 0 var(--spacing-lg) var(--spacing-xs);
}

.sk-search .search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 100%;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 280px;
  overflow-y: auto;
  z-index: 9999;
}

.dropdown-status {
  padding: 12px 16px;
  font-size: var(--font-sm);
  color: var(--text-muted);
  text-align: center;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 8px 12px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.search-result-item:hover,
.search-result-item.highlighted {
  background: var(--color-primary-glow);
}

.search-result-item:first-child {
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.search-result-item:last-child {
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}

.sr-name {
  flex: 1;
  font-size: var(--font-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sr-code {
  font-size: var(--font-xs);
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
  min-width: 56px;
  text-align: right;
}

.sr-market {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: var(--radius-full);
  background: var(--color-primary-glow);
  color: var(--color-primary-light);
  font-weight: 600;
  min-width: 22px;
  text-align: center;
}

.watchlist-grid {
  display: grid;

  grid-template-columns: repeat(2, 1fr);

  align-items: start;
  gap: var(--spacing-sm);
}

.wc {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: var(--spacing-md) var(--spacing-md) var(--spacing-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  overflow: clip;
  transition: transform var(--duration-micro) var(--ease-out-expo),
              border-color var(--duration-micro) var(--ease-out-expo);
}
.wc:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}
.wc-glow {
  position: absolute;
  right: -20%;
  top: -60%;
  width: 70%;
  aspect-ratio: 1;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.55;
  transition: opacity var(--duration-micro) var(--ease-out-expo);
}
.wc:hover .wc-glow { opacity: 1; }
.wc.tint-rise .wc-glow { background: radial-gradient(circle, rgba(239, 68, 68, 0.22), transparent 68%); }
.wc.tint-fall .wc-glow { background: radial-gradient(circle, rgba(34, 197, 94, 0.22), transparent 68%); }

.wc-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-xs);
  min-width: 0;
}
.wc-ident { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.wc-nameline {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}
.wc-name {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wc-cap {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-glow);
}
.wc-code {
  font-size: 9px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.wc-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;

  opacity: 0;
  transition: opacity var(--transition-fast), background-color var(--transition-fast),
              color var(--transition-fast);
}
.wc:hover .wc-x { opacity: 0.6; }
.wc-x:hover { opacity: 1; background: var(--color-rise-glow); color: var(--color-rise); }

@media (hover: none) {
  .wc-x { opacity: 0.45; }
}

.wc-main {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.wc-price {
  font-size: var(--font-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.wc-chg {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--font-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.wc-arrow { flex-shrink: 0; }
.wc-chg-amt { opacity: 0.7; font-weight: 600; }

.wc-range {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
}
.wc-range-lo,
.wc-range-hi {
  font-size: 9px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.wc-range-track {
  position: relative;
  flex: 1;
  height: 3px;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--color-fall), var(--border-default) 50%, var(--color-rise));
  opacity: 0.35;
}

.wc-range-dot {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 7px;
  margin-left: -3.5px;
  border-radius: var(--radius-full);
  transform: translateY(-50%);
  border: 1.5px solid var(--bg-surface);
  transition: left var(--duration-normal) var(--ease-out-expo);
}
.wc-range-dot.text-rise { background: var(--color-rise); }
.wc-range-dot.text-fall { background: var(--color-fall); }
.wc-range-dot.text-flat { background: var(--text-muted); }

.wc-toggle {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  margin-top: 3px;
  padding: 4px 0 0;
  border: none;
  border-top: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  transition: color var(--transition-fast);
}
.wc-toggle:hover { color: var(--text-primary); }
.wc-toggle-txt { letter-spacing: 0.02em; }

.wc-more-wrap {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-fast) var(--ease-out-expo);
}
.wc-more-wrap.is-open { grid-template-rows: 1fr; }


.wc-more-body {
  overflow: hidden;
  min-height: 0;
}

.wc-more {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px var(--spacing-sm);
  padding-top: var(--spacing-sm);
}
.wc-cell {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  min-width: 0;
}
.wc-cell-k { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.wc-cell-v {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.wc-skel { pointer-events: none; }
.wc-skel .skel-name { width: 60%; height: 11px; }
.wc-skel .skel-price { width: 45%; height: 22px; }
.wc-skel .skel-range { width: 100%; height: 3px; }

.back-to-top {
  position: sticky;
  bottom: 5px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 13px 0;
  margin-top: 4px;
  flex-shrink: 0;
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

.back-to-top:hover {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.back-to-top-txt {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

@media (max-width: 767px) {
  .stock-full-page {
    padding: var(--spacing-sm);
  }

  .index-grid {
    grid-template-columns: 1fr;
  }

  .index-price {
    font-size: var(--font-md);
  }

  .watchlist-grid {
    grid-template-columns: 1fr;
  }

  .wc { padding: var(--spacing-md); }
  .wc-price { font-size: var(--font-3xl); }
  .wc-more { grid-template-columns: repeat(3, 1fr); }

  .sk-search { height: 42px; padding-left: var(--spacing-sm); }
}

@media (max-height: 760px) and (min-width: 1024px) {
  .watchlist-grid { grid-template-columns: repeat(3, 1fr); }
  .wc { padding: var(--spacing-sm) var(--spacing-md); gap: 5px; }
  .wc-price { font-size: var(--font-xl); }
}

</style>
