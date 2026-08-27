<template>
  <div class="home-page">
    <header class="header">
      <div class="header-left">
        <button class="logo-btn" title="回到介绍页" @click="goLanding">
          <span class="logo-icon">
            <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
              <ellipse cx="50" cy="60" rx="35" ry="30" fill="currentColor"/>
              <ellipse cx="50" cy="65" rx="22" ry="20" fill="currentColor" opacity="0.45"/>
              <circle cx="50" cy="32" r="18" fill="currentColor"/>
              <circle cx="44" cy="29" r="5" fill="var(--bg-base)"/>
              <circle cx="56" cy="29" r="5" fill="var(--bg-base)"/>
              <path d="M38 22 Q42 8 46 20 Q48 6 52 20 Q56 8 60 22" fill="currentColor"/>
              <ellipse cx="30" cy="58" rx="14" ry="10" fill="currentColor" opacity="0.7" transform="rotate(-15 30 58)"/>
            </svg>
          </span>
          <span class="logo">基攻宝</span>
        </button>
      </div>
      <div class="header-right">
        <SearchBar />
        <button
          class="btn-refresh"
          :class="{ spinning: refreshing }"
          :disabled="refreshing"
          :title="refreshing ? '刷新中' : settingsStore.autoRefresh ? `${countdown}s 后自动刷新，点击立即刷新` : '自动刷新已关闭，点击立即刷新'"
          @click="manualRefresh"
        >
          <svg class="refresh-ring" width="26" height="26" viewBox="0 0 26 26">
            <circle cx="13" cy="13" r="10" fill="none" stroke="var(--border-default)" stroke-width="2" />
            <circle
              v-if="ringGhost"
              class="ring-ghost"
              cx="13" cy="13" r="10"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="2"
              stroke-linecap="round"
              transform="rotate(-90 13 13)"
              stroke-dashoffset="0"
            />
            <circle
              class="ring-progress"
              :class="{ clearing: ringClearing }"
              cx="13" cy="13" r="10"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="2"
              stroke-linecap="round"
              transform="rotate(-90 13 13)"
              :stroke-dashoffset="ringOffset"
            />
          </svg>
          <svg class="refresh-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
        </button>
        <button class="btn-icon-sm" :title="`当前${settingsStore.theme === 'dark' ? '暗色' : '亮色'}，点击切换`" @click="settingsStore.toggleTheme()">
          <svg v-if="settingsStore.theme === 'light'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>
        <button class="btn-icon-sm btn-charity" title="公益 · 请作者喝杯奶茶" @pointerenter="warmCharityQr" @click="charityOpen = true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </button>
        <button class="btn-me" title="我的" @click="mineOpen = true">
          <img v-if="userAvatar" :src="userAvatar" alt="我的" class="btn-me-img" />
          <span v-else class="btn-me-initial" :style="{ background: user.color }">{{ user.initial }}</span>
        </button>
      </div>
    </header>
    <MinePanel v-model:visible="mineOpen" />
    <InfoSheet
      v-model:visible="charityOpen"
      title="请作者喝杯奶茶"
      lead="随心就好，感谢你的心意 ☕"
      :icon="HEART_ICON"
      :image="charityQr"
      :paragraphs="['长按或截图保存收款码，用微信 / 支付宝扫码。']"
      center-text
    />
    <IndexBar />
    <DashboardStats :stats="dashboardStats" />
    <div class="fund-list-scroll">
      <FundList
        :sorted-rows="sortedFundRows"
        :view-mode="viewMode"
        :sort-field="fundStore.sortField"
        :sort-direction="fundStore.sortDirection"
        @remove-fund="handleRemoveFund"
        @quick-remove-fund="handleQuickRemoveFund"
        @change-view-mode="handleViewModeChange"
        @change-sort="handleSortChange"
        @clear-holdings="handleClearHoldings"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onActivated, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import DashboardStats from '@/components/dashboard/dashboard-stats.vue'
import FundList from '@/components/fund-list/fund-list.vue'
import SearchBar from '@/components/search/search-bar.vue'
import IndexBar from '@/components/market/index-bar.vue'
import MinePanel from '@/views/mine.vue'
import InfoSheet from '@/components/shared/info-sheet.vue'

import { useFundData } from '@/composables/use-fund-data'
import { useAutoRefresh } from '@/composables/use-auto-refresh'
import { useCrossDay } from '@/composables/use-cross-day'
import { useClockTick } from '@/composables/use-clock-tick'
import { confirm } from '@/composables/use-confirm'
import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { useRandomNickname } from '@/composables/use-random-nickname'
import { loadString } from '@/shared/cache/local-storage-io'
import { STORAGE_KEYS } from '@/config/constants'
import { removeFundFromActiveGroup } from '@/modules/group/group-actions'
import type { ViewMode, SortField, SortDirection } from '@/modules/fund/fund-types'

const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const settingsStore = useSettingsStore()
const { user } = useRandomNickname()
const router = useRouter()

function goLanding(): void {
  void router.push('/landing')
}

const mineOpen = ref(false)

const charityOpen = ref(false)
const charityQr = `${import.meta.env.BASE_URL}charity-qr.webp`

function warmCharityQr(): void {
  const img = new Image()
  img.decoding = 'async'
  img.src = charityQr
}
const HEART_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>'

const userAvatar = ref(loadString(STORAGE_KEYS.USER_AVATAR) || '')
watch(mineOpen, (v) => {
  if (!v) userAvatar.value = loadString(STORAGE_KEYS.USER_AVATAR) || ''
})
const { sortedFundRows, dashboardStats, refreshData } = useFundData()
useAutoRefresh()
useCrossDay()

useClockTick()

const refreshing = ref(false)
const countdown = ref(settingsStore.refreshInterval)

let countdownTimer: ReturnType<typeof setInterval> | null = null

const RING_CIRCUMFERENCE = 62.83

const ringOffset = computed(() => {
  if (!settingsStore.autoRefresh) return RING_CIRCUMFERENCE
  const total = settingsStore.refreshInterval
  if (total <= 0) return RING_CIRCUMFERENCE
  const elapsed = total - countdown.value
  const ratio = Math.min(1, Math.max(0, elapsed / total))
  return RING_CIRCUMFERENCE * (1 - ratio)
})

const ringClearing = ref(false)
const ringGhost = ref(false)
let prevRingOffset = RING_CIRCUMFERENCE
let ringGhostTimer: ReturnType<typeof setTimeout> | null = null

watch(ringOffset, (next) => {
  if (next > prevRingOffset + 0.5) {
    ringClearing.value = true
    if (settingsStore.autoRefresh && prevRingOffset < RING_CIRCUMFERENCE * 0.12) {
      ringGhost.value = false
      requestAnimationFrame(() => { ringGhost.value = true })
      if (ringGhostTimer) clearTimeout(ringGhostTimer)
      ringGhostTimer = setTimeout(() => { ringGhost.value = false }, 620)
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { ringClearing.value = false })
    })
  }
  prevRingOffset = next
})

function startCountdown(): void {
  if (countdownTimer) return
  if (!settingsStore.autoRefresh) return
  countdown.value = settingsStore.refreshInterval
  countdownTimer = setInterval(() => {
    if (countdown.value <= 0) {
      countdown.value = settingsStore.refreshInterval
      return
    }
    countdown.value--
  }, 1000)
}

function stopCountdown(): void {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

const MIN_SPIN_MS = 600

async function manualRefresh(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  const startedAt = Date.now()
  try {
    await refreshData()
    countdown.value = settingsStore.refreshInterval
  } finally {
    const rest = MIN_SPIN_MS - (Date.now() - startedAt)
    if (rest > 0) await new Promise(r => setTimeout(r, rest))
    refreshing.value = false
  }
}

watch(() => settingsStore.refreshInterval, () => {
  countdown.value = settingsStore.refreshInterval
})

watch(() => settingsStore.autoRefresh, (on) => {
  stopCountdown()
  if (on) startCountdown()
  else countdown.value = settingsStore.refreshInterval
})

onMounted(() => { startCountdown() })
onUnmounted(() => {
  stopCountdown()
  if (ringGhostTimer) clearTimeout(ringGhostTimer)
})

onActivated(() => {
  if (fundStore.fundCodes.length > 0 && fundStore.valuationMap.size === 0) refreshData()
  stopCountdown()
  startCountdown()
})

watch(() => fundStore.t2HintPending, (pending) => {
  if (pending) fundStore.t2HintPending = false
}, { immediate: true })

const viewMode = ref<ViewMode>(fundStore.viewMode)

async function handleQuickRemoveFund(fundCode: string): Promise<void> {
  const ok = await confirm({
    title: '删除确认',
    desc: '确认从当前分组删除该基金？该分组下的持仓数据将一并清除。',
    confirmText: '确认删除',
    cancelText: '取消',
  })
  if (!ok) return
  removeFundFromActiveGroup(fundCode)
  ElMessage.success('已删除')
}

async function handleRemoveFund(fundCode: string): Promise<void> {
  const ok = await confirm({
    title: '移除确认',
    desc: '确认从当前分组移除该基金？该分组下的持仓数据将一并清除。',
    confirmText: '确认移除',
    cancelText: '取消',
  })
  if (!ok) return
  removeFundFromActiveGroup(fundCode)
  ElMessage.success('已移除')
}

async function handleClearHoldings(code: string): Promise<void> {
  const ok = await confirm({
    title: '清空持仓',
    desc: '确认清空该基金的持仓数据？清空后持仓金额和收益将归零。',
    confirmText: '确认清空',
    cancelText: '取消',
  })
  if (!ok) return
  holdingStore.settleAllByFund(code)
  ElMessage.success('已清空持仓')
}

function handleViewModeChange(mode: ViewMode): void {
  viewMode.value = mode

  fundStore.viewMode = mode
}

function handleSortChange(field: SortField, dir: SortDirection): void {
  fundStore.setSort(field, dir)
}
</script>
<style scoped>
.home-page {
  padding: var(--spacing-md);

  padding-bottom: calc(var(--nav-height) + var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  height: 100%;
  overflow: hidden;
}

@media (min-width: 1024px) {
  .home-page {
    padding-bottom: var(--spacing-md);
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: var(--spacing-sm) var(--spacing-xs);
  flex-shrink: 0;
}
.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.logo-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.logo-btn:hover { opacity: 0.75; }
.logo-btn:active { transform: scale(0.98); }

.logo-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;

  color: var(--color-primary);
}
.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.btn-refresh {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--transition-fast);
}
.btn-refresh:hover { color: var(--text-primary); }
.btn-refresh:disabled { cursor: not-allowed; }

.refresh-ring {
  position: absolute;
  inset: 2px;

  transform-origin: 50% 50%;
}

.ring-progress {
  stroke-dasharray: 62.83;
  transition: stroke-dashoffset 1s linear;
}
.ring-progress.clearing { transition: none; }

.ring-ghost {
  stroke-dasharray: 62.83;
  pointer-events: none;
  animation: ringGhostOut 620ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) forwards;
}
@keyframes ringGhostOut {
  from { opacity: 0.85; }
  to { opacity: 0; }
}

.refresh-icon { position: relative; z-index: 1; }

.btn-refresh.spinning .refresh-ring { animation: spin 0.9s linear infinite; }
.btn-refresh.spinning .refresh-icon { animation: spin 0.9s linear infinite; transform-origin: 50% 50%; }
.btn-refresh.spinning .ring-progress { transition: none; opacity: 0.55; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.btn-icon-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.btn-icon-sm:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--color-primary);
}

.btn-charity:hover {
  background: var(--color-rise-glow);
  border-color: var(--color-rise);
  color: var(--color-rise);
}

.btn-me {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: transparent;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}
.btn-me:hover { border-color: var(--color-primary); }
.btn-me:active { transform: scale(0.94); }
.btn-me-img { width: 100%; height: 100%; object-fit: cover; }
.btn-me-initial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: var(--font-xs);
  font-weight: 700;
  color: #fff;
}

.logo {
  font-size: var(--font-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1;

  color: var(--text-primary);
}
.logo-sub { font-size: var(--font-sm); color: var(--text-muted); }

.fund-list-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.home-page > :not(.fund-list-scroll) { flex-shrink: 0; }

@media (max-width: 767px) {
  .home-page {
    padding: var(--spacing-sm);
    padding-bottom: calc(var(--nav-height) + var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  }
  .header { padding: var(--spacing-sm) var(--spacing-md); }
  .logo { font-size: var(--font-xl); }
  .logo-sub { display: none; }
}
</style>
