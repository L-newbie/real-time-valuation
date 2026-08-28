

import type { FundCatalogItem } from '@/modules/fund/fund-types'
import { API_URLS, FUND_CATALOG_CONFIG, FUND_VALUATION_CONFIG } from '@/config/constants'
import { loadScriptVar } from '@/shared/net/jsonp-main'
import { searchFunds } from './fund-search'
import { ref } from 'vue'

const catalogLoading = ref(false)

export function useCatalogLoading() {
  return catalogLoading
}

let cachedCatalog: FundCatalogItem[] | null = null
let catalogPromise: Promise<FundCatalogItem[]> | null = null

export async function fetchFundCodeCatalog(): Promise<FundCatalogItem[]> {
  if (cachedCatalog && cachedCatalog.length > 0) return cachedCatalog
  if (catalogPromise) return catalogPromise

  catalogLoading.value = true
  catalogPromise = doFetchCatalog()
  try {
    return await catalogPromise
  } finally {
    catalogPromise = null
    catalogLoading.value = false
  }
}

async function doFetchCatalog(): Promise<FundCatalogItem[]> {
  try {
    const r = await loadScriptVar<any[]>(
      API_URLS.FUND_CODE_SEARCH,
      'r',
      FUND_CATALOG_CONFIG.CATALOG_TIMEOUT,
      'utf-8',
    )
    if (!Array.isArray(r) || r.length === 0) return []

    cachedCatalog = r
      .filter((item: any[]) => Array.isArray(item) && item.length >= 4 && item[0] && item[2])
      .map((item: any[]) => ({
        fundCode: String(item[0]),
        pinyin: String(item[1] ?? ''),
        fundName: String(item[2]),
        fundType: String(item[3] ?? ''),
      }))

    return cachedCatalog
  } catch {
    return []
  }
}

export interface FundTypeAndName {
  fundType: string
  fundName: string
}

const fundTypeCache = new Map<string, FundTypeAndName>()

function setFundTypeCache(code: string, data: FundTypeAndName): void {
  if (fundTypeCache.has(code)) {
    fundTypeCache.delete(code)
  } else if (fundTypeCache.size >= FUND_VALUATION_CONFIG.FUND_TYPE_CACHE_MAX) {
    const firstKey = fundTypeCache.keys().next().value
    if (firstKey !== undefined) fundTypeCache.delete(firstKey)
  }
  fundTypeCache.set(code, data)
}

export async function getFundType(fundCode: string): Promise<FundTypeAndName> {
  const cached = fundTypeCache.get(fundCode)
  if (cached) return cached

  try {
    const catalog = await fetchFundCodeCatalog()
    const item = catalog.find((c) => c.fundCode === fundCode)
    if (item?.fundType) {
      const data: FundTypeAndName = { fundType: item.fundType, fundName: item.fundName || '' }
      setFundTypeCache(fundCode, data)
      return data
    }
  } catch {
  }

  try {
    const results = await searchFunds(fundCode)
    if (results.length > 0) {
      const data: FundTypeAndName = {
        fundType: results[0].fundType || '',
        fundName: results[0].fundName || '',
      }
      setFundTypeCache(fundCode, data)
      return data
    }
  } catch {
  }

  return { fundType: '', fundName: '' }
}

export function getCatalogFundName(fundCode: string): string {
  if (!cachedCatalog) return ''
  const item = cachedCatalog.find(c => c.fundCode === fundCode)
  return item?.fundName ?? ''
}
