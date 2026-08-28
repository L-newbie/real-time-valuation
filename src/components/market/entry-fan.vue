<template>
  <div
    ref="rootRef"
    class="efan"
    :class="{ 'is-dragging': selfDrag !== 0, 'is-expanded': expanded }"
    role="listbox"
    aria-label="板块选择"
    tabindex="0"
    @keydown.left.prevent="step(-1)"
    @keydown.right.prevent="step(1)"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div class="efan-stage">
      <button
        v-for="it in visible"
        :key="`${it.offset}:${it.key}`"
        type="button"
        role="option"
        class="efan-card"
        :class="{ center: it.offset === 0 }"
        :aria-selected="it.offset === 0"
        :style="cardStyle(it.offset, it.key)"
        @click="it.offset === 0 ? $emit('activate', it.key) : select(it.index)"
      >
        <span class="efan-grid" aria-hidden="true" />
        <span class="efan-sheen" aria-hidden="true" />
        <span class="efan-corner efan-corner-tl" aria-hidden="true" />
        <span class="efan-corner efan-corner-br" aria-hidden="true" />
        <span class="efan-body">
          <span class="efan-icon" v-html="it.icon" />
          <span class="efan-name">{{ it.name }}</span>
          <span v-if="it.summary" class="efan-summary">{{ it.summary }}</span>
        </span>
        <span class="efan-no font-number" aria-hidden="true">
          {{ String(it.index + 1).padStart(2, '0') }}
        </span>
      </button>
    </div>
    <div class="efan-mask" aria-hidden="true" />
    <div class="efan-dots">
      <span
        v-for="(it, i) in items"
        :key="it.key"
        class="efan-dot"
        :class="{ on: i === activeIndex }"
      />
    </div>
    <p class="efan-hint">
      {{ expanded ? '滑动切换 · 再次点击当前卡片收起' : '点击卡片查看 · 左右滑动切换' }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

export interface EntryFanItem {
  key: string
  name: string

  icon: string

  summary?: string

  hue: number
}

const props = withDefaults(defineProps<{
  items: EntryFanItem[]

  modelValue: string

  expanded?: boolean
}>(), {
  expanded: false,
})

const emit = defineEmits<{
  'update:modelValue': [key: string]

  activate: [key: string]
}>()

const GEO = {
  collapsed: { ANGLE: 12, STEP_X: 0, DROP: 28, ARC: 13, SHRINK: 0.11 },
  expanded: { ANGLE: 8, STEP_X: 62, DROP: 13, ARC: 6, SHRINK: 0.08 },
}

const COLLAPSED_STEP_RATIO = 0.62

const SIDE = 2

const rootRef = ref<HTMLElement | null>(null)

const cardW = ref(226)

function measureCardW(): void {
  const el = rootRef.value
  if (!el) return
  const raw = getComputedStyle(el).getPropertyValue('--efan-card-w').trim()
  const n = parseFloat(raw)
  if (Number.isFinite(n) && n > 0) cardW.value = n
}

const geo = computed(() => {
  if (props.expanded) return GEO.expanded
  return { ...GEO.collapsed, STEP_X: cardW.value * COLLAPSED_STEP_RATIO }
})

const activeIndex = computed(() => {
  const i = props.items.findIndex(it => it.key === props.modelValue)
  return i < 0 ? 0 : i
})

const visible = computed(() => {
  const list: (EntryFanItem & { offset: number; index: number })[] = []
  const total = props.items.length
  for (let d = -SIDE; d <= SIDE; d++) {
    let idx = activeIndex.value + d
    if (total > SIDE * 2) idx = ((idx % total) + total) % total
    else if (idx < 0 || idx >= total) continue
    const it = props.items[idx]
    if (!it) continue
    list.push({ ...it, offset: d, index: idx })
  }

  return list.sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset))
})

const DRAG_DAMP = 0.55
const SWIPE_THRESHOLD = 50
const selfDrag = ref(0)

function cardStyle(offset: number, key: string): Record<string, string> {
  const g = geo.value

  const shift = (selfDrag.value / g.STEP_X) * 0.5
  const eff = offset + shift
  const ea = Math.abs(eff)
  const item = props.items.find(it => it.key === key)
  return {
    transform: [
      `translate3d(${eff * g.STEP_X}px, ${ea * g.DROP + ea * ea * g.ARC}px, 0)`,
      `rotate(${eff * g.ANGLE}deg)`,
      `scale(${1 - Math.min(ea, 3) * g.SHRINK})`,
    ].join(' '),
    zIndex: String(10 - Math.round(ea)),
    '--card-h': String(item?.hue ?? 210),
  }
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

  if (!swiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) swiping = true
  if (swiping) selfDrag.value = dx * DRAG_DAMP
}
function onTouchEnd(e: TouchEvent): void {
  if (!swiping) return
  const dx = e.changedTouches[0].clientX - startX
  swiping = false
  selfDrag.value = 0
  if (Math.abs(dx) >= SWIPE_THRESHOLD) step(dx < 0 ? 1 : -1)
}

watch(() => props.items, (list) => {
  if (list.length === 0) return
  if (!list.some(it => it.key === props.modelValue)) emit('update:modelValue', list[0].key)
}, { immediate: true, deep: false })

onMounted(() => {
  nextTick(measureCardW)
  window.addEventListener('resize', measureCardW)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measureCardW)
})
watch(() => props.expanded, () => { nextTick(measureCardW) })
</script>
<style scoped>
.efan {
  position: relative;

  --efan-card-w: 268px;
  --efan-card-h: 348px;

  --efan-h: calc(6px + var(--efan-card-h) * 0.78 + 46px);
  height: var(--efan-h);
  flex-shrink: 0;
  outline: none;

  overflow-x: visible;
  overflow-y: clip;

  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;

  transition: height var(--duration-slow) var(--ease-out-expo);
}

.efan.is-expanded {
  --efan-card-w: 112px;
  --efan-card-h: 138px;
}

.efan-stage {
  position: absolute;
  left: 50%;
  top: 6px;
  width: 0;
  height: 0;
}

.efan-card {
  position: absolute;

  left: calc(var(--efan-card-w) / -2);
  top: 0;
  width: var(--efan-card-w);
  height: var(--efan-card-h);
  display: block;
  padding: 0;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);

  background:
    radial-gradient(120% 80% at 50% 0%, hsl(var(--card-h, 210) 60% 52% / 0.22), transparent 62%),
    linear-gradient(168deg, hsl(var(--card-h, 210) 45% 42% / 0.10), var(--bg-card) 70%);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;

  clip-path: inset(0 round var(--radius-lg));
  overflow: clip;

  transform-origin: 50% 120%;

  transition: transform var(--duration-slow) var(--ease-out-expo),
              width var(--duration-slow) var(--ease-out-expo),
              height var(--duration-slow) var(--ease-out-expo),
              border-color var(--transition-fast),
              box-shadow var(--transition-fast);
  box-shadow: var(--shadow-md);
}

/* will-change 只在拖动时挂：常驻会让每张卡各占一层合成层。 */
.efan.is-dragging .efan-card {
  will-change: transform;
  transition: none;
}

.efan-body {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 11px;
  padding: var(--spacing-md);
}
.is-expanded .efan-body { gap: 6px; padding: var(--spacing-sm); }

.efan-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(hsl(var(--card-h, 210) 60% 70% / 0.07) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--card-h, 210) 60% 70% / 0.07) 1px, transparent 1px);
  background-size: 22px 22px;

  mask-image: linear-gradient(180deg, #000 0%, transparent 78%);
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 78%);
  pointer-events: none;
}

.efan-sheen {
  position: absolute;
  inset: -40% -60%;
  z-index: 1;
  background: linear-gradient(
    100deg,
    transparent 38%,
    hsl(var(--card-h, 210) 70% 78% / 0.13) 48%,
    transparent 58%
  );
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-normal) var(--ease-out-expo);
}

.efan-card.center .efan-sheen {
  opacity: 1;
  animation: efanSheen 4.2s var(--ease-out-expo) infinite;
}
@keyframes efanSheen {
  0%, 100% { transform: translateX(-28%); }
  50% { transform: translateX(28%); }
}

.efan-corner {
  position: absolute;
  z-index: 2;
  width: 14px;
  height: 14px;
  border-color: hsl(var(--card-h, 210) 65% 68% / 0.42);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
  transition: border-color var(--transition-fast);
}
.efan-corner-tl {
  top: 10px;
  left: 10px;
  border-top-width: 1.5px;
  border-left-width: 1.5px;
  border-top-left-radius: 3px;
}
.efan-corner-br {
  right: 10px;
  bottom: 10px;
  border-bottom-width: 1.5px;
  border-right-width: 1.5px;
  border-bottom-right-radius: 3px;
}
.efan-card.center .efan-corner { border-color: hsl(var(--card-h, 210) 70% 70% / 0.85); }

.is-expanded .efan-corner { width: 9px; height: 9px; }
.is-expanded .efan-corner-tl { top: 6px; left: 6px; }
.is-expanded .efan-corner-br { right: 6px; bottom: 6px; }

.efan-no {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 13px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: hsl(var(--card-h, 210) 60% 72% / 0.55);
  font-variant-numeric: tabular-nums;
  transition: color var(--transition-fast);
}
.efan-card.center .efan-no { color: hsl(var(--card-h, 210) 70% 74% / 0.95); }
.is-expanded .efan-no { font-size: 9px; top: 7px; right: 8px; }

.efan-card.center {
  border-color: hsl(var(--card-h, 210) 62% 58% / 0.62);
  color: var(--text-primary);
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px hsl(var(--card-h, 210) 62% 58% / 0.28),
    0 12px 40px hsl(var(--card-h, 210) 60% 45% / 0.22);
}

.efan-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: var(--radius-lg);

  background:
    radial-gradient(circle at 50% 35%, hsl(var(--card-h, 210) 65% 60% / 0.30), transparent 68%),
    hsl(var(--card-h, 210) 55% 50% / 0.12);
  box-shadow:
    inset 0 0 0 1px hsl(var(--card-h, 210) 65% 65% / 0.30),
    0 0 22px hsl(var(--card-h, 210) 65% 55% / 0.16);
  color: hsl(var(--card-h, 210) 72% 70%);
  transition: width var(--duration-slow) var(--ease-out-expo),
              height var(--duration-slow) var(--ease-out-expo),
              box-shadow var(--transition-fast);
}
.efan-card.center .efan-icon {
  box-shadow:
    inset 0 0 0 1px hsl(var(--card-h, 210) 70% 70% / 0.50),
    0 0 34px hsl(var(--card-h, 210) 68% 58% / 0.30);
}

.is-expanded .efan-icon { width: 38px; height: 38px; border-radius: var(--radius-md); }

.efan-icon :deep(svg) { width: 43px; height: 43px; }
.is-expanded .efan-icon :deep(svg) { width: 19px; height: 19px; }

.efan-name {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}
.is-expanded .efan-name { font-size: var(--font-sm); }

.efan-summary {
  font-size: var(--font-sm);
  color: var(--text-muted);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.is-expanded .efan-summary { font-size: 10px; }

.efan-mask {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);

  top: calc(6px + var(--efan-card-h) * 0.78);

  height: 260px;
  width: 200%;
  border-radius: 50% 50% 0 0 / 44px 44px 0 0;
  background: var(--bg-base);
  pointer-events: none;
  z-index: 15;
}

.efan-dots {
  position: absolute;
  left: 0;
  right: 0;

  bottom: 18px;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.efan-dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--border-hover);
  transition: width var(--duration-fast) var(--ease-out-expo),
              background-color var(--duration-fast) var(--ease-out-expo);
}

.efan-dot.on {
  width: 16px;
  background: var(--color-primary);
}

.efan-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 1px;
  z-index: 20;
  margin: 0;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.75;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out-expo);
}

.is-expanded .efan-hint { opacity: 0.4; }

@media (max-width: 767px) {
  .efan {
    --efan-card-w: 222px;
    --efan-card-h: 292px;
  }
  .efan.is-expanded {
    --efan-card-w: 102px;
    --efan-card-h: 126px;
  }
  .efan-icon { width: 72px; height: 72px; }
  .efan-icon :deep(svg) { width: 36px; height: 36px; }
}

@media (max-height: 760px) and (min-width: 768px) {
  .efan {
    --efan-card-w: 188px;
    --efan-card-h: 244px;
  }
  .efan.is-expanded {
    --efan-card-w: 100px;
    --efan-card-h: 116px;
  }
  .efan-icon { width: 60px; height: 60px; }
  .efan-icon :deep(svg) { width: 30px; height: 30px; }
}
</style>
