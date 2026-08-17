import { withBudget } from '@/shared/net/net-budget'
import { defineCache } from '@/shared/cache/define-cache'
import { isValidFundCode } from '@/shared/utils/validation'

export interface FundBaseInfo {
  establishDate: string
  scale: string
  confirmDays: number | null
  company: string
  benchmark: string
  riskLevel: string
}

const baseInfoCache = defineCache<FundBaseInfo>({
  pool: 'fund',
  name: 'base-info',
  ttl: 30 * 24 * 60 * 60 * 1000,
  max: 200,
  isEmpty: (v) => !v?.establishDate && !v?.company && v?.confirmDays == null,
})

function pick(d: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = d[k]
    if (v != null && String(v).trim() && String(v) !== '--') return String(v).trim()
  }
  return ''
}

export async function fetchFundBaseInfo(fundCode: string): Promise<FundBaseInfo | null> {
  if (!isValidFundCode(fundCode)) return null

  const cached = baseInfoCache.get(fundCode)
  if (!cached.missing && !cached.stale) return cached.data ?? null

  const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNBaseInfo?FCODE=${fundCode}`
    + `&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=rtf${Date.now()}`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const resp = await withBudget(url, () => fetch(url, { signal: ctrl.signal }))
    if (!resp.ok) return cached.data ?? null
    const json = await resp.json() as { Success?: boolean; Datas?: Record<string, unknown> }
    if (!json?.Success || !json.Datas) return cached.data ?? null

    const d = json.Datas
    const confirmRaw = Number(d.SSBCFMDATA)
    const info: FundBaseInfo = {
      establishDate: pick(d, ['ESTABDATE', 'FOUNDDATE', 'ESTABLISHDATE']),
      scale: pick(d, ['ENDNAV', 'NETNAV', 'FUNDSCALE']),
      confirmDays: Number.isFinite(confirmRaw) && confirmRaw > 0 ? confirmRaw : null,
      company: pick(d, ['JJGS', 'FUNDCOMPANY', 'MANAGERNAME']),
      benchmark: pick(d, ['BENCH', 'BENCHMARK']),
      riskLevel: pick(d, ['RISKLEVEL', 'RLEVEL_SZ']),
    }
    baseInfoCache.set(fundCode, info, { src: 'fundmob' })
    return info
  } catch {
    return cached.data ?? null
  } finally {
    clearTimeout(timer)
  }
}
