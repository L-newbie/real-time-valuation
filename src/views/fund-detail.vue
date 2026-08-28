<template>
  <div
    class="fund-detail-shell"
    @touchstart.passive="onSwipeStart"
    @touchend="onSwipeEnd"
    @touchcancel="onSwipeEnd"
  >
    <div ref="trackRef" class="pane-track" :style="trackStyle">
      <div class="pane-slot" :style="slotStyle('A')">
        <FundDetailPane key="A" :fund-code="codeOfSlot('A')" :is-active="activeSlot === 'A'" class="pane" />
      </div>
      <div class="pane-slot" :style="slotStyle('B')">
        <FundDetailPane key="B" :fund-code="codeOfSlot('B')" :is-active="activeSlot === 'B'" class="pane" />
      </div>
    </div>
    <button
      v-if="prevCode"
      class="float-nav float-nav-prev"
      :class="{ 'is-active': prevActive }"
      title="上一个"
      @click="goPrev"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <button
      v-if="nextCode"
      class="float-nav float-nav-next"
      :class="{ 'is-active': nextActive }"
      title="下一个"
      @click="goNext"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  </div>
</template>
<script setup lang="ts">

import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFundData } from '@/composables/use-fund-data'
import { chartScrubActive } from '@/composables/use-chart-scrub'
import FundDetailPane from '@/components/fund-detail/fund-detail-pane.vue'
import { markLastVisitedFund } from '@/modules/fund/misc/last-visited-fund'

const route = useRoute()
const router = useRouter()

const { sortedFundRows } = useFundData()
const sortedCodes = computed(() => sortedFundRows.value.map(r => r.fundCode))

const currentCode = ref<string>(route.params.code as string)
const activeSlot = ref<'A' | 'B'>('A')
const slotCodes = ref<{ A: string | null; B: string | null }>({ A: currentCode.value, B: null })

function codeOfSlot(slot: 'A' | 'B'): string {
  return slot === activeSlot.value ? currentCode.value : (slotCodes.value[slot] ?? currentCode.value)
}

function slotStyle(slot: 'A' | 'B'): { left: string } {
  if (slot === activeSlot.value) return { left: '0' }
  return { left: swipeDir.value === -1 ? '100%' : '-100%' }
}

const inactiveCode = computed(() => {
  const inactive: 'A' | 'B' = activeSlot.value === 'A' ? 'B' : 'A'
  return slotCodes.value[inactive]
})

const currentIndex = computed(() => sortedCodes.value.indexOf(currentCode.value))
const nextCode = computed(() => {
  const list = sortedCodes.value
  if (list.length < 2) return null
  const i = currentIndex.value
  if (i < 0) return null
  return list[(i + 1) % list.length]
})
const prevCode = computed(() => {
  const list = sortedCodes.value
  if (list.length < 2) return null
  const i = currentIndex.value
  if (i < 0) return null
  return list[(i - 1 + list.length) % list.length]
})

const SWIPE_THRESHOLD = 60
const LOCK_AXIS_THRESHOLD = 10
const ANIM_MS = 290

type SwipeState = 'idle' | 'tracking' | 'animating'
const swipeState = ref<SwipeState>('idle')
const swipeOffset = ref(0)
const swipeDir = ref<1 | -1 | 0>(0)
let touchStartX = 0
let touchStartY = 0
let axisLocked: null | 'h' | 'v' | 'scroll' = null
let touchStartTarget: EventTarget | null = null
let animTimer: ReturnType<typeof setTimeout> | null = null

const trackStyle = computed(() => {
  const hasTransition = !noTransition.value && swipeState.value === 'animating'
  return {
    transform: `translateX(${swipeOffset.value}px)`,
    transition: hasTransition ? 'transform 0.28s cubic-bezier(0.32, 0.72, 0.32, 1)' : 'none',
  }
})

const prevActive = computed(() => swipeState.value === 'tracking' && swipeOffset.value > 4)
const nextActive = computed(() => swipeState.value === 'tracking' && swipeOffset.value < -4)

const trackRef = ref<HTMLElement | null>(null)
function paneWidth(): number {
  if (trackRef.value) return trackRef.value.offsetWidth
  return typeof window !== 'undefined' ? window.innerWidth : 375
}

function clearAnimTimer() {
  if (animTimer) { clearTimeout(animTimer); animTimer = null }
}

let safetyTimer: ReturnType<typeof setTimeout> | null = null
function armSafetyNet() {
  clearSafetyNet()
  safetyTimer = setTimeout(() => {
    safetyTimer = null
    if (swipeState.value === 'animating') {
      swipeState.value = 'idle'
      swipeOffset.value = 0
      swipeDir.value = 0
    }
  }, ANIM_MS * 1.5)
}
function clearSafetyNet() {
  if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null }
}

function beginSwitch(targetCode: string, dir: 1 | -1) {
  swipeDir.value = dir
  const inactive: 'A' | 'B' = activeSlot.value === 'A' ? 'B' : 'A'
  slotCodes.value = { ...slotCodes.value, [inactive]: targetCode }
}

const noTransition = ref(false)

function commitSwitch() {
  clearAnimTimer()
  const newActive: 'A' | 'B' = activeSlot.value === 'A' ? 'B' : 'A'
  const newCode = slotCodes.value[newActive]!

  noTransition.value = true
  nextTick(() => {
    swipeState.value = 'idle'
    clearSafetyNet()
    activeSlot.value = newActive
    currentCode.value = newCode
    const oldActive: 'A' | 'B' = activeSlot.value === 'A' ? 'B' : 'A'
    slotCodes.value = { ...slotCodes.value, [oldActive]: null }
    swipeDir.value = 0
    swipeOffset.value = 0

    if (route.params.code !== newCode) {
      router.replace({ name: 'FundDetail', params: { code: newCode } })
    }

    nextTick(() => { noTransition.value = false })
  })
}

function cancelSwitch() {
  clearAnimTimer()
  swipeState.value = 'animating'
  swipeOffset.value = 0
  armSafetyNet()
  animTimer = setTimeout(() => {
    const inactive: 'A' | 'B' = activeSlot.value === 'A' ? 'B' : 'A'
    slotCodes.value = { ...slotCodes.value, [inactive]: null }
    swipeDir.value = 0
    swipeState.value = 'idle'
    clearSafetyNet()
  }, ANIM_MS)
}

function onSwipeStart(e: TouchEvent) {
  if (e.touches.length !== 1) return
  if (swipeState.value === 'animating') return
  const t = e.touches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
  touchStartTarget = e.target
  axisLocked = null
  swipeOffset.value = 0
  swipeState.value = 'tracking'
}

function findScrollableX(start: EventTarget | null, dx: number): HTMLElement | null {
  let el = start instanceof HTMLElement ? start : null
  while (el && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) {
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1
      if (dx > 0 ? !atStart : !atEnd) return el
    }
    el = el.parentElement
  }
  return null
}

function onSwipeMove(e: TouchEvent) {
  if (chartScrubActive.value) {
    if (swipeState.value === 'tracking') {
      swipeState.value = 'idle'
      swipeOffset.value = 0
      axisLocked = null
    }
    return
  }
  if (swipeState.value !== 'tracking') return
  const t = e.touches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  if (axisLocked === null) {
    if (Math.abs(dx) < LOCK_AXIS_THRESHOLD && Math.abs(dy) < LOCK_AXIS_THRESHOLD) return

    if (Math.abs(dx) > Math.abs(dy) && findScrollableX(touchStartTarget, dx)) {
      axisLocked = 'scroll'
      swipeState.value = 'idle'
      swipeOffset.value = 0
      return
    }

    axisLocked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'

    if (axisLocked === 'h') {
      const dir: 1 | -1 = dx > 0 ? 1 : -1
      const target = dir > 0 ? prevCode.value : nextCode.value
      if (target && !inactiveCode.value) beginSwitch(target, dir)
    }
  }
  if (axisLocked !== 'h') return
  e.preventDefault()

  const hasPending = swipeDir.value !== 0
  const damping = hasPending ? 1 : 0.3
  swipeOffset.value = dx * damping
}
function onSwipeEnd() {
  if (swipeState.value !== 'tracking') return

  if (axisLocked !== 'h') {
    swipeState.value = 'idle'
    return
  }
  const offset = swipeOffset.value
  const hasPending = inactiveCode.value !== null
  if (hasPending && Math.abs(offset) >= SWIPE_THRESHOLD) {
    const dir: 1 | -1 = offset > 0 ? 1 : -1
    swipeState.value = 'animating'
    swipeOffset.value = dir * paneWidth()
    armSafetyNet()
    animTimer = setTimeout(commitSwitch, ANIM_MS)
  } else if (hasPending) {
    cancelSwitch()
  } else {
    swipeState.value = 'animating'
    swipeOffset.value = 0
    armSafetyNet()
    animTimer = setTimeout(() => { swipeState.value = 'idle'; clearSafetyNet() }, ANIM_MS)
  }
}

function goPrev() {
  if (prevCode.value && swipeState.value !== 'animating') animateSwitchByButton(prevCode.value, 1)
}
function goNext() {
  if (nextCode.value && swipeState.value !== 'animating') animateSwitchByButton(nextCode.value, -1)
}
function animateSwitchByButton(targetCode: string, dir: 1 | -1) {
  beginSwitch(targetCode, dir)
  swipeState.value = 'animating'
  swipeOffset.value = dir * paneWidth()
  armSafetyNet()
  animTimer = setTimeout(commitSwitch, ANIM_MS)
}

function onTouchMoveCapture(e: TouchEvent) { onSwipeMove(e) }

function addDocListener() {
  document.addEventListener('touchmove', onTouchMoveCapture, { passive: false, capture: true })
}
function removeDocListener() {
  document.removeEventListener('touchmove', onTouchMoveCapture, { capture: true })
}

function resetGesture() {
  clearAnimTimer()
  clearSafetyNet()
  swipeState.value = 'idle'
  swipeOffset.value = 0
  swipeDir.value = 0
  axisLocked = null

  const inactive: 'A' | 'B' = activeSlot.value === 'A' ? 'B' : 'A'
  slotCodes.value = { ...slotCodes.value, [inactive]: null }
}

onMounted(addDocListener)
onActivated(addDocListener)
onDeactivated(() => {
  removeDocListener()
  markLastVisitedFund(currentCode.value)
  resetGesture()
})
onUnmounted(() => {
  removeDocListener()
  resetGesture()
})

watch(() => route.params.code, (code) => {
  if (typeof code !== 'string' || !code) return
  if (code === currentCode.value) return

  currentCode.value = code
  const inactive: 'A' | 'B' = activeSlot.value === 'A' ? 'B' : 'A'
  slotCodes.value = { A: activeSlot.value === 'A' ? code : slotCodes.value.A, B: activeSlot.value === 'B' ? code : null }
  void inactive
  swipeDir.value = 0
  swipeOffset.value = 0
  swipeState.value = 'idle'
  clearAnimTimer()
  clearSafetyNet()
})
</script>
<style scoped>
.fund-detail-shell {
  position: relative;

  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
}

.pane-track {
  position: relative;
  width: 100%;
  height: 100%;
  will-change: transform;
}

.pane-slot {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
}
.pane-slot-current { left: 0; }
.pane-slot-pending {  }
.pane {
  width: 100%;
  height: 100%;
}

.float-nav {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 50;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 52px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: rgba(128, 128, 128, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text-secondary);
  cursor: pointer;

  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0.2s ease, color 0.2s ease,
              border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.float-nav-prev {
  left: max(var(--spacing-md), calc(50vw - 320px + var(--spacing-md)));
}
.float-nav-next {
  right: max(var(--spacing-md), calc(50vw - 320px + var(--spacing-md)));
}

@media (min-width: 1024px) {
  .float-nav-prev {
    left: max(var(--spacing-md), calc(5vw + var(--spacing-md)));
  }
  .float-nav-next {
    right: max(var(--spacing-md), calc(5vw + var(--spacing-md)));
  }
}

.float-nav.is-active {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-glow);
}
.float-nav.is-active:hover { opacity: 1; }
.float-nav.is-active:active { transform: translateY(-50%) scale(0.92); }

@media (hover: hover) and (pointer: fine) {
  .fund-detail-shell:hover .float-nav {
    opacity: 0.45;
    visibility: visible;
    pointer-events: auto;
  }
  .fund-detail-shell:hover .float-nav:hover {
    opacity: 1;
    color: var(--color-primary);
    border-color: var(--color-primary);
    background: var(--color-primary-glow);
  }
}
</style>
