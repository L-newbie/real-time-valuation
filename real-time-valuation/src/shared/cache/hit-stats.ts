export interface HitStat {
  name: string
  group: string
  hits: number
  misses: number
  writes: number
  rejected: number
  keys: number
  desc: string
}

const stats = new Map<string, HitStat>()

const META: Record<string, { group: string; desc: string }> = {
  '基金估值': { group: '基金', desc: '首屏与列表的估值数据，命中即无需请求天天基金' },
  '推算持仓': { group: '基金', desc: '前十大重仓及占比，季报级数据缓存 100 天' },
  'T+1持仓': { group: '基金', desc: 'T+1 基金持仓，与推算持仓同源复用' },
  '分时走势': { group: '基金', desc: '当日分时估值点，跨日作废' },
  '基金经理': { group: '基金', desc: '经理快照，用于变更提醒' },
  '股票昨收': { group: '公共', desc: '持仓股昨收涨跌，跨基金共享同一份' },
  '股票实时': { group: '公共', desc: '持仓股实时涨跌，盘中高频读写' },
  '指数报价': { group: '公共', desc: '大盘指数，供指数条与首页展示' },
  '自选股行情': { group: '板块', desc: '自选股列表行情快照' },
  '板块排行': { group: '板块', desc: 'ETF 与板块榜单，盘中 30 秒过期' },
  '资讯列表': { group: '板块', desc: '财经快讯，分钟级时效' },
  '基金目录': { group: '公共', desc: '全市场基金检索表，仅内存不落盘' },
}

function of(name: string): HitStat {
  let s = stats.get(name)
  if (!s) {
    const m = META[name] ?? { group: '其他', desc: '未分类缓存' }
    s = { name, group: m.group, desc: m.desc, hits: 0, misses: 0, writes: 0, rejected: 0, keys: 0 }
    stats.set(name, s)
  }
  return s
}

export function recordHit(name: string, n = 1): void {
  of(name).hits += n
}

export function recordMiss(name: string, n = 1): void {
  of(name).misses += n
}

export function recordWrite(name: string, n = 1): void {
  of(name).writes += n
}

export function recordReject(name: string, n = 1): void {
  of(name).rejected += n
}

export function recordKeys(name: string, n: number): void {
  of(name).keys = n
}

export function getHitStats(): HitStat[] {
  return [...stats.values()].sort((a, b) => (b.hits + b.misses) - (a.hits + a.misses))
}

export function resetHitStats(): void {
  stats.clear()
}
