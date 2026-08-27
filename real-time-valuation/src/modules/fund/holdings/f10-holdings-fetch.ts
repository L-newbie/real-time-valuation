

import type { FundAllHoldings, YearlyHoldingsResult } from '@/modules/fund/fund-types'
import { API_URLS, F10_CONFIG } from '@/config/constants'
import { loadApidata } from './f10-apidata-loader'
import { parseHoldingsHtml, extractLatestReportBlock, extractHoldingsReportDate } from './holdings-parser'
import { detectReportType } from './report-date'
import { isValidFundCode } from '@/shared/utils/validation'
import { withBudget } from '@/shared/net/net-budget'

function parseApidataText(text: string): any | null {
  if (!text) return null

  let objLiteral: string | null = null
  const m = text.match(/var\s+apidata\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)
  if (m) objLiteral = m[1]
  if (!objLiteral) {
    const m2 = text.match(/apidata\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/)
    if (m2) objLiteral = m2[1]
  }
  if (!objLiteral) return null
  try {
    const fn = new Function(`return (${objLiteral})`) as () => any
    return fn()
  } catch {
    return null
  }
}

const F10_PROXY_CANDIDATES: Array<{ name: string; build: (u: string) => string; wrap: boolean }> = [
  { name: 'allorigins-get', build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, wrap: true },
  { name: 'allorigins-raw', build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, wrap: false },
  { name: 'thingproxy', build: (u) => `https://thingproxy.freeboard.io/fetch/${u}`, wrap: false },
  { name: 'corsproxy', build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`, wrap: false },
]

async function loadApidataViaProxy(url: string, timeoutMs: number = F10_CONFIG.TIMEOUT): Promise<any | null> {
  for (const candidate of F10_PROXY_CANDIDATES) {
    const proxyUrl = candidate.build(url)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs * 3)
    try {
      const resp = await withBudget(proxyUrl, () => fetch(proxyUrl, { signal: ctrl.signal }))
      clearTimeout(timer)
      if (!resp.ok) continue
      let text = ''
      if (candidate.wrap) {
        const raw = await resp.json() as { contents?: string; status?: { http_code?: number } }
        if (raw?.status?.http_code && raw.status.http_code !== 200) continue
        text = raw?.contents ?? ''
      } else {
        text = await resp.text()
      }
      if (!text) continue
      const apidata = parseApidataText(text)
      if (apidata && apidata.content) return apidata
    } catch {
      clearTimeout(timer)
    }
  }
  return null
}

function buildUrl(fundCode: string, topline: number, year?: string, month?: string): string {
  const y = year ? `&year=${year}` : '&year='
  const m = month ? `&month=${month}` : '&month='
  return `${API_URLS.F10_HOLDINGS}?type=jjcc&code=${fundCode}&topline=${topline}${y}${m}&rt=${Math.random()}`
}

export async function fetchFundAllHoldings(
  fundCode: string,
  options?: { year?: string; full?: boolean; month?: string },
): Promise<FundAllHoldings | null> {
  if (!isValidFundCode(fundCode)) return null

  const year = options?.year ?? ''
  const full = options?.full ?? false
  const month = options?.month ?? ''
  const topline = full ? F10_CONFIG.TOPLINE_FULL : F10_CONFIG.TOPLINE_TOP10

  const url = buildUrl(fundCode, topline, year, month)

  try {
    let apidata: any = null
    try {
      apidata = await loadApidata(url, F10_CONFIG.TIMEOUT)
    } catch {
    }
    if (!apidata || !apidata.content) {
      apidata = await loadApidataViaProxy(url, F10_CONFIG.TIMEOUT)
    }
    if (!apidata) return full ? await fetchFundTop10Holdings(fundCode) : null

    const content = apidata.content || ''

    const latest = extractLatestReportBlock(content)
    if (!latest) {
      if (apidata.curyear) {
        const retried = await fetchWithYear(fundCode, String(apidata.curyear), full, month)
        if (retried) return retried
      }
      return full ? await fetchFundTop10Holdings(fundCode) : null
    }

    const holdings = parseHoldingsHtml(latest.html)
    const reportDate = (latest.reportDate || extractHoldingsReportDate(content)) ?? ''
    const { reportType, isFull } = detectReportType(reportDate)

    if (full && !isFull && !year && !month) {
      const prevYear = String(Number(apidata.curyear || new Date().getFullYear()) - 1)
      const prevResult = await fetchWithYear(fundCode, prevYear, full, month)
      if (prevResult && prevResult.isFull) return prevResult
    }

    if (holdings.length > 0) {
      return { reportDate, reportType, isFull, holdings }
    }

    const fallbackHoldings = parseHoldingsHtml(content)
    if (fallbackHoldings.length > 0) {
      return { reportDate, reportType, isFull, holdings: fallbackHoldings }
    }
  } catch {
  }

  if (full) return await fetchFundTop10Holdings(fundCode)

  return null
}

async function fetchWithYear(
  fundCode: string, year: string, full: boolean, month: string,
): Promise<FundAllHoldings | null> {
  const topline = full ? F10_CONFIG.TOPLINE_FULL : F10_CONFIG.TOPLINE_TOP10
  const retryUrl = buildUrl(fundCode, topline, year, month)

  let retryData = await loadApidata(retryUrl, F10_CONFIG.TIMEOUT)
  if (!retryData || !retryData.content) {
    retryData = await loadApidataViaProxy(retryUrl, F10_CONFIG.TIMEOUT)
  }
  if (!retryData) return null

  const retryContent = retryData.content || ''
  const latest = extractLatestReportBlock(retryContent)
  if (!latest) return null

  const holdings = parseHoldingsHtml(latest.html)
  if (holdings.length === 0) return null

  const reportDate = (latest.reportDate || extractHoldingsReportDate(retryContent)) ?? ''
  const { reportType, isFull } = detectReportType(reportDate)

  return { reportDate, reportType, isFull, holdings }
}

export async function fetchFundTop10Holdings(fundCode: string): Promise<FundAllHoldings | null> {
  return fetchFundAllHoldings(fundCode, { full: false })
}

export async function fetchFundHoldingsByYear(
  fundCode: string, year: string,
): Promise<YearlyHoldingsResult> {
  if (!isValidFundCode(fundCode)) return { year, reports: [], error: '无效的基金代码' }

  const reports: FundAllHoldings[] = []
  const quarters = [
    { month: '1', label: '一季报' },
    { month: '2', label: '半年报' },
    { month: '3', label: '三季报' },
    { month: '4', label: '年报' },
  ]

  for (const q of quarters) {
    try {
      const result = await fetchFundAllHoldings(fundCode, { year, full: true, month: q.month })
      if (result && result.holdings.length > 0) reports.push(result)
    } catch {  }
  }

  if (reports.length === 0) {
    try {
      const result = await fetchFundAllHoldings(fundCode, { year, full: true })
      if (result && result.holdings.length > 0) reports.push(result)
    } catch {  }
  }

  return { year, reports }
}
