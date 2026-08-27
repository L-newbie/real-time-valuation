

import { type LsjzRealData } from './pingzhongdata-fetch'
import { getNavSeries } from './nav-series-cache'

export type { LsjzRealData }

export async function fetchLsjzRealData(fundCode: string): Promise<LsjzRealData | null> {
  return getNavSeries(fundCode)
}
