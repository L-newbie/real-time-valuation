<template>
  <div ref="rootEl" class="lp" :class="{ 'is-scrolling': scrolling }">
    <div class="lp-bg" aria-hidden="true">
      <div class="lp-stars" />
      <div class="lp-aurora" />
      <div class="lp-ridge lp-ridge-far" />
      <div class="lp-ridge lp-ridge-near" />
    </div>

    <div class="lp-flash" :style="flashStyle" aria-hidden="true" />

    <header class="lp-nav" :class="{ scrolled: navSolid }">
      <button type="button" class="lp-brand" @click="scrollTop">
        <span class="lp-brand-mark">
          <svg width="22" height="22" viewBox="0 0 100 100" fill="none">
            <ellipse cx="50" cy="60" rx="35" ry="30" fill="currentColor" />
            <ellipse cx="50" cy="65" rx="22" ry="20" fill="currentColor" opacity="0.45" />
            <circle cx="50" cy="32" r="18" fill="currentColor" />
            <circle cx="44" cy="29" r="5" fill="var(--bg-base)" />
            <circle cx="56" cy="29" r="5" fill="var(--bg-base)" />
            <path d="M38 22 Q42 8 46 20 Q48 6 52 20 Q56 8 60 22" fill="currentColor" />
            <ellipse cx="30" cy="58" rx="14" ry="10" fill="currentColor" opacity="0.7" transform="rotate(-15 30 58)" />
          </svg>
        </span>
        <span class="lp-brand-name">基攻宝</span>
      </button>

      <nav class="lp-pills" aria-label="页面导航">
        <button
          v-for="s in SECTIONS"
          :key="s.id"
          type="button"
          class="lp-pill"
          :class="{ on: activeSection === s.id }"
          @click="scrollTo(s.id)"
        >
          {{ s.label }}
        </button>
      </nav>

      <div class="lp-nav-actions">
        <a class="lp-ghost" href="https://github.com/L-newbie/real-time-valuation" target="_blank" rel="noopener">
          GitHub
        </a>
        <button type="button" class="lp-cta" @click="enterApp">开始使用</button>
      </div>
    </header>

    <section id="top" class="lp-hero">
      <div class="lp-hero-inner">
        <div class="lp-eyebrow">
          <span class="lp-dot" />
          {{ pick('数据只在本机', '纯前端 · 数据只存在你的浏览器里') }}
        </div>
        <h1 class="lp-title">
          <span class="lp-line">{{ pick('净值没出来', '净值没出来，') }}</span>
          <span class="lp-line lp-line-accent">{{ pick('先看今天赚了多少', '先看今天赚了多少。') }}</span>
        </h1>
        <p v-if="!isNarrow" class="lp-sub">
          盘中按持仓股实时涨跌加权推算，不用等收盘。
          同一只基金还能分组记账 —— 实盘一本，观察一本，互不干扰。
        </p>
        <div class="lp-actions">
          <button type="button" class="lp-cta lp-cta-lg" @click="enterApp">
            立即体验
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button v-if="!isNarrow" type="button" class="lp-ghost lp-ghost-lg" @click="scrollTo('features')">看看能做什么</button>
        </div>
      </div>

      <div class="lp-stage" :style="stageStyle">
        <div
          class="lp-card"
          :class="{ 'is-tilt': tiltOn }"
          :style="cardStyle"
          @pointermove="onCardMove"
          @pointerleave="onCardLeave"
        >
          <div class="lp-card-sheen" />
          <div class="lp-card-shine" :style="shineStyle" aria-hidden="true" />
          <div class="lp-card-top">
            <span class="lp-card-label">总资产</span>
            <span class="lp-card-chip" />
          </div>
          <div class="lp-card-amount font-number">¥{{ heroAmount }}</div>
          <div class="lp-card-row">
            <span class="lp-card-delta font-number">+241.00</span>
            <span class="lp-card-rate font-number">+2.41%</span>
            <span class="lp-card-tag">今日</span>
          </div>
          <div class="lp-card-spark" aria-hidden="true">
            <svg viewBox="0 0 240 48" preserveAspectRatio="none">
              <path :d="SPARK_PATH" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="lp-card-foot">
            <span class="lp-card-name">基攻宝</span>
            <span class="lp-card-sub">JIGONGBAO</span>
          </div>
        </div>
        <div class="lp-glow" :style="glowStyle" aria-hidden="true" />
      </div>

      <div class="lp-scroll-hint" :class="{ hide: progress > 0.05 }" aria-hidden="true">
        <span>向下滚动</span>
        <span class="lp-scroll-line" />
      </div>
    </section>

    <section id="features" class="lp-section">
      <div class="lp-section-head">
        <h2 class="lp-h2">{{ pick('能做什么', '不止是看一眼净值') }}</h2>
        <p v-if="!isNarrow" class="lp-lead">每个能力都对着一个真实的麻烦</p>
      </div>

      <div
        class="lp-orb"
        :class="{ 'is-paused': orbPaused }"
        :style="{ '--lp-face-ms': `${FACE_INTERVAL_MS}ms` }"
        @pointerenter="pauseOrb"
        @pointerleave="resumeOrb"
        @touchstart.passive="onFaceTouchStart"
        @touchend.passive="onFaceTouchEnd"
      >
        <div class="lp-orb-stage">
          <div class="lp-orb-ring" :style="orbStyle">
            <article
              v-for="(f, i) in FEATURES"
              :key="f.title"
              class="lp-face"
              :class="{ on: i === faceIndex }"
              :style="faceStyle(i)"
              :aria-hidden="i === faceIndex ? 'false' : 'true'"
            >
              <span class="lp-feature-icon" v-html="f.icon" />
              <h3 class="lp-feature-title">{{ f.title }}</h3>
              <p class="lp-feature-desc">{{ pick(f.short, f.desc) }}</p>
              <span v-if="!isNarrow" class="lp-feature-meta">{{ f.meta }}</span>
            </article>
          </div>
        </div>

        <div class="lp-orb-dots" role="tablist" aria-label="功能切换">
          <button
            v-for="(f, i) in FEATURES"
            :key="f.title"
            type="button"
            class="lp-orb-dot"
            :class="{ on: i === faceIndex }"
            role="tab"
            :aria-selected="i === faceIndex"
            :aria-label="f.title"
            @click="goFace(i)"
          >
            <span v-if="i === faceIndex" :key="faceIndex" class="lp-orb-dot-fill" />
          </button>
        </div>
      </div>
    </section>

    <section id="groups" class="lp-section lp-section-split">
      <div class="lp-split-text reveal">
        <span class="lp-tagline">分组记账</span>
        <h2 class="lp-h2">一只基金，两本账</h2>
        <p v-if="!isNarrow" class="lp-lead">
          实盘持仓和观察仓位混在一起算，收益率就没有参考价值。
          分组把持仓、交易记录、待确认单彻底隔开，
          <b>在 A 组加仓不会影响 B 组</b>。
        </p>
        <ul v-if="!isNarrow" class="lp-list">
          <li><b>隔离</b>：持仓份额、成本价、买卖记录、图表标记</li>
          <li><b>共享</b>：估值、净值序列、持仓股 —— 只发一次请求</li>
        </ul>
        <p v-if="!isNarrow" class="lp-note">
          行情是客观事实，全世界看到的该一样；持仓是你的私人账本，才需要分开记。
        </p>
      </div>

      <div class="lp-split-visual reveal">
        <div class="lp-mini" v-for="(g, i) in GROUPS" :key="g.name" :style="{ '--i': i }">
          <div class="lp-mini-head">
            <span class="lp-mini-mark">{{ g.name.charAt(0) }}</span>
            <div class="lp-mini-ident">
              <span class="lp-mini-name">{{ g.name }}</span>
              <span class="lp-mini-count">{{ g.count }} 只基金</span>
            </div>
          </div>
          <div class="lp-mini-amount font-number">¥{{ g.amount }}</div>
          <div class="lp-mini-rate font-number" :class="g.up ? 'up' : 'flat'">{{ g.rate }}</div>
        </div>
      </div>
    </section>

    <section id="trust" class="lp-section">
      <div class="lp-stats">
        <div v-for="s in STATS" :key="s.label" class="lp-stat reveal">
          <span class="lp-stat-num font-number">{{ s.value }}</span>
          <span class="lp-stat-label">{{ pick(s.short, s.label) }}</span>
        </div>
      </div>
      <p class="lp-disclaimer">
        <template v-if="isNarrow">公开数据，<b>不构成投资建议</b></template>
        <template v-else>数据来自公开接口，仅供学习交流，<b>不构成任何投资建议</b>。投资有风险，入市需谨慎。</template>
      </p>
    </section>

    <section class="lp-final">
      <div class="lp-final-inner reveal">
        <h2 class="lp-h2">{{ pick('现在就试试', '现在就看看你的持仓') }}</h2>
        <p v-if="!isNarrow" class="lp-lead">不需要注册，不需要联网存储，打开就能用。</p>
        <button type="button" class="lp-cta lp-cta-lg" @click="enterApp">
          进入基攻宝
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <footer class="lp-foot">
        <span>{{ pick('基攻宝', '基攻宝 · 纯前端基金估值工具') }}</span>
        <span class="lp-foot-links">
          <a href="https://github.com/L-newbie/real-time-valuation" target="_blank" rel="noopener">GitHub</a>
          <a href="https://github.com/L-newbie/real-time-valuation/issues" target="_blank" rel="noopener">反馈</a>
        </span>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const rootEl = ref<HTMLElement | null>(null)

const SECTIONS = [
  { id: 'features', label: '功能' },
  { id: 'groups', label: '分组' },
  { id: 'trust', label: '关于' },
]

const SPARK_PATH = 'M2 38 L26 33 L50 36 L74 24 L98 28 L122 18 L146 22 L170 12 L194 16 L218 7 L238 10'

const FEATURES = [
  {
    title: '盘中实时估值',
    desc: 'QDII 与商品基金官方不给盘中估值，改由前十大持仓股按占比加权推算，覆盖全球各时区。',
    short: '官方没有估值的，按持仓股算',
    meta: 'A股 · 港股 · 美股 · 日韩台 · 欧股',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>',
  },
  {
    title: 'T+N 自动结算',
    desc: '净值确认后自动推进昨日基数；连着几天没打开，重新进来会按净值序列把中间每一天补齐。',
    short: '几天没开，回来自动补齐',
    meta: '漏日回放 · 待确认单到期成交',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  },
  {
    title: '截图导入持仓',
    desc: '把持仓截图拖进来或直接粘贴，视觉模型识别出基金与金额，批量录入，结果可逐条校验。',
    short: '截图丢进来，自动录入',
    meta: '拖拽 · 粘贴 · 批量校验',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-6 6"/></svg>',
  },
  {
    title: '数据不出本机',
    desc: '没有服务器、没有账号体系、没有埋点。全部存在浏览器本地，关掉标签页数据仍在。',
    short: '无服务器、无账号、无埋点',
    meta: '五类敏感数字可逐项打码',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  },
]

const GROUPS = [
  { name: '自选', count: 6, amount: '1.00万', rate: '+2.41%', up: true },
  { name: '实盘', count: 4, amount: '3.62万', rate: '+0.87%', up: true },
  { name: '观察', count: 3, amount: '0.00', rate: '0.00%', up: false },
]

const STATS = [
  { value: '331', label: '测试用例全绿', short: '测试全绿' },
  { value: '28', label: '功能域覆盖', short: '功能域' },
  { value: '0', label: '后端服务', short: '后端' },
]

const heroAmount = ref('10,241.00')

const progress = ref(0)
const navSolid = ref(false)
let ticking = false

// backdrop-filter 叠加 transform: scale 时，每帧都要按放大后的尺寸重采样整片背景。
// 英雄卡最大放大到 6 倍，滚动中这一项就吃掉整个帧预算，所以滚动期间整页降级掉模糊，
// 停下来再补回去 —— 静止时才是真正看得清模糊质感的时候。
const scrolling = ref(false)
let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null

const SCROLL_IDLE_MS = 160

function markScrolling(): void {
  if (!scrolling.value) scrolling.value = true
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
  scrollIdleTimer = setTimeout(() => { scrolling.value = false }, SCROLL_IDLE_MS)
}

// 素材实测：卡片放大与增亮同步，末端猛冲（ease-in），
// 白光过曝到峰值后场景已切换 —— 不是淡入淡出。
function easeIn(t: number): number {
  return t * t * t
}

function onScroll(): void {
  markScrolling()
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    const el = rootEl.value
    const y = el ? el.scrollTop : 0
    const h = el ? el.clientHeight : window.innerHeight
    progress.value = Math.min(1, Math.max(0, y / (h * 0.9)))
    navSolid.value = y > 40
    updateActive()
    ticking = false
  })
}

const activeSection = ref('')

// 逐帧 querySelector 会一遍遍翻 DOM，节点是固定的，挂载后缓存住即可。
let sectionEls: { id: string; el: HTMLElement }[] = []

function cacheSectionEls(): void {
  const el = rootEl.value
  if (!el) return
  sectionEls = SECTIONS
    .map(s => ({ id: s.id, el: el.querySelector<HTMLElement>(`#${s.id}`) }))
    .filter((x): x is { id: string; el: HTMLElement } => x.el != null)
}

function updateActive(): void {
  const el = rootEl.value
  if (!el) return
  if (sectionEls.length === 0) cacheSectionEls()
  const mark = el.getBoundingClientRect().top + el.clientHeight * 0.4
  let cur = ''
  for (const s of sectionEls) {
    if (s.el.getBoundingClientRect().top <= mark) cur = s.id
  }
  activeSection.value = cur
}

const eased = computed(() => easeIn(progress.value))

const NARROW_QUERY = '(max-width: 767px)'
const isNarrow = ref(false)
let narrowMql: MediaQueryList | null = null

function pick(narrow: string, wide: string): string {
  return isNarrow.value ? narrow : wide
}

const tiltX = ref(0)
const tiltY = ref(0)
const tiltOn = ref(false)
const shineX = ref(50)
const shineY = ref(50)

const shineStyle = computed(() => ({
  opacity: tiltOn.value ? '1' : '0',
  background: `radial-gradient(220px 220px at ${shineX.value}% ${shineY.value}%, rgba(255,255,255,0.22), transparent 68%)`,
}))

const TILT_MAX_DEG = 14

function onCardMove(e: PointerEvent): void {
  if (isNarrow.value) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()

  const nx = (e.clientX - r.left) / r.width - 0.5
  const ny = (e.clientY - r.top) / r.height - 0.5
  tiltY.value = nx * TILT_MAX_DEG * 2
  tiltX.value = -ny * TILT_MAX_DEG * 2
  shineX.value = (nx + 0.5) * 100
  shineY.value = (ny + 0.5) * 100
  tiltOn.value = true
}

function onCardLeave(): void {
  tiltOn.value = false
  tiltX.value = 0
  tiltY.value = 0
}

const cardStyle = computed(() => {
  const p = eased.value

  if (isNarrow.value) {
    return {
      transform: 'none',
      opacity: '1',
      transition: 'none',
    }
  }

  const scale = 1 + p * 5.2
  const rotY = 18 - p * 30 + tiltY.value
  const rotX = -8 + p * 14 + tiltX.value
  const lift = tiltOn.value ? 1.03 : 1
  return {
    transform: `translate3d(0, ${-p * 60}px, 0) scale(${scale * lift}) rotateY(${rotY}deg) rotateX(${rotX}deg)`,
    opacity: String(Math.max(0, 1 - Math.max(0, p - 0.7) / 0.3)),
    transition: tiltOn.value ? 'none' : 'transform 420ms cubic-bezier(0.22, 0.9, 0.24, 1)',
  }
})

const stageStyle = computed(() => (isNarrow.value
  ? { opacity: '1' }
  : { opacity: String(Math.max(0, 1 - Math.max(0, progress.value - 0.8) / 0.2)) }))

const glowStyle = computed(() => {
  const p = eased.value
  return {
    opacity: String(Math.min(1, p * (isNarrow.value ? 1.1 : 1.6))),
    transform: `scale(${1 + p * (isNarrow.value ? 1.4 : 4)})`,
  }
})

const flashStyle = computed(() => {
  const p = eased.value
  const a = p < 0.75 ? p * 0.5 : Math.max(0, (1 - p) * 2)
  return { opacity: String(Math.min(isNarrow.value ? 0.6 : 0.92, a)) }
})

const FACE_INTERVAL_MS = 2800

const turns = ref(0)
const faceIndex = computed(() => ((turns.value % FEATURES.length) + FEATURES.length) % FEATURES.length)

const orbPaused = ref(false)
let faceTimer: number | null = null

const FACE_STEP = 360 / FEATURES.length

const orbRadius = computed(() => (isNarrow.value ? 190 : 300))

const orbStyle = computed(() => ({
  transform: `translateZ(${-orbRadius.value}px) rotateY(${-turns.value * FACE_STEP}deg)`,
}))

function faceStyle(i: number): Record<string, string> {
  const total = FEATURES.length
  let d = i - faceIndex.value
  if (d > total / 2) d -= total
  if (d < -total / 2) d += total

  const depth = Math.abs(d)

  return {
    transform: `rotateY(${i * FACE_STEP}deg) translateZ(${orbRadius.value}px)`,
    opacity: depth === 0 ? '1' : depth === 1 ? '0.28' : '0.08',
    pointerEvents: depth === 0 ? 'auto' : 'none',
  }
}

function goFace(i: number): void {
  const total = FEATURES.length
  const target = ((i % total) + total) % total
  let d = target - faceIndex.value
  if (d > total / 2) d -= total
  if (d < -total / 2) d += total
  turns.value += d
  startFaceTimer()
}

function startFaceTimer(): void {
  stopFaceTimer()
  faceTimer = window.setInterval(() => {
    if (orbPaused.value) return
    turns.value += 1
  }, FACE_INTERVAL_MS)
}

function stopFaceTimer(): void {
  if (faceTimer !== null) {
    clearInterval(faceTimer)
    faceTimer = null
  }
}

function pauseOrb(): void { orbPaused.value = true }
function resumeOrb(): void { orbPaused.value = false }

const SWIPE_MIN_PX = 40
let touchStartX = 0
let touchStartY = 0

function onFaceTouchStart(e: TouchEvent): void {
  const t = e.touches[0]
  if (!t) return
  touchStartX = t.clientX
  touchStartY = t.clientY
}

function onFaceTouchEnd(e: TouchEvent): void {
  const t = e.changedTouches[0]
  if (!t) return
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY

  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return
  turns.value += dx < 0 ? 1 : -1
  startFaceTimer()
}

function scrollTo(id: string): void {
  rootEl.value?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// hash 路由下 href="#top" 会被 vue-router 当成路由 /top，只能走 JS 滚动。
function scrollTop(): void {
  rootEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

async function enterApp(): Promise<void> {
  try {
    await router.push('/')
  } catch {
    window.location.hash = '#/'
  }
}

let io: IntersectionObserver | null = null
let orbIo: IntersectionObserver | null = null
let onNarrowChange: ((e: MediaQueryListEvent) => void) | null = null

onMounted(() => {
  narrowMql = window.matchMedia(NARROW_QUERY)
  isNarrow.value = narrowMql.matches
  onNarrowChange = (e: MediaQueryListEvent) => { isNarrow.value = e.matches }
  narrowMql.addEventListener('change', onNarrowChange)

  rootEl.value?.addEventListener('scroll', onScroll, { passive: true })
  cacheSectionEls()
  onScroll()

  io = new IntersectionObserver(
    entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io?.unobserve(e.target)
        }
      }
    },
    { root: rootEl.value, threshold: 0.18 },
  )
  rootEl.value?.querySelectorAll('.reveal').forEach(el => io!.observe(el))

  startFaceTimer()

  const orb = rootEl.value?.querySelector('.lp-orb')
  if (orb) {
    orbIo = new IntersectionObserver(
      entries => { orbPaused.value = !entries[0].isIntersecting },
      { root: rootEl.value, threshold: 0.25 },
    )
    orbIo.observe(orb)
  }
})

onUnmounted(() => {
  rootEl.value?.removeEventListener('scroll', onScroll)
  if (narrowMql && onNarrowChange) narrowMql.removeEventListener('change', onNarrowChange)
  narrowMql = null
  onNarrowChange = null
  io?.disconnect()
  io = null
  orbIo?.disconnect()
  orbIo = null
  stopFaceTimer()
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
})
</script>

<style scoped>
.lp {
  position: relative;
  height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  background: var(--bg-base);
  color: var(--text-primary);
  scroll-behavior: smooth;

  /* 装饰层（星空/山脊/玻璃底）在两套主题下取值不同，
     统一收在这里，亮色由下方 html.light 覆盖。 */
  --lp-star: rgba(255, 255, 255, 0.5);
  --lp-ridge-far: rgba(28, 42, 60, 0.9);
  --lp-ridge-far-fade: rgba(15, 20, 25, 0);
  --lp-ridge-near: rgba(11, 15, 22, 0.96);
  --lp-ridge-near-solid: rgba(11, 15, 22, 1);
  --lp-nav-bg: rgba(15, 20, 25, 0.72);
  --lp-pill-bg: rgba(22, 28, 33, 0.66);
  --lp-eyebrow-bg: rgba(22, 28, 33, 0.5);
  --lp-card-tint: rgba(22, 28, 33, 0.6);
  --lp-card-shadow: rgba(0, 0, 0, 0.55);
  --lp-sheen: rgba(255, 255, 255, 0.14);
  --lp-hover-shadow: rgba(0, 0, 0, 0.4);
}

html.light .lp {
  --lp-star: rgba(43, 127, 212, 0.28);
  --lp-ridge-far: rgba(168, 192, 214, 0.72);
  --lp-ridge-far-fade: rgba(242, 244, 247, 0);
  --lp-ridge-near: rgba(206, 219, 231, 0.92);
  --lp-ridge-near-solid: rgba(226, 233, 241, 1);
  --lp-nav-bg: rgba(242, 244, 247, 0.78);
  --lp-pill-bg: rgba(255, 255, 255, 0.72);
  --lp-eyebrow-bg: rgba(255, 255, 255, 0.6);
  --lp-card-tint: rgba(255, 255, 255, 0.72);
  --lp-card-shadow: rgba(20, 25, 32, 0.14);
  --lp-sheen: rgba(255, 255, 255, 0.55);
  --lp-hover-shadow: rgba(20, 25, 32, 0.12);
}

.lp-bg {
  position: sticky;
  top: 0;
  height: 100dvh;
  margin-bottom: -100dvh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

/* 滚动中把所有 backdrop-filter 摘掉：它与 transform: scale 叠加时，
   每帧都要按放大后的尺寸重采样背景，是这一页最大的一笔帧开销。
   停手 160ms 后恢复，静止时质感一点不少。 */
.lp.is-scrolling .lp-card,
.lp.is-scrolling .lp-face,
.lp.is-scrolling .lp-nav.scrolled,
.lp.is-scrolling .lp-pills,
.lp.is-scrolling .lp-mini {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.lp-stars {
  position: absolute;
  inset: -10%;
  background-image:
    radial-gradient(1.4px 1.4px at 12% 18%, var(--lp-star), transparent),
    radial-gradient(1.2px 1.2px at 32% 42%, var(--lp-star), transparent),
    radial-gradient(1.6px 1.6px at 58% 12%, var(--lp-star), transparent),
    radial-gradient(1.1px 1.1px at 74% 34%, var(--lp-star), transparent),
    radial-gradient(1.5px 1.5px at 88% 22%, var(--lp-star), transparent),
    radial-gradient(1.2px 1.2px at 22% 62%, var(--lp-star), transparent),
    radial-gradient(1.3px 1.3px at 66% 68%, var(--lp-star), transparent);
  animation: lpTwinkle 7s var(--ease-smooth) infinite alternate;
}
@keyframes lpTwinkle {
  from { opacity: 0.5; }
  to { opacity: 0.95; }
}

.lp-aurora {
  position: absolute;
  left: 50%;
  top: -22%;
  width: 130vw;
  height: 78vh;
  transform: translateX(-50%);
  background:
    radial-gradient(58% 52% at 50% 42%, rgba(74,158,255,0.20), transparent 70%),
    radial-gradient(40% 40% at 74% 30%, rgba(94,200,216,0.13), transparent 72%);
  filter: blur(28px);
}

.lp-ridge {
  position: absolute;
  left: -6%;
  right: -6%;
  bottom: 0;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}
.lp-ridge-far {
  height: 44vh;
  opacity: 0.5;
  background-image: linear-gradient(to bottom, var(--lp-ridge-far), var(--lp-ridge-far-fade));
  clip-path: polygon(0 62%, 9% 44%, 18% 56%, 27% 34%, 37% 50%, 47% 28%, 58% 47%, 68% 32%, 79% 50%, 89% 38%, 100% 54%, 100% 100%, 0 100%);
}
.lp-ridge-near {
  height: 30vh;
  opacity: 0.85;
  background-image: linear-gradient(to bottom, var(--lp-ridge-near), var(--lp-ridge-near-solid));
  clip-path: polygon(0 58%, 12% 36%, 23% 54%, 34% 28%, 46% 50%, 57% 30%, 69% 52%, 81% 34%, 92% 52%, 100% 42%, 100% 100%, 0 100%);
}

.lp-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 14px clamp(16px, 4vw, 40px);
  transition: background-color var(--transition-normal), backdrop-filter var(--transition-normal),
              border-color var(--transition-normal);
  border-bottom: 1px solid transparent;
}
.lp-nav.scrolled {
  background: var(--lp-nav-bg);
  backdrop-filter: blur(14px);
  border-bottom-color: var(--border-subtle);
}

.lp-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
}
.lp-brand-mark { display: inline-flex; }
.lp-brand-name {
  font-size: var(--font-md);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.lp-pills {
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: var(--radius-full);
  background: var(--lp-pill-bg);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(10px);
}
.lp-pill {
  padding: 7px 16px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}
.lp-pill:hover { color: var(--text-primary); }
.lp-pill.on {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.lp-nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.lp-ghost {
  padding: 8px 16px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--transition-fast), color var(--transition-fast),
              background-color var(--transition-fast);
}
.lp-ghost:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: var(--bg-card-hover);
}

.lp-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--accent-gradient);
  color: var(--color-on-primary);
  font-size: var(--font-xs);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 18px rgba(74, 158, 255, 0.28);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast),
              background var(--transition-fast);
}
.lp-cta:hover {
  background: var(--accent-gradient-hover);
  box-shadow: 0 6px 26px rgba(74, 158, 255, 0.4);
  transform: translateY(-1px);
}
.lp-cta:active { transform: translateY(0) scale(0.98); }

.lp-cta-lg, .lp-ghost-lg {
  padding: 13px 26px;
  font-size: var(--font-sm);
}

.lp-hero {
  position: relative;
  z-index: 1;
  min-height: calc(100dvh - 64px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(24px, 5vw, 64px);
  padding: 40px clamp(20px, 6vw, 88px) 80px;
  margin-top: -1px;
}

.lp-hero-inner { max-width: 560px; }

.lp-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--lp-eyebrow-bg);
  color: var(--text-muted);
  font-size: var(--font-xs);
  margin-bottom: var(--spacing-lg);
}
.lp-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 10px var(--color-primary);
  animation: lpPulse 2.4s var(--ease-smooth) infinite;
}
@keyframes lpPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.lp-title {
  font-size: clamp(34px, 5.4vw, 62px);
  line-height: 1.14;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 var(--spacing-lg);
}
.lp-line {
  display: block;
  animation: lpRise var(--duration-slow) var(--ease-out-expo) both;
}
.lp-line-accent {
  background: linear-gradient(120deg, var(--color-primary) 0%, var(--color-accent) 70%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation-delay: 90ms;
}
@keyframes lpRise {
  from { opacity: 0; transform: translate3d(0, 22px, 0); }
  to { opacity: 1; transform: none; }
}

.lp-sub {
  font-size: clamp(14px, 1.5vw, 17px);
  line-height: 1.75;
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-xl);
  animation: lpRise var(--duration-slow) var(--ease-out-expo) 180ms both;
}

.lp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  animation: lpRise var(--duration-slow) var(--ease-out-expo) 260ms both;
}

.lp-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  perspective: 1400px;
  will-change: opacity;
}

.lp-card {
  position: relative;
  z-index: 2;
  width: min(340px, 78vw);
  aspect-ratio: 1.586;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(150deg, rgba(74,158,255,0.16), rgba(94,200,216,0.05) 46%, var(--lp-card-tint)),
    var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(18px);
  box-shadow:
    0 24px 70px var(--lp-card-shadow),
    0 0 44px rgba(74, 158, 255, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  transform-style: preserve-3d;
  will-change: transform, opacity;
  animation: lpFloat 6.5s var(--ease-smooth) infinite alternate;
}
@keyframes lpFloat {
  from { translate: 0 -6px; }
  to { translate: 0 8px; }
}

.lp-card.is-tilt {
  animation-play-state: paused;
  box-shadow:
    0 34px 90px var(--lp-card-shadow),
    0 0 60px rgba(74, 158, 255, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.lp-card-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition: opacity var(--transition-fast);
  z-index: 1;
}

.lp-card-sheen {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(115deg, transparent 32%, var(--lp-sheen) 46%, transparent 60%);
  opacity: 0.9;
  pointer-events: none;
  animation: lpSheen 5.5s var(--ease-smooth) infinite;
}
@keyframes lpSheen {
  0%, 62% { transform: translateX(-130%); }
  100% { transform: translateX(130%); }
}

.lp-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lp-card-label { font-size: var(--font-xs); color: var(--text-muted); }
.lp-card-chip {
  width: 30px;
  height: 22px;
  border-radius: 5px;
  background: linear-gradient(135deg, #c8b273, #8a7742);
  opacity: 0.9;
}

.lp-card-amount {
  font-size: clamp(26px, 3.4vw, 34px);
  font-weight: 800;
  letter-spacing: -0.01em;
  margin-top: 6px;
}

.lp-card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.lp-card-delta { color: var(--color-rise); font-size: var(--font-sm); font-weight: 700; }
.lp-card-rate {
  color: var(--color-rise);
  font-size: var(--font-xs);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-rise-glow);
}
.lp-card-tag { font-size: var(--font-xs); color: var(--text-muted); }

.lp-card-spark {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  color: var(--color-primary);
  opacity: 0.85;
}
.lp-card-spark svg { width: 100%; height: 40px; }

.lp-card-foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.lp-card-name { font-size: var(--font-sm); font-weight: 700; }
.lp-card-sub {
  font-size: 10px;
  letter-spacing: 0.22em;
  color: var(--text-muted);
}

.lp-glow {
  position: absolute;
  z-index: 1;
  width: min(340px, 78vw);
  aspect-ratio: 1.586;
  border-radius: var(--radius-2xl);
  background: radial-gradient(closest-side, rgba(180, 216, 255, 0.92), rgba(74, 158, 255, 0.35) 58%, transparent 76%);
  filter: blur(26px);
  will-change: transform, opacity;
}

.lp-scroll-hint {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: var(--font-xs);
  color: var(--text-muted);
  transition: opacity var(--transition-normal);
}
.lp-scroll-hint.hide { opacity: 0; }
.lp-scroll-line {
  width: 1px;
  height: 34px;
  background: linear-gradient(to bottom, var(--color-primary), transparent);
  animation: lpDrop 1.9s var(--ease-smooth) infinite;
}
@keyframes lpDrop {
  0% { opacity: 0; transform: scaleY(0.3); transform-origin: top; }
  40% { opacity: 1; }
  100% { opacity: 0; transform: scaleY(1); transform-origin: top; }
}

.lp-flash {
  position: sticky;
  top: 0;
  height: 100dvh;
  margin-bottom: -100dvh;
  z-index: 20;
  pointer-events: none;
  background: radial-gradient(circle at 72% 46%, rgba(226, 240, 255, 1), rgba(160, 205, 255, 0.72) 34%, transparent 68%);
  will-change: opacity;
}

.lp-section {
  position: relative;
  z-index: 1;
  padding: clamp(64px, 10vh, 120px) clamp(20px, 6vw, 88px);
  max-width: 1200px;
  margin: 0 auto;
}

.lp-section-head { margin-bottom: var(--spacing-2xl); }

.lp-h2 {
  font-size: clamp(26px, 3.6vw, 40px);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 10px;
}
.lp-lead {
  font-size: clamp(14px, 1.4vw, 16px);
  line-height: 1.75;
  color: var(--text-secondary);
  margin: 0;
  max-width: 56ch;
}
.lp-tagline {
  display: inline-block;
  font-size: var(--font-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--color-primary);
  margin-bottom: 10px;
}

.lp-orb {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xl);
}

.lp-orb-stage {
  position: relative;
  width: min(520px, 100%);
  height: 290px;
  perspective: 1100px;
  perspective-origin: 50% 46%;
}

.lp-orb-ring {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform 620ms cubic-bezier(0.22, 0.9, 0.24, 1);
}

.lp-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 44px var(--lp-hover-shadow);
  transition: opacity var(--duration-slow) var(--ease-out-expo);
}
.lp-face.on {
  border-color: var(--border-hover);
  will-change: opacity;
}

/* 转轮 6 面里只有正对的那面看得清，背面那几片模糊玻璃照样每帧参与合成。
   彻底摘掉它们的 backdrop-filter —— 在 0.08 透明度下本来也看不出区别。 */
.lp-face:not(.on) {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}

.lp-orb-dots {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.lp-orb-dot {
  position: relative;
  width: 40px;
  height: 4px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: var(--border-default);
  cursor: pointer;
  overflow: hidden;
  transition: background-color var(--transition-fast);
}
.lp-orb-dot:hover { background: var(--border-hover); }
.lp-orb-dot-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-primary);
  transform: scaleX(0);
  transform-origin: left center;
}
.lp-orb-dot.on .lp-orb-dot-fill {
  animation: lpDotFill var(--lp-face-ms) linear forwards;
}
.lp-orb.is-paused .lp-orb-dot.on .lp-orb-dot-fill {
  animation-play-state: paused;
}
@keyframes lpDotFill {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.lp-feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--accent-gradient-soft);
  color: var(--color-primary);
  margin-bottom: var(--spacing-md);
}
.lp-feature-title {
  font-size: var(--font-lg);
  font-weight: 700;
  margin: 0 0 8px;
}
.lp-feature-desc {
  font-size: var(--font-sm);
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0 0 12px;
}
.lp-feature-meta {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin-top: auto;
}

.lp-section-split {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: clamp(28px, 5vw, 72px);
  align-items: center;
}

.lp-list {
  margin: var(--spacing-lg) 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lp-list li {
  position: relative;
  padding-left: 20px;
  font-size: var(--font-sm);
  line-height: 1.7;
  color: var(--text-secondary);
}
.lp-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
}
.lp-list b { color: var(--text-primary); }

.lp-note {
  margin: var(--spacing-lg) 0 0;
  padding-left: 14px;
  border-left: 2px solid var(--border-default);
  font-size: var(--font-xs);
  line-height: 1.75;
  color: var(--text-muted);
}

.lp-split-visual {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lp-mini {
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(10px);
  transition: transform var(--transition-normal), border-color var(--transition-normal);
}
.lp-mini:hover {
  transform: translateX(6px);
  border-color: var(--color-primary);
}
.lp-mini-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.lp-mini-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  background: var(--accent-gradient-soft);
  color: var(--color-primary);
  font-size: var(--font-sm);
  font-weight: 700;
}
.lp-mini-ident { display: flex; flex-direction: column; gap: 1px; }
.lp-mini-name { font-size: var(--font-sm); font-weight: 600; }
.lp-mini-count { font-size: var(--font-xs); color: var(--text-muted); }
.lp-mini-amount { font-size: var(--font-xl); font-weight: 700; }
.lp-mini-rate { font-size: var(--font-xs); font-weight: 600; }
.lp-mini-rate.up { color: var(--color-rise); }
.lp-mini-rate.flat { color: var(--text-muted); }

.lp-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}
.lp-stat {
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  text-align: center;
}
.lp-stat-num {
  display: block;
  font-size: clamp(30px, 4vw, 44px);
  font-weight: 800;
  background: linear-gradient(120deg, var(--color-primary), var(--color-accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.lp-stat-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.lp-disclaimer {
  text-align: center;
  font-size: var(--font-xs);
  line-height: 1.8;
  color: var(--text-muted);
  margin: 0;
}
.lp-disclaimer b { color: var(--text-secondary); }

.lp-final {
  position: relative;
  z-index: 1;
  padding: clamp(64px, 10vh, 120px) clamp(20px, 6vw, 88px) 0;
  text-align: center;
}
.lp-final-inner {
  max-width: 640px;
  margin: 0 auto;
  padding-bottom: var(--spacing-2xl);
}
.lp-final .lp-lead {
  margin: 0 auto var(--spacing-xl);
}

.lp-foot {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-lg) 0 var(--spacing-2xl);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.lp-foot-links { display: flex; gap: var(--spacing-md); }
.lp-foot-links a {
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.lp-foot-links a:hover { color: var(--color-primary); }

.reveal {
  opacity: 0;
  transform: translate3d(0, 26px, 0);
  transition: opacity var(--duration-slow) var(--ease-out-expo),
              transform var(--duration-slow) var(--ease-out-expo);
  transition-delay: calc(var(--i, 0) * 70ms);
}
.reveal.in {
  opacity: 1;
  transform: none;
}

@media (max-width: 1023px) {
  .lp-hero {
    grid-template-columns: 1fr;
    text-align: left;
    padding-top: 104px;
  }
  .lp-stage { min-height: 42vh; order: -1; }
  .lp-section-split { grid-template-columns: 1fr; }
}

@media (max-width: 767px) {
  .lp-pills { display: none; }
  .lp-nav {
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: 10px var(--spacing-md);
  }
  .lp-brand-name { font-size: var(--font-sm); }
  .lp-ghost { display: none; }
  .lp-cta { padding: 8px 14px; font-size: var(--font-xs); }

  .lp-aurora,
  .lp-stars,
  .lp-ridge-far,
  .lp-flash,
  .lp-glow,
  .lp-card-sheen,
  .lp-card-shine,
  .lp-card-tag,
  .lp-card-sub,
  .lp-scroll-hint,
  .lp-note,
  .lp-tagline,
  .lp-mini-count { display: none; }
  .lp-ridge-near { opacity: 0.45; height: 18vh; }

  .lp-hero {
    min-height: 0;
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-lg);
    gap: var(--spacing-lg);
    align-items: start;
  }
  .lp-hero-inner {
    max-width: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .lp-stage {
    order: -1;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
  .lp-card {
    width: min(300px, 84vw);
    aspect-ratio: auto;
    gap: 2px;
    padding: 14px 16px;
    animation: none;
  }
  .lp-card-label { font-size: 11px; }
  .lp-card-chip { width: 26px; height: 19px; }
  .lp-card-amount { font-size: 27px; margin-top: 0; }
  .lp-card-row { gap: 6px; margin-top: 0; }
  .lp-card-delta { font-size: var(--font-xs); }
  .lp-card-rate { font-size: 11px; padding: 1px 6px; }
  .lp-card-spark { flex: none; margin: 2px 0; }
  .lp-card-spark svg { height: 26px; }
  .lp-card-name { font-size: var(--font-xs); }

  .lp-title {
    order: 1;
    font-size: clamp(27px, 8vw, 33px);
    line-height: 1.22;
    letter-spacing: -0.03em;
    margin: 0 0 var(--spacing-lg);
  }
  .lp-line { display: block; }
  .lp-actions {
    order: 2;
    flex-direction: column;
    align-items: stretch;
    align-self: stretch;
  }
  .lp-eyebrow {
    order: 3;
    padding: 0;
    border: none;
    background: none;
    font-size: 11px;
    margin: 14px 0 0;
  }
  .lp-sub { font-size: var(--font-sm); line-height: 1.7; }

  .lp-cta-lg, .lp-ghost-lg {
    justify-content: center;
    padding: 13px 20px;
  }

  .lp-section { padding: var(--spacing-xl) var(--spacing-md); }
  .lp-section-head { margin-bottom: var(--spacing-lg); }
  .lp-h2 { font-size: clamp(22px, 6.4vw, 28px); margin-bottom: 0; }
  .lp-lead { font-size: var(--font-sm); }

  .lp-orb { gap: var(--spacing-md); }
  .lp-orb-dot { width: 32px; }
  .lp-orb-stage { height: 148px; perspective: 900px; }
  .lp-face {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-content: center;
    column-gap: var(--spacing-md);
    row-gap: 3px;
    padding: var(--spacing-md);
    background: var(--bg-surface);
    backdrop-filter: none;
    box-shadow: none;
  }
  .lp-feature-icon {
    grid-row: 1 / span 2;
    align-self: center;
    width: 44px;
    height: 44px;
    margin-bottom: 0;
  }
  .lp-feature-title {
    align-self: end;
    font-size: 15px;
    margin: 0;
  }
  .lp-feature-desc {
    align-self: start;
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
  }

  .lp-section-split { gap: var(--spacing-lg); }
  .lp-split-visual { gap: var(--spacing-xs); }
  .lp-mini {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: var(--spacing-md);
    padding: 10px var(--spacing-md);
    background: var(--bg-surface);
    backdrop-filter: none;
  }
  .lp-mini:hover { transform: none; }
  .lp-mini-head { margin-bottom: 0; gap: var(--spacing-sm); }
  .lp-mini-mark { width: 26px; height: 26px; font-size: var(--font-xs); }
  .lp-mini-amount { font-size: var(--font-md); }
  .lp-mini-rate { font-size: 11px; min-width: 46px; text-align: right; }

  .lp-stats {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }
  .lp-stat { padding: var(--spacing-md) var(--spacing-xs); background: var(--bg-surface); }
  .lp-stat-num { font-size: var(--font-xl); }
  .lp-stat-label { font-size: 11px; }
  .lp-disclaimer { font-size: 11px; line-height: 1.6; }

  .lp-final { padding: var(--spacing-xl) var(--spacing-md) 0; }
  .lp-final .lp-h2 { margin-bottom: var(--spacing-lg); }
  .lp-foot {
    flex-direction: column;
    gap: var(--spacing-sm);
    justify-content: center;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-stars, .lp-dot, .lp-card, .lp-card-sheen, .lp-scroll-line { animation: none; }
  .lp-line, .lp-sub, .lp-actions { animation: none; opacity: 1; transform: none; }
  .reveal { transition-duration: 1ms; }
  .lp-face, .lp-orb-ring { transition-duration: 1ms; }
  .lp-orb-dot.on .lp-orb-dot-fill { animation: none; transform: scaleX(1); }
}
</style>
