/**
 * 01 · 页面渲染   02 · 组件渲染
 *
 * 每个页面在「空数据态」（新用户）与「有数据态」下各挂载一次，不报错即通过。
 * 空态尤其重要——新用户零数据时最容易因为少写一个判空而白屏。
 */

import { describe } from 'vitest'
import { featureCase } from '../helpers/case'
import { freshPinia, TEST_FUNDS } from '../helpers/seed'
import { flush } from '../helpers/gesture'
import { setBreakpoint } from '../setup/media-stub'

/** 建一个隔离路由（用真实路由表），避免各用例互相影响 */
async function makeRouter(path = '/') {
  const { createRouter, createWebHashHistory } = await import('vue-router')
  const real = (await import('@/router/index')).default
  const router = createRouter({ history: createWebHashHistory(), routes: real.getRoutes() as any })
  await router.push(path)
  await router.isReady()
  return router
}

/** 铺"有数据态"：自选基金 + 持仓 + 自选股 */
async function seedAll() {
  const { useFundStore } = await import('@/modules/fund/fund-store')
  const { useHoldingStore } = await import('@/modules/holding/holding-store')
  const { useStockStore } = await import('@/modules/stock/stock-store')
  const f = useFundStore()
  const h = useHoldingStore()
  const s = useStockStore()
  h.restoreHoldings()
  s.restoreWatchlist()
  for (const x of TEST_FUNDS) {
    f.addFund(x.code, x.name)
    h.addHoldingByAmount(x.code, 10000, 1.234)
  }
  s.addToWatchlist({ code: '600519', name: '贵州茅台', rawMarket: '1' } as any)
}

/**
 * 挂载一个页面组件，返回是否成功渲染出 DOM。
 * withData=true 时先铺数据（有数据态）。
 */
async function mountPage(loader: () => Promise<any>, path: string, withData: boolean) {
  freshPinia()
  if (withData) await seedAll()
  const { mount } = await import('@vue/test-utils')
  const router = await makeRouter(path)
  const comp = (await loader()).default
  const wrapper = mount(comp, {
    global: {
      plugins: [router],
      stubs: { RouterLink: true, RouterView: true, transition: false, 'transition-group': false },
    },
  })
  await flush()
  const html = wrapper.html()
  wrapper.unmount()
  return html
}

/** 全部页面：[编号后缀, 中文名, 加载器, 路由路径] */
const PAGES: [string, string, () => Promise<any>, string][] = [
  ['01', '首页', () => import('@/views/home.vue'), '/'],
  ['03', '行情资讯中心', () => import('@/views/stock-news-hub.vue'), '/market'],
  ['04', '资讯详情', () => import('@/views/market-news.vue'), '/news/detail'],
  ['05', '资讯全屏', () => import('@/views/news-full.vue'), '/news/detail'],
  ['06', '基金详情', () => import('@/views/fund-detail.vue'), '/fund/000001'],
  ['07', '批量管理', () => import('@/views/manage.vue'), '/manage'],
  ['08', '设置主页', () => import('@/views/settings.vue'), '/settings'],
  ['14', '数据管理', () => import('@/views/settings/data-management.vue'), '/settings/data'],
  ['15', '关于', () => import('@/views/settings/about.vue'), '/settings/about'],
  ['16', '指数设置', () => import('@/views/settings/indices-settings.vue'), '/settings/indices'],
  ['17', '登录', () => import('@/views/login.vue'), '/login'],
  ['18', '注册', () => import('@/views/register.vue'), '/register'],
  ['19', '问题反馈', () => import('@/views/feedback.vue'), '/feedback'],
  ['20', '公益', () => import('@/views/charity.vue'), '/charity'],
  ['21', '板块全屏', () => import('@/views/sector-full.vue'), '/market'],
  ['22', '个股全屏', () => import('@/views/stock-full.vue'), '/market'],
]

describe('01 · 页面渲染', () => {
  for (const [n, name, loader, path] of PAGES) {
    featureCase(`01-${n}`, `${name} · 空数据态可渲染`, async t => {
      const html = await t.act(`挂载 ${name}（新用户零数据）`, () => mountPage(loader, path, false))
      t.check('渲染出 DOM 内容', !!html && html.length > 20, `${name} 空数据态渲染为空 —— 新用户会看到白屏`)
    })
  }

  for (const [n, name, loader, path] of PAGES) {
    featureCase(`01-${Number(n) + 22}`, `${name} · 有数据态可渲染`, async t => {
      const html = await t.act(`挂载 ${name}（含基金/持仓/自选数据）`, () => mountPage(loader, path, true))
      t.check('渲染出 DOM 内容', !!html && html.length > 20, `${name} 有数据态渲染为空 —— 页面白屏`)
    })
  }

  featureCase('01-45', '移动端断点下首页可渲染', async t => {
    await t.prepare('切换到移动端断点', () => setBreakpoint('mobile'))
    const html = await t.act('挂载首页', () => mountPage(() => import('@/views/home.vue'), '/', true))
    t.check('移动端渲染出内容', !!html && html.length > 20, '移动端首页白屏')
  })

  featureCase('01-46', '平板断点下首页可渲染', async t => {
    await t.prepare('切换到平板断点', () => setBreakpoint('tablet'))
    const html = await t.act('挂载首页', () => mountPage(() => import('@/views/home.vue'), '/', true))
    t.check('平板渲染出内容', !!html && html.length > 20, '平板首页白屏')
  })
})

/* ─────────────── 02 组件渲染 ─────────────── */

async function mountComp(loader: () => Promise<any>, props: any = {}, withData = true) {
  freshPinia()
  if (withData) await seedAll()
  const { mount } = await import('@vue/test-utils')
  const router = await makeRouter('/')
  const comp = (await loader()).default
  const wrapper = mount(comp, {
    props,
    global: {
      plugins: [router],
      stubs: { RouterLink: true, RouterView: true, transition: false, 'transition-group': false },
    },
  })
  await flush()
  const html = wrapper.html()
  wrapper.unmount()
  return html
}

/** fund-list 的必填 props（字段名以 use-fund-data.ts 的 FundRowData 为准） */
const FUND_LIST_PROPS = {
  sortedRows: TEST_FUNDS.map(f => ({
    fundCode: f.code,
    fundName: f.name,
    lastNetValue: 1.234,
    currentNav: 1.245,
    changeRate: 0.89,
    netChangeRate: 0.85,
    changeDirection: 'up',
    holdingAmount: 10000,
    costPrice: 1.2,
    todayProfit: 89,
    totalProfit: 120,
    totalReturnRate: 1.21,
    profitStatus: 'profit',
    valuationTime: '2026-08-07 14:30',
    holdingDate: '2026-08-06',
    isEstimated: true,
    isUpdated: false,
    delayDays: 1 as 1 | 2,
    hasTodayData: true,
    hasHoldingsRatio: true,
  })),
  viewMode: 'card',
  sortField: 'gszzl',
  sortDirection: 'desc',
}

/** dashboard-stats 的必填 props（字段名以 holding-types.ts 的 DashboardStats 为准） */
const DASHBOARD_PROPS = {
  stats: {
    totalHoldingAmount: 30000,
    todayProfit: 267,
    totalProfit: 360,
    overallChangeRate: 1.21,
    totalCost: 29640,
    todayReturnRate: 0.89,
  },
}

const COMPONENTS: [string, string, () => Promise<any>, any][] = [
  ['01', '基金列表', () => import('@/components/fund-list/fund-list.vue'), FUND_LIST_PROPS],
  ['02', '基金迷你走势图', () => import('@/components/fund-list/fund-sparkline.vue'), { points: [1, 2, 3] }],
  ['03', '仪表盘统计', () => import('@/components/dashboard/dashboard-stats.vue'), DASHBOARD_PROPS],
  ['04', '基金详情面板', () => import('@/components/fund-detail/fund-detail-pane.vue'), { fundCode: '000001' }],
  ['05', '任务管理器', () => import('@/components/fund-detail/task-manager.vue'), { fundCode: '000001' }],
  ['06', '指数栏', () => import('@/components/market/index-bar.vue'), {}],
  ['08', '搜索栏', () => import('@/components/search/search-bar.vue'), {}],
  ['09', '搜索弹窗', () => import('@/components/search/search-dialog.vue'), {}],
  ['11', '底部导航', () => import('@/components/shared/bottom-nav.vue'), {}],
  ['12', '待确认计划列表', () => import('@/components/shared/pending-plan-list.vue'), {}],
  ['14', '涨跌指示器', () => import('@/components/shared/change-indicator.vue'), { value: 1.25 }],
  ['15', '数字滚动', () => import('@/components/shared/number-transition.vue'), { value: 100 }],
  ['16', '确认弹窗', () => import('@/components/shared/confirm-modal.vue'), { visible: true, title: '确认' }],
  ['17', '通知弹窗', () => import('@/components/shared/notice-modal.vue'), { visible: true }],
  ['18', '隐私浮层', () => import('@/components/shared/privacy-popover.vue'), {}],
  ['19', '公告弹窗', () => import('@/components/shared/free-announcement-popup.vue'), {}],
  ['20', '净值走势图', () => import('@/components/fund-list/fund-nav-trend.vue'), {
    // ≥2 点才会画折线；日期取近1年内的几个点，避开空数据占位分支
    points: [
      { d: '2025-12-01', v: 1.10 },
      { d: '2026-04-01', v: 1.18 },
      { d: '2026-08-06', v: 1.30 },
    ],
    changeRate: 1.5,
  }],
]

describe('02 · 组件渲染', () => {
  for (const [n, name, loader, props] of COMPONENTS) {
    featureCase(`02-${n}`, `${name} 可渲染`, async t => {
      const html = await t.act(`挂载「${name}」组件`, () => mountComp(loader, props))
      t.check('组件渲染成功（无异常）', typeof html === 'string', `${name} 组件挂载失败`)
    })
  }

  // 净值走势图空数据态：无历史净值时应画占位虚线、显示「加载中」，不白屏不报错
  featureCase('02-21', '净值走势图空数据态可渲染（占位不崩）', async t => {
    const html = await t.act('挂载「净值走势图」（无净值数据）', () =>
      mountComp(() => import('@/components/fund-list/fund-nav-trend.vue'), { points: [], changeRate: 0 }),
    )
    t.check('空数据态渲染出 DOM', typeof html === 'string' && html.length > 0, '净值走势图空数据态渲染为空')
    t.check('显示占位提示', typeof html === 'string' && html.includes('加载中'), '空数据未显示占位文案 —— 用户会看到空白图')
  })
})
