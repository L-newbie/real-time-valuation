import { loadJSON, saveJSON, removeKey } from '@/shared/cache/local-storage-io'
import { STORAGE_KEYS } from '@/config/constants'

export type CodeMatchSource = 'variant' | 'cn-name' | 'en-name'

interface CodeEntry {
  code: string
  em?: string
  by: CodeMatchSource
  at: number
}

interface CodeMapFile {
  v: number
  entries: Record<string, CodeEntry>
}

const VERSION = 1
const MAX_ENTRIES = 1000
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

let cache: Map<string, CodeEntry> | null = null

function normalizeKey(raw: string): string {
  return String(raw ?? '').trim().toUpperCase()
}

function load(): Map<string, CodeEntry> {
  if (cache) return cache
  const map = new Map<string, CodeEntry>()
  try {
    const raw = loadJSON<CodeMapFile | null>(STORAGE_KEYS.STOCK_CODE_MAP, null)
    if (raw && raw.v === VERSION && raw.entries && typeof raw.entries === 'object') {
      const cutoff = Date.now() - MAX_AGE_MS
      for (const [k, e] of Object.entries(raw.entries)) {
        if (!e || typeof e.code !== 'string' || !e.code) continue
        if (typeof e.at !== 'number' || e.at < cutoff) continue
        map.set(k, e)
      }
    }
  } catch {  }
  cache = map
  return map
}

function persist(map: Map<string, CodeEntry>): void {
  const entries: Record<string, CodeEntry> = {}
  for (const [k, e] of map) entries[k] = e
  try {
    saveJSON(STORAGE_KEYS.STOCK_CODE_MAP, { v: VERSION, entries })
  } catch {  }
}

function touch(map: Map<string, CodeEntry>, key: string, entry: CodeEntry): void {
  if (map.has(key)) {
    map.delete(key)
  } else if (map.size >= MAX_ENTRIES) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, entry)
}

export function lookupMappedCode(...keys: Array<string | undefined>): CodeEntry | null {
  const map = load()
  const cutoff = Date.now() - MAX_AGE_MS
  for (const raw of keys) {
    const k = normalizeKey(raw ?? '')
    if (!k) continue
    const e = map.get(k)
    if (!e) continue
    if (e.at < cutoff) { map.delete(k); continue }
    map.delete(k)
    map.set(k, e)
    return e
  }
  return null
}

export function rememberMappedCode(
  targetCode: string,
  by: CodeMatchSource,
  aliases: Array<string | undefined>,
  em?: string,
): void {
  const std = normalizeKey(targetCode)
  if (!std) return
  const map = load()
  const entry: CodeEntry = { code: std, em, by, at: Date.now() }
  let added = false
  for (const raw of aliases) {
    const k = normalizeKey(raw ?? '')
    if (!k || k === std) continue
    touch(map, k, entry)
    added = true
  }
  if (added) persist(map)
}

export function codeMapStats(): { size: number; bySource: Record<string, number> } {
  const map = load()
  const bySource: Record<string, number> = {}
  for (const e of map.values()) bySource[e.by] = (bySource[e.by] ?? 0) + 1
  return { size: map.size, bySource }
}

export function clearCodeMap(): void {
  cache = new Map()
  removeKey(STORAGE_KEYS.STOCK_CODE_MAP)
}
