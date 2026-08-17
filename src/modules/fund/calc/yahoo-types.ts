

export interface YahooChartMeta {
  symbol?: string
  regularMarketPrice?: number
  regularMarketChangePercent?: number
  regularMarketChange?: number

  regularMarketTime?: number
  previousClose?: number
  currency?: string
  longName?: string
  shortName?: string

  marketState?: string

  preMarketPrice?: number
  preMarketChange?: number
  preMarketChangePercent?: number

  postMarketPrice?: number
  postMarketChange?: number
  postMarketChangePercent?: number
}

export interface YahooChartResult {
  meta?: YahooChartMeta
  timestamp?: number[]
  indicators?: {
    quote?: Array<{
      close?: (number | null)[]
    }>
  }
}

export interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[]
    error?: { code: string; description: string }
  }
}
