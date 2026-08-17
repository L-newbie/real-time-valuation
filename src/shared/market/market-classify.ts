

import type { StockMarket, MarketTz } from '@/shared/types/common-types'
import { EM_MARKET_MAP } from './em-market-map'

export function isAShare(emMarketCode?: string): boolean {
  return emMarketCode === '1' || emMarketCode === '0'
}

export function isHKShare(emMarketCode?: string): boolean {
  return emMarketCode === '116'
}

export function isUSShare(emMarketCode?: string): boolean {
  return emMarketCode === '105' || emMarketCode === '106'
}

export function classifyShare(emMarketCode?: string, _code?: string): StockMarket {
  if (isAShare(emMarketCode)) return 'A'
  if (isHKShare(emMarketCode)) return 'HK'
  if (isUSShare(emMarketCode)) return 'US'
  return 'unknown'
}

export function detectMarketByEmCode(emMarketCode: string): StockMarket {
  return EM_MARKET_MAP[emMarketCode] ?? 'unknown'
}

export function stockMarketToTz(m: StockMarket): MarketTz {
  if (m === 'A' || m === 'HK' || m === 'US' || m === 'JP' || m === 'KR' || m === 'TW' || m === 'DE' || m === 'FR' || m === 'UK') {
    return m as MarketTz
  }
  return 'unknown'
}
