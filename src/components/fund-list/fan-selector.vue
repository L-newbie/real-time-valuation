<template>
  <div
    class="fan"
    :class="{ 'is-dragging': effectiveOffset !== 0, 'is-vertical': vertical }"
    role="listbox"
    :aria-label="`基金选择器，共 ${items.length} 只`"
    tabindex="0"
    @keydown.left.prevent="step(-1)"
    @keydown.right.prevent="step(1)"
    @keydown.up.prevent="step(-1)"
    @keydown.down.prevent="step(1)"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
    @wheel.prevent="onWheel"
  >
    <div class="fan-stage">
      <button
        v-for="it in visible"
        :key="`${it.offset}:${it.key}`"
        type="button"
        role="option"
        class="fan-card"
        :class="{ center: it.offset === 0 }"
        :aria-selected="it.offset === 0"
        :style="cardStyle(it.offset)"
        @click="it.offset === 0 ? $emit('activate', it.key) : select(it.index)"
      >
        <span class="fc-mark mark-chip" :style="it.markStyle">{{ it.initial }}</span>
        <span class="fc-name">{{ it.name }}</span>
        <span class="fc-code">{{ it.key }}</span>
        <span :class="['fc-rate', it.rateClass]">{{ it.rateText }}</span>
      </button>
    </div>
    <div class="fan-mask" aria-hidden="true" />
    <div class="fan-meta">
      <span class="fan-count">{{ activeIndex + 1 }} / {{ items.length }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export interface FanItem {
  key: string
  name: string

  rateText: string

  rateClass: string
}

const props = withDefaults(defineProps<{
  items: FanItem[]

  modelValue: string

  previewOffset?: number

  vertical?: boolean
}>(), {
  previewOffset: 0,
  vertical: false,
})

const emit = defineEmits<{
  'update:modelValue': [key: string]

  activate: [key: string]

  drag: [dx: number]
}>()

const ANGLE = 8
const STEP_X = 62
const DROP = 14
const ARC = 6
const SHRINK = 0.07

const ANGLE_V = 3
const STEP_Y = 54
const DROP_V = 8
const ARC_V = 3

const SIDE = 3

const SIDE_V = 2

const sideCount = computed(() => (props.vertical ? SIDE_V : SIDE))

const activeIndex = computed(() => {
  const i = props.items.findIndex(it => it.key === props.modelValue)
  return i < 0 ? 0 : i
})

const visible = computed(() => {
  const list: (FanItem & { offset: number; index: number; initial: string; markStyle: Record<string, string> })[] = []
  const total = props.items.length
  if (total === 0) return list

  // 环形取模会让同一项在 d 的两端各出现一次，侧翼数超过 (total-1)/2
  // 就会渲染出重复卡片（3 只基金铺出 5 张）。
  const side = Math.min(sideCount.value, Math.floor(Math.max(total - 1, 0) / 2))

  const offsets: number[] = []
  for (let d = -side; d <= side; d++) offsets.push(d)

  // 偶数只时对称范围只够覆盖 total-1 张，末尾再补一张仍不重复的；
  // 侧翼已被 sideCount 截断时不补，否则会超出扇形的设计容量。
  if (offsets.length < total && side < sideCount.value) offsets.push(side + 1)

  for (const d of offsets) {
    const idx = ((((activeIndex.value + d) % total) + total) % total)
    const it = props.items[idx]
    list.push({
      ...it,
      offset: d,
      index: idx,
      initial: (it.name || it.key).trim().charAt(0),
      markStyle: markStyle(it.key),
    })
  }

  return list.sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset))
})

function cardStyle(offset: number): Record<string, string> {
  const stepPx = props.vertical ? STEP_Y : STEP_X
  const shift = (effectiveOffset.value / stepPx) * 0.5
  const eff = offset + shift
  const ea = Math.abs(eff)

  const transform = props.vertical
    ? [
        `translate3d(${ea * DROP_V + ea * ea * ARC_V}px, ${eff * STEP_Y}px, 0)`,
        `rotate(${eff * ANGLE_V}deg)`,
        `scale(${1 - Math.min(ea, 3) * SHRINK})`,
      ]
    : [
        `translate3d(${eff * STEP_X}px, ${ea * DROP + ea * ea * ARC}px, 0)`,
        `rotate(${eff * ANGLE}deg)`,
        `scale(${1 - Math.min(ea, 3) * SHRINK})`,
      ]

  return {
    transform: transform.join(' '),

    zIndex: String(10 - Math.round(ea)),
  }
}

function markStyle(code: string): Record<string, string> {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 360

  h = 190 + (h % 75)
  return { '--mark-h': String(h) }
}

function select(index: number): void {
  const it = props.items[index]
  if (it) emit('update:modelValue', it.key)
}

function step(delta: number): void {
  const n = props.items.length
  if (n === 0) return

  select((((activeIndex.value + delta) % n) + n) % n)
}

let startX = 0
let startY = 0
let swiping = false
const selfDrag = ref(0)

const effectiveOffset = computed(() => (selfDrag.value !== 0 ? selfDrag.value : props.previewOffset))

const DRAG_DAMP = 0.55
const SWIPE_THRESHOLD = 50

function onTouchStart(e: TouchEvent): void {
  const t = e.touches[0]
  startX = t.clientX
  startY = t.clientY
  swiping = false
  selfDrag.value = 0
}
function onTouchMove(e: TouchEvent): void {
  const t = e.touches[0]
  const dx = t.clientX - startX
  const dy = t.clientY - startY

  const main = props.vertical ? dy : dx
  const cross = props.vertical ? dx : dy

  if (!swiping && Math.abs(main) > 12 && Math.abs(main) > Math.abs(cross) * 1.4) swiping = true
  if (swiping) { selfDrag.value = main * DRAG_DAMP; emit('drag', selfDrag.value) }
}
function onTouchEnd(e: TouchEvent): void {
  if (!swiping) return
  const t = e.changedTouches[0]
  const d = props.vertical ? t.clientY - startY : t.clientX - startX
  swiping = false
  selfDrag.value = 0
  emit('drag', 0)
  if (Math.abs(d) >= SWIPE_THRESHOLD) step(d < 0 ? 1 : -1)
}

const WHEEL_THRESHOLD = 24
let wheelAccum = 0
let wheelTimer: ReturnType<typeof setTimeout> | null = null

function onWheel(e: WheelEvent): void {
  if (!props.vertical) return
  wheelAccum += e.deltaY
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => { wheelAccum = 0 }, 140)

  if (Math.abs(wheelAccum) >= WHEEL_THRESHOLD) {
    step(wheelAccum > 0 ? 1 : -1)
    wheelAccum = 0
  }
}

watch(() => props.items, (list) => {
  if (list.length === 0) return
  if (!list.some(it => it.key === props.modelValue)) emit('update:modelValue', list[0].key)
}, { immediate: true, deep: false })
</script>
<style scoped>
.fan {
  position: relative;

  --fan-h: 176px;
  --fan-card-h: 148px;
  --fan-card-w: 112px;

  --fan-mask-bite: 34px;

  position: relative;
  height: var(--fan-h);
  overflow: hidden;
  outline: none;
  user-select: none;
  -webkit-user-select: none;
}
.fan:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; border-radius: var(--radius-lg); }

.fan-stage {
  position: absolute;
  left: 50%;
  top: var(--spacing-xs);
  width: 0;
  height: 0;
}

.fan-card {
  position: absolute;

  left: calc(var(--fan-card-w) / -2);
  top: 0;
  width: var(--fan-card-w);
  height: var(--fan-card-h);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: var(--spacing-sm);
  border-radius: var(--radius-lg);

  clip-path: inset(0 round var(--radius-lg));
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  cursor: pointer;

  transform-origin: 50% 120%;
  transition: transform var(--duration-slow) var(--ease-out-expo),
              border-color var(--transition-fast);
  box-shadow: var(--shadow-md);
}

/* will-change 常驻会让每张卡长期各占一层合成层，自选一多就吃显存。
   只在真正拖动时提层，松手后交还。 */
.fan.is-dragging .fan-card {
  will-change: transform;
  transition: none;
}

.fan-card.center {
  border-color: var(--color-primary);
  background: linear-gradient(150deg, var(--color-primary-glow), var(--bg-card) 70%);
  box-shadow: var(--shadow-lg), 0 0 0 1px var(--color-primary-glow);

  animation: fanCenterPulse var(--duration-normal) var(--ease-out-expo);
}
@keyframes fanCenterPulse {
  0%   { box-shadow: var(--shadow-lg), 0 0 0 1px var(--color-primary-glow); }
  45%  { box-shadow: var(--shadow-lg), 0 0 0 5px var(--color-primary-glow); }
  100% { box-shadow: var(--shadow-lg), 0 0 0 1px var(--color-primary-glow); }
}

.fc-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}
.fc-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  text-align: left;

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fc-code {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.fc-rate {
  margin-top: auto;
  font-size: var(--font-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.fan-mask {
  position: absolute;
  left: 50%;
  top: calc(var(--fan-h) - var(--fan-mask-bite));
  width: 260%;
  height: 300px;
  transform: translateX(-50%);
  border-radius: 50% 50% 0 0 / 60px 60px 0 0;
  background: var(--bg-base);
  pointer-events: none;
  z-index: 20;
}

.fan-meta {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  z-index: 21;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}
.fan-count {
  font-size: var(--font-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 46px;
  text-align: center;
}

.fan.is-vertical {
  --fan-card-w: 124px;
  --fan-card-h: 46px;
  height: 100%;
  width: calc(var(--fan-card-w) + var(--spacing-md));
}
.fan.is-vertical .fan-stage {
  left: 50%;
  right: auto;
  top: 50%;
}
.fan.is-vertical .fan-card {
  left: calc(var(--fan-card-w) / -2);
  right: auto;
  top: calc(var(--fan-card-h) / -2);
  height: var(--fan-card-h);
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  transform-origin: 50% 50%;
}
.fan.is-vertical .fan-mask { display: none; }
.fan.is-vertical .fan-meta {
  top: auto;
  bottom: 2px;
}
.fan.is-vertical .fc-name {
  -webkit-line-clamp: 1;
  flex: 1;
  min-width: 0;
}
.fan.is-vertical .fc-code { display: none; }
.fan.is-vertical .fc-rate {
  margin-top: 0;
  font-size: 12px;
}
.fan.is-vertical .fc-mark { width: 24px; height: 24px; font-size: 11px; }

@media (max-width: 767px) {
  .fan { height: 164px; }
  .fan-card { width: 104px; height: 138px; left: -52px; }
}

@media (max-height: 900px) {
  .fan:not(.is-vertical) {
    --fan-h: 138px;
    --fan-card-h: 112px;
    --fan-card-w: 96px;
    --fan-mask-bite: 26px;
  }
  .fan:not(.is-vertical) .fan-card { padding: 6px; }
  .fan:not(.is-vertical) .fc-mark { width: 24px; height: 24px; font-size: 11px; }
  .fan:not(.is-vertical) .fc-name { font-size: 11px; }
  .fan:not(.is-vertical) .fc-code { display: none; }
  .fan:not(.is-vertical) .fc-rate { font-size: 12px; }
}
@media (max-height: 760px) {
  .fan:not(.is-vertical) {
    --fan-h: 118px;
    --fan-card-h: 94px;
    --fan-card-w: 88px;
    --fan-mask-bite: 22px;
  }
  .fan:not(.is-vertical) .fc-mark { display: none; }
}

</style>
