<template>
  <div class="hs">
    <div class="hs-modes">
      <button
        type="button"
        class="hs-mode"
        :class="{ on: mode === 'close' }"
        @click="mode = 'close'"
      >昨日收盘</button>
      <button
        type="button"
        class="hs-mode"
        :class="{ on: mode === 'realtime' }"
        @click="mode = 'realtime'"
      >实时</button>
    </div>
    <ul v-if="rows.length > 0" class="hx-list">
      <li v-for="(s, i) in rows" :key="s.stockCode" class="hx-item">
        <div class="hx-main is-static">
          <span class="hx-bar" :style="{ width: ratioBarWidth(s.ratio) }" aria-hidden="true"></span>
          <span class="hx-rank font-number">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="hx-ident">
            <span class="hx-name" :title="s.stockName || s.stockCode">{{ s.stockName || s.stockCode }}</span>
            <span class="hx-meta"><span class="hx-code font-number">{{ s.stockCode }}</span></span>
          </span>
          <span class="hx-ratio">
            <span class="hx-ratio-v font-number">{{ s.ratio > 0 ? s.ratio.toFixed(2) : '--' }}</span>
            <span v-if="s.ratio > 0" class="hx-ratio-u">%</span>
          </span>
          <span v-if="rateOf(s.stockCode) != null" :class="['hx-chg font-number', classOf(s.stockCode)]">
            {{ rateOf(s.stockCode)! > 0 ? '+' : '' }}{{ rateOf(s.stockCode)!.toFixed(2) }}%
          </span>
          <span v-else class="hx-chg font-number text-muted">--</span>
        </div>
      </li>
    </ul>
    <p v-else class="hs-empty">{{ loading ? '持仓数据加载中…' : '暂无持仓数据' }}</p>
    <p v-if="meta" class="hs-meta">{{ meta }}</p>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, toRef, onMounted } from 'vue'
import { useEstimatedHoldings } from '@/composables/use-estimated-holdings'
import { stockQuoteMode } from '@/composables/use-view-prefs'

const props = defineProps<{
  fundCode: string
  delayDays: number
}>()

const TOP_N = 10

const mode = stockQuoteMode

const {
  estimated, loading, loadEstimation,
  getPrevDayRate, prevDayClass,
  getRealtimeRate, realtimeClass,
} = useEstimatedHoldings(toRef(props, 'fundCode'), toRef(props, 'delayDays'))

onMounted(() => { void loadEstimation() })

const rows = computed(() => (estimated.value?.holdings ?? []).slice(0, TOP_N))

const meta = computed(() => estimated.value?.description ?? '')

const ratioMax = computed(() => rows.value.reduce((m, s) => Math.max(m, s.ratio ?? 0), 0))

function ratioBarWidth(ratio: number): string {
  const max = ratioMax.value
  if (!(ratio > 0) || max <= 0) return '0%'
  return `${Math.max((ratio / max) * 100, 4).toFixed(1)}%`
}

function rateOf(code: string): number | null {
  return mode.value === 'close' ? getPrevDayRate(code) : getRealtimeRate(code)
}
function classOf(code: string): string {
  return mode.value === 'close' ? prevDayClass(code) : realtimeClass(code)
}
</script>
<style scoped>
.hs { display: flex; flex-direction: column; gap: var(--spacing-sm); }

.hs-modes {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px;
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}
.hs-mode {
  padding: 3px 12px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.hs-mode.on { background: var(--bg-elevated); color: var(--text-primary); }

.hs-tip { margin: 0; font-size: 10px; color: var(--text-muted); }

.hx-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hx-item {
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.hx-main {
  position: relative;
  display: grid;
  grid-template-columns: 22px 1fr auto auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  text-align: left;
}
.hx-main.is-static { cursor: default; }

.hx-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--color-primary);
  opacity: 0.09;
  pointer-events: none;
  transition: width var(--transition-base);
}
.hx-main > :not(.hx-bar) { position: relative; z-index: 1; }

.hx-rank {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.hx-ident { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hx-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hx-meta { display: flex; align-items: center; gap: 5px; min-width: 0; }
.hx-code { font-size: 10px; color: var(--text-muted); }

.hx-ratio { display: flex; align-items: baseline; gap: 1px; justify-content: flex-end; }
.hx-ratio-v {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.hx-ratio-u { font-size: 9px; color: var(--text-muted); }

.hx-chg {
  min-width: 62px;
  text-align: right;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hs-empty,
.hs-meta {
  margin: 0;
  font-size: 10px;
  color: var(--text-muted);
}
.hs-empty { padding: var(--spacing-sm) 0; text-align: center; }
.hs-meta { padding-top: 4px; border-top: 1px solid var(--border-subtle); }
</style>
