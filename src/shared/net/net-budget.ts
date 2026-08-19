export interface NetStat {
  host: string
  sent: number
  failed: number
  queued: number
  active: number
  bytes: number
  budget: number
  totalMs: number
  maxMs: number
  peakQueued: number
}

const DEFAULT_BUDGET = 4

const QUEUE_MAX_WAIT = 8000

const HOST_BUDGET: Record<string, number> = {
  'push2.eastmoney.com': 4,
  'push2delay.eastmoney.com': 4,
  'push2his.eastmoney.com': 4,
  'fundgz.1234567.com.cn': 3,
  'fund.eastmoney.com': 3,
  'fundf10.eastmoney.com': 2,
  'fundmobapi.eastmoney.com': 3,
  'qt.gtimg.cn': 4,
  'ifzq.gtimg.cn': 4,
  'query1.finance.yahoo.com': 2,
  'api.allorigins.win': 4,
  'corsproxy.io': 4,
  'danjuanfunds.com': 3,
}

interface Lane {
  active: number
  queue: Array<() => void>
}

const lanes = new Map<string, Lane>()
const stats = new Map<string, NetStat>()

function hostOf(url: string): string {
  try {
    return new URL(url, typeof location !== 'undefined' ? location.href : 'https://x').host
  } catch {
    return 'unknown'
  }
}

function laneOf(host: string): Lane {
  let l = lanes.get(host)
  if (!l) { l = { active: 0, queue: [] }; lanes.set(host, l) }
  return l
}

function statOf(host: string): NetStat {
  let s = stats.get(host)
  if (!s) {
    s = { host, sent: 0, failed: 0, queued: 0, active: 0, bytes: 0, budget: budgetOf(host), totalMs: 0, maxMs: 0, peakQueued: 0 }
    stats.set(host, s)
  }
  return s
}

function budgetOf(host: string): number {
  return HOST_BUDGET[host] ?? DEFAULT_BUDGET
}

export async function withBudget<T>(url: string, task: () => Promise<T>): Promise<T> {
  const host = hostOf(url)
  const lane = laneOf(host)
  const st = statOf(host)

  if (lane.active >= budgetOf(host)) {
    st.queued++
    if (st.queued > st.peakQueued) st.peakQueued = st.queued
    let released = false
    await new Promise<void>((resolve) => {
      const go = (): void => { if (released) return; released = true; resolve() }
      lane.queue.push(go)
      setTimeout(go, QUEUE_MAX_WAIT)
    })
    st.queued--
  }

  lane.active++
  st.active = lane.active
  st.sent++
  const started = Date.now()
  try {
    return await task()
  } catch (e) {
    st.failed++
    throw e
  } finally {
    const cost = Date.now() - started
    st.totalMs += cost
    if (cost > st.maxMs) st.maxMs = cost
    lane.active--
    st.active = lane.active
    const next = lane.queue.shift()
    if (next) next()
  }
}

export function recordBytes(url: string, bytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) return
  statOf(hostOf(url)).bytes += bytes
}

export function getNetStats(): NetStat[] {
  return [...stats.values()].sort((a, b) => b.sent - a.sent)
}

export function resetNetStats(): void {
  stats.clear()
  sessionStart = Date.now()
}

let sessionStart = Date.now()

export function getSessionStart(): number {
  return sessionStart
}
