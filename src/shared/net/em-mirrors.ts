import { jsonpRequest, genCallbackName } from '@/shared/net/jsonp-main'
import { withBudget } from '@/shared/net/net-budget'
import { API_URLS } from '@/config/constants'

const MIRRORS = API_URLS.STOCK_QUOTES_MIRRORS

const CORS_HOSTS = ['push2delay.eastmoney.com']

let preferred = 0

const failedAt = new Map<number, number>()

const COOLDOWN = 60 * 1000

function usable(i: number): boolean {
  const t = failedAt.get(i)
  return !t || Date.now() - t > COOLDOWN
}

function order(): number[] {
  const idx = MIRRORS.map((_, i) => i)
  const head = idx.slice(preferred).concat(idx.slice(0, preferred))
  return head.filter(usable).concat(head.filter(i => !usable(i)))
}

function supportsCors(base: string): boolean {
  return CORS_HOSTS.some(h => base.includes(h))
}

async function viaFetch<T>(url: string, timeout: number): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const resp = await withBudget(url, () => fetch(url, { signal: ctrl.signal }))
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.json() as T
  } finally {
    clearTimeout(timer)
  }
}

export async function jsonpWithMirrors<T>(
  path: string,
  query: string,
  cbPrefix: string,
  timeout = 6000,
): Promise<T | null> {
  for (const i of order()) {
    const base = MIRRORS[i]
    try {
      let r: T
      if (supportsCors(base)) {
        r = await viaFetch<T>(`${base}${path}?${query}`, timeout)
      } else {
        const cb = genCallbackName(cbPrefix)
        r = await jsonpRequest<T>(`${base}${path}?${query}&cb=${cb}`, cb, timeout)
      }
      preferred = i
      failedAt.delete(i)
      return r
    } catch {
      failedAt.set(i, Date.now())
    }
  }
  return null
}

export function mirrorStatus(): Array<{ host: string; ok: boolean; preferred: boolean; cors: boolean }> {
  return MIRRORS.map((m, i) => ({
    host: m.replace('https://', ''),
    ok: usable(i),
    preferred: i === preferred,
    cors: supportsCors(m),
  }))
}
