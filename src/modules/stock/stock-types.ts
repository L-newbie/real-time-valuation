

export interface StockQuote {
  code: string

  name: string

  price: number

  changeRate: number

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
}

export interface StockSearchItem {
  code: string

  name: string

  market: string

  rawMarket: string
}
