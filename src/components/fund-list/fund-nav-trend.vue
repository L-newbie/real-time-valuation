<template>
  <div class="nav-trend">
    <div class="trend-ranges">
      <button
        v-for="r in RANGES"
        :key="r.key"
        type="button"
        :class="['trend-range-btn', { 'is-active': activeRange === r.key }]"
        :disabled="!rangeAvailable(r.days)"
        @click.stop="activeRange = r.key"
      >{{ r.label }}</button>
    </div>
    <div
      ref="scrubContainer"
      class="trend-box"
      @touchstart.capture.passive="scrub.onTouchStart"
      @touchmove.capture="scrub.onTouchMove"
      @touchend.capture="scrub.onTouchEnd"
      @touchcancel.capture="scrub.onTouchEnd"
      @mousedown.stop="onMouseDown"
    >
      <div v-if="activeReadout" class="scrub-readout">
        <span class="scrub-label">{{ activeReadout.label }}</span>
        <span class="scrub-nav font-number">{{ activeReadout.nav.toFixed(4) }}</span>
        <span :class="['scrub-change font-number', activeReadout.cls]">{{ activeReadout.change }}</span>
      </div>
      <svg
        v-if="axis && view.length >= 2"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none" class="trend-svg"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="fillTop" />
            <stop offset="100%" :stop-color="fillBottom" />
          </linearGradient>
        </defs>
        <line
          :x1="0" :y1="baseLineY" :x2="WIDTH" :y2="baseLineY"
          stroke="var(--border-default)" stroke-width="1" stroke-dasharray="4 3"
        />
        <polygon :points="areaPoints" :fill="`url(#${gradientId})`" />
        <polyline
          :points="linePoints" fill="none" :stroke="strokeColor"
          stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"
        />
        <circle
          v-if="activeDotY !== null"
          :cx="activeDotX" :cy="activeDotY" r="3"
          :fill="strokeColor" stroke="var(--bg-card)" stroke-width="1.5"
        />
      </svg>
      <div v-else class="trend-empty-box">
        <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none" class="trend-svg">
          <line
            :x1="0" :y1="HEIGHT / 2" :x2="WIDTH" :y2="HEIGHT / 2"
            stroke="var(--border-default)" stroke-width="1" stroke-dasharray="4 3"
          />
        </svg>
        <span class="trend-empty-text">{{ points.length ? '该区间数据不足' : '净值走势加载中' }}</span>
      </div>
      <div v-if="markDots.length > 0" class="trend-marks" aria-hidden="true">
        <span
          v-for="(m, i) in markDots"
          :key="i"
          :class="['trend-mark', m.tone, !m.exact && 'is-approx']"
          :style="{ left: (m.x / WIDTH * 100) + '%', top: (m.y / HEIGHT * 100) + '%' }"
        >{{ m.label }}</span>
      </div>
      <div v-if="activeMarkNotes.length > 0" class="trend-trades">
        <span v-for="(note, i) in activeMarkNotes" :key="i" class="trend-trade">{{ note }}</span>
      </div>
      <div v-if="activeReadout" class="scrub-line" :style="{ left: scrubLineLeft + 'px' }"></div>
    </div>
    <div v-if="axis && view.length >= 2" class="trend-axis">
      <span class="trend-date">{{ view[0].d }}</span>
      <span class="trend-hint">长按或双击查看</span>
      <span class="trend-date">{{ view[view.length - 1].d }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">

import { computed, ref, shallowRef, watch } from 'vue'
import type { NavPoint } from '@/modules/fund/perf/perf-intervals'
import { cardNavRange, type CardRangeKey } from '@/composables/use-view-prefs'
import { useChartScrub } from '@/composables/use-chart-scrub'
import { anchorMarks, describeMarks, type TradeMark } from '@/modules/holding/trade-marks'

const props = withDefaults(defineProps<{
  points?: NavPoint[]

  changeRate?: number

  marks?: TradeMark[]
}>(), {
  points: () => [],
  changeRate: 0,
  marks: () => [],
})

const WIDTH = 300
const HEIGHT = 96
const PAD_Y = 8

const _uid = Math.random().toString(36).substring(2, 8)
const gradientId = `navtrend-grad-${_uid}`

const RANGES: { key: CardRangeKey; label: string; days: number }[] = [
  { key: 'w',  label: '近1周', days: 7 },
  { key: 'm1', label: '近1月', days: 30 },
  { key: 'm3', label: '近3月', days: 90 },
  { key: 'm6', label: '近6月', days: 180 },
  { key: 'y1', label: '近1年', days: 365 },
]
const activeRange = cardNavRange

const clean = computed<NavPoint[]>(() =>
  (props.points ?? []).filter(p => p && Number.isFinite(p.v) && p.v > 0),
)

function sliceByDays(days: number): NavPoint[] {
  const list = clean.value
  if (list.length === 0) return []
  const lastMs = Date.parse(list[list.length - 1].d)
  if (!Number.isFinite(lastMs)) return list
  const cutoff = lastMs - days * 86400000
  return list.filter(p => {
    const t = Date.parse(p.d)
    return Number.isFinite(t) && t >= cutoff
  })
}

function rangeAvailable(days: number): boolean {
  return sliceByDays(days).length >= 2
}

const view = computed<NavPoint[]>(() => {
  const r = RANGES.find(x => x.key === activeRange.value)
  return r ? sliceByDays(r.days) : clean.value
})

watch([view, activeRange], () => scrub.reset())

const rangeChange = computed(() => {
  const v = view.value
  if (v.length < 2 || v[0].v <= 0) return props.changeRate
  return (v[v.length - 1].v - v[0].v) / v[0].v * 100
})

const strokeColor = 'var(--text-primary)'

const fillTop = computed(() => {
  if (rangeChange.value > 0) return 'rgba(239, 68, 68, 0.20)'
  if (rangeChange.value < 0) return 'rgba(34, 197, 94, 0.20)'
  return 'rgba(138, 151, 160, 0.14)'
})
const fillBottom = computed(() => {
  if (rangeChange.value > 0) return 'rgba(239, 68, 68, 0.00)'
  if (rangeChange.value < 0) return 'rgba(34, 197, 94, 0.00)'
  return 'rgba(138, 151, 160, 0.00)'
})

const axis = computed(() => {
  const list = view.value
  if (list.length < 2) return null
  const values = list.map(p => p.v)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    const pad = min * 0.005 || 0.001
    min -= pad
    max += pad
  }
  return { min, max, range: max - min || 1 }
})

function toX(i: number): number {
  const n = view.value.length
  return n < 2 ? 0 : (i / (n - 1)) * WIDTH
}
function toY(v: number): number {
  const a = axis.value!
  return PAD_Y + (HEIGHT - 2 * PAD_Y) - ((v - a.min) / a.range) * (HEIGHT - 2 * PAD_Y)
}

const linePoints = computed(() => {
  if (!axis.value || view.value.length < 2) return ''
  return view.value.map((p, i) => `${toX(i).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ')
})
const areaPoints = computed(() =>
  linePoints.value ? `0,${HEIGHT} ${linePoints.value} ${WIDTH},${HEIGHT}` : '',
)
const markDots = computed<{ x: number; y: number; label: string; tone: string; exact: boolean }[]>(() => {
  if (!axis.value || view.value.length < 2 || (props.marks ?? []).length === 0) return []
  const anchors = anchorMarks(view.value.map(p => p.d), props.marks ?? [], view.value.map(p => p.v))
  return anchors.map((a) => {
    const p = view.value[a.index]
    const kinds = new Set(a.marks.map(m => (m.side === 'buy' ? 'B' : m.side === 'settle' ? 'S' : 'T')))
    const primary = a.marks[a.marks.length - 1]?.side ?? 'buy'
    return {
      x: toX(a.index),
      y: toY(p.v),
      label: [...kinds].join('/'),
      tone: primary === 'buy' ? 'is-buy' : primary === 'settle' ? 'is-settle' : 'is-sell',
      exact: a.exact,
    }
  })
})

const anchorByIndex = computed(() => {
  const m = new Map<number, { marks: TradeMark[]; exact: boolean }>()
  if (!axis.value || view.value.length < 2 || (props.marks ?? []).length === 0) return m
  for (const a of anchorMarks(view.value.map(p => p.d), props.marks ?? [], view.value.map(p => p.v))) {
    m.set(a.index, { marks: a.marks, exact: a.exact })
  }
  return m
})

const activeMarkNotes = computed<string[]>(() => {
  const i = scrub.activeIndex.value ?? mouseIndex.value
  if (i == null) return []

  let hit = anchorByIndex.value.get(i)
  if (!hit) {
    const tol = Math.max(1, Math.round(view.value.length / 40))
    let best = Infinity
    for (const [idx, v] of anchorByIndex.value) {
      const d = Math.abs(idx - i)
      if (d <= tol && d < best) { best = d; hit = v }
    }
  }
  if (!hit) return []

  const notes = describeMarks(hit.marks)
  return hit.exact ? notes : notes.map(n => `${n}（净值未公布，标在最近交易日）`)
})

const baseLineY = computed(() => {
  if (!axis.value || view.value.length < 2) return HEIGHT / 2
  return toY(view.value[0].v)
})

const scrubContainer = shallowRef<HTMLElement | null>(null)
const scrub = useChartScrub({
  count: () => view.value.length,
})

watch(scrubContainer, el => { scrub.containerRef.value = el }, { immediate: true })

function onMouseDown(e: MouseEvent): void {
  if (view.value.length < 2) return
  const move = (ev: MouseEvent) => updateByClientX(ev.clientX)
  const up = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    mouseIndex.value = null
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
  updateByClientX(e.clientX)
}

const mouseIndex = ref<number | null>(null)
const mouseLeft = ref(0)
function updateByClientX(clientX: number): void {
  const el = scrubContainer.value
  const n = view.value.length
  if (!el || n < 2) return
  const rect = el.getBoundingClientRect()
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
  mouseIndex.value = Math.min(Math.max(Math.round((x / rect.width) * (n - 1)), 0), n - 1)
  mouseLeft.value = x
}

const activeIndex = computed<number | null>(() =>
  scrub.activeIndex.value ?? mouseIndex.value,
)

const scrubLineLeft = computed(() =>
  scrub.activeIndex.value != null ? scrub.lineLeft.value : mouseLeft.value,
)

const activeReadout = computed(() => {
  const i = activeIndex.value
  const list = view.value
  if (i == null || !list[i]) return null
  const cur = list[i]
  const prev = i > 0 ? list[i - 1].v : 0
  const chg = i === 0 || prev <= 0 ? null : (cur.v - prev) / prev * 100
  return {
    label: cur.d,
    nav: cur.v,
    change: chg == null ? '--' : `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`,
    cls: chg == null ? 'text-muted' : chg > 0 ? 'text-rise' : chg < 0 ? 'text-fall' : 'text-muted',
  }
})

const activeDotX = computed(() => {
  const i = activeIndex.value
  return i == null ? 0 : toX(i)
})
const activeDotY = computed<number | null>(() => {
  const i = activeIndex.value
  const list = view.value
  if (i == null || !axis.value || !list[i]) return null
  return toY(list[i].v)
})
</script>
<style scoped>
.nav-trend {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trend-ranges {
  display: flex;
  gap: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 2px;
}
.trend-range-btn {
  flex: 1;
  padding: 4px 0;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.trend-range-btn.is-active {
  background: var(--bg-card);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.trend-range-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.trend-box {
  position: relative;
  width: 100%;
  height: 96px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  overflow: hidden;

  touch-action: pan-y;
}
.trend-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.trend-marks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
.trend-mark {
  position: absolute;
  transform: translate(-50%, -50%);
  min-width: 14px;
  padding: 0 3px;
  border-radius: var(--radius-full);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  white-space: nowrap;
  box-shadow: 0 0 0 1.5px var(--bg-surface);
}
.trend-mark.is-buy { background: var(--color-rise); }
.trend-mark.is-sell { background: var(--color-fall); }
.trend-mark.is-settle { background: var(--text-muted); }

.trend-trades {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
}
.trend-trade {
  max-width: 96%;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--bg-card);
  border: 1px solid var(--color-primary);
  box-shadow: var(--shadow-sm);
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trend-mark.is-approx { opacity: 0.7; }

.trend-empty-box {
  position: relative;
  width: 100%;
  height: 100%;
}
.trend-empty-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-muted);
}

.scrub-readout {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 3px 6px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-default);
  font-size: 11px;
  pointer-events: none;
}
.scrub-label { color: var(--text-muted); }
.scrub-nav { color: var(--text-primary); font-weight: 600; }
.scrub-change { font-weight: 600; }
.scrub-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  z-index: 2;
  background: var(--color-primary);
  opacity: 0.75;
  pointer-events: none;
}

.trend-axis {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.trend-date,
.trend-hint {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}
.trend-hint { opacity: 0.7; }
</style>
