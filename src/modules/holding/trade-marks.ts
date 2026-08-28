import type { HoldingAction, PendingAction } from '@/modules/holding/holding-types'
import { HoldingActionType, PendingActionStatus } from '@/modules/holding/holding-types'
import { defineCache } from '@/shared/cache/define-cache'
import dayjs from 'dayjs'

export type TradeSide = 'buy' | 'sell' | 'settle'

export interface TradeMark {
  id?: string

  date: string

  execDate?: string

  side: TradeSide

  label: string

  amount?: number

  shares?: number

  nav?: number

  pending: boolean

  open?: boolean

  at: number
}

export const tradeMarkCache = defineCache<TradeMark[]>({
  pool: 'fund',
  name: 'trade-marks',
  ttl: 0,
  max: 200,
  isEmpty: (v) => !v?.length,
  asOf: (v) => (v.length > 0 ? v[v.length - 1].date : ''),

  persistent: true,
})

const BJ_OFFSET_MIN = 8 * 60

function toBeijing(ts: number): dayjs.Dayjs {
  const local = dayjs(ts)
  return local.add(local.utcOffset() * -1 + BJ_OFFSET_MIN, 'minute')
}

function toDateStr(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return ''
  return toBeijing(ts).format('YYYY-MM-DD')
}

export function buildTradeMarks(
  actions: HoldingAction[],
  pending: PendingAction[],
  fundCode: string,
): TradeMark[] {
  const out: TradeMark[] = []
  const fundActions = actions
    .filter(a => a.fundCode === fundCode)
    .sort((a, b) => a.timestamp - b.timestamp)
  let opened = false
  for (const a of fundActions) {
    const date = a.markDate || toDateStr(a.timestamp)
    if (!date) continue

    const before = a.sharesBefore ?? 0
    const after = a.sharesAfter ?? 0
    const delta = after - before

    // 建仓走 Edit 类型（sharesBefore 为 0），不能只按 type 判方向，
    // 一律以份额增减为准；份额没变的纯改价 Edit 不打点。
    let side: TradeSide
    if (a.type === HoldingActionType.Settle) side = 'settle'
    else if (delta > 0) side = 'buy'
    else if (delta < 0) side = 'sell'
    else continue

    const open = !opened && side === 'buy'
    if (open) opened = true

    out.push({
      date,
      side,
      label: side === 'buy' ? 'B' : side === 'settle' ? 'S' : 'T',
      shares: Math.abs(delta) > 0 ? Math.abs(delta) : undefined,
      // 清仓时 costAfter 归零，金额要靠清仓前的成本价折算
      nav: a.costAfter > 0 ? a.costAfter : a.costBefore > 0 ? a.costBefore : undefined,
      pending: false,
      open,
      at: a.timestamp,
    })
  }

  for (const p of pending) {
    if (p.fundCode !== fundCode) continue
    if (p.status !== PendingActionStatus.Pending) continue
    const date = toDateStr(p.operateTime || p.createdAt)
    if (!date) continue
    const side: TradeSide = p.type === 'add' ? 'buy' : 'sell'
    out.push({
      id: p.id,
      date,
      execDate: p.scheduledDate,
      side,
      label: side === 'buy' ? 'B' : 'T',
      amount: p.type === 'add' ? p.amount : undefined,
      shares: p.type === 'reduce' ? p.amount : undefined,
      nav: p.referenceNav > 0 ? p.referenceNav : undefined,
      pending: true,
      at: p.operateTime || p.createdAt,
    })
  }

  return out.sort((a, b) => a.at - b.at)
}

export function groupMarksByDate(marks: TradeMark[]): Map<string, TradeMark[]> {
  const map = new Map<string, TradeMark[]>()
  for (const m of marks) {
    const list = map.get(m.date)
    if (list) list.push(m)
    else map.set(m.date, [m])
  }
  return map
}

export interface MarkAnchor {
  index: number

  marks: TradeMark[]

  exact: boolean
}

export function anchorMarks(dates: string[], marks: TradeMark[], navs?: number[]): MarkAnchor[] {
  if (dates.length === 0 || marks.length === 0) return []

  const first = dates[0]
  const byIndex = new Map<number, { marks: TradeMark[]; exact: boolean }>()

  for (const m of marks) {
    if (m.date < first) continue

    let lo = 0
    let hi = dates.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (dates[mid] <= m.date) { found = mid; lo = mid + 1 }
      else hi = mid - 1
    }
    if (found < 0) continue

    let exact = dates[found] === m.date

    // 日期对不上（多为建仓：净值当天未公布，或落在周末），
    // 就改用这笔交易的成本净值去序列里找最接近的那一天，
    // 标记落在真实成交净值上，而不是硬贴到最近交易日。
    if (!exact && navs && navs.length === dates.length) {
      const byNav = indexByNav(navs, m.nav)
      if (byNav >= 0) { found = byNav; exact = true }
    }

    const slot = byIndex.get(found)
    if (slot) {
      slot.marks.push(m)
      slot.exact = slot.exact && exact
    } else {
      byIndex.set(found, { marks: [m], exact })
    }
  }

  return [...byIndex.entries()]
    .map(([index, v]) => ({ index, marks: v.marks, exact: v.exact }))
    .sort((a, b) => a.index - b.index)
}

const NAV_MATCH_TOLERANCE = 0.08

function indexByNav(navs: number[], targetNav: number | undefined): number {
  if (!(targetNav != null && targetNav > 0)) return -1
  let best = -1
  let bestDiff = Infinity
  for (let i = 0; i < navs.length; i++) {
    const v = navs[i]
    if (!(v > 0)) continue
    const diff = Math.abs(v - targetNav)
    if (diff <= bestDiff) { bestDiff = diff; best = i }
  }
  if (best < 0 || bestDiff / targetNav > NAV_MATCH_TOLERANCE) return -1
  return best
}

export function anchorMarksByTime(times: string[], marks: TradeMark[], today: string): MarkAnchor[] {
  if (times.length === 0 || marks.length === 0) return []

  const byIndex = new Map<number, { marks: TradeMark[]; exact: boolean }>()

  for (const m of marks) {
    if (m.date !== today) continue
    const hhmm = toBeijing(m.at).format('HH:mm')

    let found = -1
    for (let i = 0; i < times.length; i++) {
      if (times[i].slice(0, 5) <= hhmm) found = i
      else break
    }
    if (found < 0) found = 0

    const slot = byIndex.get(found)
    if (slot) slot.marks.push(m)
    else byIndex.set(found, { marks: [m], exact: true })
  }

  return [...byIndex.entries()]
    .map(([index, v]) => ({ index, marks: v.marks, exact: v.exact }))
    .sort((a, b) => a.index - b.index)
}

export function describeMark(m: TradeMark): string {
  const verb = m.side === 'settle' ? '清仓' : m.open ? '建仓' : m.side === 'buy' ? '买入' : '卖出'
  const nav = m.nav != null && m.nav > 0 ? m.nav : 0

  // 金额与份额只要有一个，就能用净值补出另一个，两者一并展示。
  let amount = m.amount != null && m.amount > 0 ? m.amount : 0
  let shares = m.shares != null && m.shares > 0 ? m.shares : 0
  if (!amount && shares && nav) amount = shares * nav
  if (!shares && amount && nav) shares = amount / nav

  const parts: string[] = []
  if (amount > 0) parts.push(`${amount.toFixed(2)} 元`)
  if (shares > 0) parts.push(`${shares.toFixed(2)} 份`)

  const detail = parts.length > 0 ? ` ${parts.join(' · ')}` : ''
  return `${verb}${detail}${m.pending ? '（待确认）' : ''}`
}

export function describeMarks(list: TradeMark[]): string[] {
  return list.map(describeMark)
}

const revisions = new Map<string, string>()

function revisionOf(actions: HoldingAction[], pending: PendingAction[], fundCode: string): string {
  let n = 0
  let last = 0
  for (const a of actions) {
    if (a.fundCode !== fundCode) continue
    n++
    if (a.timestamp > last) last = a.timestamp
  }
  for (const p of pending) {
    if (p.fundCode !== fundCode) continue
    if (p.status !== PendingActionStatus.Pending) continue
    n++
    const t = p.operateTime || p.createdAt
    if (t > last) last = t
  }
  return `${n}:${last}`
}

export function findDateByNav(
  series: { d: string; v: number }[] | undefined,
  targetNav: number,
): string {
  if (!series || series.length === 0 || !(targetNav > 0)) return ''
  let bestDate = ''
  let bestDiff = Infinity
  for (const p of series) {
    if (!(p.v > 0)) continue
    const diff = Math.abs(p.v - targetNav)
    if (diff < bestDiff) { bestDiff = diff; bestDate = p.d }
  }

  // 差得太离谱就不硬凑（超过 8%），交给调用方回退到当天
  if (!bestDate || bestDiff / targetNav > 0.08) return ''
  return bestDate
}

export function dropTradeMarks(groupId: string, fundCode: string): void {
  if (!fundCode) return
  const key = markKey(groupId, fundCode)
  revisions.delete(key)
  tradeMarkCache.del(key)
}

export function dropAllTradeMarks(): void {
  revisions.clear()
  tradeMarkCache.clear()
}

// 同一只基金在不同分组各有一套交易记录，缓存 key 必须带上分组，
// 否则先渲染的那组标记会被另一组直接读走。
function markKey(groupId: string, fundCode: string): string {
  return `${groupId}:${fundCode}`
}

export function getTradeMarks(
  actions: HoldingAction[],
  pending: PendingAction[],
  fundCode: string,
  groupId: string,
): TradeMark[] {
  if (!fundCode) return []
  const key = markKey(groupId, fundCode)
  const rev = revisionOf(actions, pending, fundCode)

  if (revisions.get(key) === rev) {
    const hit = tradeMarkCache.peek(key)
    if (hit) return hit
  }

  const built = buildTradeMarks(actions, pending, fundCode)
  revisions.set(key, rev)
  if (built.length > 0) tradeMarkCache.set(key, built, { src: 'holding-actions' })
  else tradeMarkCache.del(key)
  return built
}
