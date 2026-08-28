

import { fetchPingzhongNavSeries } from './pingzhongdata-fetch'
import type { LsjzRow } from './lsjz-parser'
import { isValidFundCode } from '@/shared/utils/validation'

export async function fetchFundNetValueRange(
  fundCode: string,
  sdate: string,
  edate: string,
): Promise<LsjzRow[] | null> {
  if (!isValidFundCode(fundCode)) return []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sdate) || !/^\d{4}-\d{2}-\d{2}$/.test(edate)) return []
  if (sdate > edate) return []

  const series = await fetchPingzhongNavSeries(fundCode)
  if (series == null) return null

  return series.filter((row) => row.date >= sdate && row.date <= edate)
}
