

import { ref, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { isCnTradingDay, getBeijingTodayStr } from '@/modules/fund/valuation/cn-trading-day'
import { beijingNow } from '@/shared/utils/date-format'

const POST_MARKET_INTERVAL_MS = 5 * 60 * 1000

const NON_TRADING_DAY_MIN_GAP_MS = 60 * 60 * 1000

const VISIBILITY_REFRESH_MIN_GAP_MS = 10 * 1000

const NON_TRADING_DAY_VISIBILITY_GAP_MS = 30 * 60 * 1000

function isTradingHours(): boolean {
  const d = beijingNow()
  const day = d.day()
  if (day === 0 || day === 6) return false
  const timeStr = d.format('HH:mm')
  return (timeStr >= '09:30' && timeStr <= '11:30') ||
         (timeStr >= '13:00' && timeStr <= '16:00')
}

export function useAutoRefresh() {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const settingsStore = useSettingsStore()

  let timerId: number | null = null

  let postMarketTimerId: number | null = null

  let activatedOnce = false

  const inTradingHours = ref(isTradingHours())

  function hasUnconfirmedFunds(): boolean {
    return fundStore.fundCodes.some(code => {
      const v = fundStore.getValuation(code)
      return v == null || v.isEstimated !== false
    })
  }

  function hasPendingT2(): boolean {
    return fundStore.fundCodes.some(code => {
      const v = fundStore.getValuation(code)
      return v?.delayDays === 2 && v.isEstimated !== false
    })
  }

  function sweepStaleRealtime(): void {
    if (fundStore.expireStaleRealtimeCache()) fundStore.recomputeAllFromCache()
  }

  async function tradingHoursRefresh(): Promise<void> {
    inTradingHours.value = isTradingHours()
    sweepStaleRealtime()

    const t2Pending = hasPendingT2()
    if ((!inTradingHours.value || !isCnTradingDay()) && !t2Pending) return
    await fundStore.refreshAllValuations()

    void holdingStore.executePendingActions(fundStore.valuationMap).catch(() => {  })
  }

  function startAutoRefresh(): void {
    stopAutoRefresh()
    const intervalMs = settingsStore.refreshInterval * 1000
    timerId = window.setInterval(tradingHoursRefresh, intervalMs)
  }

  function stopAutoRefresh(): void {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
  }

  async function postMarketPoll(): Promise<void> {
    sweepStaleRealtime()
    if (isTradingHours() && isCnTradingDay()) return

    const hasDuePending = holdingStore.pendingOnly.some(a => a.scheduledDate <= getBeijingTodayStr())

    if (!hasUnconfirmedFunds()) {
      if (hasDuePending) {
        void holdingStore.executePendingActions(fundStore.valuationMap).catch(() => {  })
      }
      return
    }

    if (!isCnTradingDay() && Date.now() - fundStore.lastRefreshTime < NON_TRADING_DAY_MIN_GAP_MS) {
      if (hasDuePending) {
        void holdingStore.executePendingActions(fundStore.valuationMap).catch(() => {  })
      }
      return
    }

    await fundStore.refreshAllValuations()
    void holdingStore.executePendingActions(fundStore.valuationMap).catch(() => {  })
  }

  function startPostMarketPoll(): void {
    stopPostMarketPoll()
    postMarketTimerId = window.setInterval(postMarketPoll, POST_MARKET_INTERVAL_MS)
  }

  function stopPostMarketPoll(): void {
    if (postMarketTimerId !== null) {
      clearInterval(postMarketTimerId)
      postMarketTimerId = null
    }
  }

  async function refreshOnVisible(): Promise<void> {
    if (!settingsStore.autoRefresh) return
    if (document.visibilityState !== 'visible') return
    if (fundStore.fundCodes.length === 0) return

    sweepStaleRealtime()

    fundStore.expireCrossDayValuations()
    const gap = Date.now() - fundStore.lastRefreshTime
    if (gap >= 0 && gap < VISIBILITY_REFRESH_MIN_GAP_MS) return

    if (!isCnTradingDay() && !hasUnconfirmedFunds()
        && gap >= 0 && gap < NON_TRADING_DAY_VISIBILITY_GAP_MS) return

    await fundStore.refreshAllValuations()
    void holdingStore.executePendingActions(fundStore.valuationMap).catch(() => {  })

    void holdingStore.recalibrateHoldingsFromNav().catch(() => {  })
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void refreshOnVisible()
    }
  }

  function toggleAutoRefresh(enabled?: boolean): void {
    settingsStore.autoRefresh = enabled ?? !settingsStore.autoRefresh
    if (settingsStore.autoRefresh) {
      startAutoRefresh()
      startPostMarketPoll()
    } else {
      stopAutoRefresh()
      stopPostMarketPoll()
    }
  }

  watch(() => settingsStore.refreshInterval, () => {
    if (settingsStore.autoRefresh) {
      startAutoRefresh()
    }
  })

  watch(() => settingsStore.autoRefresh, (enabled) => {
    if (enabled) {
      startAutoRefresh()
      startPostMarketPoll()
    } else {
      stopAutoRefresh()
      stopPostMarketPoll()
    }
  })

  function onPageShow(): void {
    onVisibilityChange()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    if (settingsStore.autoRefresh) {
      startAutoRefresh()

      startPostMarketPoll()
    }

    if (fundStore.valuationMap.size === 0 && fundStore.fundCodes.length > 0) {
      setTimeout(() => {
        fundStore.refreshAllValuations().then(() => {
          void holdingStore.executePendingActions(fundStore.valuationMap).catch(() => {  })
        })
      }, 300)
    }
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pageshow', onPageShow)
    stopAutoRefresh()
    stopPostMarketPoll()
  })

  onActivated(() => {
    const isReactivation = activatedOnce
    activatedOnce = true

    if (settingsStore.autoRefresh) {
      stopAutoRefresh()
      stopPostMarketPoll()
      startAutoRefresh()
      startPostMarketPoll()

      if (isReactivation) void refreshOnVisible()
    }
  })

  onDeactivated(() => {
  })

  return {
    inTradingHours,
    toggleAutoRefresh,
    startAutoRefresh,
    stopAutoRefresh,
  }
}
