<template>
  <div class="hub-page" :class="{ 'is-expanded': expanded, 'is-animating': animating }">
    <div class="hub-spacer" aria-hidden="true" />
    <EntryFan
      v-model="fanKey"
      :items="ENTRIES"
      :expanded="expanded"
      @activate="onActivate"
    />
    <div class="hub-spacer hub-spacer-bottom" aria-hidden="true" />
    <div class="hub-body" :aria-hidden="!expanded">
      <StockFull v-if="mounted.stocks" class="panel" :class="{ active: expanded && activeTab === 'stocks' }" />
      <NewsFull v-if="mounted.news" class="panel" :class="{ active: expanded && activeTab === 'news' }" />
      <SectorFull v-if="mounted.sector" class="panel" :class="{ active: expanded && activeTab === 'sector' }" />
      <GameList v-if="mounted.game" class="panel" :class="{ active: expanded && activeTab === 'game' }" />
      <ResourcePanel v-if="mounted.resource" class="panel" :class="{ active: expanded && activeTab === 'resource' }" />
    </div>
  </div>
</template>
<script setup lang="ts">
defineOptions({ name: 'StockNewsHub' })

import { ref, reactive, watch, onUnmounted } from 'vue'
import { STORAGE_KEYS } from '@/config/constants'
import StockFull from '@/views/stock-full.vue'
import NewsFull from '@/views/news-full.vue'
import SectorFull from '@/views/sector-full.vue'
import GameList from '@/views/game-list.vue'
import ResourcePanel from '@/views/resource-panel.vue'
import EntryFan from '@/components/market/entry-fan.vue'
import type { EntryFanItem } from '@/components/market/entry-fan.vue'

type TabKey = 'stocks' | 'news' | 'sector' | 'game' | 'resource'

const ICON = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'

const ENTRIES: EntryFanItem[] = [
  {
    key: 'stocks',
    name: '股票',
    hue: 205,
    icon: `<svg ${ICON}><path d="M3 16.5 8.5 11l3.5 3.5L21 6"/><path d="M21 6v5h-5"/></svg>`,
  },
  {
    key: 'news',
    name: '简讯',
    hue: 265,
    icon: `<svg ${ICON}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h6"/></svg>`,
  },
  {
    key: 'sector',
    name: '基金排行',
    hue: 160,
    icon: `<svg ${ICON}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
  },
  {
    key: 'game',
    name: '游戏',
    hue: 35,
    icon: `<svg ${ICON}><path d="M6 11h4M8 9v4"/><circle cx="15" cy="11" r="1"/><circle cx="18" cy="14" r="1"/><path d="M17.5 5H6.5A4.5 4.5 0 0 0 2 9.5v5A4.5 4.5 0 0 0 6.5 19h11a4.5 4.5 0 0 0 4.5-4.5v-5A4.5 4.5 0 0 0 17.5 5Z"/></svg>`,
  },
  {
    key: 'resource',
    name: '资源',
    hue: 15,
    icon: `<svg ${ICON}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>`,
  },
]

const fanKey = ref<TabKey>(loadActiveTab())

const expanded = ref(false)

const activeTab = ref<TabKey>(loadActiveTab())

const animating = ref(false)
let animateTimer: ReturnType<typeof setTimeout> | null = null

const EXPAND_ANIM_MS = 620

function markAnimating(): void {
  animating.value = true
  if (animateTimer) clearTimeout(animateTimer)
  animateTimer = setTimeout(() => { animating.value = false }, EXPAND_ANIM_MS)
}

watch(expanded, markAnimating)

onUnmounted(() => {
  if (animateTimer) clearTimeout(animateTimer)
})

watch(fanKey, (k) => {
  if (!expanded.value) return
  mounted[k] = true
  activeTab.value = k
  saveActiveTab()
})

function onActivate(key: string): void {
  const k = key as TabKey
  if (expanded.value && activeTab.value === k) {
    expanded.value = false
    return
  }
  mounted[k] = true
  activeTab.value = k
  expanded.value = true
  saveActiveTab()
}

function loadActiveTab(): TabKey {
  const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)
  if (raw === 'news' || raw === 'sector' || raw === 'game' || raw === 'resource') return raw
  return 'stocks'
}
function saveActiveTab(): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab.value)
}

const mounted = reactive<Record<TabKey, boolean>>({
  stocks: false, news: false, sector: false, game: false, resource: false,
})
</script>
<style scoped>
.hub-page {
  padding: var(--spacing-md);

  padding-bottom: calc(var(--nav-height) + var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;

  height: 100%;
  overflow: hidden;

  gap: var(--spacing-xs);
}

.hub-spacer {
  flex: 1 1 auto;
  min-height: 0;
  transition: flex-grow var(--duration-slow) var(--ease-out-expo);
}

.hub-spacer-bottom { flex-grow: 1.25; }
.is-expanded .hub-spacer { flex-grow: 0; }

@media (min-width: 1024px) {
  .hub-page { padding-bottom: var(--spacing-md); }
}

.hub-body {
  flex: 0 1 0;
  min-height: 0;
  position: relative;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  contain: layout paint;
  transition: flex-grow var(--duration-slow) var(--ease-out-expo),
              opacity var(--duration-fast) var(--ease-out-expo);
}
.is-expanded .hub-body {
  flex-grow: 1;
  opacity: 1;
  overflow: visible;
  pointer-events: auto;
}

/* flex-grow 是布局属性，展开的 560ms 里每帧都要把面板内容整个重排一遍，
   而面板动辄上百个节点还叠着毛玻璃。动画期间摘掉模糊，落定后恢复 ——
   展开过程本来也看不清这层质感。 */
.hub-page.is-animating .hub-body :deep(.glass-card) {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.32s ease;
}
.panel.active {
  opacity: 1;
  pointer-events: auto;
}

</style>
