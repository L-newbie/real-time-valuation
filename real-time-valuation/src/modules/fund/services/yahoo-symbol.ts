

import type { StockMarket } from '@/shared/types/common-types'
import { YAHOO_CONFIG } from '@/config/constants'
import { defineCache } from '@/shared/cache/define-cache'
import { EM_TO_YAHOO_SUFFIX } from '@/shared/market/em-market-map'

export interface YahooSearchResult {
  symbol: string
  name: string
  exchange: string
  quoteType: string
}

export type SearchYahooSymbol = (keyword: string, count: number, includeEtf: boolean) => Promise<YahooSearchResult[]>

export function detectMarketFromSymbol(symbol: string): StockMarket {
  if (symbol.endsWith('.SS') || symbol.endsWith('.SZ') || symbol.endsWith('.BJ')) return 'A'
  if (symbol.endsWith('.HK')) return 'HK'
  if (symbol.endsWith('.T')) return 'JP'
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return 'KR'
  if (symbol.endsWith('.TW')) return 'TW'
  if (symbol.endsWith('.DE')) return 'DE'
  if (symbol.endsWith('.PA')) return 'FR'
  if (symbol.endsWith('.L')) return 'UK'
  if (/^[A-Z]+$/.test(symbol)) return 'US'
  return 'unknown'
}

const CODE_TAIL_MARKET_TO_YAHOO: Record<string, string> = {
  JP: '.T',
  KS: '.KS',
  KQ: '.KQ',
  TW: '.TW',
  HK: '.HK',
  DE: '.DE',
  PA: '.PA',
  L: '.L',
}

function splitCodeTailMarket(code: string): string | null {
  const m = code.match(/^(\d+)(JP|KS|KQ|TW|HK|DE|PA|L)$/)
  if (!m) return null
  return `${m[1]}${CODE_TAIL_MARKET_TO_YAHOO[m[2]]}`
}

const symbolCache = defineCache<string>({
  pool: 'shared',
  name: 'yahoo-symbol',
  ttl: YAHOO_CONFIG.SYMBOL_CACHE_TTL,
  isEmpty: (v) => !v,
})

function saveSymbolToCache(code: string, symbol: string): void {
  symbolCache.set(code, symbol)
}

function symbolMatchesCode(symbol: string, code: string): boolean {
  const prefix = symbol.split('.')[0].toUpperCase()
  const c = code.toUpperCase()
  if (prefix === c) return true

  if (/^\d+$/.test(prefix) && /^\d+$/.test(c)) {
    return parseInt(prefix) === parseInt(c)
  }
  return false
}

async function searchBestSymbol(
  keyword: string, code: string, searchFn: SearchYahooSymbol,
): Promise<string | null> {
  const results = await searchFn(keyword, YAHOO_CONFIG.SEARCH_MATCH_COUNT, true)
  if (results.length === 0) return null

  const matched = results.find(r => r.symbol && symbolMatchesCode(r.symbol, code))
  return (matched?.symbol) || results[0].symbol || null
}

export async function guessYahooSymbol(
  code: string,
  emMarketCode: string | undefined,
  stockName: string | undefined,
  searchFn: SearchYahooSymbol,
): Promise<string | null> {
  const cleanCode = code.trim().toUpperCase() || code

  if (emMarketCode && EM_TO_YAHOO_SUFFIX[emMarketCode] !== undefined) {
    const suffix = EM_TO_YAHOO_SUFFIX[emMarketCode]
    if (emMarketCode === '116') return `${cleanCode.padStart(4, '0')}${suffix}`
    if (emMarketCode === '105' || emMarketCode === '106') return cleanCode
    return `${cleanCode}${suffix}`
  }

  const tailSplit = splitCodeTailMarket(cleanCode)
  if (tailSplit) return tailSplit

  const cached = symbolCache.peek(cleanCode)
  if (cached) return cached

  const trimmedName = stockName?.trim()

  if (trimmedName) {
    const sym = await searchBestSymbol(trimmedName, cleanCode, searchFn)
    if (sym) { saveSymbolToCache(cleanCode, sym); return sym }
  }

  const symByCode = await searchBestSymbol(cleanCode, cleanCode, searchFn)
  if (symByCode) {
    saveSymbolToCache(cleanCode, symByCode)
    return symByCode
  }
  return null
}
