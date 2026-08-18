

import dayjs from 'dayjs'
import { safeParseFloat } from '@/shared/utils/safe-math'
import { isValidFundCode } from '@/shared/utils/validation'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'
import { defineCache } from '@/shared/cache/define-cache'
import { getPreviousBusinessTradingDay } from '@/modules/fund/valuation/cn-trading-day'

export interface NavPoint {
  d: string

  v: number
}

export interface PerfIntervals {
  week: number | null
  m1: number | null
  m3: number | null
  m6: number | null
  y1: number | null

  nav: NavPoint[]

  navRecent?: NavPoint[]
}

const PERF_CACHE_TTL = 30 * 24 * 60 * 60 * 1000

const FETCH_GAP_MS = 500

const NAV_MAX_POINTS = 250

const NAV_WINDOW_DAYS = 365

const NAV_RECENT_COUNT = 15

function asOfOf(v: PerfIntervals): string {
  const recent = v.navRecent
  if (recent && recent.length > 0) return recent[recent.length - 1].d
  if (v.nav.length > 0) return v.nav[v.nav.length - 1].d
  return ''
}

export const perfCache = defineCache<PerfIntervals>({
  pool: 'fund',
  name: 'perf-intervals',
  ttl: PERF_CACHE_TTL,
  max: 200,
  isEmpty: (v) =>
    !Array.isArray(v?.nav)
    || (v.week == null && v.m1 == null && v.m3 == null && v.m6 == null && v.y1 == null),
  asOf: asOfOf,
})

interface NetWorthPoint { x: number; y: number | string }

interface PerfWindowData {
  syl_1y?: unknown
  syl_3y?: unknown
  syl_6y?: unknown
  syl_1n?: unknown
}

interface PerfSnapshot {
  netWorthData: NetWorthPoint[] | null
  windowData: PerfWindowData | null
}

async function loadPerfWindow(fundCode: string): Promise<PerfSnapshot | null> {
  const pz = await loadPingzhong(fundCode)
  if (!pz) return null
  return {
    netWorthData: Array.isArray(pz.Data_netWorthTrend) ? pz.Data_netWorthTrend as NetWorthPoint[] : null,
    windowData: {
      syl_1y: pz.syl_1y,
      syl_3y: pz.syl_3y,
      syl_6y: pz.syl_6y,
      syl_1n: pz.syl_1n,
    } as PerfWindowData,
  }
}

function calcGrowthFromHistory(
  history: { date: string; value: number }[],
  days: number,
): number | null {
  if (history.length < 2) return null
  const latest = history[history.length - 1]
  const target = dayjs(latest.date).subtract(days, 'day')
  let closest = history[0]
  let minDist = Infinity
  for (const d of history) {
    if (d.date === latest.date) continue
    const dist = Math.abs(dayjs(d.date).diff(target, 'day'))
    if (dist < minDist) { minDist = dist; closest = d }
  }
  return closest && closest.value > 0
    ? safeParseFloat((latest.value - closest.value) / closest.value * 100)
    : null
}

function toFinite(v: unknown): number | null {
  if (v == null) return null
  const n = safeParseFloat(v as string | number)
  return Number.isFinite(n) ? n : null
}

function downsampleNav(history: { date: string; value: number }[]): NavPoint[] {
  if (history.length === 0) return []

  const latestDate = history[history.length - 1].date
  const cutoff = dayjs(latestDate).subtract(NAV_WINDOW_DAYS, 'day')
  const recent = history.filter(h => !dayjs(h.date).isBefore(cutoff))
  if (recent.length === 0) return []
  if (recent.length <= NAV_MAX_POINTS) {
    return recent.map(h => ({ d: h.date, v: h.value }))
  }

  const out: NavPoint[] = []
  const step = (recent.length - 1) / (NAV_MAX_POINTS - 1)
  for (let i = 0; i < NAV_MAX_POINTS; i++) {
    const idx = i === NAV_MAX_POINTS - 1 ? recent.length - 1 : Math.round(i * step)
    const p = recent[idx]
    if (p) out.push({ d: p.date, v: p.value })
  }
  return out
}

function buildPerf(snapshot: PerfSnapshot): PerfIntervals {
  const history: { date: string; value: number }[] = []
  if (Array.isArray(snapshot.netWorthData)) {
    for (const d of snapshot.netWorthData) {
      if (!d || typeof d.x !== 'number' || !Number.isFinite(Number(d.y))) continue
      history.push({ date: dayjs(d.x).format('YYYY-MM-DD'), value: safeParseFloat(d.y) })
    }
    history.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }

  const w = snapshot.windowData
  const sylM1 = toFinite(w?.syl_1y)
  const sylM3 = toFinite(w?.syl_3y)
  const sylM6 = toFinite(w?.syl_6y)
  const sylY1 = toFinite(w?.syl_1n)

  return {
    week: calcGrowthFromHistory(history, 7),
    m1: sylM1 ?? calcGrowthFromHistory(history, 30),
    m3: sylM3 ?? calcGrowthFromHistory(history, 90),
    m6: sylM6 ?? calcGrowthFromHistory(history, 180),
    y1: sylY1 ?? calcGrowthFromHistory(history, 365),
    nav: downsampleNav(history),
    navRecent: history.slice(-(NAV_RECENT_COUNT + 1)).map(h => ({ d: h.date, v: h.value })),
  }
}

function isFresh(code: string): boolean {
  const hit = perfCache.get(code)
  if (hit.missing || hit.stale || !hit.data) return false
  return hit.asOf >= getPreviousBusinessTradingDay()
}

let fetchToken = 0

export function getPerfIntervals(codes: string[]): Map<string, PerfIntervals> {
  const out = new Map<string, PerfIntervals>()
  for (const code of codes) {
    if (!isFresh(code)) continue
    const data = perfCache.peek(code)
    if (data) out.set(code, data)
  }
  return out
}

export function peekPerfIntervals(codes: string[]): Map<string, PerfIntervals> {
  const out = new Map<string, PerfIntervals>()
  for (const code of codes) {
    const data = perfCache.peek(code)
    if (data) out.set(code, data)
  }
  return out
}

export function peekNavSeries(fundCode: string): NavPoint[] {
  const data = perfCache.peek(fundCode)
  return data?.nav ?? []
}

export function peekPerfItems(fundCode: string): { title: string; value: number }[] {
  const d = perfCache.peek(fundCode)
  if (!d) return []
  const rows: { title: string; value: number | null }[] = [
    { title: '近1周', value: d.week },
    { title: '近1月', value: d.m1 },
    { title: '近3月', value: d.m3 },
    { title: '近6月', value: d.m6 },
    { title: '近1年', value: d.y1 },
  ]
  return rows
    .filter((r): r is { title: string; value: number } => r.value != null && Number.isFinite(r.value))
}

export async function fetchMissingPerf(
  codes: string[],
  onBatch: (updates: Map<string, PerfIntervals>) => void,
): Promise<void> {
  const myToken = ++fetchToken

  const missing = codes.filter((code) => {
    if (!isValidFundCode(code)) return false
    return !isFresh(code)
  })

  for (let i = 0; i < missing.length; i++) {
    if (myToken !== fetchToken) return
    const code = missing[i]
    try {
      const snapshot = await loadPerfWindow(code)
      if (myToken !== fetchToken) return
      if (snapshot) {
        const perf = buildPerf(snapshot)

        const usable = perf.week != null || perf.m1 != null || perf.m3 != null
          || perf.m6 != null || perf.y1 != null
        if (usable) {
          perfCache.set(code, perf, { src: 'pingzhong' })
          onBatch(new Map([[code, perf]]))
        }
      }
    } catch {
    }

    if (i < missing.length - 1) {
      await new Promise((r) => setTimeout(r, FETCH_GAP_MS))
    }
  }

  if (myToken === fetchToken) {
    perfCache.flush()
  }
}
