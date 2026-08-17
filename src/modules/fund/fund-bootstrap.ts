

import { useFundStore } from '@/modules/fund/fund-store'
import { useCacheStore } from '@/modules/fund/cache-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { getCatalogFundName } from '@/modules/fund/catalog/fund-code-catalog'
import { fetchFundCodeCatalog } from '@/modules/fund/catalog/fund-code-catalog'
import { startEmCloseLoop, stopEmCloseLoop } from '@/modules/fund/services/em-close-service'
import { startEmRealtimeLoop, stopEmRealtimeLoop } from '@/modules/fund/services/em-realtime-service'
import { startYahooLoop, stopYahooLoop } from '@/modules/fund/services/yahoo-service'
import { loadHolidays, reloadHolidays } from '@/modules/fund/services/holiday-service'
import { workerManager } from '@/shared/worker/worker-manager'
import { runConcurrent } from '@/shared/net/rate-limiter'
import { FUND_VALUATION_CONFIG } from '@/config/constants'

let started = false

export async function startFundModule(): Promise<void> {
  if (started) return
  started = true

  const store = useFundStore()

  store.restoreLastBusinessDay()
  store.restoreFundCodes()
  store.restoreFundNames()
  store.restoreColumnConfig()

  // 必须排在 restoreFundCodes 之后：首次升级要拿现有全集做「自选」组的种子。
  const groupStore = useGroupStore()
  groupStore.restoreGroups(store.fundCodes)

  const holdingStore = useHoldingStore()
  holdingStore.restoreHoldings()
  holdingStore.restoreActions()
  holdingStore.restorePendingActions()

  store.restoreStockCaches()

  store.restoreEstimatedHoldingsCache()

  store.restoreT1HoldingsCache()

  store.restoreEstimatedGszzlMap()

  store.restoreIntradayMap()

  const cacheStore = useCacheStore()
  cacheStore.restoreCache()
  cacheStore.clearExpiredCache()
  store.seedFromCache(cacheStore.cacheMap)

  store.expireCrossDayValuations()
  store.recomputeAllFromCache()

  if (store.fundCodes.length === 0) return

  const missingNames = store.fundCodes.filter(code => !store.getFundName(code))
  if (missingNames.length > 0) {
    void fetchFundCodeCatalog()
    .then(() => {
      for (const code of missingNames) {
        if (store.getFundName(code)) continue
        const name = getCatalogFundName(code)
        if (name) store.setFundName(code, name)
      }
    })
    .catch(() => {  })
  }

  void loadHolidays().catch(() => {  })
  try {
    await store.refreshAllValuations()
    const holdingStore = useHoldingStore()

    void holdingStore.recalibrateHoldingsFromNav().catch(() => {  })

    for (const [code, valuation] of store.valuationMap) {
      store.updateIntradayPoints(code, valuation)
    }

    void store.fetchIntradayHistory().catch(() => {  })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[fund-bootstrap] 估值刷新异常', e)
  }

  const preloadFunds = store.fundCodes.filter(code => {
    const d = store.getValuation(code)?.delayDays
    return d === 1 || d === 2
  })
  void runConcurrent(preloadFunds, FUND_VALUATION_CONFIG.BATCH_CONCURRENCY, async (code) => {
    try { await store.getEstimatedHoldings(code, async () => new Map()) } catch {  }
    if (store.getValuation(code)?.delayDays === 1) {
      try { await store.getT1Holdings(code) } catch {  }
    }
  })

  startEmCloseLoop()
  startEmRealtimeLoop()
  startYahooLoop()
}

export function stopFundModule(): void {
  stopEmCloseLoop()
  stopEmRealtimeLoop()
  stopYahooLoop()
}

export async function rebuildFundModuleOnCrossDay(): Promise<void> {
  stopFundModule()
  workerManager.rebuildAllWorkers()
  const store = useFundStore()
  store.clearCrossDayCaches()
  reloadHolidays()
  started = false
  await startFundModule()
}
