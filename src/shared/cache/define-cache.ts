import { loadJSON, saveJSON, removeKey } from '@/shared/cache/local-storage-io'

export type PoolName = 'fund' | 'shared' | 'board'

export interface CacheEntry<T> {
  v: T
  src?: string
  q: number
  at: number
  exp: number
  asOf?: string
}

export interface CacheResult<T> {
  data: T | undefined
  stale: boolean
  missing: boolean
  asOf: string
  src: string
}

export interface CacheOptions<T> {
  pool: PoolName
  name: string
  ttl: number | ((v: T) => number)
  max?: number
  quality?: (v: T) => number
  isEmpty?: (v: T) => boolean
  asOf?: (v: T) => string
  merge?: (prev: T, next: T) => T

  persistent?: boolean
}

export interface CacheStats {
  pool: PoolName
  name: string
  keys: number
  bytes: number
  hits: number
  misses: number
  stales: number
  writes: number
  rejected: number
}

const POOL_PREFIX: Record<PoolName, string> = { fund: 'jgb_p_f', shared: 'jgb_p_s', board: 'jgb_p_b' }

const registry: Array<{ stats: () => CacheStats; clear: () => void; flush: () => void; storageKey: string; pool: PoolName; persistent: boolean }> = []

const flushTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function defineCache<T>(opts: CacheOptions<T>) {
  const storageKey = `${POOL_PREFIX[opts.pool]}_${opts.name}`
  const mem = new Map<string, CacheEntry<T>>()
  const inflight = new Map<string, Promise<T | null>>()
  let restored = false
  let hits = 0, misses = 0, stales = 0, writes = 0, rejected = 0

  const qualityOf = (v: T): number => (opts.quality ? opts.quality(v) : 50)
  const emptyOf = (v: T): boolean => {
    if (v == null) return true
    if (opts.isEmpty) return opts.isEmpty(v)
    if (Array.isArray(v)) return v.length === 0
    return false
  }
  const ttlOf = (v: T): number => (typeof opts.ttl === 'function' ? opts.ttl(v) : opts.ttl)

  function ensureRestored(): void {
    if (restored) return
    restored = true
    const raw = loadJSON<Record<string, CacheEntry<T>> | null>(storageKey, null)
    if (!raw || typeof raw !== 'object') return
    for (const [k, e] of Object.entries(raw)) {
      if (e && typeof e === 'object' && 'v' in e) mem.set(k, e)
    }
  }

  function scheduleFlush(): void {
    const t = flushTimers.get(storageKey)
    if (t) clearTimeout(t)
    flushTimers.set(storageKey, setTimeout(flush, 800))
  }

  function flush(): void {
    const t = flushTimers.get(storageKey)
    if (t) { clearTimeout(t); flushTimers.delete(storageKey) }
    const disk = loadJSON<Record<string, CacheEntry<T>> | null>(storageKey, null) ?? {}
    for (const [k, e] of mem) {
      const d = disk[k]
      if (!d || (e.at ?? 0) >= (d.at ?? 0)) disk[k] = e
    }
    const now = Date.now()
    for (const k of Object.keys(disk)) {
      const e = disk[k]
      if (!e || (e.exp > 0 && e.exp < now - 7 * 86400000)) delete disk[k]
    }
    saveJSON(storageKey, disk)
  }

  function evictIfNeeded(): void {
    const max = opts.max ?? 0
    if (max <= 0 || mem.size <= max) return
    const sorted = [...mem.entries()].sort((a, b) => (a[1].at ?? 0) - (b[1].at ?? 0))
    const drop = mem.size - max
    for (let i = 0; i < drop; i++) mem.delete(sorted[i][0])
  }

  function get(key: string): CacheResult<T> {
    ensureRestored()
    const e = mem.get(key)
    if (!e) {
      misses++
      return { data: undefined, stale: false, missing: true, asOf: '', src: '' }
    }
    const stale = e.exp > 0 && Date.now() > e.exp
    if (stale) stales++
    else hits++
    return { data: e.v, stale, missing: false, asOf: e.asOf ?? '', src: e.src ?? '' }
  }

  function peek(key: string): T | undefined {
    ensureRestored()
    return mem.get(key)?.v
  }

  function set(key: string, value: T, meta?: { src?: string }): boolean {
    ensureRestored()
    if (value == null || emptyOf(value)) { rejected++; return false }

    const prev = mem.get(key)
    let next: T = value
    if (prev) {
      const pq = prev.q ?? qualityOf(prev.v)
      const nq = qualityOf(value)
      if (nq < pq) {
        if (opts.merge) next = opts.merge(prev.v, value)
        else { rejected++; return false }
      } else if (opts.merge) {
        next = opts.merge(prev.v, value)
      }
    }

    const now = Date.now()
    const ttl = ttlOf(next)
    mem.set(key, {
      v: next,
      src: meta?.src,
      q: qualityOf(next),
      at: now,
      exp: ttl > 0 ? now + ttl : 0,
      asOf: opts.asOf ? opts.asOf(next) : undefined,
    })
    writes++
    evictIfNeeded()
    scheduleFlush()
    return true
  }

  function setMany(entries: Array<[string, T]>, meta?: { src?: string }): number {
    let n = 0
    for (const [k, v] of entries) if (set(k, v, meta)) n++
    return n
  }

  function missing(keys: string[]): string[] {
    ensureRestored()
    const out: string[] = []
    for (const k of keys) {
      const r = get(k)
      if (r.missing || r.stale) out.push(k)
    }
    return out
  }

  function fetch(key: string, loader: () => Promise<T | null>, meta?: { src?: string }): Promise<T | null> {
    const cur = get(key)
    if (!cur.missing && !cur.stale) return Promise.resolve(cur.data ?? null)

    const running = inflight.get(key)
    if (running) return running

    const p = (async () => {
      try {
        const v = await loader()
        if (v != null) set(key, v, meta)
        return peek(key) ?? v
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, p)
    return p
  }

  function del(key: string): void {
    ensureRestored()
    mem.delete(key)
    scheduleFlush()
  }

  function clear(): void {
    mem.clear()
    removeKey(storageKey)
  }

  function stats(): CacheStats {
    ensureRestored()
    let bytes = 0
    try { bytes = (localStorage.getItem(storageKey) ?? '').length * 2 } catch {  }
    return { pool: opts.pool, name: opts.name, keys: mem.size, bytes, hits, misses, stales, writes, rejected }
  }

  registry.push({ stats, clear, flush, storageKey, pool: opts.pool, persistent: opts.persistent === true })

  return { get, peek, set, setMany, missing, fetch, del, clear, stats, flush, storageKey }
}

export function listCaches(): CacheStats[] {
  return registry.map(r => r.stats())
}

export function cacheStorageKeys(pool?: PoolName): string[] {
  return registry
    .filter(r => !r.persistent && (!pool || r.pool === pool))
    .map(r => r.storageKey)
}

export function clearPool(pool: PoolName): void {
  for (const r of registry) if (!r.persistent && r.pool === pool) r.clear()
}

export function clearAllPools(): void {
  for (const r of registry) if (!r.persistent) r.clear()
}

export function flushPendingCaches(): void {
  if (flushTimers.size === 0) return
  for (const r of registry) {
    if (flushTimers.has(r.storageKey)) r.flush()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key) return
    const hit = registry.find(r => r.storageKey === e.key)
    if (hit) window.dispatchEvent(new CustomEvent('jgb-cache-external', { detail: { key: e.key } }))
  })

  window.addEventListener('pagehide', flushPendingCaches)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingCaches()
  })
}
