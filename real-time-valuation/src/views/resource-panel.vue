<template>
  <div class="rp-page">
    <div class="rp-body">
      <section class="rp-hero glass-card">
        <div class="rp-hero-grid" aria-hidden="true" />
        <div class="rp-hero-top">
          <div class="rp-gauge">
            <svg viewBox="0 0 120 120" class="rp-gauge-svg">
              <circle class="rp-gauge-track" cx="60" cy="60" r="52" />
              <circle
                class="rp-gauge-fill" :class="meterTone"
                cx="60" cy="60" r="52"
                :stroke-dasharray="GAUGE_C" :stroke-dashoffset="gaugeOffset"
              />
            </svg>
            <div class="rp-gauge-core">
              <span class="rp-gauge-num font-number">{{ storage.percent.toFixed(1) }}</span>
              <span class="rp-gauge-unit">%</span>
            </div>
          </div>
          <div class="rp-hero-side">
            <p class="rp-hero-title">资源使用<span class="rp-hero-tag">{{ lastAtText }}</span></p>
            <p class="rp-hero-desc">
              本地可用空间约 {{ formatBytes(storage.quota) }}，写满后新数据会静默失败。
            </p>
            <p v-if="storage.quotaHit" class="rp-alert">
              <span class="rp-alert-dot" />存储已满，部分写入失败。请到「设置 → 数据管理」清除缓存。
            </p>
          </div>
          <button class="rp-refresh" type="button" :disabled="refreshing" @click="refresh">
            <svg :class="{ spin: refreshing }" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
            </svg>
            <span>{{ refreshing ? '采集中' : '刷新' }}</span>
          </button>
        </div>

        <div class="rp-sum-head">
          <span class="rp-dot" data-k="run" />
          <span class="rp-sum-title">总览 · 存储 / 网络 / 运行时</span>
        </div>
        <div class="rp-sum">
          <div class="rp-sum-cell">
            <em>已用空间</em>
            <b class="font-number">{{ formatBytes(storage.total) }}</b>
            <i class="font-number">剩余 {{ formatBytes(Math.max(storage.quota - storage.total, 0)) }}</i>
          </div>
          <div class="rp-sum-cell">
            <em>缓存命中</em>
            <b class="font-number" :class="rateTone(cacheSum.hitRate)">{{ cacheSum.hitRate.toFixed(0) }}%</b>
            <i class="font-number">省下 {{ cacheSum.hits }} 次请求</i>
          </div>
          <div class="rp-sum-cell">
            <em>网络请求</em>
            <b class="font-number">{{ netSum.sent }}</b>
            <i class="font-number">成功率 {{ netSum.successRate.toFixed(0) }}%</i>
          </div>
          <div class="rp-sum-cell">
            <em>平均耗时</em>
            <b class="font-number">{{ netSum.avgMs }}<u>ms</u></b>
            <i class="font-number">峰值 {{ netSum.maxMs }}ms</i>
          </div>
          <div class="rp-sum-cell">
            <em>JS 内存</em>
            <b class="font-number">{{ runtime.memoryUsed > 0 ? formatBytes(runtime.memoryUsed) : '—' }}</b>
            <i class="font-number">{{ runtime.memoryTotal > 0 ? '上限 ' + formatBytes(runtime.memoryTotal) : '不可用' }}</i>
          </div>
          <div class="rp-sum-cell">
            <em>页面状态</em>
            <b :class="runtime.hidden ? 'warn' : 'ok'">{{ runtime.hidden ? '后台' : '前台' }}</b>
            <i>{{ runtime.hidden ? '轮询已暂停' : runtime.ua === 'mobile' ? '移动端' : '桌面端' }}</i>
          </div>
          <div class="rp-sum-cell">
            <em>会话时长</em>
            <b class="font-number">{{ netSum.sessionMin }}<u>min</u></b>
            <i class="font-number">{{ (netSum.sent / netSum.sessionMin).toFixed(1) }} 请求/分</i>
          </div>
          <div class="rp-sum-cell">
            <em>存储条目</em>
            <b class="font-number">{{ storage.items.length }}</b>
            <i class="font-number">缓存 {{ cacheSum.keys }} 条</i>
          </div>
        </div>
        <p class="rp-note">
          行情轮询在页面切到后台时暂停、回到前台立即恢复，以降低移动端耗电与流量。
          缓存命中率越高，说明越多数据直接来自本地而无需联网。
        </p>
      </section>

      <section class="rp-card">
        <div class="rp-card-head">
          <span class="rp-dot" data-k="store" /><span class="rp-card-title">存储占用</span>
          <span class="rp-card-cap font-number">{{ storage.items.length }} 项</span>
        </div>
        <div class="rp-stack" role="img" aria-label="存储分池占比">
          <i v-for="g in groupTotals" :key="g.name" :data-g="g.name"
             :style="{ width: pct(g.bytes, storage.total) }" :title="`${g.name} ${formatBytes(g.bytes)}`" />
        </div>
        <div class="rp-legend">
          <button v-for="g in groupTotals" :key="g.name" type="button" class="rp-legend-item"
                  :class="{ on: groupFilter === g.name }"
                  @click="groupFilter = groupFilter === g.name ? '' : g.name">
            <span class="rp-dot" :data-g="g.name" />
            <span>{{ g.name }}</span>
            <span class="rp-legend-val font-number">{{ formatBytes(g.bytes) }}</span>
          </button>
        </div>
        <p class="rp-note">{{ GROUP_NOTE[groupFilter] ?? '点击图例筛选。基金池随自选数量增长，公共池被所有基金共享，用户池永不参与清理。' }}</p>
        <ul class="rp-list">
          <li v-for="it in visibleItems" :key="it.key" class="rp-item">
            <button type="button" class="rp-row rp-row-3" @click="toggle(it.key)">
              <span class="rp-dot" :data-g="it.group" />
              <span class="rp-row-name">{{ it.label }}</span>
              <span class="rp-bar"><i :data-g="it.group" :style="{ width: barWidth(it.bytes) }" /></span>
              <span class="rp-row-val font-number">{{ formatBytes(it.bytes) }}</span>
            </button>
            <Transition name="rp-fold">
              <div v-if="opened.has(it.key)" class="rp-fold"><div class="rp-clip"><div class="rp-fold-in">
                <p class="rp-fold-desc">{{ it.desc }}</p>
                <div class="rp-chips">
                  <span class="rp-chip"><em>键名</em><b class="font-number">{{ it.key }}</b></span>
                  <span class="rp-chip"><em>占比</em><b class="font-number">{{ pct(it.bytes, storage.total) }}</b></span>
                  <span class="rp-chip"><em>分池</em><b>{{ it.group }}</b></span>
                </div>
              </div></div></div>
            </Transition>
          </li>
        </ul>
      </section>

      <section class="rp-card">
        <div class="rp-card-head">
          <span class="rp-dot" data-k="cache" /><span class="rp-card-title">缓存命中</span>
          <span class="rp-card-cap font-number">{{ cacheSum.hitRate.toFixed(0) }}%</span>
        </div>
        <div class="rp-kpis">
          <div class="rp-kpi"><em>命中</em><b class="font-number ok">{{ cacheSum.hits }}</b><i>省下的请求数</i></div>
          <div class="rp-kpi"><em>未命中</em><b class="font-number">{{ cacheSum.misses }}</b><i>需要联网获取</i></div>
          <div class="rp-kpi"><em>拒绝写入</em><b class="font-number" :class="cacheSum.rejected > 0 ? 'warn' : ''">{{ cacheSum.rejected }}</b><i>空值或降级数据</i></div>
        </div>
        <p class="rp-note">命中即无需联网。「拒绝写入」是保护动作：取数失败或质量低于已有值时保留旧数据，避免界面空白或倒退。</p>
        <ul v-if="cacheRows.length > 0" class="rp-list">
          <li v-for="c in cacheRows" :key="c.name" class="rp-item">
            <button type="button" class="rp-row rp-row-3" @click="toggle('c:' + c.name)">
              <span class="rp-dot" :data-g="c.group" />
              <span class="rp-row-name">{{ c.name }}</span>
              <span class="rp-bar"><i data-g="rate" :style="{ width: c.rate.toFixed(0) + '%' }" /></span>
              <span class="rp-row-val font-number" :class="rateTone(c.rate)">{{ c.hits + c.misses > 0 ? c.rate.toFixed(0) + '%' : '—' }}</span>
            </button>
            <Transition name="rp-fold">
              <div v-if="opened.has('c:' + c.name)" class="rp-fold"><div class="rp-clip"><div class="rp-fold-in">
                <p class="rp-fold-desc">{{ c.desc }}</p>
                <div class="rp-chips">
                  <span class="rp-chip is-good"><em>命中</em><b class="font-number">{{ c.hits }}</b></span>
                  <span class="rp-chip"><em>未命中</em><b class="font-number">{{ c.misses }}</b></span>
                  <span class="rp-chip"><em>写入</em><b class="font-number">{{ c.writes }}</b></span>
                  <span v-if="c.keys > 0" class="rp-chip"><em>条目</em><b class="font-number">{{ c.keys }}</b></span>
                  <span v-if="c.rejected > 0" class="rp-chip is-bad"><em>拒写</em><b class="font-number">{{ c.rejected }}</b></span>
                </div>
              </div></div></div>
            </Transition>
          </li>
        </ul>
        <p v-else class="rp-empty">尚无缓存读写记录，稍后刷新</p>
      </section>

      <section class="rp-card">
        <div class="rp-card-head">
          <span class="rp-dot" data-k="net" /><span class="rp-card-title">网络请求</span>
          <span class="rp-card-cap font-number">近 {{ netSum.sessionMin }} 分钟</span>
        </div>
        <div class="rp-kpis">
          <div class="rp-kpi"><em>总请求</em><b class="font-number">{{ netSum.sent }}</b><i class="font-number">{{ netSum.hosts }} 个域名</i></div>
          <div class="rp-kpi"><em>成功率</em><b class="font-number" :class="rateTone(netSum.successRate)">{{ netSum.successRate.toFixed(0) }}%</b><i class="font-number">失败 {{ netSum.failed }}</i></div>
          <div class="rp-kpi"><em>平均耗时</em><b class="font-number">{{ netSum.avgMs }}<u>ms</u></b><i class="font-number">峰值 {{ netSum.maxMs }}ms</i></div>
        </div>
        <p class="rp-note">浏览器对单域名仅保持约 6 条并发连接，故各数据源都设了并发闸门。排队峰值高说明该源在被限流，属保护而非故障。</p>
        <ul v-if="net.length > 0" class="rp-list">
          <li v-for="n in net" :key="n.host" class="rp-item">
            <button type="button" class="rp-row rp-row-3" @click="toggle('n:' + n.host)">
              <span class="rp-dot" :data-live="n.active > 0" />
              <span class="rp-row-name">{{ shortHost(n.host) }}</span>
              <span class="rp-bar"><i data-g="net" :style="{ width: pct(n.sent, netSum.sent || 1) }" /></span>
              <span class="rp-row-val font-number">{{ n.sent }}</span>
            </button>
            <Transition name="rp-fold">
              <div v-if="opened.has('n:' + n.host)" class="rp-fold"><div class="rp-clip"><div class="rp-fold-in">
                <p class="rp-fold-desc">{{ hostDesc(n.host) }}</p>
                <div class="rp-chips">
                  <span class="rp-chip"><em>并发上限</em><b class="font-number">{{ n.budget }}</b></span>
                  <span class="rp-chip"><em>平均</em><b class="font-number">{{ n.sent > 0 ? Math.round(n.totalMs / n.sent) : 0 }}ms</b></span>
                  <span class="rp-chip"><em>最慢</em><b class="font-number">{{ n.maxMs }}ms</b></span>
                  <span v-if="n.peakQueued > 0" class="rp-chip"><em>排队峰值</em><b class="font-number">{{ n.peakQueued }}</b></span>
                  <span v-if="n.failed > 0" class="rp-chip is-bad"><em>失败</em><b class="font-number">{{ n.failed }}</b></span>
                </div>
              </div></div></div>
            </Transition>
          </li>
        </ul>
        <p v-else class="rp-empty">本次会话尚无请求记录</p>
      </section>

      <section class="rp-card">
        <div class="rp-card-head">
          <span class="rp-dot" data-k="data" /><span class="rp-card-title">数据规模</span>
          <span class="rp-card-cap">当前账户</span>
        </div>
        <div class="rp-kpis rp-kpis-4">
          <div class="rp-kpi"><em>自选基金</em><b class="font-number">{{ scale.funds }}</b><i>只</i></div>
          <div class="rp-kpi"><em>持仓记录</em><b class="font-number">{{ scale.holdings }}</b><i>笔</i></div>
          <div class="rp-kpi"><em>持仓股票</em><b class="font-number">{{ scale.stocks }}</b><i>去重后</i></div>
          <div class="rp-kpi"><em>自选股票</em><b class="font-number">{{ scale.watch }}</b><i>只</i></div>
        </div>
        <p class="rp-note">持仓股票是所有基金前十大重仓去重后的总数 —— 它决定了行情请求量，多只基金重仓同一股票时只取一次。</p>
      </section>

    </div>
  </div>
</template>
<script setup lang="ts">
defineOptions({ name: 'ResourcePanel' })

import { ref, computed, onActivated, onMounted } from 'vue'
import {
  readStorageSummary, readCacheStats, readNetStats, readRuntime, formatBytes,
  readNetSummary, readCacheSummary, readCacheRows,
  type StorageSummary, type NetSummary, type CacheSummary, type CacheRow,
} from '@/modules/resource/resource-stats'
import type { NetStat } from '@/shared/net/net-budget'
import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useStockStore } from '@/modules/stock/stock-store'

const GAUGE_C = 2 * Math.PI * 52

const GROUP_NOTE: Record<string, string> = {
  基金: '基金池按代码隔离，条目数随自选数量增长。删除自选基金会连带清除。',
  公共: '公共池被所有基金共享，如持仓股行情 —— 多只基金持有同一股票时只存一份。',
  板块: '板块池存放榜单与资讯等时效内容，空间紧张时最先被淘汰。',
  用户: '用户池是持仓账本与设置，属于你的资产数据，任何清理都不会触碰。',
  其他: '未纳入分池管理的历史键，后续会逐步收敛。',
}

const HOST_DESC: Record<string, string> = {
  'push2.eastmoney.com': '东方财富实时行情，供股票与指数报价，限流较严格',
  'push2his.eastmoney.com': '东方财富历史 K 线，用于昨收兜底',
  'fundgz.1234567.com.cn': '天天基金实时估值，盘中分钟级更新',
  'fund.eastmoney.com': '天天基金详情，含净值序列与持仓明细',
  'fundmobapi.eastmoney.com': '天天基金移动端接口，持仓占比的首选来源',
  'fundf10.eastmoney.com': '天天基金 F10 档案，全量持仓兜底',
  'qt.gtimg.cn': '腾讯实时报价，A股与港股主通道',
  'ifzq.gtimg.cn': '腾讯日 K 线，用于计算昨收涨跌',
  'query1.finance.yahoo.com': '雅虎财经，海外市场行情，需经代理转发',
  'api.allorigins.win': '跨域代理，为境外接口转发请求',
  'searchapi.eastmoney.com': '东方财富搜索建议',
  'stock.finance.sina.com.cn': '新浪分时估值曲线',
  'feed.mix.sina.com.cn': '新浪财经快讯',
  'date.nager.at': '各国节假日日历，每年更新一次',
}

const storage = ref<StorageSummary>({ items: [], total: 0, quota: 5 * 1024 * 1024, percent: 0, quotaHit: false })
const net = ref<NetStat[]>([])
const cacheRows = ref<CacheRow[]>([])
const netSum = ref<NetSummary>({ sent: 0, failed: 0, hosts: 0, avgMs: 0, maxMs: 0, peakQueued: 0, sessionMin: 1, successRate: 100 })
const cacheSum = ref<CacheSummary>({ hits: 0, misses: 0, stales: 0, rejected: 0, keys: 0, hitRate: 0 })
const runtime = ref(readRuntime())
const scale = ref({ funds: 0, holdings: 0, stocks: 0, watch: 0 })
const refreshing = ref(false)
const groupFilter = ref('')
const opened = ref<Set<string>>(new Set())

function toggle(key: string): void {
  const s = new Set(opened.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  opened.value = s
}

function readScale(): { funds: number; holdings: number; stocks: number; watch: number } {
  try {
    const f = useFundStore(); const h = useHoldingStore(); const w = useStockStore()
    const codes = new Set<string>()
    for (const [, entry] of f.estimatedHoldingsCache) {
      for (const it of entry.data.holdings) codes.add(it.stockCode)
    }
    return {
      funds: f.fundCodes.length,
      holdings: h.activeHoldings.length,
      stocks: codes.size,
      watch: w.watchlist.length,
    }
  } catch {
    return { funds: 0, holdings: 0, stocks: 0, watch: 0 }
  }
}

const lastAt = ref(0)

function collect(): void {
  storage.value = readStorageSummary()
  net.value = readNetStats()
  netSum.value = readNetSummary()
  cacheSum.value = readCacheSummary()
  cacheRows.value = readCacheRows()
  runtime.value = readRuntime()
  scale.value = readScale()
  void readCacheStats()
  lastAt.value = Date.now()
}

async function refresh(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  const started = Date.now()
  try {
    await new Promise<void>(r => requestAnimationFrame(() => r()))
    collect()
    const spent = Date.now() - started
    if (spent < 420) await new Promise<void>(r => setTimeout(r, 420 - spent))
  } finally {
    refreshing.value = false
  }
}

const groupTotals = computed(() => {
  const m = new Map<string, number>()
  for (const it of storage.value.items) m.set(it.group, (m.get(it.group) ?? 0) + it.bytes)
  return [...m.entries()].map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes)
})

const visibleItems = computed(() => {
  const list = groupFilter.value
    ? storage.value.items.filter(i => i.group === groupFilter.value)
    : storage.value.items
  return list.slice(0, 14)
})

const maxBytes = computed(() => storage.value.items[0]?.bytes ?? 1)
function barWidth(b: number): string {
  return `${Math.max((b / maxBytes.value) * 100, 2).toFixed(1)}%`
}
function pct(v: number, total: number): string {
  if (!(total > 0)) return '0%'
  return `${Math.max((v / total) * 100, 0.4).toFixed(1)}%`
}
function rateTone(r: number): string {
  return r >= 80 ? 'ok' : r >= 50 ? 'warn' : 'bad'
}

const gaugeOffset = computed(() => GAUGE_C * (1 - Math.min(storage.value.percent, 100) / 100))
const meterTone = computed(() => {
  const p = storage.value.percent
  return p > 80 ? 'is-bad' : p > 50 ? 'is-warn' : 'is-ok'
})

const lastAtText = computed(() => {
  if (!lastAt.value) return '实时统计'
  const d = new Date(lastAt.value)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} 采集`
})

function shortHost(h: string): string {
  return h.replace(/^www\./, '')
}
function hostDesc(h: string): string {
  return HOST_DESC[h] ?? '本次会话访问过的数据源'
}

// collect 会整表遍历 localStorage 并逐条 getItem，是一笔同步阻塞开销。
// 挂载/激活正好撞在展开动画的第一帧上，会直接卡住整段动画 ——
// 让出一帧再采集，把动画的起跑阶段空出来。
function collectDeferred(): void {
  requestAnimationFrame(collect)
}

onMounted(collectDeferred)
onActivated(collectDeferred)
</script>
<style scoped>
.rp-page { height: 100%; min-height: 0; overflow: hidden; display: flex; }

.rp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-md);
  align-content: start;
  padding-bottom: var(--spacing-md);
}

.rp-hero {
  position: relative;
  display: block;
  padding: var(--spacing-md) var(--spacing-lg);
  overflow: visible;
}
.rp-hero .rp-hero-top,
.rp-hero .rp-sum-head,
.rp-hero .rp-sum,
.rp-hero .rp-note { position: relative; z-index: 1; }
.rp-hero .rp-sum-head { margin-top: var(--spacing-md); }
.rp-hero .rp-sum { margin-top: 8px; }
.rp-hero .rp-note { margin-top: 10px; }
.rp-hero-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: radial-gradient(circle at 14% 22%, #000 0%, transparent 62%);
  -webkit-mask-image: radial-gradient(circle at 14% 22%, #000 0%, transparent 62%);
  pointer-events: none;
}
.rp-hero-top {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  min-height: 96px;
  padding-right: 76px;
}
.rp-gauge {
  position: relative;
  width: 96px;
  min-width: 96px;
  height: 96px;
  flex: 0 0 auto;
  align-self: center;
}
.rp-gauge-svg { display: block; width: 96px; height: 96px; transform: rotate(-90deg); }
.rp-gauge-track { fill: none; stroke: var(--bg-elevated); stroke-width: 7; }
.rp-gauge-fill {
  fill: none; stroke: var(--color-primary); stroke-width: 7; stroke-linecap: round;
  filter: drop-shadow(0 0 5px var(--color-primary-glow));
  transition: stroke-dashoffset var(--duration-slow) var(--ease-out-expo), stroke var(--transition-normal);
}
.rp-gauge-fill.is-warn { stroke: #eab308; filter: drop-shadow(0 0 5px rgba(234,179,8,0.35)); }
.rp-gauge-fill.is-bad { stroke: var(--color-rise); filter: drop-shadow(0 0 6px var(--color-rise-glow)); }
.rp-gauge-core {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.rp-gauge-num { font-size: var(--font-xl); font-weight: 700; color: var(--text-primary); line-height: 1; font-variant-numeric: tabular-nums; }
.rp-gauge-unit { font-size: 10px; color: var(--text-muted); }

.rp-hero-side { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1 1 auto; }
.rp-hero-title {
  margin: 0; display: flex; align-items: center; gap: 7px;
  font-size: var(--font-md); font-weight: 700; color: var(--text-primary);
}
.rp-hero-tag {
  padding: 2px 7px; border-radius: var(--radius-full);
  background: var(--color-primary-glow); color: var(--color-primary);
  font-size: 10px; font-weight: 600; white-space: nowrap;
}
.rp-hero-desc { margin: 0; font-size: 11px; line-height: 1.6; color: var(--text-muted); }

.rp-sum-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
}
.rp-sum-title { font-size: var(--font-sm); font-weight: 600; color: var(--text-primary); }

.rp-sum {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background: var(--border-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.rp-sum-cell {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px;
  background: var(--bg-card);
  min-width: 0;
}
.rp-sum-cell em { font-style: normal; font-size: 10px; color: var(--text-muted); }
.rp-sum-cell b {
  font-size: var(--font-lg); font-weight: 700; color: var(--text-primary);
  font-variant-numeric: tabular-nums; line-height: 1.15;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rp-sum-cell b u { font-size: 10px; font-weight: 500; text-decoration: none; color: var(--text-muted); margin-left: 1px; }
.rp-sum-cell b.ok { color: var(--color-fall); }
.rp-sum-cell b.warn { color: #eab308; }
.rp-sum-cell b.bad { color: var(--color-rise); }
.rp-sum-cell i {
  font-style: normal; font-size: 10px; color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.rp-refresh {
  position: absolute; top: var(--spacing-sm); right: var(--spacing-sm);
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px;
  border: 1px solid var(--border-subtle); border-radius: var(--radius-full);
  background: var(--bg-elevated); color: var(--text-secondary);
  font-family: inherit; font-size: 11px; cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.rp-refresh:hover:not(:disabled) { color: var(--color-primary); border-color: var(--color-primary); }
.rp-refresh:disabled { opacity: 0.65; cursor: default; }
.rp-refresh .spin { animation: rp-spin 0.9s linear infinite; }
@keyframes rp-spin { to { transform: rotate(360deg); } }

.rp-alert {
  display: flex; align-items: center; gap: 6px; margin: 0;
  padding: 6px 10px; border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-rise) 14%, transparent);
  color: var(--color-rise); font-size: var(--font-xs);
}
.rp-alert-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: rp-pulse 1.4s ease-in-out infinite; flex-shrink: 0; }
@keyframes rp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.rp-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  display: flex; flex-direction: column; gap: 10px; min-width: 0;
}
.rp-card-head { display: flex; align-items: center; gap: 7px; }
.rp-card-title { font-size: var(--font-sm); font-weight: 600; color: var(--text-primary); }
.rp-card-cap { margin-left: auto; font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; }

.rp-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-primary); flex-shrink: 0; }
.rp-dot[data-k='store'] { background: var(--color-primary); }
.rp-dot[data-k='net'] { background: #06b6d4; }
.rp-dot[data-k='cache'] { background: #8b5cf6; }
.rp-dot[data-k='data'] { background: #f59e0b; }
.rp-dot[data-k='run'] { background: #22c55e; }
.rp-dot[data-g='基金'] { background: var(--color-primary); }
.rp-dot[data-g='公共'] { background: #06b6d4; }
.rp-dot[data-g='板块'] { background: #8b5cf6; }
.rp-dot[data-g='用户'] { background: #22c55e; }
.rp-dot[data-g='其他'] { background: var(--text-muted); }
.rp-dot[data-live='true'] {
  background: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
  animation: rp-pulse 1.4s ease-in-out infinite;
}

.rp-stack { display: flex; height: 9px; border-radius: var(--radius-full); overflow: hidden; background: var(--bg-elevated); }
.rp-stack i { display: block; height: 100%; transition: width var(--duration-fast) var(--ease-out-expo); }
.rp-stack i[data-g='基金'] { background: var(--color-primary); }
.rp-stack i[data-g='公共'] { background: #06b6d4; }
.rp-stack i[data-g='板块'] { background: #8b5cf6; }
.rp-stack i[data-g='用户'] { background: #22c55e; }
.rp-stack i[data-g='其他'] { background: var(--text-muted); }

.rp-legend { display: flex; flex-wrap: wrap; gap: 5px; }
.rp-legend-item {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border: 1px solid transparent; border-radius: var(--radius-full);
  background: var(--bg-elevated); font-family: inherit; font-size: 11px;
  color: var(--text-muted); cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast);
}
.rp-legend-item:hover { color: var(--text-secondary); }
.rp-legend-item.on { border-color: var(--color-primary); color: var(--text-primary); }
.rp-legend-val { color: var(--text-secondary); font-weight: 600; font-variant-numeric: tabular-nums; }

.rp-note {
  margin: 0; padding-left: 9px;
  border-left: 2px solid var(--border-subtle);
  font-size: 11px; line-height: 1.65; color: var(--text-muted);
}

.rp-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.rp-kpis-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.rp-kpi {
  display: flex; flex-direction: column; gap: 2px;
  padding: 9px 11px; border-radius: var(--radius-md);
  background: var(--bg-elevated); min-width: 0;
}
.rp-kpi em { font-style: normal; font-size: 10px; color: var(--text-muted); }
.rp-kpi b {
  font-size: var(--font-lg); font-weight: 700; color: var(--text-primary);
  font-variant-numeric: tabular-nums; line-height: 1.15;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rp-kpi b u { font-size: 10px; font-weight: 500; text-decoration: none; color: var(--text-muted); margin-left: 1px; }
.rp-kpi b.ok { color: var(--color-fall); }
.rp-kpi b.warn { color: #eab308; }
.rp-kpi b.bad { color: var(--color-rise); }
.rp-kpi i { font-style: normal; font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.rp-list { display: flex; flex-direction: column; gap: 1px; margin: 0; padding: 0; list-style: none; }
.rp-item {
  border-radius: var(--radius-sm);
  overflow: hidden;
  content-visibility: auto;
  contain-intrinsic-size: auto 26px;
}
.rp-row {
  display: grid; align-items: center; gap: 8px;
  width: 100%; padding: 7px 8px;
  border: none; background: transparent;
  font-family: inherit; font-size: var(--font-xs); text-align: left; cursor: pointer;
  transition: background-color var(--transition-fast);
}
.rp-row-3 { grid-template-columns: 7px minmax(0, 1fr) 54px auto; }
.rp-row:hover { background: var(--bg-card-hover); }
.rp-row-name { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.rp-bar { height: 4px; border-radius: var(--radius-full); background: var(--bg-elevated); overflow: hidden; }
.rp-bar i { display: block; height: 100%; background: var(--color-primary); opacity: 0.85; }
.rp-bar i[data-g='公共'] { background: #06b6d4; }
.rp-bar i[data-g='板块'] { background: #8b5cf6; }
.rp-bar i[data-g='用户'] { background: #22c55e; }
.rp-bar i[data-g='其他'] { background: var(--text-muted); }
.rp-bar i[data-g='net'] { background: #06b6d4; }
.rp-bar i[data-g='rate'] { background: #8b5cf6; }
.rp-row-val { color: var(--text-muted); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.rp-row-val.ok { color: var(--color-fall); }
.rp-row-val.warn { color: #eab308; }
.rp-row-val.bad { color: var(--color-rise); }

.rp-fold { display: grid; grid-template-rows: 1fr; }
.rp-fold > .rp-clip { min-height: 0; overflow: hidden; }
.rp-fold-in { padding: 2px 8px 9px 22px; display: flex; flex-direction: column; gap: 6px; }
.rp-fold-desc { margin: 0; font-size: 11px; line-height: 1.6; color: var(--text-muted); }
.rp-chips { display: flex; flex-wrap: wrap; gap: 4px; }

.rp-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: var(--radius-full);
  background: var(--bg-elevated); font-size: 10px; max-width: 100%;
}
.rp-chip em { font-style: normal; color: var(--text-muted); flex-shrink: 0; }
.rp-chip b { color: var(--text-secondary); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-chip.is-bad b { color: var(--color-rise); }
.rp-chip.is-good b { color: var(--color-fall); }

.rp-empty { margin: 0; font-size: var(--font-xs); color: var(--text-muted); }

.rp-fold-enter-active,
.rp-fold-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out-expo);
}
.rp-fold-enter-from,
.rp-fold-leave-to { opacity: 0; }
.rp-fold-enter-active .rp-fold-in {
  animation: rp-fold-in var(--duration-fast) var(--ease-out-expo) both;
}
@keyframes rp-fold-in {
  from { opacity: 0; transform: translate3d(0, -4px, 0); }
  to   { opacity: 1; transform: none; }
}

@media (min-width: 768px) {
  .rp-body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rp-hero { grid-column: 1 / -1; }
}

@media (max-width: 767px) {
  .rp-hero { padding: var(--spacing-md) var(--spacing-sm); gap: var(--spacing-sm); }
  .rp-hero-top { gap: var(--spacing-sm); min-height: 76px; padding-right: 66px; }
  .rp-gauge { width: 76px; min-width: 76px; height: 76px; }
  .rp-gauge-svg { width: 76px; height: 76px; }
  .rp-gauge-num { font-size: var(--font-md); }
  .rp-hero-desc { display: none; }
  .rp-sum { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rp-sum-cell { padding: 8px 10px; }
  .rp-sum-cell b { font-size: var(--font-sm); }
  .rp-card { padding: var(--spacing-sm); }
  .rp-kpis, .rp-kpis-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .rp-kpi { padding: 7px 9px; }
  .rp-kpi b { font-size: var(--font-sm); }
  .rp-row-3 { grid-template-columns: 7px minmax(0, 1fr) 38px auto; gap: 6px; padding: 7px 6px; }
  .rp-fold-in { padding-left: 15px; }
  .rp-refresh { top: 10px; right: 10px; }
}
</style>
