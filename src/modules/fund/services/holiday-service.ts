

import type { MarketTz } from '@/shared/types/common-types'
import { API_URLS, HOLIDAY_CONFIG } from '@/config/constants'
import { defineCache } from '@/shared/cache/define-cache'
import { setMarketHolidays } from '@/shared/market/trading-day'
import { runConcurrent } from '@/shared/net/rate-limiter'
import { withBudget } from '@/shared/net/net-budget'

const MARKET_TO_COUNTRY: Partial<Record<MarketTz, string>> = {
  A: 'CN', HK: 'HK', US: 'US', JP: 'JP', KR: 'KR',
  TW: 'TW', DE: 'DE', FR: 'FR', UK: 'GB',
}

interface HolidayCache {
  year: number

  markets: Partial<Record<MarketTz, string[]>>
}

const holidayCache = defineCache<HolidayCache>({
  pool: 'shared',
  name: 'holidays',
  ttl: 365 * 24 * 60 * 60 * 1000,
  isEmpty: (v) => !v.markets || Object.keys(v.markets).length === 0,
})

let loaded = false

async function fetchMarketHolidays(market: MarketTz, year: number): Promise<string[]> {
  const country = MARKET_TO_COUNTRY[market]
  if (!country) return []
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HOLIDAY_CONFIG.FETCH_TIMEOUT)
  try {
    const hurl = `${API_URLS.NAGER_HOLIDAYS}/${year}/${country}`
    const resp = await withBudget(hurl, () => fetch(hurl, { signal: controller.signal }))
    clearTimeout(timer)
    if (!resp.ok) return []
    const data = await resp.json() as Array<{ date?: string; global?: boolean }>
    if (!Array.isArray(data)) return []
    return data.filter(h => h?.global === true && h.date).map(h => h.date as string)
  } catch {
    clearTimeout(timer)
    return []
  }
}

export async function loadHolidays(): Promise<void> {
  if (loaded) return
  loaded = true
  const year = new Date().getFullYear()

  const cached = holidayCache.peek('all')
  const allMarkets = HOLIDAY_CONFIG.MARKETS as unknown as MarketTz[]
  if (cached && cached.year === year && cached.markets) {
    for (const m of allMarkets) {
      const dates = cached.markets[m]
      if (dates) setMarketHolidays(m, dates)
    }
    return
  }

  const markets = allMarkets
  const result: Partial<Record<MarketTz, string[]>> = {}
  await runConcurrent(markets, HOLIDAY_CONFIG.FETCH_CONCURRENCY, async (m) => {
    const dates = await fetchMarketHolidays(m, year)
    if (dates.length > 0) {
      result[m] = dates
      setMarketHolidays(m, dates)
    }
  })

  holidayCache.set('all', { year, markets: result })
}

export function reloadHolidays(): void {
  loaded = false
  void loadHolidays()
}
