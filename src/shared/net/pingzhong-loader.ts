import { API_URLS, LSJZ_CONFIG } from '@/config/constants'
import { runScriptTask } from '@/shared/net/script-data-locks'
import { withBudget } from '@/shared/net/net-budget'

export interface PingzhongData {
  fS_name?: string
  fS_type?: string
  fS_code?: string
  fS_purchaseStatus?: string
  fS_redeemStatus?: string
  Data_netWorthTrend?: unknown
  Data_ACWorthTrend?: unknown
  Data_grandTotal?: unknown
  Data_currentFundManager?: unknown
  Data_fluctuationScale?: unknown
  Data_assetAllocation?: unknown
  Data_fundSharesPositions?: unknown
  Data_holderStructure?: unknown
  Data_rateInSimilarType?: unknown
  Data_performanceEvaluation?: unknown
  stockCodesNew?: unknown
  stockCodes?: unknown
  zqCodesNew?: unknown
  zqCodes?: unknown
  syl_1n?: unknown
  syl_6y?: unknown
  syl_3y?: unknown
  syl_1y?: unknown
  fund_Rate?: unknown
  fund_minsg?: unknown
  fund_sourceRate?: unknown
}

const SNAPSHOT_KEYS: readonly string[] = [
  'fS_name', 'fS_type', 'fS_code', 'fS_purchaseStatus', 'fS_redeemStatus',
  'Data_netWorthTrend', 'Data_ACWorthTrend', 'Data_grandTotal',
  'Data_currentFundManager', 'Data_fluctuationScale', 'Data_assetAllocation',
  'Data_fundSharesPositions', 'Data_holderStructure', 'Data_rateInSimilarType',
  'Data_performanceEvaluation',
  'stockCodesNew', 'stockCodes', 'zqCodesNew', 'zqCodes',
  'syl_1n', 'syl_6y', 'syl_3y', 'syl_1y',
  'fund_Rate', 'fund_minsg', 'fund_sourceRate',
]

export function loadPingzhong(fundCode: string, timeout: number = LSJZ_CONFIG.TIMEOUT): Promise<PingzhongData | null> {
  const url = `${API_URLS.FUND_DETAIL}${fundCode}.js`
  return runScriptTask(`pz:${fundCode}`, () => withBudget(url, () => loadRaw(fundCode, timeout)))
}

function loadRaw(fundCode: string, timeout: number): Promise<PingzhongData | null> {
  return new Promise((resolve) => {
    const w = window as unknown as Record<string, unknown>
    const url = `${API_URLS.FUND_DETAIL}${fundCode}.js?rt=${Date.now()}`
    const script = document.createElement('script')
    let done = false

    const timer = setTimeout(() => {
      if (done) return
      done = true
      cleanup()
      resolve(null)
    }, timeout)

    function snapshot(): PingzhongData {
      const data: Record<string, unknown> = {}
      for (const k of SNAPSHOT_KEYS) data[k] = w[k]
      return data as PingzhongData
    }

    function clearGlobals(): void {
      for (const k of SNAPSHOT_KEYS) {
        try { delete w[k] } catch { w[k] = undefined }
      }
    }

    function cleanup(): void {
      clearTimeout(timer)
      script.onload = null
      script.onerror = null
      clearGlobals()
      if (script.parentNode) script.parentNode.removeChild(script)
    }

    script.onload = () => {
      if (done) return
      done = true
      const data = snapshot()
      cleanup()
      resolve(data)
    }
    script.onerror = () => {
      if (done) return
      done = true
      cleanup()
      resolve(null)
    }
    script.src = url
    document.head.appendChild(script)
  })
}
