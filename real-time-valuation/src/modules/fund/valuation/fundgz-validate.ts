

import type { FundValuation } from '@/modules/fund/fund-types'
import { safeParseFloat } from '@/shared/utils/safe-math'

export function validateFundValuation(raw: Partial<FundValuation>): FundValuation | null {
  if (!raw.fundcode) return null
  return {
    fundcode: raw.fundcode,
    name: raw.name || `基金(${raw.fundcode})`,
    gztime: raw.gztime ?? '',
    gz: safeParseFloat(raw.gz),
    dwjz: safeParseFloat(raw.dwjz),
    gszzl: safeParseFloat(raw.gszzl),
    jzrq: raw.jzrq ?? '',
    isEstimated: raw.isEstimated ?? true,
    delayDays: raw.delayDays ?? 1,
  }
}
