import type { FundValuation } from '@/modules/fund/fund-types'
import { withBudget } from '@/shared/net/net-budget'
import { isValidFundCode } from '@/shared/utils/validation'

const ENDPOINT = 'https://fundcomapi.tiantianfunds.com/mm/newCore/FundValuationLast'

const FIELDS = 'FCODE,SHORTNAME,GSZZL,GZTIME,GSZ'

const BATCH_SIZE = 50

const TIMEOUT = 8000

interface RawItem {
  FCODE?: string | number
  SHORTNAME?: string
  GSZZL?: string | number
  GZTIME?: string
  GSZ?: string | number
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeTime(raw: string | undefined): string {
  if (!raw) return ''
  return String(raw).replace(/:(\d{2}):\d{2}$/, ':$1')
}

function toValuation(item: RawItem): { code: string; v: FundValuation } | null {
  const code = item.FCODE != null ? String(item.FCODE).trim() : ''
  if (!code) return null

  const gsz = num(item.GSZ)
  const gszzl = num(item.GSZZL)
  if (gsz == null && gszzl == null) return null

  const v: FundValuation = {
    fundcode: code,
    name: item.SHORTNAME ? String(item.SHORTNAME) : `基金(${code})`,
    gztime: normalizeTime(item.GZTIME),
    gz: gsz ?? 0,
    dwjz: 0,
    gszzl: gszzl ?? 0,
    isEstimated: true,
  }
  return { code, v }
}

export async function fetchValuationBatch(codes: string[]): Promise<Map<string, FundValuation>> {
  const out = new Map<string, FundValuation>()
  const valid = codes.filter(isValidFundCode)
  if (valid.length === 0) return out

  const chunks: string[][] = []
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    chunks.push(valid.slice(i, i + BATCH_SIZE))
  }

  await Promise.all(chunks.map(async (chunk) => {
    const url = `${ENDPOINT}?FCODES=${encodeURIComponent(chunk.join(','))}&FIELDS=${encodeURIComponent(FIELDS)}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
    try {
      const resp = await withBudget(url, () => fetch(url, { signal: ctrl.signal }))
      if (!resp.ok) return
      const json = await resp.json() as { success?: boolean; data?: RawItem[] }
      if (!json?.success || !Array.isArray(json.data)) return
      for (const item of json.data) {
        const r = toValuation(item)
        if (r) out.set(r.code, r.v)
      }
    } catch {
    } finally {
      clearTimeout(timer)
    }
  }))

  return out
}
