import { listCaches, type CacheStats } from '@/shared/cache/define-cache'
import { getNetStats, getSessionStart, type NetStat } from '@/shared/net/net-budget'
import { getHitStats, type HitStat } from '@/shared/cache/hit-stats'
import { STORAGE_KEYS } from '@/config/constants'
import { getLastQuotaError } from '@/shared/cache/local-storage-io'

export interface StorageItem {
  key: string
  label: string
  bytes: number
  group: string
  desc: string
}

export interface StorageSummary {
  items: StorageItem[]
  total: number
  quota: number
  percent: number
  quotaHit: boolean
}

const KEY_LABELS: Record<string, { label: string; group: string; desc: string }> = {
  [STORAGE_KEYS.FUND_CACHE]: { label: '基金估值缓存', group: '基金', desc: '每只自选基金的估值与基础信息，首屏直接由它渲染' },
  [STORAGE_KEYS.FUND_NAMES]: { label: '基金名称', group: '基金', desc: '基金代码到名称的映射，近乎静态' },
  [STORAGE_KEYS.ESTIMATED_HOLDINGS_CACHE]: { label: '推算持仓', group: '基金', desc: '前十大重仓及占比，来自季报，缓存 100 天' },
  [STORAGE_KEYS.ESTIMATED_GSZZL_CACHE]: { label: '持仓加权涨跌', group: '基金', desc: '由持仓与行情推算的加权涨跌，派生值' },
  [STORAGE_KEYS.T1_HOLDINGS_CACHE]: { label: 'T+1 持仓', group: '基金', desc: 'T+1 基金的持仓明细，与推算持仓同源' },
  [STORAGE_KEYS.INTRADAY_MAP]: { label: '分时走势', group: '基金', desc: '当日分时估值点，跨日作废且无法补回' },
  [STORAGE_KEYS.FUND_MANAGERS]: { label: '基金经理', group: '基金', desc: '基金经理快照，用于变更提醒' },
  [STORAGE_KEYS.STOCK_PREV_DAY_CACHE]: { label: '股票昨收', group: '公共', desc: '全市场持仓股的昨收涨跌，跨基金共享' },
  [STORAGE_KEYS.STOCK_REALTIME_CACHE]: { label: '股票实时', group: '公共', desc: '持仓股实时涨跌，盘中高频写入' },
  [STORAGE_KEYS.INDEX_QUOTES_CACHE]: { label: '指数报价', group: '公共', desc: '大盘指数报价，供指数条展示' },
  [STORAGE_KEYS.STOCK_QUOTES_CACHE]: { label: '自选股报价', group: '板块', desc: '自选股行情快照' },
  [STORAGE_KEYS.SECTOR_CACHE]: { label: '板块排行', group: '板块', desc: '板块与 ETF 排行榜，盘中 30 秒过期' },
  [STORAGE_KEYS.NEWS_READ]: { label: '资讯已读', group: '板块', desc: '已读资讯标记，上限 500 条' },
  [STORAGE_KEYS.NEWS_OPENED]: { label: '资讯已打开', group: '板块', desc: '已打开资讯链接，上限 500 条' },
  [STORAGE_KEYS.NEWS_BLACKLIST]: { label: '资讯屏蔽', group: '板块', desc: '屏蔽的资讯来源' },
  [STORAGE_KEYS.HOLDINGS]: { label: '持仓账本', group: '用户', desc: '持仓账本，用户资产数据，清缓存不会删除' },
  [STORAGE_KEYS.HOLDING_ACTIONS]: { label: '操作流水', group: '用户', desc: '买入卖出流水记录' },
  [STORAGE_KEYS.PENDING_ACTIONS]: { label: '待确认操作', group: '用户', desc: '尚未确认的计划单' },
  [STORAGE_KEYS.FUND_CODES]: { label: '自选基金', group: '用户', desc: '自选基金代码列表' },
  [STORAGE_KEYS.WATCHLIST]: { label: '自选股票', group: '用户', desc: '自选股票列表' },
  [STORAGE_KEYS.USER_SETTINGS]: { label: '应用设置', group: '用户', desc: '主题、刷新间隔等偏好' },
  [STORAGE_KEYS.USER_AVATAR]: { label: '用户头像', group: '用户', desc: '自定义头像（图片体积可能较大）' },
  [STORAGE_KEYS.AUTH]: { label: '登录状态', group: '用户', desc: '登录凭据与用户信息' },
}

const LOCAL_QUOTA = 5 * 1024 * 1024

export function readStorageSummary(): StorageSummary {
  const items: StorageItem[] = []
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const raw = localStorage.getItem(key) ?? ''
      const bytes = (key.length + raw.length) * 2
      total += bytes
      const meta = KEY_LABELS[key]
      items.push({
        key,
        label: meta?.label ?? key.replace(/^jgb_/, ''),
        bytes,
        group: meta?.group ?? (key.startsWith('jgb_p_f') ? '基金' : key.startsWith('jgb_p_s') ? '公共' : key.startsWith('jgb_p_b') ? '板块' : '其他'),
        desc: meta?.desc ?? '统一缓存工厂托管的数据',
      })
    }
  } catch {  }
  items.sort((a, b) => b.bytes - a.bytes)
  const q = getLastQuotaError()
  return {
    items, total, quota: LOCAL_QUOTA,
    percent: (total / LOCAL_QUOTA) * 100,
    quotaHit: q > 0 && Date.now() - q < 10 * 60 * 1000,
  }
}

export function readCacheStats(): CacheStats[] {
  return listCaches()
}

export function readNetStats(): NetStat[] {
  return getNetStats()
}

export interface NetSummary {
  sent: number
  failed: number
  hosts: number
  avgMs: number
  maxMs: number
  peakQueued: number
  sessionMin: number
  successRate: number
}

export function readNetSummary(): NetSummary {
  const list = getNetStats()
  let sent = 0, failed = 0, totalMs = 0, maxMs = 0, peakQueued = 0
  for (const n of list) {
    sent += n.sent
    failed += n.failed
    totalMs += n.totalMs
    if (n.maxMs > maxMs) maxMs = n.maxMs
    if (n.peakQueued > peakQueued) peakQueued = n.peakQueued
  }
  return {
    sent, failed,
    hosts: list.length,
    avgMs: sent > 0 ? Math.round(totalMs / sent) : 0,
    maxMs,
    peakQueued,
    sessionMin: Math.max(1, Math.round((Date.now() - getSessionStart()) / 60000)),
    successRate: sent > 0 ? ((sent - failed) / sent) * 100 : 100,
  }
}

export interface CacheSummary {
  hits: number
  misses: number
  stales: number
  rejected: number
  keys: number
  hitRate: number
}

export function readCacheSummary(): CacheSummary {
  let hits = 0, misses = 0, stales = 0, rejected = 0, keys = 0
  for (const c of listCaches()) {
    hits += c.hits; misses += c.misses; stales += c.stales
    rejected += c.rejected; keys += c.keys
  }
  for (const h of getHitStats()) {
    hits += h.hits; misses += h.misses; rejected += h.rejected; keys += h.keys
  }
  const t = hits + misses
  return { hits, misses, stales, rejected, keys, hitRate: t > 0 ? (hits / t) * 100 : 0 }
}

export interface CacheRow {
  name: string
  group: string
  desc: string
  hits: number
  misses: number
  writes: number
  rejected: number
  keys: number
  rate: number
}

const FACTORY_CN: Record<string, string> = {
  'holidays': '节假日历',
  'yahoo-symbol': '雅虎代码映射',
  'manager': '基金经理档案',
  'index-quote': '指数报价库',
  'sector-rank': '板块排行榜',
  'watch-quote': '自选股行情',
  'stock-prev-day': '股票昨收库',
  'stock-realtime': '股票实时库',
  'intraday': '分时走势库',
  'holdings': '推算持仓库',
  't1-holdings': 'T+1持仓库',
  'valuation': '基金估值库',
  'news-read': '资讯已读表',
  'base-info': '基金档案库',
}

export function readCacheRows(): CacheRow[] {
  const rows: CacheRow[] = []
  for (const h of getHitStats()) {
    const t = h.hits + h.misses
    rows.push({ ...h, rate: t > 0 ? (h.hits / t) * 100 : 0 })
  }
  for (const c of listCaches()) {
    const t = c.hits + c.misses
    rows.push({
      name: FACTORY_CN[c.name] ?? c.name,
      group: c.pool === 'fund' ? '基金' : c.pool === 'shared' ? '公共' : '板块',
      desc: '由统一缓存工厂托管，支持质量分与过期重取',
      hits: c.hits, misses: c.misses, writes: c.writes, rejected: c.rejected, keys: c.keys,
      rate: t > 0 ? (c.hits / t) * 100 : 0,
    })
  }
  return rows.sort((a, b) => (b.hits + b.misses) - (a.hits + a.misses))
}

export type { HitStat }

export interface RuntimeInfo {
  memoryUsed: number
  memoryTotal: number
  hidden: boolean
  ua: 'mobile' | 'desktop'
}

export function readRuntime(): RuntimeInfo {
  const perf = performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
  return {
    memoryUsed: perf.memory?.usedJSHeapSize ?? 0,
    memoryTotal: perf.memory?.jsHeapSizeLimit ?? 0,
    hidden: typeof document !== 'undefined' && document.visibilityState !== 'visible',
    ua: typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  }
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
