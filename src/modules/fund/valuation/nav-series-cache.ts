import { defineCache } from '@/shared/cache/define-cache'
import { getBusinessDay } from './cn-trading-day'
import { fetchPingzhongNavData, type LsjzRealData } from './pingzhongdata-fetch'

const PENDING_TTL = 10 * 60 * 1000

const CONFIRMED_TTL = 24 * 60 * 60 * 1000

const navSeriesCache = defineCache<LsjzRealData>({
  pool: 'fund',
  name: 'nav-series',
  ttl: (v) => (v.jzrq >= getBusinessDay() ? CONFIRMED_TTL : PENDING_TTL),
  max: 200,
  isEmpty: (v) => !v || !(v.dwjz > 0),
  asOf: (v) => v.jzrq,
  quality: (v) => (v.recentNavs?.length ?? 0) * 10 + (v.jzrq ? 1 : 0),
  merge: (prev, next) => (next.jzrq >= prev.jzrq ? next : prev),
})

export function getNavSeries(fundCode: string): Promise<LsjzRealData | null> {
  return navSeriesCache.fetch(fundCode, () => fetchPingzhongNavData(fundCode))
}

export function peekNavSeries(fundCode: string): LsjzRealData | undefined {
  return navSeriesCache.peek(fundCode)
}

export function invalidateNavSeries(fundCode: string): void {
  navSeriesCache.del(fundCode)
}
