

import type { StockQuoteInfo } from '@/shared/types/common-types'

export interface IntradayPoint {
  time: string

  value: number

  date?: string
}

export interface FundValuation {
  fundcode: string

  name: string

  gztime: string

  gz: number

  dwjz: number

  prevConfirmedNav?: number

  prevConfirmedGszzl?: number

  gszzl: number

  jzrq?: string

  isEstimated?: boolean

  delayDays?: 1 | 2

  confirmedGszzl?: number

  realtimeGszzl?: number

  realtimeSource?: string

  realtimeUpdatedAt?: string

  staleAsOf?: string
}

export interface FundAllHoldings {
  reportDate: string

  reportType: string

  isFull: boolean

  holdings: HoldingDetailItem[]
}

export interface HoldingDetailItem {
  stockCode: string

  stockName: string

  ratio: number

  change?: string

  changeRate?: number | null

  emMarketCode?: string

  rawEntry?: string
}

export interface EstimatedHoldingItem extends HoldingDetailItem {
  isEstimated: boolean
}

export interface OptimizationMeta {
  method: 'optimization' | 'proportional-scaling'

  navDaysUsed: number

  stockCoverage: number

  droppedStocks?: string[]
}

export interface EstimatedHoldings {
  fundCode: string
  quarterReportDate: string
  annualReportDate: string
  description: string
  holdings: EstimatedHoldingItem[]
  optimizationMeta: OptimizationMeta

  stockQuoteMap?: Map<string, StockQuoteInfo>

  stockQuotesReady?: Promise<void>

  holdingsEnrichedReady?: Promise<void>
}

export interface YearlyHoldingsResult {
  year: string
  reports: FundAllHoldings[]
  error?: string
}

export interface FundInfo {
  fundCode: string

  fundName: string

  fundType: string

  establishDate?: string

  fundScale?: string

  fundManager?: string
}

export interface FundCache {
  fundCode: string

  fundName: string

  valuation: FundValuation | null

  info: FundInfo | null

  cachedAt: number

  cachedDate: string
}

export interface SearchResult {
  fundCode: string

  fundName: string

  fundType: string
}

export interface FundCatalogItem {
  fundCode: string

  pinyin: string

  fundName: string

  fundType: string
}

export interface KnownManager {
  fundCode: string

  fundName: string

  managerName: string

  updatedAt: string
}

export interface ManagerChange {
  fundCode: string

  fundName: string

  oldManager: string

  newManager: string
}

export interface Holding {
  id: string

  fundCode: string

  groupId?: string

  shares: number

  costPrice: number

  holdingDate: string

  createdAt: number

  settled: boolean

  initialAmount?: number

  yesterdayAmount?: number

  lastConfirmedDate?: string

  confirmedBaseAmount?: number

  entryNavDate?: string
}

export type ViewMode = 'table' | 'card' | 'row'

export type SortField = 'fundCode' | 'fundName' | 'changeRate' | 'realtimeGszzl' | 'holdingAmount' | 'lastNetValue' | 'todayProfit' | 'totalProfit' | 'totalReturnRate' | 'costPrice'

export type SortDirection = 'asc' | 'desc'

export interface ColumnConfig {
  key: string

  title: string

  width: number

  sortable: boolean

  visible: boolean

  sortDirection?: 'asc' | 'desc' | null
}
