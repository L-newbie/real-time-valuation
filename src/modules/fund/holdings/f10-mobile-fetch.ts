

import type { FundAllHoldings, HoldingDetailItem } from '@/modules/fund/fund-types'
import { F10_CONFIG } from '@/config/constants'
import { isValidFundCode } from '@/shared/utils/validation'
import { beijingNow } from '@/shared/utils/date-format'
import dayjs from 'dayjs'
import { withBudget } from '@/shared/net/net-budget'

interface MobileFundStock {
  GPDM?: string

  GPJC?: string

  JZBL?: number | string
}

interface MobileHoldingsResponse {
  Success?: boolean
  ErrCode?: number
  ErrMsg?: string

  Expansion?: string
  Datas?: { fundStocks?: MobileFundStock[] }
}

export async function fetchTop10FromMobileApi(fundCode: string): Promise<FundAllHoldings | null> {
  if (!isValidFundCode(fundCode)) return null
  const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?FCODE=${fundCode}&deviceid=Wap&plat=WAP&product=EFund&version=2.0.0`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), F10_CONFIG.TIMEOUT)
  try {
    const resp = await withBudget(url, () => fetch(url, { signal: controller.signal }))
    if (!resp.ok) return null
    const json = (await resp.json()) as MobileHoldingsResponse
    if (!json || !json.Success) return null

    const reportDate = String(json.Expansion || '')
    if (!isReportFresh(reportDate)) return null

    const fundStocks = json.Datas?.fundStocks || []
    if (!Array.isArray(fundStocks) || fundStocks.length === 0) return null

    const holdings: HoldingDetailItem[] = []
    for (const s of fundStocks) {
      const rawCode = String(s.GPDM || '').trim()
      const name = String(s.GPJC || '').trim()
      const ratio = parseRatio(s.JZBL)
      if (!rawCode && !name && ratio <= 0) continue
      const { stockCode, emMarketCode } = parseGpdm(rawCode)
      holdings.push({
        stockCode,
        stockName: name,
        ratio,
        emMarketCode,
        rawEntry: rawCode,
      })
    }

    if (holdings.length === 0) return null

    return {
      reportDate,
      reportType: detectReportType(reportDate),
      isFull: false,
      holdings: holdings.slice(0, 10),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const REPORT_MAX_AGE_MONTHS = 15

function isReportFresh(reportDate: string): boolean {
  if (!reportDate) return false
  const report = dayjs(reportDate, 'YYYY-MM-DD')
  if (!report.isValid()) return false
  const now = beijingNow()
  return report.isAfter(now.subtract(REPORT_MAX_AGE_MONTHS, 'month')) && report.isBefore(now.add(7, 'day'))
}

function parseRatio(raw: number | string | undefined): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100) / 100
}

function detectReportType(reportDate?: string): string {
  const m = String(reportDate || '').match(/-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const mm = m[1]
  if (mm === '12') return '年报'
  if (mm === '06') return '半年报'
  if (mm === '03') return '一季报'
  if (mm === '09') return '三季报'
  return '季报'
}

const PREFIX_TO_EM_MARKET: Record<string, string> = {
  sh: '1',
  sz: '0',
  bj: '0',
  hk: '116',
  us: '105',
}

function parseGpdm(rawCode: string): { stockCode: string; emMarketCode: string } {
  const raw = rawCode.trim()
  if (!raw) return { stockCode: '', emMarketCode: '' }

  const mPref = raw.match(/^(sh|sz|bj|hk|us)(.+)$/i)
  if (mPref) {
    const p = mPref[1].toLowerCase()
    const rest = String(mPref[2] || '').trim()
    const em = PREFIX_TO_EM_MARKET[p] ?? ''
    if (p === 'hk') return { stockCode: rest.padStart(5, '0'), emMarketCode: em }
    if (p === 'us') return { stockCode: rest.toUpperCase(), emMarketCode: em }
    return { stockCode: rest, emMarketCode: em }
  }

  const hkDot = raw.match(/^(\d{4,5})\.HK$/i)
  if (hkDot) return { stockCode: hkDot[1].padStart(5, '0'), emMarketCode: '116' }

  const usDot = raw.match(/^([A-Za-z]{1,10})\.[A-Za-z]{1,6}$/)
  if (usDot) return { stockCode: usDot[1].toUpperCase(), emMarketCode: '105' }

  if (/^\d{5}$/.test(raw)) return { stockCode: raw, emMarketCode: '116' }
  if (/^[A-Za-z]{1,6}$/.test(raw)) return { stockCode: raw.toUpperCase(), emMarketCode: '105' }

  return { stockCode: raw, emMarketCode: '' }
}
