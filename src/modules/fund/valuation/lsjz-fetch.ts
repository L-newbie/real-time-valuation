

import { fetchPingzhongNavData, type LsjzRealData } from './pingzhongdata-fetch'

export type { LsjzRealData }

export async function fetchLsjzRealData(fundCode: string): Promise<LsjzRealData | null> {
  return fetchPingzhongNavData(fundCode)
}
