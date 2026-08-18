<template>
  <div class="gs-page">
    <header class="gs-header">
      <div class="gs-title-wrap">
        <h1 class="gs-title">资产汇总</h1>
        <span class="gs-sub">{{ groupStore.sortedGroups.length }} 个分组 · {{ totalFunds }} 只基金</span>
      </div>
    </header>
    <div class="gs-body">
      <DashboardStats :stats="allStats" />
      <div class="gs-cards">
        <article
          v-for="g in cards"
          :key="g.groupId"
          class="gs-card surface-card"
          :class="{ active: g.groupId === groupStore.activeGroupId, selected: g.groupId === selectedId }"
          role="button"
          tabindex="0"
          @click="onCardClick(g.groupId)"
          @keydown.enter.prevent="onCardClick(g.groupId)"
        >
          <header class="gs-card-head">
            <span class="gs-card-mark mark-chip" :style="markStyle(g.groupId)">
              {{ g.groupName.trim().charAt(0) }}
            </span>
            <div class="gs-card-ident">
              <span class="gs-card-name">{{ g.groupName }}</span>
              <span class="gs-card-count">{{ g.fundCount }} 只基金</span>
            </div>
            <span v-if="g.groupId === selectedId" class="gs-card-enter">再次点击进入</span>
            <span class="gs-card-arrow" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          </header>
          <div class="gs-card-main">
            <span class="gs-card-label">总资产</span>
            <span :class="['gs-card-amount font-number', !p.holding && 'privacy-blur']">
              ¥{{ formatCompactMoney(g.totalHoldingAmount) }}
            </span>
          </div>
          <div class="gs-card-grid">
            <div class="gs-cell">
              <span class="gs-cell-label">今日收益</span>
              <span :class="['gs-cell-value font-number', toneOf(g.todayProfit), !p.todayProfit && 'privacy-blur']">
                {{ formatProfitCompact(g.todayProfit) }}
              </span>
            </div>
            <div class="gs-cell">
              <span class="gs-cell-label">今日收益率</span>
              <span :class="['gs-cell-value font-number', toneOf(g.todayReturnRate), !p.todayRate && 'privacy-blur']">
                {{ g.todayReturnRate > 0 ? '+' : '' }}{{ g.todayReturnRate.toFixed(2) }}%
              </span>
            </div>
            <div class="gs-cell">
              <span class="gs-cell-label">累计收益</span>
              <span :class="['gs-cell-value font-number', toneOf(g.totalProfit), !p.totalProfit && 'privacy-blur']">
                {{ formatProfitCompact(g.totalProfit) }}
              </span>
            </div>
            <div class="gs-cell">
              <span class="gs-cell-label">累计收益率</span>
              <span :class="['gs-cell-value font-number', toneOf(g.overallChangeRate), !p.totalRate && 'privacy-blur']">
                {{ g.overallChangeRate > 0 ? '+' : '' }}{{ g.overallChangeRate.toFixed(2) }}%
              </span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import DashboardStats from '@/components/dashboard/dashboard-stats.vue'
import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { currentMinuteTick } from '@/composables/use-clock-tick'
import { formatCompactMoney, formatProfitCompact } from '@/shared/utils/money-format'
import type { GroupStats } from '@/modules/group/group-types'
import type { StatsValuation } from '@/modules/holding/holding-types'

const router = useRouter()
const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const groupStore = useGroupStore()
const settingsStore = useSettingsStore()

const p = computed(() => settingsStore.privacy)
const minuteTick = currentMinuteTick()

const valuationMap = computed(() => {
  void minuteTick.value
  const m = new Map<string, StatsValuation>()
  for (const [code, v] of fundStore.valuationMap) {
    m.set(code, {
      gz: v.gz, dwjz: v.dwjz, gszzl: v.gszzl, isEstimated: v.isEstimated, jzrq: v.jzrq, delayDays: v.delayDays,
      realtimeGszzl: settingsStore.enablePrediction ? v.realtimeGszzl : undefined,
      realtimeSource: settingsStore.enablePrediction ? v.realtimeSource : undefined,
      realtimeUpdatedAt: settingsStore.enablePrediction ? v.realtimeUpdatedAt : undefined,
    })
  }
  return m
})

const allStats = computed(() => holdingStore.getAllGroupsStats(valuationMap.value))

const totalFunds = computed(() => groupStore.allCodes().length)

const cards = computed<GroupStats[]>(() =>
  groupStore.sortedGroups.map(g => {
    const s = holdingStore.getDashboardStats(valuationMap.value, g.id)
    return {
      groupId: g.id,
      groupName: g.name,
      fundCount: groupStore.getMembers(g.id).length,
      totalHoldingAmount: s.totalHoldingAmount,
      todayProfit: s.todayProfit,
      totalProfit: s.totalProfit,
      totalCost: s.totalCost,
      overallChangeRate: s.overallChangeRate,
      todayReturnRate: s.todayReturnRate,
    }
  }),
)

function toneOf(v: number): string {
  return v > 0 ? 'text-rise' : v < 0 ? 'text-fall' : 'text-flat'
}

function markStyle(id: string): Record<string, string> {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  h = 190 + (h % 75)
  return { '--mark-h': String(h) }
}

const selectedId = ref('')

// 两段式：先点选中并切到该组（仪表盘随之更新），再点才跳进列表页。
// 避免误触直接离开汇总页。
function onCardClick(id: string): void {
  if (selectedId.value === id) {
    enterGroup(id)
    return
  }
  selectedId.value = id
  groupStore.setActiveGroup(id)
}

function enterGroup(id: string): void {
  groupStore.setActiveGroup(id)
  router.push('/')
}

onActivated(() => {
  selectedId.value = ''
})
</script>
<style scoped>
.gs-page {
  padding: var(--spacing-md);
  padding-bottom: calc(var(--nav-height) + var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  height: 100%;
  overflow: hidden;
}

@media (min-width: 1024px) {
  .gs-page { padding-bottom: var(--spacing-md); }
}

.gs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-xs);
  flex-shrink: 0;
}
.gs-title-wrap { display: flex; flex-direction: column; gap: 2px; }
.gs-title {
  font-size: var(--font-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}
.gs-sub { font-size: var(--font-xs); color: var(--text-muted); }

.gs-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.gs-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-sm);
}

@media (min-width: 768px) {
  .gs-cards { grid-template-columns: repeat(2, 1fr); }
}

.gs-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  cursor: pointer;
  transition: border-color var(--transition-fast), transform var(--transition-fast),
              box-shadow var(--transition-fast);
}
.gs-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-lg);
}
.gs-card:active { transform: scale(0.99); }
.gs-card.active { border-color: var(--color-primary); }
.gs-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary) inset, var(--shadow-lg);
}
.gs-card.selected .gs-card-arrow { color: var(--color-primary); }

.gs-card-enter {
  font-size: 10px;
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-primary-glow);
  white-space: nowrap;
  flex-shrink: 0;
}

.gs-card-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.gs-card-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: 700;
  flex-shrink: 0;
}
.gs-card-ident {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.gs-card-name {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gs-card-count { font-size: var(--font-xs); color: var(--text-muted); }
.gs-card-arrow { color: var(--text-muted); display: inline-flex; flex-shrink: 0; }

.gs-card-main {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
}
.gs-card-label { font-size: var(--font-xs); color: var(--text-muted); }
.gs-card-amount {
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.gs-card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xs) var(--spacing-sm);
}
.gs-cell { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-xs); }
.gs-cell-label { font-size: var(--font-xs); color: var(--text-muted); }
.gs-cell-value { font-size: var(--font-sm); font-weight: 600; }

@media (max-width: 767px) {
  .gs-page { padding: var(--spacing-sm); }
  .gs-header { padding: var(--spacing-sm) var(--spacing-md); }
}
</style>
