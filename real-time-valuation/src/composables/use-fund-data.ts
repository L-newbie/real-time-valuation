

import { computed } from 'vue'
import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import type { IntradayPoint } from '@/modules/fund/fund-types'
import type { StatsValuation } from '@/modules/holding/holding-types'
import { ChangeDirection } from '@/config/enums'
import { safeParseFloat, displayRate, roundMoney } from '@/shared/utils/safe-math'
import { formatValuationTime, formatHoldingDate } from '@/shared/utils/date-format'
import { getPreviousTradingDay, getBeijingTodayStr, isCnTradingDay, getBusinessDay, getPreviousBusinessTradingDay, getPreviousCalendarTradingDay } from '@/modules/fund/valuation/cn-trading-day'
import { currentMinuteTick } from '@/composables/use-clock-tick'
import { keepTodayPoints } from '@/modules/fund/intraday/intraday-points'

export interface FundRowData {
  fundCode: string
  fundName: string
  lastNetValue: number
  currentNav: number
  changeRate: number
  netChangeRate: number
  lastNetChangeRate: number | null
  changeDirection: ChangeDirection
  holdingAmount: number
  costPrice: number
  todayProfit: number
  totalProfit: number
  totalReturnRate: number | null
  profitStatus: string
  valuationTime: string
  holdingDate: string
  isEstimated?: boolean
  isUpdated?: boolean
  delayDays?: 1 | 2

  hasTodayData?: boolean

  hasHoldingsRatio?: boolean
  realtimeGszzl?: number
  realtimeSource?: string
  realtimeUpdatedAt?: string

  realtimePlaceholder?: boolean
  intradayPoints: IntradayPoint[]
  intradayBaseValue: number
}

function computeIntradayBase(v: { dwjz: number; delayDays?: 1 | 2; gztime?: string; gszzl: number; isEstimated?: boolean } | undefined): number {
  if (!v || v.dwjz <= 0) return 0
  const isT2 = v.delayDays === 2 || (v.delayDays == null && !!v.gztime && !v.gztime.includes(':'))
  if (isT2) return v.dwjz
  if (v.gszzl !== 0 && !v.isEstimated) return v.dwjz / (1 + v.gszzl / 100)
  return v.dwjz
}

export function useFundData() {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const settingsStore = useSettingsStore()
  const groupStore = useGroupStore()

  const minuteTick = currentMinuteTick()

  const fundRows = computed<FundRowData[]>(() => {
    void minuteTick.value
    return groupStore.activeCodes.map(code => {
      try {
        const v = fundStore.getValuation(code)
        const gszzl = v?.gszzl || 0
        const displayGszzl = displayRate(gszzl)
        const isEstimated = v?.isEstimated ?? true
        const today = getBusinessDay()

        const expectedConfirmDate = v?.delayDays === 2 ? getPreviousBusinessTradingDay() : today

        const isUpdated = v?.delayDays === 2
          ? (!isEstimated && v?.jzrq != null && v.jzrq >= getPreviousCalendarTradingDay())
          : (v?.jzrq != null && v.jzrq >= expectedConfirmDate)

        const resolvedName = fundStore.resolveFundName(code)
        const fundName = resolvedName === code ? '--' : resolvedName

        const currentNav = v?.dwjz ?? v?.prevConfirmedNav ?? 0
        const confirmedRate = isEstimated ? (v?.confirmedGszzl ?? 0) : (v?.gszzl ?? 0)

        const todayProfit = holdingStore.calcFundTodayProfit(code, displayGszzl, v?.dwjz, gszzl, isEstimated, holdingStore.resolveGszzlDate(v))
        const baseAmount = holdingStore.getFundHoldingAmount(code, v?.dwjz, gszzl, isEstimated)
        const principal = holdingStore.getPrincipal(code)
        const holdingAmount = baseAmount
        const totalProfit = roundMoney(holdingAmount - principal)
        const totalReturnRate: number | null = principal > 0 ? displayRate(totalProfit / principal * 100) : null

        const valTime = !isCnTradingDay()
          ? getPreviousTradingDay()
          : v?.delayDays === 2
            ? getPreviousTradingDay()
            : (v?.isEstimated ? (v.gztime ?? '') : getBeijingTodayStr())

        const profitStatus = totalReturnRate != null
          ? (totalReturnRate > 0 ? 'profit' : totalReturnRate < 0 ? 'loss' : 'flat')
          : 'flat'

        const estHoldings = fundStore.estimatedHoldingsCache.get(code)?.data

        const hasHoldingsForEstimate = v?.delayDays === 2
          ? !!estHoldings && estHoldings.holdings.length > 0
          : false
        const hasTodayData = gszzl !== 0 || (!!v?.gztime)
          || (v?.jzrq != null && v.jzrq >= expectedConfirmDate)
          || hasHoldingsForEstimate

        const hasHoldingsRatio = !!estHoldings && estHoldings.holdings.some(h => (h.ratio ?? 0) > 0)

        return {
          fundCode: code,
          fundName,
          lastNetValue: v?.prevConfirmedNav ?? 0,
          currentNav,
          changeRate: safeParseFloat(displayGszzl),

          netChangeRate: safeParseFloat(displayRate(confirmedRate || (v?.prevConfirmedGszzl ?? 0))),
          lastNetChangeRate: v?.prevConfirmedGszzl == null ? null : safeParseFloat(displayRate(v.prevConfirmedGszzl)),
          changeDirection: displayGszzl > 0 ? ChangeDirection.Rise : displayGszzl < 0 ? ChangeDirection.Fall : ChangeDirection.Flat,
          holdingAmount,
          costPrice: holdingStore.getAvgCostPrice(code),
          todayProfit,
          totalProfit,
          totalReturnRate,
          profitStatus,
          valuationTime: formatValuationTime(valTime),
          holdingDate: formatHoldingDate(holdingStore.activeHoldings.find(h => h.fundCode === code)?.holdingDate ?? ''),
          isEstimated,
          isUpdated,
          hasTodayData,
          hasHoldingsRatio,
          delayDays: v?.delayDays ?? 1,

          realtimeGszzl: settingsStore.enablePrediction ? v?.realtimeGszzl : undefined,
          realtimeSource: settingsStore.enablePrediction ? v?.realtimeSource : undefined,
          realtimeUpdatedAt: settingsStore.enablePrediction ? v?.realtimeUpdatedAt : undefined,

          realtimePlaceholder: settingsStore.enablePrediction && v?.realtimeGszzl === 0 && !v?.realtimeUpdatedAt &&
            v?.realtimeSource === '实时',

          intradayPoints: keepTodayPoints(fundStore.intradayMap[code]),
          intradayBaseValue: computeIntradayBase(v),
        }
      } catch {
        return {
          fundCode: code, fundName: '--', lastNetValue: 0, currentNav: 0,
          changeRate: 0, netChangeRate: 0, lastNetChangeRate: null, changeDirection: ChangeDirection.Flat,
          holdingAmount: 0, costPrice: 0, todayProfit: 0, totalProfit: 0,
          totalReturnRate: null, profitStatus: 'flat', valuationTime: '', holdingDate: '',
          isEstimated: true, isUpdated: false, hasTodayData: false, delayDays: 1,
          intradayPoints: [], intradayBaseValue: 0,
        }
      }
    })
  })

  const sortedFundRows = computed<FundRowData[]>(() => {
    const rows = [...fundRows.value]
    const field = fundStore.sortField
    const dir = fundStore.sortDirection === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      const valA = (a as any)[field] ?? 0
      const valB = (b as any)[field] ?? 0
      if (typeof valA === 'string') return valA.localeCompare(valB) * dir
      return (valA - valB) * dir
    })
    return rows
  })

  const dashboardStats = computed(() => {
    const vMap = new Map<string, StatsValuation>()
    for (const [code, v] of fundStore.valuationMap) {
      vMap.set(code, {
        gz: v.gz, dwjz: v.dwjz, gszzl: v.gszzl, isEstimated: v.isEstimated, jzrq: v.jzrq, delayDays: v.delayDays,
        realtimeGszzl: settingsStore.enablePrediction ? v.realtimeGszzl : undefined,
        realtimeSource: settingsStore.enablePrediction ? v.realtimeSource : undefined,
        realtimeUpdatedAt: settingsStore.enablePrediction ? v.realtimeUpdatedAt : undefined,
      })
    }
    return holdingStore.getDashboardStats(vMap)
  })

  async function refreshData(): Promise<void> {
    await fundStore.refreshAllValuations()
  }

  return { fundRows, sortedFundRows, dashboardStats, refreshData, fundStore, holdingStore }
}
