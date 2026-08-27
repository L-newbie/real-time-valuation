<template>
  <div class="sector-full-page">
    <header class="sf-head">
      <div class="sf-bar">
        <div class="sf-filters">
        <button
          type="button"
          class="sf-toggle"
          :class="{ 'is-offboard': market === 'offboard' }"
          :title="`当前${currentMarket.label}，点击切换`"
          @click="toggleMarket"
        >
          <span class="sf-toggle-dot" aria-hidden="true" />
          <span class="sf-toggle-txt">{{ currentMarket.label }}</span>
        </button>
        <span class="sf-div" aria-hidden="true" />
        <div class="sf-seg sf-seg-wide" :data-active="basis">
          <span class="sf-seg-thumb" aria-hidden="true" />
          <button
            v-for="b in BASES"
            :key="b.key"
            type="button"
            class="sf-seg-btn"
            :class="{ on: basis === b.key }"
            @click="basis = b.key"
          >{{ b.label }}</button>
        </div>
        <button
          type="button"
          class="sf-dir"
          :class="dirClass"
          :title="dirTitle"
          @click="desc = !desc"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="desc"><path d="M12 5v14M5 12l7-7 7 7" /></template>
            <template v-else><path d="M12 19V5M5 12l7 7 7-7" /></template>
          </svg>
          <span class="sf-dir-label">{{ dirLabel }}</span>
        </button>
        </div>
        <div class="sf-actions">
        <RefreshControl
          toggle-key="sectorAutoRefresh"
          interval-key="sectorRefreshInterval"
          :options="[5, 10, 15, 30, 60, 120]"
        />
        <RingRefresh
          class="sf-refresh"
          :interval="settingsStore.sectorRefreshInterval"
          :countdown="countdown"
          :enabled="settingsStore.sectorAutoRefresh"
          :spinning="refreshing"
          @refresh="manualRefresh"
        />
        </div>
      </div>
    </header>
    <div v-if="errorTip" class="sf-error">
      <svg class="error-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ errorTip }}</span>
    </div>
    <div class="sector-body" ref="bodyRef" @scroll.passive="handleScroll">
      <div v-if="loading && rows.length === 0" class="rank-list">
        <div v-for="i in 10" :key="i" class="rank-row skel-row">
          <span class="rank-no skel-rank"></span>
          <div class="rank-info">
            <span class="skel-line skel-rank-name"></span>
            <span class="skel-line skel-rank-code"></span>
          </div>
          <div class="rank-metric skel-line skel-rank-metric"></div>
        </div>
      </div>
      <div v-else-if="rows.length === 0 && errorTip" class="empty-text">
        <p>加载失败</p>
        <p class="empty-sub">{{ errorTip }}</p>
      </div>
      <div v-else-if="rows.length === 0" class="empty-text">
        <p>暂无数据</p>
        <p class="empty-sub">{{ currentMarket.hint }}</p>
      </div>
      <template v-else>
        <div v-if="podium.length === 3" class="podium">
          <div
            v-for="p in podium"
            :key="p.item.code"
            class="podium-slot"
            :class="`slot-${p.place}`"
          >
            <span class="podium-medal" :class="`medal-${p.place}`">{{ p.place }}</span>
            <span class="podium-name" :title="p.item.name">{{ p.item.name }}</span>
            <span class="podium-code font-number">{{ p.item.code }}</span>
            <span class="podium-metric font-number" :class="metricValueClass(p.item)">
              {{ metricValueText(p.item) }}
            </span>
            <span class="podium-sub font-number" :class="subValueClass(p.item)">
              {{ subValueText(p.item) }}
            </span>
            <span class="podium-step" aria-hidden="true" />
          </div>
        </div>
        <div v-if="restRows.length > 0" class="rank-list">
          <div
            v-for="(item, idx) in restRows"
            :key="item.code"
            class="rank-row"
            :style="{ '--bar-w': barWidth(item) }"
          >
            <span class="rank-bar" :class="metricValueClass(item)" aria-hidden="true" />
            <span class="rank-no">{{ idx + 4 }}</span>
            <div class="rank-info">
              <span class="rank-name">{{ item.name }}</span>
              <span class="rank-code font-number">{{ item.code }}</span>
            </div>
            <div class="rank-metric font-number" :class="metricValueClass(item)">
              {{ metricValueText(item) }}
            </div>
            <span class="rank-rate font-number" :class="subValueClass(item)">
              {{ subValueText(item) }}
            </span>
          </div>
        </div>
      </template>
      <p v-if="rows.length > 0" class="sf-note">
        {{ currentMetric.label }} · 前 {{ rows.length }} 名
      </p>
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

defineOptions({ name: 'SectorFull' })

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { STORAGE_KEYS } from '@/config/constants'
import { getBeijingTodayStr } from '@/shared/utils/date-format'
import { resolveMarketTradingDays } from '@/shared/market/trading-day'
import { recordHit, recordMiss, recordWrite, recordKeys } from '@/shared/cache/hit-stats'
import { sectorCache } from '@/modules/stock/sector-cache'
import { jsonpWithMirrors } from '@/shared/net/em-mirrors'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { usePageAutoRefresh } from '@/composables/use-page-auto-refresh'
import RingRefresh from '@/components/shared/ring-refresh.vue'
import RefreshControl from '@/components/shared/refresh-control.vue'

const settingsStore = useSettingsStore()

type MarketKey = 'onboard' | 'offboard'

type MetricKey = 'gainers' | 'losers' | 'inflow' | 'outflow'

interface MetricDef {
  key: MetricKey
  label: string
  emoji: string
  fid: string
  po: string

  valueField: 'rate' | 'flow'
}
interface MarketDef { key: MarketKey; label: string; hint: string }

const MARKETS: MarketDef[] = [
  { key: 'onboard', label: '场内', hint: '场内 ETF 实时榜' },

  { key: 'offboard', label: '场外', hint: '' },
]
const ONBOARD_METRICS: MetricDef[] = [
  { key: 'gainers', label: '今日涨幅', emoji: '📈', fid: 'f3', po: '1', valueField: 'rate' },
  { key: 'losers', label: '今日跌幅', emoji: '📉', fid: 'f3', po: '0', valueField: 'rate' },
  { key: 'inflow', label: '资金流入', emoji: '💰', fid: 'f62', po: '1', valueField: 'flow' },
  { key: 'outflow', label: '资金流出', emoji: '💸', fid: 'f62', po: '0', valueField: 'flow' },
]

const market = ref<MarketKey>(loadMarket())

type BasisKey = 'rate' | 'flow'
const BASES: { key: BasisKey; label: string }[] = [
  { key: 'rate', label: '涨跌幅' },
  { key: 'flow', label: '资金流' },
]

const basis = ref<BasisKey>('rate')

const desc = ref(true)

const metric = computed<MetricKey>(() => {
  if (basis.value === 'rate') return desc.value ? 'gainers' : 'losers'
  return desc.value ? 'inflow' : 'outflow'
})

const dirLabel = computed(() => {
  if (basis.value === 'rate') return desc.value ? '涨幅' : '跌幅'
  return desc.value ? '流入' : '流出'
})
const dirTitle = computed(() => `当前按${dirLabel.value}排序，点击切换`)

const dirClass = computed(() => (desc.value ? 'is-up' : 'is-down'))

const currentMetric = computed<MetricDef>(() =>
  ONBOARD_METRICS.find(m => m.key === metric.value) ?? ONBOARD_METRICS[0])
const currentMarket = computed<MarketDef>(() =>
  MARKETS.find(m => m.key === market.value) ?? MARKETS[0])

function loadMarket(): MarketKey {
  const raw = localStorage.getItem(STORAGE_KEYS.SECTOR_MARKET)
  return raw === 'offboard' ? 'offboard' : 'onboard'
}

;(function restoreMetric(): void {
  const raw = localStorage.getItem(STORAGE_KEYS.SECTOR_METRIC)
  if (raw === 'losers') { basis.value = 'rate'; desc.value = false }
  else if (raw === 'inflow') { basis.value = 'flow'; desc.value = true }
  else if (raw === 'outflow') { basis.value = 'flow'; desc.value = false }
  else { basis.value = 'rate'; desc.value = true }
})()

function switchMarket(m: MarketKey): void {
  if (market.value === m) return
  market.value = m
  localStorage.setItem(STORAGE_KEYS.SECTOR_MARKET, m)
}

function toggleMarket(): void {
  switchMarket(market.value === 'onboard' ? 'offboard' : 'onboard')
}

watch(metric, (m) => {
  localStorage.setItem(STORAGE_KEYS.SECTOR_METRIC, m)
})

interface EtfRow {
  code: string
  name: string
  rate: number
  turnover: number
  inflow: number
}
interface ClistRaw {
  f3: number | null
  f6: number | null
  f12: string
  f14: string
  f62: number | null
}
interface ClistResp { data?: { diff?: ClistRaw[] } }

const rows = ref<EtfRow[]>([])

const podium = computed(() => {
  const top = rows.value.slice(0, 3)
  if (top.length < 3) return []
  return [
    { place: 2, item: top[1] },
    { place: 1, item: top[0] },
    { place: 3, item: top[2] },
  ]
})

const restRows = computed(() =>
  rows.value.length >= 3 ? rows.value.slice(3) : rows.value,
)

const loading = ref(false)
const refreshing = ref(false)
const showBackTop = ref(false)
const bodyRef = ref<HTMLElement | null>(null)

const errorTip = ref('')

let failStreak = 0

const PAGE_SIZE = 15

const FAIL_PAUSE = 3

let scrollTimer: number | null = null

interface FetchResult { ok: boolean; rows: EtfRow[] }
async function fetchOnboardRank(fid: string, po: string, page: number, pz: number): Promise<FetchResult> {
  const fs = 'b:MK0021,b:MK0022,b:MK0023,b:MK0024,b:MK0827'
  const ut = 'bd1d9ddb04089700cf9c27f6f7426281'
  try {
    const resp = await jsonpWithMirrors<ClistResp>(
      '/api/qt/clist/get',
      `pn=${page}&pz=${pz}&po=${po}&np=1&ut=${ut}&fltt=2&invt=2&fs=${fs}&fields=f2,f3,f6,f12,f14,f62&fid=${fid}`,
      'sector',
    )
    const diff = resp?.data?.diff

    if (!diff) return { ok: false, rows: [] }
    return {
      ok: true,
      rows: diff.map(d => ({
        code: d.f12 ?? '',
        name: d.f14 ?? d.f12 ?? '',
        rate: d.f3 ?? 0,
        turnover: d.f6 ?? 0,
        inflow: d.f62 ?? 0,
      })).filter(r => r.code),
    }
  } catch {
    return { ok: false, rows: [] }
  }
}

const SECTOR_TTL_OPEN = 30 * 1000


function sectorCacheKey(): string {
  return `${market.value}:${currentMetric.value.key}`
}

function loadSectorCache(): void {
  const hit = sectorCache.peek(sectorCacheKey())
  if (!hit?.rows?.length || hit.day !== getBeijingTodayStr()) return
  rows.value = hit.rows
}

function saveSectorCache(data: EtfRow[]): void {
  if (data.length === 0) return
  sectorCache.set(sectorCacheKey(), { rows: data, at: Date.now(), day: getBeijingTodayStr() })
}

function isSectorCacheFresh(): boolean {
  const hit = sectorCache.peek(sectorCacheKey())
  if (!hit || hit.day !== getBeijingTodayStr()) return false
  const td = resolveMarketTradingDays('A')
  if (td.isNonTradingDay || td.isClosed) return true
  return Date.now() - hit.at < SECTOR_TTL_OPEN
}

async function refreshRanks(): Promise<void> {
  if (market.value === 'offboard') {
    rows.value = []
    errorTip.value = ''
    failStreak = 0
    return
  }
  loadSectorCache()
  if (isSectorCacheFresh() && rows.value.length > 0) {
    recordHit('板块排行')
    recordKeys('板块排行', rows.value.length)
    loading.value = false
    return
  }
  recordMiss('板块排行')
  const def = currentMetric.value
  loading.value = true

  const { ok, rows: data } = await fetchOnboardRank(def.fid, def.po, 1, PAGE_SIZE)
  loading.value = false
  if (!ok) {
    failStreak++
    errorTip.value = rows.value.length > 0
      ? '刷新失败，展示旧数据（东财接口可能限流/封IP）'
      : '加载失败，东财接口可能限流或封IP，稍后重试'
    if (failStreak >= FAIL_PAUSE) {
      pause()
      errorTip.value = `连续 ${failStreak} 次刷新失败，已暂停自动刷新（东财接口限流/封IP）`
    }
    return
  }

  failStreak = 0
  errorTip.value = ''
  rows.value = data
  saveSectorCache(data)
  recordWrite('板块排行')
  recordKeys('板块排行', data.length)

  resume()
}

const { countdown, resetCountdown, pause, resume } = usePageAutoRefresh({
  enabled: () => settingsStore.sectorAutoRefresh,
  interval: () => settingsStore.sectorRefreshInterval,
  onTick: refreshRanks,
})

async function manualRefresh(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await refreshRanks()

    if (!errorTip.value) resetCountdown()
  } finally {
    refreshing.value = false
  }
}

function handleScroll(): void {
  if (scrollTimer) cancelAnimationFrame(scrollTimer)
  scrollTimer = requestAnimationFrame(() => {
    const el = bodyRef.value
    if (!el) return
    showBackTop.value = el.scrollTop > 400
  })
}
function scrollToTop(): void {
  bodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function rateClass(rate: number): string {
  return rate > 0 ? 'text-rise' : rate < 0 ? 'text-fall' : 'text-flat'
}
function rateText(rate: number): string {
  if (!Number.isFinite(rate)) return '--'
  return `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`
}
function amountClass(v: number): string {
  return v > 0 ? 'text-rise' : v < 0 ? 'text-fall' : 'text-flat'
}

function flowText(v: number): string {
  if (!Number.isFinite(v)) return '--'
  const sign = v > 0 ? '+' : ''
  const abs = Math.abs(v)
  if (abs >= 1e8) return `${sign}${(v / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${sign}${(v / 1e4).toFixed(2)}万`
  return `${sign}${v.toFixed(0)}`
}

function metricValueText(item: EtfRow): string {
  return currentMetric.value.valueField === 'rate' ? rateText(item.rate) : flowText(item.inflow)
}
function metricValueClass(item: EtfRow): string {
  return currentMetric.value.valueField === 'rate' ? rateClass(item.rate) : amountClass(item.inflow)
}

function subValueText(item: EtfRow): string {
  return currentMetric.value.valueField === 'rate' ? flowText(item.inflow) : rateText(item.rate)
}
function subValueClass(item: EtfRow): string {
  return currentMetric.value.valueField === 'rate' ? amountClass(item.inflow) : rateClass(item.rate)
}

const barMax = computed(() => {
  const field = currentMetric.value.valueField
  let max = 0
  for (const r of rows.value) {
    const v = Math.abs(field === 'rate' ? r.rate : r.inflow)
    if (v > max) max = v
  }
  return max
})

function barWidth(item: EtfRow): string {
  const max = barMax.value
  if (max <= 0) return '0%'
  const v = Math.abs(currentMetric.value.valueField === 'rate' ? item.rate : item.inflow)
  return `${Math.max(4, (v / max) * 100).toFixed(1)}%`
}

watch(market, () => { void refreshRanks() })
watch(metric, () => { void refreshRanks() })

onMounted(() => {
  void refreshRanks()
})
onBeforeUnmount(() => {
  if (scrollTimer) cancelAnimationFrame(scrollTimer)
})
</script>
<style scoped>
.sector-full-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: var(--spacing-md);
}

.sf-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  position: relative;
  z-index: 20;
}

.sf-filters {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sf-filters::-webkit-scrollbar { display: none; }

.sf-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding-left: var(--spacing-sm);
  margin-left: auto;
  border-left: 1px solid var(--border-subtle);
  position: relative;
  z-index: 30;
}

.sf-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 5px 6px 5px 5px;
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  min-width: 0;
}

.sf-div {
  width: 1px;
  height: 16px;
  flex-shrink: 0;
  background: var(--border-default);
}

.sf-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 5px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--transition-fast), color var(--transition-fast), background-color var(--transition-fast);
}
.sf-toggle:hover { border-color: var(--color-primary); }

.sf-toggle-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  flex-shrink: 0;
  transition: background-color var(--transition-fast);
}
.sf-toggle.is-offboard .sf-toggle-dot { background: var(--color-accent); }
.sf-toggle-txt { min-width: 24px; text-align: center; }

.sf-seg {
  position: relative;
  display: flex;
  flex-shrink: 0;
  padding: 2px;
  border-radius: var(--radius-full);
  background: var(--bg-input);
}
.sf-seg-thumb {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc(50% - 2px);
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-fast) var(--ease-out-expo);
}

.sf-seg[data-active='flow'] .sf-seg-thumb { transform: translateX(100%); }

.sf-seg-btn {
  position: relative;
  z-index: 1;
  min-width: 50px;
  padding: 5px 12px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-out-expo);
}
.sf-seg-btn:hover:not(.on) { color: var(--text-secondary); }
.sf-seg-btn.on { color: var(--text-primary); }
.sf-seg-wide .sf-seg-btn { min-width: 58px; }

.sf-dir {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 5px 12px 5px 10px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  font-family: inherit;
  font-size: var(--font-xs);
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast);
}
.sf-dir.is-up {
  background: var(--color-rise-glow);
  border-color: hsl(0 72% 58% / 0.35);
  color: var(--color-rise);
}
.sf-dir.is-down {
  background: var(--color-fall-glow);
  border-color: hsl(142 60% 45% / 0.35);
  color: var(--color-fall);
}
.sf-dir:hover { filter: brightness(1.15); }
.sf-dir-label { white-space: nowrap; }

.sf-refresh { margin-left: auto; flex-shrink: 0; }

.sf-note {
  margin: 0;
  padding: var(--spacing-sm) 0 0;
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
  padding-top: var(--spacing-md);
}
.podium-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
  padding: 0 4px;
  text-align: center;

  animation: podiumIn var(--duration-normal) var(--ease-out-expo) backwards;
}
.slot-1 { animation-delay: 0ms; }
.slot-2 { animation-delay: 70ms; }
.slot-3 { animation-delay: 140ms; }
@keyframes podiumIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

.podium-medal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 800;
  color: var(--bg-base);
  font-variant-numeric: tabular-nums;
}

.medal-1 {
  background: linear-gradient(145deg, hsl(45 85% 60%), hsl(38 80% 48%));
  box-shadow: 0 0 18px hsl(45 85% 55% / 0.45);
}
.medal-2 { background: linear-gradient(145deg, hsl(210 12% 76%), hsl(210 10% 58%)); }
.medal-3 { background: linear-gradient(145deg, hsl(25 55% 58%), hsl(22 50% 43%)); }

.slot-1 .podium-medal { width: 32px; height: 32px; font-size: 14px; }

.podium-name {
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.slot-1 .podium-name { font-size: var(--font-sm); }
.podium-code {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.podium-metric {
  font-size: var(--font-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.slot-1 .podium-metric { font-size: var(--font-md); }

.podium-sub {
  font-size: var(--font-xs);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

.podium-step {
  width: 100%;
  margin-top: 6px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: linear-gradient(180deg, var(--bg-elevated), var(--bg-surface));
  border: 1px solid var(--border-subtle);
  border-bottom: none;
}
.slot-1 .podium-step { height: 46px; background: linear-gradient(180deg, hsl(45 60% 50% / 0.18), var(--bg-surface)); }
.slot-2 .podium-step { height: 32px; }
.slot-3 .podium-step { height: 22px; }

.sf-error {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-md);

  background: var(--color-rise-glow);
  border: 1px solid var(--color-rise-glow);
  color: var(--color-rise);
  font-size: var(--font-xs);
  line-height: 1.4;
}
.error-icon { flex-shrink: 0; }

.sector-body {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  gap: var(--spacing-lg);
  box-sizing: border-box;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sector-body::-webkit-scrollbar { display: none; width: 0; }

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-shrink: 0;
}
.rank-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 10px var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
  transition: background var(--transition-fast), border-color var(--transition-fast),
              transform var(--transition-fast);
  flex-shrink: 0;
  min-height: 48px;
}
.rank-row:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  transform: translateX(2px);
}

.rank-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--bar-w, 0%);
  z-index: 0;
  pointer-events: none;
  transition: width var(--duration-normal) var(--ease-out-expo);
}
.rank-bar.text-rise { background: linear-gradient(90deg, rgba(239, 68, 68, 0.16), rgba(239, 68, 68, 0.02)); }
.rank-bar.text-fall { background: linear-gradient(90deg, rgba(34, 197, 94, 0.16), rgba(34, 197, 94, 0.02)); }
.rank-bar.text-flat { background: linear-gradient(90deg, rgba(138, 151, 160, 0.12), rgba(138, 151, 160, 0.02)); }

.rank-row > :not(.rank-bar) { position: relative; z-index: 1; }

.rank-no {
  flex-shrink: 0;
  width: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-sm);
  font-weight: 700;

  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.rank-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.rank-name {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.rank-code {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono, monospace);
}

.rank-metric {
  font-size: var(--font-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 72px;
  text-align: right;
}

.rank-rate {
  font-size: var(--font-xs);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 56px;
  text-align: right;
}

.loading-text,
.empty-text {
  font-size: var(--font-sm);
  color: var(--text-muted);
  text-align: center;
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.skel-row { pointer-events: none; }
.skel-line {
  display: block;
  border-radius: var(--radius-sm);
  background-image: linear-gradient(90deg, var(--bg-card) 0%, var(--bg-card-hover) 50%, var(--bg-card) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
.skel-rank { background: var(--bg-input); }
.skel-rank-name { width: 50%; height: 13px; }
.skel-rank-code { width: 32%; height: 11px; margin-top: 2px; }
.skel-rank-metric { min-height: 14px; background: var(--bg-surface); }
@media (prefers-reduced-motion: reduce) {
  .skel-line { animation: none; }
}

.empty-sub {
  font-size: var(--font-xs);
  color: var(--text-muted);
  opacity: 0.7;
  line-height: 1.5;
  padding: 0 var(--spacing-md);
}

.text-rise { color: var(--color-rise); }
.text-fall { color: var(--color-fall); }
.text-flat { color: var(--text-muted); }
.text-secondary { color: var(--text-secondary); }

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
  .back-to-top { bottom: 5px; }

  .sf-bar { gap: 6px; padding: 4px 5px; }
  .sf-seg-btn { min-width: 42px; padding: 5px 9px; }
  .sf-seg-wide .sf-seg-btn { min-width: 48px; }
  .sf-dir { padding: 5px 10px 5px 8px; }
  .slot-1 .podium-step { height: 38px; }
  .slot-2 .podium-step { height: 27px; }
  .slot-3 .podium-step { height: 18px; }
  .rank-row { min-height: 44px; padding: 9px var(--spacing-sm); gap: var(--spacing-sm); }
  .rank-metric { min-width: 62px; font-size: var(--font-sm); }
  .sector-body { gap: var(--spacing-md); }
}

@media (max-height: 760px) and (min-width: 768px) {
  .sf-head { gap: 6px; }
  .sf-bar { padding: 4px 5px; }
  .sector-body { gap: var(--spacing-md); }
  .rank-row { min-height: 42px; padding: 8px var(--spacing-md); }
  .podium { padding-top: var(--spacing-sm); }
  .slot-1 .podium-step { height: 34px; }
  .slot-2 .podium-step { height: 24px; }
  .slot-3 .podium-step { height: 16px; }
  .rank-row { min-height: 38px; padding: 5px var(--spacing-sm); }
}

</style>
