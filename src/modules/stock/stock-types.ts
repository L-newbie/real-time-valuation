

import type { StockMarket, USSession } from '@/shared/types/common-types'

export interface StockQuote {
  code: string

  name: string

  price: number

  changeRate: number | null

  changeAmount: number

  open?: number

  high?: number

  low?: number

  prevClose?: number

  volume?: number

  turnover?: number

  turnoverRate?: number

  peRatio?: number

  pbRatio?: number

  marketCap?: number

  floatCap?: number

  emMarketCode?: string

  market?: StockMarket

  extPrice?: number

  extRate?: number

  session?: USSession
}

export interface StockSearchItem {
  code: string

  name: string

  market: string

  rawMarket: string
}
