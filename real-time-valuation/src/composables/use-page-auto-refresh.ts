

import { ref, onMounted, onUnmounted, onActivated, onDeactivated, watch, type Ref } from 'vue'

export interface PageAutoRefreshOptions {
  enabled: () => boolean

  interval: () => number

  onTick: () => void | Promise<void>
}

export function usePageAutoRefresh(options: PageAutoRefreshOptions): {
  countdown: Ref<number>
  restart: () => void
  resetCountdown: () => void
  pause: () => void
  resume: () => void
} {
  const countdown = ref(options.interval())

  let timerId: number | null = null

  let active = false

  let paused = false

  function stopTimer(): void {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
  }

  function startTimer(): void {
    stopTimer()
    if (!active) return
    if (paused) return
    if (document.visibilityState !== 'visible') return
    if (!options.enabled()) return

    timerId = window.setInterval(() => {
      if (countdown.value <= 0) {
        countdown.value = options.interval()
        return
      }
      countdown.value--
      if (countdown.value > 0) return
      void options.onTick()
    }, 1000)
  }

  function resetCountdown(): void {
    countdown.value = options.interval()
  }

  function restart(): void {
    resetCountdown()
    startTimer()
  }

  function pause(): void {
    paused = true
    stopTimer()
  }

  function resume(): void {
    if (!paused) return
    paused = false
    restart()
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') startTimer()
    else stopTimer()
  }

  watch(() => options.enabled(), (on) => {
    if (on) restart()
    else { stopTimer(); resetCountdown() }
  })

  watch(() => options.interval(), () => { restart() })

  onMounted(() => {
    active = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    startTimer()
  })

  onUnmounted(() => {
    active = false
    document.removeEventListener('visibilitychange', onVisibilityChange)
    stopTimer()
  })

  onActivated(() => {
    active = true
    startTimer()
  })

  onDeactivated(() => {
    active = false
    stopTimer()
  })

  return { countdown, restart, resetCountdown, pause, resume }
}
