

import type { KnownManager, ManagerChange } from '../fund-types'
import { STORAGE_KEYS, FUND_VALUATION_CONFIG } from '@/config/constants'
import { loadJSON, saveJSON } from '@/shared/cache/local-storage-io'
import { defineCache } from '@/shared/cache/define-cache'
import { getBeijingTodayStr } from '../valuation/cn-trading-day'
import { loadPingzhong } from '@/shared/net/pingzhong-loader'

const managerCache = defineCache<KnownManager>({
  pool: 'fund',
  name: 'manager',
  ttl: 30 * 24 * 60 * 60 * 1000,
  max: 200,
  isEmpty: (v) => !v?.managerName,
})

export function loadKnownManagers(): Record<string, KnownManager> {
  const legacy = loadJSON<Record<string, KnownManager>>(STORAGE_KEYS.FUND_MANAGERS, {})
  const out: Record<string, KnownManager> = { ...legacy }
  for (const code of Object.keys(legacy)) {
    const hit = managerCache.peek(code)
    if (hit) out[code] = hit
  }
  return out
}

export function saveKnownManagers(data: Record<string, KnownManager>): void {
  for (const [code, v] of Object.entries(data)) managerCache.set(code, v)
  saveJSON(STORAGE_KEYS.FUND_MANAGERS, data)
}

export function removeKnownManager(fundCode: string): void {
  const data = loadKnownManagers()
  delete data[fundCode]
  saveKnownManagers(data)
}

async function fetchFundManager(fundCode: string): Promise<{ name: string; manager: string } | null> {
  const data = await loadPingzhong(fundCode)
  if (!data) return null
  const managers = data.Data_currentFundManager as Array<{ name?: string }> | undefined
  const manager = managers?.[0]?.name
  const name = (data.fS_name as string | undefined) ?? fundCode
  if (!manager || manager === '--') return null
  return { name, manager }
}

export async function checkManagerChanges(fundCodes: string[]): Promise<ManagerChange[]> {
  if (fundCodes.length === 0) return []

  const known = loadKnownManagers()
  const today = getBeijingTodayStr()
  const changes: ManagerChange[] = []
  const concurrency = FUND_VALUATION_CONFIG.MANAGER_CHECK_CONCURRENCY

  for (let i = 0; i < fundCodes.length; i += concurrency) {
    const batch = fundCodes.slice(i, i + concurrency)
    await Promise.allSettled(batch.map(async (code) => {
      if (known[code]?.updatedAt === today) return
      const result = await fetchFundManager(code)
      if (!result) return

      const prev = known[code]
      if (prev && prev.managerName !== result.manager) {
        changes.push({
          fundCode: code,
          fundName: result.name,
          oldManager: prev.managerName,
          newManager: result.manager,
        })
      }
      known[code] = {
        fundCode: code,
        fundName: result.name,
        managerName: result.manager,
        updatedAt: today,
      }
    }))
  }

  saveKnownManagers(known)
  return changes
}
