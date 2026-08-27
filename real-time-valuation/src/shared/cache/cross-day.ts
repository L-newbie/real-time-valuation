

import { getBeijingTodayStr } from '@/shared/utils/date-format'

export function isCrossDay(lastDate: string): boolean {
  if (!lastDate) return false
  return lastDate !== getBeijingTodayStr()
}

export function createCrossDayWatcher(
  onCrossDay: () => void | Promise<void>,
  intervalMs: number = 30 * 1000,
): { start: () => void; stop: () => void; checkNow: () => Promise<void> } {
  let currentDate = getBeijingTodayStr()
  let timer: ReturnType<typeof setInterval> | null = null

  async function check(): Promise<void> {
    const today = getBeijingTodayStr()
    if (today !== currentDate) {
      currentDate = today
      await onCrossDay()
    }
  }

  return {
    start: () => {
      if (timer) return
      timer = setInterval(() => { void check() }, intervalMs)
    },
    stop: () => {
      if (timer) { clearInterval(timer); timer = null }
    },
    checkNow: check,
  }
}
