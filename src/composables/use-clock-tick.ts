

import { ref, onMounted, onUnmounted } from 'vue'

const minuteTick = ref(0)

let timerId: ReturnType<typeof setInterval> | null = null
let alignTimerId: ReturnType<typeof setTimeout> | null = null
let refCount = 0

function start(): void {
  if (timerId !== null || alignTimerId !== null) return

  const msToNextMinute = 60000 - (Date.now() % 60000)
  alignTimerId = setTimeout(() => {
    alignTimerId = null
    minuteTick.value++
    timerId = setInterval(() => { minuteTick.value++ }, 60000)
  }, msToNextMinute)
}

function stop(): void {
  if (timerId !== null) { clearInterval(timerId); timerId = null }
  if (alignTimerId !== null) { clearTimeout(alignTimerId); alignTimerId = null }
}

export function useClockTick() {
  onMounted(() => {
    refCount++
    start()
  })
  onUnmounted(() => {
    refCount--
    if (refCount <= 0) { refCount = 0; stop() }
  })
  return { minuteTick }
}

export function currentMinuteTick() {
  return minuteTick
}
