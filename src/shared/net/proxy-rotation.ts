

import { PROXY_CANDIDATES, type ProxyCandidate } from './proxy-candidates'
import { PROXY_BREAK_THRESHOLD, PROXY_BREAK_COOLDOWN_MS } from '@/config/constants'
import { withBudget } from '@/shared/net/net-budget'

interface ProxyState {
  failStreak: number
  breakUntil: number
  lastFailAt: number
  probeAt: number
}

const proxyStates: ProxyState[] = PROXY_CANDIDATES.map(() => ({ failStreak: 0, breakUntil: 0, lastFailAt: 0, probeAt: 0 }))

const FAIL_DEBOUNCE_MS = 1000

const PROBE_INTERVAL_MS = 5000

function markProxyFail(idx: number): void {
  const s = proxyStates[idx]
  const now = Date.now()
  if (now - s.lastFailAt < FAIL_DEBOUNCE_MS) return
  s.lastFailAt = now
  s.failStreak++
  if (s.failStreak >= PROXY_BREAK_THRESHOLD) {
    s.breakUntil = now + PROXY_BREAK_COOLDOWN_MS
  }
}

function markProxyOk(idx: number): void {
  const s = proxyStates[idx]
  s.failStreak = 0
  s.breakUntil = 0
  s.probeAt = 0
}

function isProxyBroken(idx: number): boolean {
  const s = proxyStates[idx]
  const now = Date.now()
  if (s.breakUntil <= now) {
    if (s.breakUntil > 0) s.breakUntil = 0
    return false
  }

  if (now - s.probeAt >= PROBE_INTERVAL_MS) {
    s.probeAt = now
    return false
  }
  return true
}

function availableProxyIndexes(): number[] {
  const out: number[] = []
  for (let i = 0; i < PROXY_CANDIDATES.length; i++) {
    if (!isProxyBroken(i)) out.push(i)
  }
  return out
}

async function fetchViaProxy(candidate: ProxyCandidate, targetUrl: string, timeoutMs: number): Promise<{ data: any | null; reason: string }> {
  const proxyUrl = candidate.build(targetUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await withBudget(proxyUrl, () => fetch(proxyUrl, { signal: controller.signal }))
    clearTimeout(timer)
    if (!resp.ok) return { data: null, reason: `HTTP ${resp.status}` }

    if (candidate.wrap) {
      const raw = await resp.json() as { contents?: string; status?: { http_code?: number } }
      if (raw?.status?.http_code && raw.status.http_code !== 200) {
        return { data: null, reason: `目标http_code=${raw.status.http_code}` }
      }
      const contents = raw?.contents
      if (typeof contents !== 'string' || contents.length === 0) {
        return { data: null, reason: 'contents空' }
      }
      return { data: JSON.parse(contents), reason: '' }
    } else {
      const text = await resp.text()
      if (!text || text.length === 0) return { data: null, reason: '响应体空' }
      return { data: JSON.parse(text), reason: '' }
    }
  } catch (e) {
    clearTimeout(timer)

    const aborted = e instanceof DOMException && e.name === 'AbortError'
    return { data: null, reason: aborted ? `超时(${timeoutMs}ms)` : 'fetch异常' }
  }
}

export async function fetchWithProxyRotation(
  targetUrl: string,
  timeoutMs: number = 6000,
): Promise<{ data: any | null; proxyFailed: boolean }> {
  const MAX_RETRY = 2
  let lastReason = ''
  let attempted = false

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const indexes = availableProxyIndexes()
    if (indexes.length === 0) break

    for (const idx of indexes) {
      const candidate = PROXY_CANDIDATES[idx]
      attempted = true
      const { data, reason } = await fetchViaProxy(candidate, targetUrl, timeoutMs)
      if (data != null) {
        markProxyOk(idx)
        return { data, proxyFailed: false }
      }
      markProxyFail(idx)
      if (reason) lastReason = reason
    }
  }

  if (!attempted) {
    return { data: null, proxyFailed: true }
  }

  // eslint-disable-next-line no-console
  console.warn(`[proxy] allorigins 重试${MAX_RETRY}次全失败 (${lastReason})`)
  return { data: null, proxyFailed: true }
}
