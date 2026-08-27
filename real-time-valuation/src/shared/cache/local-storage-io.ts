const LEGACY_PURGE_KEYS = ['jgb_fund_catalog', 'jgb_perf_intervals']

let purged = false

function purgeLegacy(): void {
  if (purged) return
  purged = true
  for (const k of LEGACY_PURGE_KEYS) {
    try { localStorage.removeItem(k) } catch {  }
  }
}

let lastQuotaError = 0

export function getLastQuotaError(): number {
  return lastQuotaError
}

const EVICTABLE_PREFIXES = ['jgb_p_b', 'jgb_sector_cache', 'jgb_news_', 'jgb_stock_quotes', 'jgb_index_quotes']

function evictSome(exceptKey: string): boolean {
  try {
    const victims: Array<{ key: string; size: number }> = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || k === exceptKey) continue
      if (!EVICTABLE_PREFIXES.some(p => k.startsWith(p))) continue
      victims.push({ key: k, size: (localStorage.getItem(k) ?? '').length })
    }
    if (victims.length === 0) return false
    victims.sort((a, b) => b.size - a.size)
    for (const v of victims.slice(0, Math.max(1, Math.ceil(victims.length / 4)))) {
      localStorage.removeItem(v.key)
    }
    return true
  } catch {
    return false
  }
}

function writeRaw(key: string, raw: string): void {
  purgeLegacy()
  try {
    localStorage.setItem(key, raw)
  } catch {
    if (evictSome(key)) {
      try {
        localStorage.setItem(key, raw)
        return
      } catch {  }
    }
    lastQuotaError = Date.now()
  }
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value))
  } catch {  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {  }
}

export function loadString(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function saveString(key: string, value: string): void {
  writeRaw(key, value)
}

export function hasSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function setSessionFlag(key: string): void {
  try {
    sessionStorage.setItem(key, '1')
  } catch {  }
}
