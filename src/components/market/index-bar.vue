<template>
  <div class="ib" :class="{ 'is-open': expanded }">
    <div class="ib-bar surface-card" @click="toggleExpand">
      <span class="ib-tag">指数</span>
      <Transition name="ib-fade" mode="out-in">
        <div v-if="quotes.length > 0" :key="currentKey" class="ib-cur">
          <span class="ib-name">{{ cur.name }}</span>
          <span class="ib-price font-number">{{ cur.price > 0 ? cur.price.toFixed(2) : '--' }}</span>
          <span v-if="cur.price > 0" :class="['ib-rate font-number', rateClass(cur)]">
            {{ cur.changeRate >= 0 ? '+' : '' }}{{ cur.changeRate.toFixed(2) }}%
          </span>
          <span v-else class="ib-rate font-number text-flat">--</span>
        </div>
        <span v-else class="ib-empty">点击右侧齿轮选择指数</span>
      </Transition>
      <span v-if="quotes.length > 1" class="ib-dots font-number">{{ currentIdx + 1 }}/{{ quotes.length }}</span>
      <svg :class="['ib-arrow', { open: expanded }]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <button class="ib-gear" @click.stop="goSettings" title="选择指数">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
    <Transition name="ib-drop">
      <div v-if="expanded" class="ib-panel glass-card glass-card-elevated">
        <div v-if="quotes.length > 0" class="ib-grid">
          <div
            v-for="(q, i) in quotes"
            :key="q.secid"
            class="ib-cell animate-stagger"
            :style="{ '--i': Math.min(i, 12) }"
          >
            <span class="ib-cell-name">{{ q.name }}</span>
            <span class="ib-cell-price font-number">{{ q.price > 0 ? q.price.toFixed(2) : '--' }}</span>
            <span v-if="q.price > 0" :class="['ib-cell-rate font-number', rateClass(q)]">
              {{ q.changeRate >= 0 ? '+' : '' }}{{ q.changeRate.toFixed(2) }}%
            </span>
            <span v-else class="ib-cell-rate font-number text-flat">--</span>
          </div>
        </div>
        <p v-else class="ib-panel-empty">尚未选择指数</p>
      </div>
    </Transition>
    <div v-if="expanded" class="ib-catch" @click="toggleExpand" />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onActivated, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'
import { useIndexStore } from '@/modules/index/index-store'
import type { IndexQuote } from '@/modules/index/index-types'

const router = useRouter()
const indexStore = useIndexStore()

const expanded = ref(false)

const currentIdx = ref(0)

const CAROUSEL_INTERVAL = 4000

const REFRESH_INTERVAL = 60000

const quotes = computed(() => indexStore.selectedQuotes)

const cur = computed<IndexQuote>(() => quotes.value[currentIdx.value] ?? quotes.value[0])

const currentKey = computed(() => `${currentIdx.value}-${cur.value?.secid ?? ''}`)

let carouselTimer: number | null = null
let refreshTimer: number | null = null
let retryTimer: number | null = null

function startCarousel(): void {
  stopCarousel()
  if (expanded.value || quotes.value.length <= 1) return
  carouselTimer = window.setInterval(() => {
    if (quotes.value.length === 0) return
    currentIdx.value = (currentIdx.value + 1) % quotes.value.length
  }, CAROUSEL_INTERVAL)
}

function stopCarousel(): void {
  if (carouselTimer !== null) {
    clearInterval(carouselTimer)
    carouselTimer = null
  }
}

function toggleExpand(): void {
  expanded.value = !expanded.value
  if (expanded.value) {
    stopCarousel()
  } else {
    startCarousel()
  }
}

function goSettings(): void {
  router.push('/settings/indices')
}

watch(() => quotes.value.length, (len) => {
  if (len === 0) {
    currentIdx.value = 0
  } else if (currentIdx.value >= len) {
    currentIdx.value = 0
  }
  startCarousel()
})

watch(expanded, () => {
  if (expanded.value) stopCarousel()
  else startCarousel()
})

onActivated(() => {
  indexStore.restoreSelected()

  indexStore.refresh()

  let retries = 0
  const retryUntilData = () => {
    if (indexStore.indexQuotes.size > 0 || retries >= 5) return
    retries++
    void indexStore.refresh().finally(() => {
      retryTimer = window.setTimeout(retryUntilData, 3000)
    })
  }
  retryTimer = window.setTimeout(retryUntilData, 3000)

  refreshTimer = window.setInterval(() => indexStore.refresh(), REFRESH_INTERVAL)
  startCarousel()
})

onDeactivated(() => {
  stopCarousel()
  if (refreshTimer !== null) { clearInterval(refreshTimer); refreshTimer = null }
  if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null }
})

function rateClass(q: IndexQuote): string {
  if (q.price <= 0) return 'text-flat'
  return q.changeRate > 0 ? 'text-rise' : q.changeRate < 0 ? 'text-fall' : 'text-flat'
}
</script>
<style scoped>

.ib {
  position: relative;
  flex-shrink: 0;
  z-index: var(--z-sticky);
}

.ib.is-open {
  z-index: var(--z-popover);
}

.ib-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  min-height: 40px;
}

.ib-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-primary);
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: var(--color-primary-glow);
  flex-shrink: 0;
}

.ib-cur {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  min-width: 0;
  flex: 1;
}
.ib-name {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ib-price {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ib-rate { font-size: var(--font-xs); font-weight: 600; font-variant-numeric: tabular-nums; }
.ib-empty { font-size: var(--font-xs); color: var(--text-muted); flex: 1; }
.ib-dots {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.ib-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.ib-arrow.open { transform: rotate(180deg); }

.ib-gear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-full);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}
.ib-gear:hover { color: var(--text-primary); background: var(--border-subtle); }

.ib-fade-enter-active,
.ib-fade-leave-active { transition: opacity var(--duration-micro) var(--ease-smooth); }
.ib-fade-enter-from,
.ib-fade-leave-to { opacity: 0; }

.ib-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: var(--z-popover);
  padding: var(--spacing-sm);
  max-height: 60vh;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ib-grid {
  display: grid;

  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 4px;
}
.ib-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  min-width: 0;
}
.ib-cell-name {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ib-cell-price {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ib-cell-rate { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }

.ib-panel-empty {
  margin: 0;
  padding: var(--spacing-md);
  text-align: center;
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.ib-drop-enter-active {
  transition: opacity var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
}
.ib-drop-leave-active {
  transition: opacity var(--duration-micro) var(--ease-smooth),
              transform var(--duration-micro) var(--ease-smooth);
}
.ib-drop-enter-from,
.ib-drop-leave-to {
  opacity: 0;
  transform: translate3d(0, -8px, 0) scale(0.985);
}

.ib-catch {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-popover) - 1);
}
</style>
