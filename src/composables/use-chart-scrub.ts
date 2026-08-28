

import { ref, shallowRef, onUnmounted, onDeactivated, type Ref } from 'vue'

export const chartScrubActive = ref(false)

const LONG_PRESS_MS = 250

const DOUBLE_TAP_MS = 300

const TAP_SLOP_PX = 10

export interface ChartScrubOptions {
  count: () => number

  pixelToIndex?: (x: number) => number | null
}

export function useChartScrub(opts: ChartScrubOptions) {
  const activeIndex = ref<number | null>(null)

  const lineLeft = ref(0)

  const containerRef = shallowRef<HTMLElement | null>(null)

  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0

  let moved = false

  let lastTapAt = 0

  let owning = false

  let scrubbing = false

  function clearPressTimer(): void {
    if (pressTimer !== null) { clearTimeout(pressTimer); pressTimer = null }
  }

  function acquireGlobal(): void {
    owning = true
    chartScrubActive.value = true
  }

  function releaseGlobal(): void {
    if (owning) { owning = false; chartScrubActive.value = false }
  }

  function enterScrub(clientX: number): void {
    scrubbing = true
    acquireGlobal()
    updateFromClientX(clientX)
  }

  function updateFromClientX(clientX: number): void {
    const el = containerRef.value
    const n = opts.count()
    if (!el || n <= 0) return
    const rect = el.getBoundingClientRect()

    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)

    let idx = opts.pixelToIndex?.(x) ?? null
    if (idx == null) {
      idx = Math.round((x / rect.width) * (n - 1))
    }
    idx = Math.min(Math.max(Math.round(idx), 0), n - 1)

    activeIndex.value = idx
    lineLeft.value = x
  }

  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) {
      clearPressTimer()
      return
    }
    if (opts.count() <= 0) return
    const t = e.touches[0]
    startX = t.clientX
    startY = t.clientY
    moved = false

    acquireGlobal()

    const now = Date.now()
    if (now - lastTapAt < DOUBLE_TAP_MS) {
      lastTapAt = 0
      clearPressTimer()
      enterScrub(t.clientX)
      return
    }

    clearPressTimer()
    pressTimer = setTimeout(() => {
      pressTimer = null
      if (!moved) enterScrub(startX)
    }, LONG_PRESS_MS)
  }

  function onTouchMove(e: TouchEvent): void {
    const t = e.touches[0]
    if (!t) return

    if (scrubbing) {
      e.stopPropagation()

      e.preventDefault()
      updateFromClientX(t.clientX)
      return
    }

    if (!moved &&
        (Math.abs(t.clientX - startX) > TAP_SLOP_PX ||
         Math.abs(t.clientY - startY) > TAP_SLOP_PX)) {
      moved = true
      clearPressTimer()
    }
  }

  function onTouchEnd(): void {
    clearPressTimer()

    lastTapAt = moved ? 0 : Date.now()
    moved = false
    scrubbing = false
    activeIndex.value = null
    releaseGlobal()
  }

  function reset(): void {
    clearPressTimer()
    moved = false
    lastTapAt = 0
    scrubbing = false
    activeIndex.value = null
    releaseGlobal()
  }

  onUnmounted(reset)
  onDeactivated(reset)

  return {
    containerRef,
    activeIndex: activeIndex as Ref<number | null>,
    lineLeft,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    updateFromClientX,
    reset,
  }
}
