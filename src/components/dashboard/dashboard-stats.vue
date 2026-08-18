<template>
  <section
    class="asset-hero surface-card"
    :class="{ 'is-collapsed': collapsed }"
    role="button"
    tabindex="0"
    :aria-expanded="!collapsed"
    :title="collapsed ? '展开明细' : '收起明细'"
    @click="toggleCollapse"
    @keydown.enter.prevent="toggleCollapse"
    @keydown.space.prevent="toggleCollapse"
  >
    <div class="hero-main">
      <span class="hero-label">总资产</span>
      <div :class="['hero-amount font-display', !p.holding && 'privacy-blur']">
        <NumberTransition :value="stats.totalHoldingAmount" type="compactMoney" />
      </div>
      <div class="hero-today">
        <span :class="['today-amount font-number', todayFmt.cssClass, !p.todayProfit && 'privacy-blur']">
          <NumberTransition :value="stats.todayProfit" type="compactProfit" />
        </span>
        <span :class="[pillClass(stats.todayReturnRate), !p.todayRate && 'privacy-blur']">
          <NumberTransition :value="stats.todayReturnRate" type="rate" />
        </span>
        <span class="today-tag">今日</span>
      </div>
      <div v-if="stats.predictedProfit != null" class="hero-today hero-predicted">
        <span :class="['today-amount font-number', predictedFmt.cssClass, !p.todayProfit && 'privacy-blur']">
          <NumberTransition :value="stats.predictedProfit" type="compactProfit" />
        </span>
        <span :class="[pillClass(stats.predictedReturnRate ?? 0), !p.todayRate && 'privacy-blur']">
          <NumberTransition :value="stats.predictedReturnRate ?? 0" type="rate" />
        </span>
        <button
          type="button"
          class="today-tag predicted-tag"
          title="预测收益说明"
          aria-label="预测收益说明"
          @click.stop="predictedInfoOpen = true"
        >
          预测
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" /><line x1="12" y1="17" x2="12" y2="17" />
          </svg>
        </button>
      </div>
      <span class="hero-toggle" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline :points="collapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15'" />
        </svg>
      </span>
    </div>
    <div class="hero-detail-wrap" :class="{ open: !collapsed }">
    <div class="hero-detail">
      <div class="detail-cell">
        <span class="detail-label">累计收益</span>
        <span :class="['detail-value font-number', totalFmt.cssClass, !p.totalProfit && 'privacy-blur']">
          <NumberTransition :value="stats.totalProfit" type="compactProfit" />
        </span>
      </div>
      <div class="detail-cell">
        <span class="detail-label">累计收益率</span>
        <span :class="['detail-value font-number', rateFmt.cssClass, !p.totalRate && 'privacy-blur']">
          <NumberTransition :value="stats.overallChangeRate" type="rate" />
        </span>
      </div>
      <div class="detail-cell">
        <span class="detail-label">投入本金</span>
        <span :class="['detail-value font-number', !p.holding && 'privacy-blur']">
          <NumberTransition :value="stats.totalCost" type="compactMoney" />
        </span>
      </div>
    </div>
    </div>
  </section>
  <InfoSheet
    v-model:visible="predictedInfoOpen"
    title="预测收益"
    lead="用持仓股的实时行情，抢先估算今天的收益"
    :rows="predictedInfoRows"
    :paragraphs="PREDICTED_INFO_PARAS"
  />
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import NumberTransition from '@/components/shared/number-transition.vue'
import InfoSheet from '@/components/shared/info-sheet.vue'
import { formatProfitWithColor, formatRateWithColor } from '@/shared/utils/money-format'
import { useSettingsStore } from '@/modules/settings/settings-store'
import type { DashboardStats } from '@/modules/holding/holding-types'

const COLLAPSED_KEY = 'dashboard_stats_collapsed'

const props = defineProps<{
  stats: DashboardStats
}>()

const collapsed = ref(localStorage.getItem(COLLAPSED_KEY) === '1')

const settingsStore = useSettingsStore()
const p = computed(() => settingsStore.privacy)

function toggleCollapse(): void {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSED_KEY, collapsed.value ? '1' : '0')
}

const predictedInfoOpen = ref(false)

const PREDICTED_INFO_PARAS = [
  '算法：把每只基金昨日的持仓金额，乘上该基金持仓股今天的实时涨跌幅，逐只相加得到预测收益；再除以这些基金的持仓金额合计，得到预测涨跌幅。',
  '与「今日」的区别：「今日」用的是基金公司发布的官方估值，通常有延迟；「预测」用的是持仓股的实时行情，更快，但只是推算。',
  '只统计 T+2 且已取到实时行情的基金。T+1 基金、无持仓记录的基金、行情尚未取到的基金都不计入，因此它的持仓金额基数小于总资产。',
  '误差来源：持仓数据来自最近一期季报，与基金实际持仓存在偏差；未取到行情的个股不参与加权，会让结果偏保守。仅供参考，请以基金公司公布的净值为准。',
]

const predictedInfoRows = computed(() => [
  { label: '纳入基金', value: `${props.stats.predictedFundCount} 只`, numeric: false },
  { label: '预测收益', value: formatProfit(props.stats.predictedProfit), tone: predictedFmt.value.cssClass },
  { label: '预测涨跌幅', value: formatRate(props.stats.predictedReturnRate), tone: predictedFmt.value.cssClass },
  { label: '官方估值收益', value: formatProfit(props.stats.todayProfit), tone: todayFmt.value.cssClass },
])

function formatProfit(v: number | null): string {
  if (v == null) return '--'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

function formatRate(v: number | null): string {
  if (v == null) return '--'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

const todayFmt = computed(() => formatProfitWithColor(props.stats.todayProfit))
const predictedFmt = computed(() => formatProfitWithColor(props.stats.predictedProfit ?? 0))
const totalFmt = computed(() => formatProfitWithColor(props.stats.totalProfit))
const rateFmt = computed(() => formatRateWithColor(props.stats.overallChangeRate))

function pillClass(v: number): string {
  if (v > 0) return 'pill-rise'
  if (v < 0) return 'pill-fall'
  return 'pill-flat'
}
</script>
<style scoped>
.asset-hero {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  transition: padding var(--duration-fast) var(--ease-out-expo);
  padding: var(--spacing-lg);
  flex-shrink: 0;

  cursor: pointer;
  user-select: none;
}
.asset-hero:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.asset-hero.is-collapsed {
  padding: var(--spacing-md) var(--spacing-lg);
}

.hero-main {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.hero-main > .hero-toggle {
  position: absolute;
  top: 0;
  right: 0;
}

.hero-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
  letter-spacing: 0.06em;
  font-weight: 500;
}

.hero-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.asset-hero:hover .hero-toggle {
  color: var(--text-primary);
  background: var(--border-subtle);
}

.hero-amount {
  color: var(--text-primary);
  transition: font-size var(--duration-fast) var(--ease-out-expo);
}
.is-collapsed .hero-amount {
  font-size: var(--font-2xl);
}

.hero-today {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.today-amount {
  font-size: var(--font-md);
  font-weight: 600;
}
.today-tag {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.hero-predicted {
  margin-top: calc(var(--spacing-xs) * -1);
}
.hero-predicted .today-amount {
  font-size: var(--font-sm);
  opacity: 0.88;
}

.predicted-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  margin: -2px -4px;
  border: 0;
  background: transparent;
  font-family: inherit;
  line-height: 1;
  cursor: pointer;
  border-radius: var(--radius-sm, 4px);
  -webkit-tap-highlight-color: transparent;
}
.predicted-tag svg { opacity: 0.6; flex-shrink: 0; }
.predicted-tag:hover { color: var(--text-primary); }
.predicted-tag:hover svg { opacity: 1; }
.predicted-tag:focus-visible {
  outline: 2px solid var(--color-primary, currentColor);
  outline-offset: 1px;
}

@media (hover: none) {
  .predicted-tag { padding: 6px 8px; margin: -6px -8px; }
}
.hero-detail-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-fast) var(--ease-out-expo);
}
.hero-detail-wrap.open {
  grid-template-rows: 1fr;
  border-top: 1px solid var(--border-subtle);
}
.hero-detail-wrap > .hero-detail {
  overflow: hidden;
  min-height: 0;
}

.hero-detail {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
  padding-top: var(--spacing-md);
}
.detail-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.detail-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
  white-space: nowrap;
}
.detail-value {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

@media (max-width: 767px) {
  .asset-hero { padding: var(--spacing-md); gap: var(--spacing-sm); }
  .hero-detail { gap: var(--spacing-sm); padding-top: var(--spacing-sm); }
  .detail-value { font-size: var(--font-sm); }
  .hero-predicted { margin-top: 0; }
  .hero-predicted .today-amount { font-size: var(--font-sm); }
}

@media (max-height: 900px) and (min-width: 768px) {
  .asset-hero { padding: var(--spacing-md) var(--spacing-lg); gap: 6px; }
  .hero-amount { font-size: var(--font-3xl); }
  .hero-detail {
    padding-top: var(--spacing-sm);
    gap: var(--spacing-sm);
  }
  .detail-label { font-size: 11px; }
  .detail-value { font-size: var(--font-sm); }
  .hero-today { gap: 6px; }
  .today-amount { font-size: var(--font-sm); }
  .hero-predicted { margin-top: 0; }
  .hero-predicted .today-amount { font-size: var(--font-xs); }
}

@media (max-height: 760px) and (min-width: 768px) {
  .asset-hero { padding: var(--spacing-sm) var(--spacing-lg); }
  .hero-amount { font-size: var(--font-2xl); }
  .hero-label { font-size: 11px; }
  .hero-detail { padding-top: 6px; }
  .detail-cell { flex-direction: row; align-items: baseline; gap: 5px; }
  .detail-label { font-size: 10px; }
}

@media (max-height: 900px) and (min-width: 768px) {
  .asset-hero.is-collapsed {
    padding: 6px var(--spacing-lg);
    gap: 0;
  }
  .asset-hero.is-collapsed .hero-main {
    flex-direction: row;

    align-items: center;
    gap: var(--spacing-sm);
  }

  .asset-hero.is-collapsed .hero-main > * { align-self: center; }

  .asset-hero.is-collapsed .hero-main > .hero-toggle {
    position: static;
    margin-left: auto;
    width: 20px;
    height: 20px;
  }
  .asset-hero.is-collapsed .hero-amount { font-size: var(--font-xl); }
  .asset-hero.is-collapsed .hero-today { gap: 6px; }
  .asset-hero.is-collapsed .today-tag { display: none; }

  .asset-hero.is-collapsed .hero-predicted { margin-top: 0; }
  .asset-hero.is-collapsed .hero-predicted .predicted-tag {
    display: inline-flex;
    padding: 4px;
    margin: -4px;
  }
  .asset-hero.is-collapsed .hero-predicted .predicted-tag svg { display: none; }
}
</style>
