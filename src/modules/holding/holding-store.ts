

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import type { Holding, FundValuation } from '@/modules/fund/fund-types'
import type { HoldingAction, PendingAction, DashboardStats, StatsValuation } from './holding-types'
import { HoldingActionType, PendingActionStatus } from './holding-types'
import { beijingNow } from '@/shared/utils/date-format'
import { dropTradeMarks, dropAllTradeMarks, findDateByNav } from './trade-marks'
import { ProfitStatus } from '@/config/enums'
import { STORAGE_KEYS, FUND_VALUATION_CONFIG } from '@/config/constants'
import { safeParseFloat, roundMoney, displayRate } from '@/shared/utils/safe-math'
import { generateId } from '@/shared/utils/validation'
import { runConcurrent } from '@/shared/net/rate-limiter'
import { loadJSON, saveJSON, loadString, saveString } from '@/shared/cache/local-storage-io'
import { getBeijingTodayStr, getNowStr, getPreviousNTradingDay, getTradingDayFromToday } from '@/modules/fund/valuation/cn-trading-day'
import { peekNavSeries } from '@/modules/fund/perf/perf-intervals'
import { useGroupStore } from '@/modules/group/group-store'
import { BUILTIN_GROUP_WATCH } from '@/modules/group/group-types'

const HOLDINGS_DATA_VERSION = 4

const MAX_PENDING_ATTEMPTS = 10

export const useHoldingStore = defineStore('holding', () => {
  const holdings = ref<Holding[]>([])

  const actions = ref<HoldingAction[]>([])

  const pendingActions = ref<PendingAction[]>([])

  let restored = false

  function currentGroupId(): string {
    try {
      return useGroupStore().activeGroupId || BUILTIN_GROUP_WATCH
    } catch {
      return BUILTIN_GROUP_WATCH
    }
  }

  function inGroup(item: { groupId?: string }, groupId: string): boolean {
    return (item.groupId ?? BUILTIN_GROUP_WATCH) === groupId
  }

  const activeHoldings = computed(() => {
    const gid = currentGroupId()
    return holdings.value.filter(h => !h.settled && inGroup(h, gid))
  })

  const settledHoldings = computed(() => {
    const gid = currentGroupId()
    return holdings.value.filter(h => h.settled && inGroup(h, gid))
  })

  const pendingOnly = computed(() => {
    const gid = currentGroupId()
    return pendingActions.value.filter(a =>
      a.status === PendingActionStatus.Pending && inGroup(a, gid),
    )
  })

  const pendingOrFailed = computed(() => {
    const gid = currentGroupId()
    return pendingActions.value.filter(a =>
      (a.status === PendingActionStatus.Pending || a.status === PendingActionStatus.Failed) &&
      inGroup(a, gid),
    )
  })

  const holdingsByFund = computed(() => {
    const m = new Map<string, Holding[]>()
    for (const h of activeHoldings.value) {
      const arr = m.get(h.fundCode)
      if (arr) arr.push(h)
      else m.set(h.fundCode, [h])
    }
    return m
  })

  const groupActions = computed(() => {
    const gid = currentGroupId()
    return actions.value.filter(a => inGroup(a, gid))
  })

  const groupPendingActions = computed(() => {
    const gid = currentGroupId()
    return pendingActions.value.filter(a => inGroup(a, gid))
  })

  function getPendingByFund(fundCode: string): PendingAction[] {
    return pendingOrFailed.value.filter(a => a.fundCode === fundCode)
  }
  function getHoldingsByFund(fundCode: string): Holding[] {
    return holdingsByFund.value.get(fundCode) ?? []
  }
  function getTotalShares(fundCode: string): number {
    const list = holdingsByFund.value.get(fundCode)
    if (!list) return 0
    let sum = 0
    for (const h of list) sum += h.shares
    return sum
  }
  function getAvgCostPrice(fundCode: string): number {
    const list = holdingsByFund.value.get(fundCode)
    if (!list || list.length === 0) return 0
    let totalCost = 0, totalShares = 0
    for (const h of list) { totalCost += h.shares * h.costPrice; totalShares += h.shares }
    return totalShares > 0 ? totalCost / totalShares : 0
  }
  function getPrincipal(fundCode: string): number {
    const list = holdingsByFund.value.get(fundCode)
    if (!list) return 0
    let sum = 0
    for (const h of list) sum += h.initialAmount ?? h.shares * h.costPrice
    return sum
  }

  function displayRateSafe(gszzl?: number | null): number {
    if (gszzl == null || !Number.isFinite(gszzl)) return 0
    return displayRate(gszzl)
  }

  function getYesterdayHoldingAmount(fundCode: string): number {
    const list = holdingsByFund.value.get(fundCode)
    if (!list) return 0
    let sum = 0
    for (const h of list) sum += h.yesterdayAmount ?? h.initialAmount ?? h.shares * h.costPrice
    return sum
  }

  function getFundHoldingAmount(fundCode: string, _dwjz?: number, _gszzl?: number, _isEstimated?: boolean): number {
    const base = getYesterdayHoldingAmount(fundCode)

    if (_isEstimated === false && _gszzl && _gszzl !== 0) {
      const list = holdingsByFund.value.get(fundCode) ?? []
      let totalConfirmedBase = 0
      for (const h of list) totalConfirmedBase += h.confirmedBaseAmount ?? 0
      if (totalConfirmedBase === 0) {
        return roundMoney(base * (1 + displayRateSafe(_gszzl) / 100))
      }
    }
    return base
  }

  function getFundAccumulatedProfit(fundCode: string, _dwjz?: number, _gszzl?: number, _isEstimated?: boolean): number {
    return roundMoney(getFundHoldingAmount(fundCode, _dwjz, _gszzl, _isEstimated) - getPrincipal(fundCode))
  }

  function resolveGszzlDate(v?: { isEstimated?: boolean; jzrq?: string }): string {
    if (v?.isEstimated === false && v.jzrq) return v.jzrq
    return getBeijingTodayStr()
  }

  function getTodayProfitBase(fundCode: string, gszzlDate?: string): number {
    const list = holdingsByFund.value.get(fundCode) ?? []
    let confirmedBase = 0
    let fallbackBase = 0
    for (const h of list) {
      if (gszzlDate && h.entryNavDate && h.entryNavDate >= gszzlDate) continue
      confirmedBase += h.confirmedBaseAmount ?? 0
      fallbackBase += h.yesterdayAmount ?? h.initialAmount ?? h.shares * h.costPrice
    }
    return confirmedBase > 0 ? confirmedBase : fallbackBase
  }

  function calcFundTodayProfit(fundCode: string, _changeRate: number, _dwjz?: number, gszzl?: number, _isEstimated?: boolean, gszzlDate?: string): number {
    const base = getTodayProfitBase(fundCode, gszzlDate)
    if (base <= 0) return 0
    return roundMoney(base * displayRateSafe(gszzl) / 100)
  }

  function calcFundTotalProfit(fundCode: string, _todayProfit: number = 0, _dwjz?: number, gszzl?: number, isEstimated?: boolean): number {
    return getFundAccumulatedProfit(fundCode, _dwjz, gszzl, isEstimated)
  }

  function getProfitStatus(fundCode: string): ProfitStatus {
    const profit = getFundAccumulatedProfit(fundCode)
    if (profit > 0) return ProfitStatus.Profit
    if (profit < 0) return ProfitStatus.Loss
    return ProfitStatus.BreakEven
  }

  function isNavUpdated(v?: StatsValuation): boolean {
    if (!v) return false
    if (v.isEstimated !== false) return false
    return v.jzrq != null && v.jzrq >= getPreviousNTradingDay(1)
  }

  function isPredictionUsable(v?: StatsValuation): boolean {
    if (!v) return false
    if (v.delayDays !== 2) return false
    const rt = v.realtimeGszzl
    if (rt == null || !Number.isFinite(rt)) return false
    if (rt === 0 && !v.realtimeUpdatedAt && v.realtimeSource === '实时') return false
    return true
  }

  function getDashboardStats(
    valuationMap: Map<string, StatsValuation>,
    groupId?: string,
  ): DashboardStats {
    const list = groupId == null
      ? activeHoldings.value
      : holdings.value.filter(h => !h.settled && inGroup(h, groupId))
    return statsFromHoldings(list, valuationMap)
  }

  function statsFromHoldings(
    list: Holding[],
    valuationMap: Map<string, StatsValuation>,
  ): DashboardStats {
    const byFund = new Map<string, Holding[]>()
    for (const h of list) {
      const arr = byFund.get(h.fundCode)
      if (arr) arr.push(h)
      else byFund.set(h.fundCode, [h])
    }

    let totalHoldingAmount = 0, totalProfit = 0, totalCost = 0, todayProfitSum = 0, totalYesterdayAmount = 0
    let predictedProfitSum = 0, predictedBaseSum = 0, predictedFundCount = 0
    for (const [code, hs] of byFund) {
      const v = valuationMap.get(code)

      let principal = 0
      for (const h of hs) principal += h.initialAmount ?? h.shares * h.costPrice
      totalCost += principal

      let base = 0
      for (const h of hs) base += h.yesterdayAmount ?? h.initialAmount ?? h.shares * h.costPrice

      let baseAmount = base
      if (v?.isEstimated === false && v.gszzl && v.gszzl !== 0) {
        let totalConfirmedBase = 0
        for (const h of hs) totalConfirmedBase += h.confirmedBaseAmount ?? 0
        if (totalConfirmedBase === 0) {
          baseAmount = roundMoney(base * (1 + displayRateSafe(v.gszzl) / 100))
        }
      }

      const gszzlDate = resolveGszzlDate(v)
      let confirmedBase = 0, fallbackBase = 0
      for (const h of hs) {
        if (gszzlDate && h.entryNavDate && h.entryNavDate >= gszzlDate) continue
        confirmedBase += h.confirmedBaseAmount ?? 0
        fallbackBase += h.yesterdayAmount ?? h.initialAmount ?? h.shares * h.costPrice
      }
      const todayBase = confirmedBase > 0 ? confirmedBase : fallbackBase
      const todayProfit = todayBase > 0 ? roundMoney(todayBase * displayRateSafe(v?.gszzl) / 100) : 0

      if (isPredictionUsable(v)) {
        const predictBase = isNavUpdated(v) ? baseAmount : roundMoney(baseAmount + todayProfit)
        if (predictBase > 0) {
          predictedProfitSum += roundMoney(predictBase * displayRateSafe(v!.realtimeGszzl) / 100)
          predictedBaseSum += predictBase
          predictedFundCount++
        }
      }

      totalHoldingAmount += baseAmount
      totalProfit += roundMoney(baseAmount - principal)
      todayProfitSum += todayProfit
      totalYesterdayAmount += todayBase
    }

    const overallChangeRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
    const todayReturnRate = totalYesterdayAmount > 0 ? (todayProfitSum / totalYesterdayAmount) * 100 : 0
    const hasPrediction = predictedFundCount > 0 && predictedBaseSum > 0
    return {
      totalHoldingAmount: roundMoney(totalHoldingAmount),
      todayProfit: roundMoney(todayProfitSum),
      totalProfit: roundMoney(totalProfit),
      overallChangeRate: safeParseFloat(displayRate(overallChangeRate)),
      totalCost: roundMoney(totalCost),
      todayReturnRate: safeParseFloat(displayRate(todayReturnRate)),
      predictedProfit: hasPrediction ? roundMoney(predictedProfitSum) : null,
      predictedReturnRate: hasPrediction
        ? safeParseFloat(displayRate((predictedProfitSum / predictedBaseSum) * 100))
        : null,
      predictedFundCount,
    }
  }

  function getAllGroupsStats(
    valuationMap: Map<string, StatsValuation>,
  ): DashboardStats {
    return statsFromHoldings(holdings.value.filter(h => !h.settled), valuationMap)
  }

  function addHoldingByAmount(fundCode: string, amount: number, netValue: number, note?: string, navDate?: string): Holding {
    const shares = netValue > 0 ? amount / netValue : 0
    const holding: Holding = {
      id: generateId(), fundCode, groupId: currentGroupId(), shares, costPrice: netValue,

      holdingDate: navDate || getNowStr(), createdAt: Date.now(), settled: false,
      initialAmount: amount, yesterdayAmount: amount,
      entryNavDate: navDate,
    }
    holdings.value.push(holding)
    logAction({ id: generateId(), fundCode, groupId: holding.groupId, type: HoldingActionType.Add, sharesBefore: 0, sharesAfter: shares, costBefore: 0, costAfter: netValue, timestamp: Date.now(), markDate: navDate || undefined, note })
    persistHoldings()
    return holding
  }

  function resolveEntryMarkDate(fundCode: string, costPrice: number, profit?: number): string | undefined {
    if (!(costPrice > 0)) return undefined
    if (!(profit != null && Math.abs(profit) > 0)) return undefined
    return findDateByNav(peekNavSeries(fundCode), costPrice) || undefined
  }

  function addHoldingDirect(
    fundCode: string, shares: number, costPrice: number,
    _holdingAmtFromUser?: number, _profitFromUser?: number,
    valuation?: { gszzl?: number; isEstimated?: boolean; jzrq?: string },
    skipLog = false,
    groupId?: string,
    markDate?: string,
  ): Holding {
    const holdingAmt = _holdingAmtFromUser ?? (shares * costPrice)
    const profit = _profitFromUser ?? 0
    const initialAmount = holdingAmt - profit

    const yesterdayAmount = holdingAmt
    const gid = groupId ?? currentGroupId()
    const holding: Holding = {
      id: generateId(), fundCode, groupId: gid, shares, costPrice,
      holdingDate: getNowStr(), createdAt: Date.now(), settled: false,
      initialAmount, yesterdayAmount,

      lastConfirmedDate: valuation?.jzrq || undefined,
      confirmedBaseAmount: yesterdayAmount,
    }
    holdings.value.push(holding)
    if (!skipLog) {
      logAction({ id: generateId(), fundCode, groupId: gid, type: HoldingActionType.Edit, sharesBefore: 0, sharesAfter: shares, costBefore: 0, costAfter: costPrice, timestamp: Date.now(), markDate: markDate || resolveEntryMarkDate(fundCode, costPrice, profit) })
    }
    persistHoldings()
    return holding
  }

  function replaceHoldingDirect(
    fundCode: string, shares: number, costPrice: number,
    holdingAmount?: number, accumulatedProfit?: number,
    valuation?: { gszzl?: number; isEstimated?: boolean; jzrq?: string },
    markDate?: string,
  ): Holding {
    const sharesBefore = getTotalShares(fundCode)
    const costBefore = getAvgCostPrice(fundCode)
    const gid = currentGroupId()
    holdings.value = holdings.value.filter(h => h.fundCode !== fundCode || h.settled || !inGroup(h, gid))
    const holding = addHoldingDirect(fundCode, shares, costPrice, holdingAmount, accumulatedProfit, valuation, true)

    logAction({
      id: generateId(), fundCode, groupId: gid, type: HoldingActionType.Edit,
      sharesBefore, sharesAfter: shares, costBefore, costAfter: costPrice,
      timestamp: Date.now(),
      markDate: markDate || resolveEntryMarkDate(fundCode, costPrice, accumulatedProfit),
    })

    immediatePersistHoldings()
    return holding
  }

  function reduceHolding(holdingId: string, reduceShares: number, note?: string, markDate?: string): boolean {
    const idx = holdings.value.findIndex(h => h.id === holdingId)
    if (idx === -1) return false
    const holding = holdings.value[idx]
    if (reduceShares >= holding.shares) return settleHolding(holdingId, note, markDate)
    const sharesBefore = holding.shares, costBefore = holding.costPrice
    const ratio = (holding.shares - reduceShares) / holding.shares
    holding.shares = safeParseFloat(holding.shares - reduceShares)
    if (holding.initialAmount != null) holding.initialAmount = holding.initialAmount * ratio
    if (holding.yesterdayAmount != null) holding.yesterdayAmount = holding.yesterdayAmount * ratio
    logAction({ id: generateId(), fundCode: holding.fundCode, groupId: holding.groupId, type: HoldingActionType.Reduce, sharesBefore, sharesAfter: holding.shares, costBefore, costAfter: holding.costPrice, timestamp: Date.now(), markDate: markDate || undefined, note })
    persistHoldings()
    return true
  }

  function editHolding(holdingId: string, newShares: number, newCostPrice: number, _newHoldingAmount?: number, _newAccumulatedProfit?: number, _newYesterdayHoldingAmount?: number, _yesterdayAmount?: number): boolean {
    const holding = holdings.value.find(h => h.id === holdingId)
    if (!holding) return false
    const sharesBefore = holding.shares, costBefore = holding.costPrice
    holding.shares = newShares
    holding.costPrice = newCostPrice
    const holdingAmt = _yesterdayAmount ?? (newShares * newCostPrice)
    const profit = _newAccumulatedProfit ?? 0
    holding.yesterdayAmount = holdingAmt
    holding.initialAmount = _yesterdayAmount != null ? holdingAmt - profit : (newShares * newCostPrice)
    logAction({ id: generateId(), fundCode: holding.fundCode, groupId: holding.groupId, type: HoldingActionType.Edit, sharesBefore, sharesAfter: newShares, costBefore, costAfter: newCostPrice, timestamp: Date.now() })
    persistHoldings()
    return true
  }

  function settleHolding(holdingId: string, note?: string, markDate?: string): boolean {
    const holding = holdings.value.find(h => h.id === holdingId)
    if (!holding) return false
    const sharesBefore = holding.shares, costBefore = holding.costPrice
    holding.settled = true
    holding.shares = 0
    logAction({ id: generateId(), fundCode: holding.fundCode, groupId: holding.groupId, type: HoldingActionType.Settle, sharesBefore, sharesAfter: 0, costBefore, costAfter: 0, timestamp: Date.now(), markDate: markDate || undefined, note })
    immediatePersistHoldings()
    return true
  }

  function settleAllByFund(fundCode: string): void {
    const gid = currentGroupId()
    for (const h of holdings.value) {
      if (h.fundCode === fundCode && !h.settled && inGroup(h, gid)) settleHolding(h.id)
    }
  }

  function removeHoldingsByFund(fundCode: string, groupId?: string): void {
    const gid = groupId ?? currentGroupId()
    holdings.value = holdings.value.filter(h => h.fundCode !== fundCode || !inGroup(h, gid))
    actions.value = actions.value.filter(a => a.fundCode !== fundCode || !inGroup(a, gid))
    pendingActions.value = pendingActions.value.filter(a => a.fundCode !== fundCode || !inGroup(a, gid))
    dropTradeMarks(gid, fundCode)
    immediatePersistHoldings(); persistActions(); persistPendingActions()
  }

  function removeHoldingsByGroup(groupId: string): void {
    const affected = new Set<string>()
    for (const h of holdings.value) if (inGroup(h, groupId)) affected.add(h.fundCode)

    holdings.value = holdings.value.filter(h => !inGroup(h, groupId))
    actions.value = actions.value.filter(a => !inGroup(a, groupId))
    pendingActions.value = pendingActions.value.filter(a => !inGroup(a, groupId))
    for (const code of affected) dropTradeMarks(groupId, code)
    immediatePersistHoldings(); persistActions(); persistPendingActions()
  }

  function clearAllHoldings(): void {
    holdings.value = []; actions.value = []; pendingActions.value = []
    dropAllTradeMarks()
    immediatePersistHoldings(); persistActions(); persistPendingActions()
  }

  function resolveScheduledDate(delayDays: number): string {
    return getTradingDayFromToday(Math.max(0, delayDays - 1))
  }

  function createPendingAdd(fundCode: string, amount: number, referenceNav: number, delayDays: number = 1, note?: string): PendingAction {
    const action: PendingAction = {
      id: generateId(), fundCode, groupId: currentGroupId(), type: 'add', amount, referenceNav,
      scheduledDate: resolveScheduledDate(delayDays), operateTime: Date.now(),
      status: PendingActionStatus.Pending, note, createdAt: Date.now(),
    }
    pendingActions.value.push(action)
    persistPendingActions()
    return action
  }
  function createPendingReduce(fundCode: string, reduceShares: number, referenceNav: number, delayDays: number = 1, note?: string): PendingAction {
    const action: PendingAction = {
      id: generateId(), fundCode, groupId: currentGroupId(), type: 'reduce', amount: reduceShares, referenceNav,
      scheduledDate: resolveScheduledDate(delayDays), operateTime: Date.now(),
      status: PendingActionStatus.Pending, note, createdAt: Date.now(),
    }
    pendingActions.value.push(action)
    persistPendingActions()
    return action
  }

  function cancelPendingAction(actionId: string): boolean {
    const action = pendingActions.value.find(a => a.id === actionId)
    if (!action) return false
    if (action.status !== PendingActionStatus.Pending && action.status !== PendingActionStatus.Failed) return false
    action.status = PendingActionStatus.Cancelled
    persistPendingActions()
    return true
  }

  async function executePendingActions(valuationMap: Map<string, FundValuation>): Promise<void> {
    const today = getBeijingTodayStr()
    let changed = false
    const { fetchFundNetValueRange } = await import('@/modules/fund/valuation/net-value-range')

    async function resolveConfirmedNav(action: PendingAction): Promise<{ nav: number; navDate: string; noNavInRange: boolean } | null> {
      const v = valuationMap.get(action.fundCode)

      if (!v || !v.jzrq || v.jzrq < action.scheduledDate) return null

      if (v.isEstimated === false && v.jzrq === action.scheduledDate && v.dwjz > 0) {
        return { nav: v.dwjz, navDate: v.jzrq, noNavInRange: false }
      }

      const rows = await fetchFundNetValueRange(action.fundCode, action.scheduledDate, today)
      if (rows == null) return null
      const row = rows.find(r => r.date >= action.scheduledDate && r.nav > 0)
      if (!row || row.nav <= 0) return { nav: 0, navDate: '', noNavInRange: true }
      return { nav: row.nav, navDate: row.date, noNavInRange: false }
    }

    function markExecuted(action: PendingAction, nav: number, navDate: string): void {
      action.status = PendingActionStatus.Executed
      action.executedNav = nav
      action.executedNavDate = navDate
      action.executedAt = Date.now()
      action.attemptCount = undefined
      action.lastAttemptDate = undefined
    }

    const reduceGroups = new Map<string, {
      pendingList: PendingAction[]
      totalShares: number

      entries: { action: PendingAction; nav: number; navDate: string }[]
    }>()
    for (const action of pendingActions.value) {
      if (action.status !== PendingActionStatus.Pending) continue
      if (action.type !== 'reduce') continue
      if (action.scheduledDate > today) continue
      const v = valuationMap.get(action.fundCode)
      const navNotReady = !v || !v.jzrq || v.jzrq < action.scheduledDate
      if (navNotReady) {
        if (markFailedIfExpired(action, '计划日确认净值长时间未公布')) changed = true
        continue
      }
      const resolved = await resolveConfirmedNav(action)
      if (!resolved) continue
      if (resolved.noNavInRange) {
        if (markFailedIfExpired(action, '确认净值未公布或基金长期停牌')) changed = true
        continue
      }
      const existing = reduceGroups.get(action.fundCode)
      if (existing) {
        existing.pendingList.push(action)
        existing.totalShares += action.amount
        existing.entries.push({ action, nav: resolved.nav, navDate: resolved.navDate })
      } else {
        reduceGroups.set(action.fundCode, {
          pendingList: [action],
          totalShares: action.amount,
          entries: [{ action, nav: resolved.nav, navDate: resolved.navDate }],
        })
      }
    }
    for (const [fundCode, group] of reduceGroups) {
      const lastEntry = group.entries[group.entries.length - 1]
      const note = group.pendingList.every(a => a.note === group.pendingList[0]?.note)
        ? group.pendingList[0]?.note
        : group.pendingList.map(a => a.note).filter(Boolean).join('；')

      const reduced = reduceSharesAcrossHoldings(
        fundCode, group.totalShares,
        note ?? `合并减仓 ${group.totalShares} 份`,
        lastEntry?.navDate,
      )

      for (const entry of group.entries) {
        markExecuted(entry.action, entry.nav, entry.navDate)
      }
      if (reduced > 0) changed = true
    }

    for (const action of pendingActions.value) {
      if (action.status !== PendingActionStatus.Pending) continue
      if (action.type !== 'add') continue
      if (action.scheduledDate > today) continue
      const v = valuationMap.get(action.fundCode)
      const navNotReady = !v || !v.jzrq || v.jzrq < action.scheduledDate
      if (navNotReady) {
        if (markFailedIfExpired(action, '计划日确认净值长时间未公布')) changed = true
        continue
      }
      const resolved = await resolveConfirmedNav(action)
      if (!resolved) continue
      if (resolved.noNavInRange) {
        if (markFailedIfExpired(action, '确认净值未公布或基金长期停牌')) changed = true
        continue
      }

      addHoldingByAmount(action.fundCode, action.amount, resolved.nav, action.note, resolved.navDate || action.scheduledDate)
      markExecuted(action, resolved.nav, resolved.navDate)
      changed = true
    }

    if (changed) persistPendingActions()
  }

  function markFailedIfExpired(action: PendingAction, reason: string): boolean {
    const today = getBeijingTodayStr()

    if (today <= action.scheduledDate) return false

    if (action.lastAttemptDate === today) return false
    action.lastAttemptDate = today
    action.attemptCount = (action.attemptCount ?? 0) + 1
    if (action.attemptCount < MAX_PENDING_ATTEMPTS) return true
    action.status = PendingActionStatus.Failed
    action.failedReason = reason
    return true
  }

  function reduceSharesAcrossHoldings(fundCode: string, reduceShares: number, note?: string, markDate?: string): number {
    let remaining = reduceShares
    let reduced = 0

    const list = [...getHoldingsByFund(fundCode)].sort((a, b) => a.createdAt - b.createdAt)
    for (const h of list) {
      if (remaining <= 0) break
      const take = Math.min(remaining, h.shares)
      if (take <= 0) continue
      if (take >= h.shares) {
        settleHolding(h.id, note, markDate)
      } else {
        reduceHolding(h.id, take, note, markDate)
      }
      remaining = safeParseFloat(remaining - take)
      reduced += take
    }
    return reduced
  }

  function syncYesterdayAmounts(valuationMap: Map<string, FundValuation>): void {
    let changed = false
    for (const h of activeHoldings.value) {
      const v = valuationMap.get(h.fundCode)
      if (!v || v.dwjz <= 0) continue

      if (!h.lastConfirmedDate) {
        const principal = h.initialAmount ?? roundMoney(h.shares * h.costPrice)
        const existingAmount = (h.yesterdayAmount != null && h.yesterdayAmount > 0) ? h.yesterdayAmount : null
        const base = existingAmount ?? principal
        h.confirmedBaseAmount = base
        if (existingAmount == null) h.yesterdayAmount = base
        h.lastConfirmedDate = v.jzrq || ''
        changed = true
        continue
      }

      if (v.isEstimated !== false) continue
      if (!v.jzrq || v.jzrq <= h.lastConfirmedDate) continue

      const prevTdOfJzrq = getPreviousNTradingDay(1, dayjs(v.jzrq))
      if (h.lastConfirmedDate !== prevTdOfJzrq) continue

      const oldAmount = h.yesterdayAmount ?? h.initialAmount ?? h.shares * h.costPrice
      h.confirmedBaseAmount = oldAmount
      h.yesterdayAmount = roundMoney(oldAmount * (1 + displayRateSafe(v.gszzl) / 100))
      h.lastConfirmedDate = v.jzrq
      changed = true
    }
    if (changed) immediatePersistHoldings()
  }

  async function replayGappedHoldings(valuationMap: Map<string, FundValuation>): Promise<void> {
    const targets: { h: Holding; v: FundValuation; baseDate: string }[] = []
    for (const h of activeHoldings.value) {
      const v = valuationMap.get(h.fundCode)
      if (!v || v.dwjz <= 0) continue
      if (v.isEstimated !== false) continue
      if (!h.lastConfirmedDate) continue
      if (!v.jzrq || v.jzrq <= h.lastConfirmedDate) continue
      const prevTdOfJzrq = getPreviousNTradingDay(1, dayjs(v.jzrq))
      if (h.lastConfirmedDate === prevTdOfJzrq) continue
      targets.push({ h, v, baseDate: h.lastConfirmedDate })
    }
    if (targets.length === 0) return
    const { fetchFundNetValueRange } = await import('@/modules/fund/valuation/net-value-range')
    let changed = false
    for (const { h, v, baseDate } of targets) {
      try {
        const rows = await fetchFundNetValueRange(h.fundCode, baseDate, v.jzrq!)
        if (rows == null || rows.length < 2) continue
        const startIdx = rows[0].date <= baseDate ? 1 : 0
        const oldAmount = h.yesterdayAmount ?? h.initialAmount ?? h.shares * h.costPrice
        let base = oldAmount
        for (let i = startIdx; i < rows.length - 1; i++) {
          const rate = resolveGrowth(rows[i], rows[i - 1])
          base = roundMoney(base * (1 + rate / 100))
        }
        h.confirmedBaseAmount = base
        const lastIdx = rows.length - 1
        const lastRate = resolveGrowth(rows[lastIdx], rows[lastIdx - 1])
        h.yesterdayAmount = roundMoney(base * (1 + lastRate / 100))
        h.lastConfirmedDate = v.jzrq
        changed = true
      } catch {
        const oldAmount = h.yesterdayAmount ?? h.initialAmount ?? h.shares * h.costPrice
        h.confirmedBaseAmount = oldAmount
        h.yesterdayAmount = roundMoney(oldAmount * (1 + displayRateSafe(v.gszzl) / 100))
        h.lastConfirmedDate = v.jzrq
        changed = true
      }
    }
    if (changed) immediatePersistHoldings()
  }

  async function recalibrateHoldingsFromNav(): Promise<void> {
    const active = activeHoldings.value
    if (active.length === 0) return

    const byFund = new Map<string, typeof active>()
    for (const h of active) {
      const arr = byFund.get(h.fundCode) ?? []
      arr.push(h)
      byFund.set(h.fundCode, arr)
    }
    const { computeAccumulatedAmountFromRatesWithDate } = await import(
      '@/modules/fund/valuation/accumulated-amount'
    )
    let changed = false

    await runConcurrent(Array.from(byFund.entries()), FUND_VALUATION_CONFIG.BATCH_CONCURRENCY, async ([, list]) => {
      try {
        const results: Array<{ amount: number; lastConfirmedDate: string } | null> = []
        for (const h of list) {
          const principal = h.initialAmount ?? roundMoney(h.shares * h.costPrice)
          if (principal <= 0) { results.push(null); continue }
          results.push(await computeAccumulatedAmountFromRatesWithDate(h.fundCode, h.holdingDate, principal))
        }
        list.forEach((h, i) => {
          const r = results[i]
          if (!r || !Number.isFinite(r.amount) || r.amount <= 0) return

          const principal = h.initialAmount ?? roundMoney(h.shares * h.costPrice)
          if (r.amount === principal && h.yesterdayAmount != null && h.yesterdayAmount > 0 && h.yesterdayAmount !== principal) {
            return
          }
          if (r.lastConfirmedDate && r.lastConfirmedDate > (h.lastConfirmedDate ?? '')) {
            h.lastConfirmedDate = r.lastConfirmedDate
            changed = true
          }
          if (Math.abs((h.yesterdayAmount ?? 0) - r.amount) > 0.005) {
            h.confirmedBaseAmount = h.yesterdayAmount ?? r.amount
            h.yesterdayAmount = r.amount
            changed = true
          }
        })
      } catch {  }
    })
    if (changed) immediatePersistHoldings()
  }

  function resolveGrowth(row: { growth: number | null; nav: number }, prevRow: { nav: number } | undefined): number {
    if (Number.isFinite(row.growth)) return displayRateSafe(row.growth)
    if (prevRow && prevRow.nav > 0) return displayRateSafe((row.nav - prevRow.nav) / prevRow.nav * 100)
    return 0
  }

  function logAction(action: HoldingAction): void {
    actions.value.push({ ...action, groupId: action.groupId ?? currentGroupId() })
    persistActions()
  }
  function getActionsByFund(fundCode: string): HoldingAction[] {
    const gid = currentGroupId()
    return actions.value.filter(a => a.fundCode === fundCode && inGroup(a, gid))
  }

  let persistHoldingsTimer: ReturnType<typeof setTimeout> | null = null
  function persistHoldings(): void {
    if (!restored) return
    if (persistHoldingsTimer) clearTimeout(persistHoldingsTimer)
    persistHoldingsTimer = setTimeout(() => {
      saveJSON(STORAGE_KEYS.HOLDINGS, holdings.value)
      persistHoldingsTimer = null
    }, 2000)
  }
  function immediatePersistHoldings(): void {
    if (persistHoldingsTimer) { clearTimeout(persistHoldingsTimer); persistHoldingsTimer = null }
    saveJSON(STORAGE_KEYS.HOLDINGS, holdings.value)
  }
  function persistActions(): void {
    if (actions.value.length > 100) actions.value = actions.value.slice(-100)
    saveJSON(STORAGE_KEYS.HOLDING_ACTIONS, actions.value)
  }
  function persistPendingActions(): void {
    saveJSON(STORAGE_KEYS.PENDING_ACTIONS, pendingActions.value)
  }

  function restoreHoldings(): void {
    const storedVersion = loadString(STORAGE_KEYS.HOLDINGS_VERSION)
    const needsMigration = !storedVersion || parseInt(storedVersion) < HOLDINGS_DATA_VERSION
    const list = loadJSON<Holding[] | null>(STORAGE_KEYS.HOLDINGS, null)
    if (!Array.isArray(list)) return
    for (const h of list) {
      if (!h.groupId) h.groupId = BUILTIN_GROUP_WATCH
      if (!h.settled) {
        if (needsMigration) {
          h.lastConfirmedDate = undefined
          h.confirmedBaseAmount = undefined
        }
        if (h.yesterdayAmount == null || h.yesterdayAmount <= 0) {
          h.yesterdayAmount = h.initialAmount ?? roundMoney(h.shares * h.costPrice)
        }
        if (h.initialAmount == null || h.initialAmount <= 0) {
          h.initialAmount = roundMoney(h.shares * h.costPrice)
        }
      }
    }
    holdings.value = list
    saveString(STORAGE_KEYS.HOLDINGS_VERSION, String(HOLDINGS_DATA_VERSION))
  }
  const DEMO_PURGE_FLAG = 'jgb_demo_marks_purged'

  function restoreActions(): void {
    const list = loadJSON<HoldingAction[]>(STORAGE_KEYS.HOLDING_ACTIONS, [])
    const cleaned = list.filter(a => a.note !== 'demo')
    for (const a of cleaned) if (!a.groupId) a.groupId = BUILTIN_GROUP_WATCH
    actions.value = cleaned
    if (cleaned.length !== list.length) saveJSON(STORAGE_KEYS.HOLDING_ACTIONS, cleaned)

    // 一次性迁移：早期版本注入过 018147 的演示标记并已落盘到派生缓存。
    // 该缓存标为 persistent 不参与「清除缓存」，只能在此主动丢弃一次。
    if (loadString(DEMO_PURGE_FLAG) !== '1') {
      dropAllTradeMarks()
      saveString(DEMO_PURGE_FLAG, '1')
    }
  }

  function restorePendingActions(): void {
    const all = loadJSON<PendingAction[]>(STORAGE_KEYS.PENDING_ACTIONS, [])
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    for (const a of all) if (!a.groupId) a.groupId = BUILTIN_GROUP_WATCH
    pendingActions.value = all.filter(a =>
      a.status === PendingActionStatus.Pending ||

      a.status === PendingActionStatus.Failed ||
      (a.executedAt != null && a.executedAt > cutoff),
    )

    restored = true
  }

  function flushAllPersist(): void {
    if (!restored) return
    if (persistHoldingsTimer) { clearTimeout(persistHoldingsTimer); persistHoldingsTimer = null }
    saveJSON(STORAGE_KEYS.HOLDINGS, holdings.value)
    saveJSON(STORAGE_KEYS.HOLDING_ACTIONS, actions.value)
    saveJSON(STORAGE_KEYS.PENDING_ACTIONS, pendingActions.value)
  }

  return {
    holdings, actions, pendingActions, activeHoldings, settledHoldings, pendingOnly, pendingOrFailed,
    groupActions, groupPendingActions,
    getPendingByFund, getHoldingsByFund, getTotalShares, getAvgCostPrice, getPrincipal,
    getYesterdayHoldingAmount, getFundHoldingAmount, getFundAccumulatedProfit,
    calcFundTodayProfit, calcFundTotalProfit, getProfitStatus, getDashboardStats, getAllGroupsStats, resolveGszzlDate,
    addHoldingByAmount, addHoldingDirect, replaceHoldingDirect, reduceHolding, editHolding, settleHolding,
    settleAllByFund, removeHoldingsByFund, removeHoldingsByGroup, clearAllHoldings,
    createPendingAdd, createPendingReduce, cancelPendingAction, executePendingActions,
    syncYesterdayAmounts, replayGappedHoldings, recalibrateHoldingsFromNav,
    logAction, getActionsByFund,
    restoreHoldings, restoreActions, restorePendingActions, persistHoldings, persistPendingActions, flushAllPersist,
  }
})
