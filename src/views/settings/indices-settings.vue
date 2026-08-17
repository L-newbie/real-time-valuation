<template>
  <div class="ix-page">
    <header class="ix-header">
      <button class="ix-back" @click="router.back()" title="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div class="ix-title-wrap">
        <h2 class="ix-title">指数选择</h2>
        <span class="ix-sub">已选 {{ marketStore.selectedIndices.length }} / {{ marketStore.allIndices.length }}</span>
      </div>
      <button class="ix-sort" :class="{ on: sortByRate }" :title="sortTitle" @click="toggleSort">
        <i class="ix-sort-arrow" :class="{ asc: sortByRate && sortDir === 'asc', off: !sortByRate }" />
        <span>{{ sortLabel }}</span>
      </button>
      <button
        v-if="marketStore.selectedIndices.length > 0"
        class="ix-clear"
        @click="clearAll"
      >清空</button>
    </header>
    <nav class="ix-tabs" role="tablist">
        <button
          v-for="g in groupedIndices"
          :key="g.label"
          role="tab"
          class="ix-tab"
          :class="{ on: activeMarket === g.label }"
          :aria-selected="activeMarket === g.label"
          @click="activeMarket = g.label"
        >
          {{ g.label }}
        <span v-if="g.selectedCount > 0" class="ix-tab-badge">{{ g.selectedCount }}</span>
      </button>
    </nav>
    <div class="ix-body">
      <div class="ix-grid">
        <button
          v-for="(idx, i) in activeItems"
          :key="idx.secid"
          class="ix-card animate-stagger"
          :class="{ on: idx.selected }"
          :style="{ '--i': Math.min(i, 12) }"
          @click="marketStore.toggleIndex(idx.secid)"
        >
          <span class="ix-card-top">
            <span class="ix-card-name">{{ idx.name }}</span>
            <span class="ix-card-check" :class="{ on: idx.selected }">
              <svg v-if="idx.selected" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          </span>
          <span class="ix-card-price font-number">{{ priceOf(idx.secid) }}</span>
          <span class="ix-card-foot">
            <span class="ix-card-code">{{ idx.code }}</span>
            <span :class="['ix-card-rate font-number', toneClass(idx.secid)]">{{ rateOf(idx.secid) }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useIndexStore } from '@/modules/index/index-store'

const router = useRouter()
const marketStore = useIndexStore()

const MARKET_GROUP: Record<string, string> = {
  sh: 'A股', sz: 'A股',
  hk: '港股',
  us: '美股',
  jp: '亚太', kr: '亚太', tw: '亚太',
  uk: '欧洲', de: '欧洲', fr: '欧洲',
}

const GROUP_ORDER: Record<string, number> = {
  'A股': 1, '港股': 2, '美股': 3, '亚太': 4, '欧洲': 5,
}

const groupedIndices = computed(() => {
  const map = new Map<string, typeof marketStore.allIndices[number][]>()
  for (const idx of marketStore.allIndices) {
    const raw = (idx as { market?: string }).market ?? ''
    const mkt = MARKET_GROUP[raw] ?? '其他'
    if (!map.has(mkt)) map.set(mkt, [])
    map.get(mkt)!.push(idx)
  }
  return Array.from(map.entries())
    .map(([label, items]) => ({
      label,
      items,
      selectedCount: items.filter(i => i.selected).length,
    }))
    .sort((a, b) => (GROUP_ORDER[a.label] ?? 99) - (GROUP_ORDER[b.label] ?? 99))
})

const activeMarket = ref('')

const sortMode = computed(() => marketStore.sortMode)
const sortByRate = computed(() => sortMode.value !== 'none')
const sortDir = computed(() => sortMode.value)

const sortLabel = computed(() => {
  if (sortMode.value === 'none') return '默认'
  return sortMode.value === 'desc' ? '降序' : '升序'
})
const sortTitle = computed(() => {
  if (sortMode.value === 'none') return '按预设顺序，点击改为按涨跌幅降序'
  return sortMode.value === 'desc' ? '涨跌幅从高到低，点击改升序' : '涨跌幅从低到高，点击恢复默认'
})

function toggleSort(): void {
  const next = sortMode.value === 'none' ? 'desc' : sortMode.value === 'desc' ? 'asc' : 'none'
  marketStore.setSortMode(next)
}

const activeItems = computed(() => {
  const g = groupedIndices.value.find(x => x.label === activeMarket.value)
  const items = g ? g.items : (groupedIndices.value[0]?.items ?? [])
  if (sortMode.value === 'none') return items

  const dir = sortMode.value === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const qa = quoteOf(a.secid)
    const qb = quoteOf(b.secid)

    const va = qa && qa.price > 0 ? qa.changeRate : null
    const vb = qb && qb.price > 0 ? qb.changeRate : null
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    return (va - vb) * dir
  })
})

watch(groupedIndices, (list) => {
  if (!activeMarket.value && list.length > 0) activeMarket.value = list[0].label
  else if (activeMarket.value && !list.some(g => g.label === activeMarket.value) && list.length > 0) {
    activeMarket.value = list[0].label
  }
}, { immediate: true })

function quoteOf(secid: string) {
  return marketStore.indexQuotes.get(secid)
}
function priceOf(secid: string): string {
  const q = quoteOf(secid)
  return q && q.price > 0 ? q.price.toFixed(2) : '--'
}
function rateOf(secid: string): string {
  const q = quoteOf(secid)
  if (!q || q.price <= 0) return '--'
  return `${q.changeRate >= 0 ? '+' : ''}${q.changeRate.toFixed(2)}%`
}

function clearAll(): void {
  const snapshot = [...marketStore.selectedIndices]
  for (const secid of snapshot) marketStore.toggleIndex(secid)
}

function toneClass(secid: string): string {
  const q = quoteOf(secid)
  if (!q || q.price <= 0) return 'tone-flat'
  return q.changeRate > 0 ? 'tone-rise' : q.changeRate < 0 ? 'tone-fall' : 'tone-flat'
}

onMounted(() => {
  marketStore.restoreSelected()

  if (marketStore.indexQuotes.size === 0) {
    marketStore.refresh()
  }
})
</script>
<style scoped>
.ix-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: var(--spacing-md);
  gap: var(--spacing-sm);
}

.ix-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}
.ix-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.ix-back:hover { background: var(--bg-card-hover); color: var(--text-primary); }

.ix-title-wrap { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.ix-title { font-size: var(--font-lg); font-weight: 700; color: var(--text-primary); margin: 0; }
.ix-sub { font-size: var(--font-xs); color: var(--text-muted); }

.ix-clear {
  padding: 6px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.ix-clear:hover { color: var(--color-rise); border-color: var(--color-rise); }

.ix-sort {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.ix-sort:hover { border-color: var(--border-hover); color: var(--text-primary); }
.ix-sort.on {
  background: var(--color-primary-glow);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ix-sort-arrow {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}
.ix-sort-arrow.asc { transform: rotate(180deg); }
.ix-sort-arrow.off { opacity: 0.35; }

.ix-tabs {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.ix-tabs::-webkit-scrollbar { display: none; }
.ix-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.ix-tab:hover { color: var(--text-secondary); border-color: var(--border-hover); }
.ix-tab.on {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary);
}
.ix-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--border-hover);
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ix-tab.on .ix-tab-badge {
  background: var(--color-on-primary);
  color: var(--color-primary);
}

.ix-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: calc(var(--nav-height) + var(--spacing-md));
}
.ix-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}

.ix-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}
@media (hover: hover) {
  .ix-card:hover { background: var(--bg-card-hover); border-color: var(--border-hover); }
}
.ix-card.on {
  border-color: var(--color-primary);
  background: var(--color-primary-glow);
}

.ix-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-xs);
}
.ix-card-name {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ix-card-check {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  border: 2px solid var(--border-hover);
  color: var(--color-on-primary);
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}
.ix-card-check.on { background: var(--color-primary); border-color: var(--color-primary); }

.ix-card-price {
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.ix-card-foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-xs);
}
.ix-card-code {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.ix-card-rate { font-size: var(--font-xs); font-weight: 600; font-variant-numeric: tabular-nums; }

.tone-rise { color: var(--color-rise); }
.tone-fall { color: var(--color-fall); }
.tone-flat { color: var(--text-muted); }

@media (min-width: 1024px) {
  .ix-body { padding-bottom: var(--spacing-md); }
}

@media (max-width: 767px) {
  .ix-page { padding: var(--spacing-sm); }
  .ix-grid { grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); }
}

@media (max-height: 900px) and (min-width: 768px) {
  .ix-card { padding: 6px var(--spacing-sm); }
  .ix-card-price { font-size: var(--font-md); }
}
</style>
