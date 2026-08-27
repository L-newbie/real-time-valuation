

export type StockMarket =
  | 'A' | 'HK' | 'US'
  | 'JP' | 'KR' | 'TW'
  | 'DE' | 'FR' | 'UK'
  | 'BR' | 'IN' | 'SG' | 'AU'
  | 'unknown'

export type MarketTz =
  | 'A' | 'HK' | 'US'
  | 'JP' | 'KR' | 'TW'
  | 'DE' | 'FR' | 'UK'
  | 'unknown'

export type USSession = 'PRE' | 'REGULAR' | 'POST' | 'OFF'

export interface StockQuoteInfo {
  changeRate: number | null

  date: string | null

  market: StockMarket

  source: string | null

  closed?: boolean

  session?: 'PRE' | 'REGULAR' | 'POST'

  price?: number

  prevClose?: number

  extPrice?: number

  updatedAt?: number
}
