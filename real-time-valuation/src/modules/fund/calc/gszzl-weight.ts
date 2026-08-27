

import type { EstimatedHoldingItem, HoldingDetailItem } from '@/modules/fund/fund-types'
import type { StockQuoteInfo } from '@/shared/types/common-types'

type HoldingItem = EstimatedHoldingItem | HoldingDetailItem

export function computeEstimatedGszzlFromPrevDay(
  holdings: HoldingItem[],
  quoteMap: Map<string, StockQuoteInfo>,
): number | null {
  let totalChange = 0
  let hasData = false

  for (const h of holdings) {
    const info = quoteMap.get(h.stockCode)
    if (info && info.changeRate != null) {
      totalChange += h.ratio * info.changeRate / 100
      hasData = true
    }
  }

  return hasData ? totalChange : null
}
