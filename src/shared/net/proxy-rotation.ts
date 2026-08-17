

import { PROXY_CANDIDATES, type ProxyCandidate } from './proxy-candidates'
import { PROXY_BREAK_THRESHOLD, PROXY_BREAK_COOLDOWN_MS } from '@/config/constants'
import { withBudget } from '@/shared/net/net-budget'

interface ProxyState {
  failStreak: number
  breakUntil: number
}

const proxyStates: ProxyState[] = PROXY_CANDIDATES.map(() => ({ failStreak: 0, breakUntil: 0 }))

function markProxyFail(idx: number): void {
  const s = proxyStates[idx]
  s.failStreak++
  if (s.failStreak >= PROXY_BREAK_THRESHOLD) {
    s.breakUntil = Date.now() + PROXY_BREAK_COOLDOWN_MS
  }
}

function markProxyOk(idx: number): void {
  proxyStates[idx].failStreak = 0
}

function isProxyBroken(idx: number): boolean {
  const s = proxyStates[idx]
  if (s.breakUntil > Date.now()) return true
  if (s.breakUntil > 0 && s.breakUntil <= Date.now()) s.breakUntil = 0
  return false
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
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const indexes = availableProxyIndexes()
    const tryOrder = indexes.length > 0 ? indexes : [0]
    for (const idx of tryOrder) {
      const candidate = PROXY_CANDIDATES[idx]
      const { data, reason } = await fetchViaProxy(candidate, targetUrl, timeoutMs)
      if (data != null) {
        markProxyOk(idx)
        return { data, proxyFailed: false }
      }
      markProxyFail(idx)
      if (reason) lastReason = reason
    }
  }

  // eslint-disable-next-line no-console
  console.warn(`[proxy] allorigins 重试${MAX_RETRY}次全失败 (${lastReason})`)
  return { data: null, proxyFailed: true }
}
