

import { onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { useIndexStore } from '@/modules/index/index-store'
import { useStockStore } from '@/modules/stock/stock-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { rebuildFundModuleOnCrossDay } from '@/modules/fund/fund-bootstrap'
import { checkManagerChanges } from '@/composables/use-manager-check'
import { getBusinessDay } from '@/modules/fund/valuation/cn-trading-day'

export function useCrossDay() {
  const indexStore = useIndexStore()
  const stockStore = useStockStore()
  const settingsStore = useSettingsStore()

  let currentBaseDay = getBusinessDay()

  let checkTimer: number | null = null

  let rebuilding = false

  async function checkCrossDay(): Promise<void> {
    const baseDay = getBusinessDay()
    if (baseDay === currentBaseDay) return
    if (rebuilding) return
    rebuilding = true
    currentBaseDay = baseDay
    try {
      await rebuildFundModuleOnCrossDay()

      indexStore.indexQuotes = new Map()
      stockStore.quoteMap = new Map()
      await indexStore.refresh()
      await stockStore.refresh()

      if (settingsStore.enableManagerCheck) {
        await checkManagerChanges()
      }
    } finally {
      rebuilding = false
    }
  }

  async function onVisibilityChange(): Promise<void> {
    if (document.visibilityState === 'visible') {
      await checkCrossDay()
    }
  }

  function startTimer(): void {
    stopTimer()

    checkTimer = window.setInterval(checkCrossDay, 30 * 1000)
  }

  function stopTimer(): void {
    if (checkTimer !== null) {
      clearInterval(checkTimer)
      checkTimer = null
    }
  }

  function onPageShow(): void {
    void onVisibilityChange()
  }

  onMounted(() => {
    startTimer()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
  })

  onUnmounted(() => {
    stopTimer()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pageshow', onPageShow)
  })

  onActivated(() => {
    checkCrossDay()
    startTimer()
  })

  onDeactivated(() => {
    stopTimer()
  })

  return { checkCrossDay }
}
