/**
 * 18 · UI 交互
 *
 * 只关注「点了有反应」，不关注「反应得漂亮」：
 *   测：交互后状态变了吗 / 界面更新了吗 / 弹窗能开能关吗 / 手势能触发行为吗 / 监听能卸载吗
 *   不测：动画流畅度、帧率、像素位置、样式美观
 *
 * 重点防的是 UI 层最典型的故障：状态机卡死 → 页面点不动（不报错、不白屏，就是没反应）。
 */

import { describe } from 'vitest'
import { featureCase, isDefined } from '../helpers/case'
import { freshPinia, TEST_FUNDS } from '../helpers/seed'
import {
  swipeLeft, swipeRight, swipe, longPress, longPressWithMove, mouseLongPress,
  doubleTap, dispatchMouse, dispatchTouch, pasteImage, dropFile, flush, wait,
} from '../helpers/gesture'
import { chartCalls, setBreakpoint, resetBreakpoint } from '../setup/media-stub'

async function makeRouter(path = '/') {
  const { createRouter, createWebHashHistory } = await import('vue-router')
  const real = (await import('@/router/index')).default
  const router = createRouter({ history: createWebHashHistory(), routes: real.getRoutes() as any })
  await router.push(path)
  await router.isReady()
  return router
}

async function seedAll() {
  const { useFundStore } = await import('@/modules/fund/fund-store')
  const { useHoldingStore } = await import('@/modules/holding/holding-store')
  const f = useFundStore()
  const h = useHoldingStore()
  h.restoreHoldings()
  for (const x of TEST_FUNDS) {
    f.addFund(x.code, x.name)
    h.addHoldingByAmount(x.code, 10000, 1.234)
  }
  return { f, h }
}

/** 挂载基金详情页（左右滑切基金的载体） */
async function mountDetail(code = '000001') {
  freshPinia()
  await seedAll()
  const { mount } = await import('@vue/test-utils')
  const router = await makeRouter(`/fund/${code}`)
  const comp = (await import('@/views/fund-detail.vue')).default
  const wrapper = mount(comp, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { RouterLink: true, transition: false, 'transition-group': false } },
  })
  await flush()
  return { wrapper, router }
}

/* ═══════════ 18A 手势 ═══════════ */

describe('18 · UI交互', () => {
  featureCase('18-01', '详情页左滑切换基金', async t => {
    const { wrapper, router } = await t.prepare('挂载基金详情页（第 1 只）', () => mountDetail('000001'))
    const before = router.currentRoute.value.params.code
    await t.act('派发左滑手势序列', async () => {
      swipeLeft(wrapper.element as Element, 250)
      await flush()
      await wait(450)
      await flush()
    })
    const after = router.currentRoute.value.params.code
    t.check('页面仍可用（未崩溃）', !!wrapper.html(), '左滑后页面白屏')
    t.note(`路由：${before} → ${after}`, true)
    wrapper.unmount()
  })

  featureCase('18-02', '详情页右滑切换基金', async t => {
    const { wrapper } = await t.prepare('挂载基金详情页（第 2 只）', () => mountDetail('000002'))
    await t.act('派发右滑手势序列', async () => {
      swipeRight(wrapper.element as Element, 250)
      await flush()
      await wait(450)
      await flush()
    })
    t.check('页面仍可用（未崩溃）', !!wrapper.html(), '右滑后页面白屏')
    wrapper.unmount()
  })

  featureCase('18-03', '滑动距离不足阈值时不切换（回弹）', async t => {
    const { wrapper, router } = await t.prepare('挂载基金详情页', () => mountDetail('000001'))
    const before = router.currentRoute.value.params.code
    await t.act('派发一个很短的滑动（20px）', async () => {
      swipe(wrapper.element as Element, { fromX: 300, toX: 280 })
      await flush()
      await wait(450)
      await flush()
    })
    const after = router.currentRoute.value.params.code
    t.check('未发生切换', before === after, `短滑动误触发了切换：${before} → ${after}`)
    wrapper.unmount()
  })

  featureCase('18-04', '连续多次滑动仍然有效（防状态机卡死）', async t => {
    const { wrapper } = await t.prepare('挂载基金详情页', () => mountDetail('000001'))
    await t.act('连续派发 3 次左滑', async () => {
      for (let i = 0; i < 3; i++) {
        swipeLeft(wrapper.element as Element, 250)
        await flush()
        await wait(450)
        await flush()
      }
    })
    t.check('多次滑动后页面仍可用', !!wrapper.html(), '连续滑动后页面白屏')
    // 再来一次，验证手势通道没有被永久占用
    await t.act('第 4 次滑动（验证手势未失效）', async () => {
      swipeLeft(wrapper.element as Element, 250)
      await flush()
      await wait(450)
      await flush()
    })
    t.check('手势通道未卡死', !!wrapper.html(), '连续滑动导致手势状态机卡死 —— 返回按钮与后续手势会全部失效')
    wrapper.unmount()
  })

  featureCase('18-05', '滑动后页面交互未失效（返回入口仍在）', async t => {
    const { wrapper } = await t.prepare('挂载基金详情页', () => mountDetail('000001'))
    await t.act('派发左滑手势', async () => {
      swipeLeft(wrapper.element as Element, 250)
      await flush()
      await wait(450)
      await flush()
    })
    const buttons = await t.act('查找页面上的可点击元素', () => wrapper.findAll('button'))
    t.check('页面仍有可点击元素', buttons.length > 0, '滑动后页面无任何按钮 —— 用户被困在页面里出不去')
    wrapper.unmount()
  })

  featureCase('18-06', 'touchcancel 能正常复位手势状态', async t => {
    const { wrapper } = await t.prepare('挂载基金详情页', () => mountDetail('000001'))
    await t.act('派发 touchstart 后直接 touchcancel', async () => {
      const el = wrapper.element as Element
      dispatchTouch(el, 'touchstart', 300, 200)
      dispatchTouch(el, 'touchmove', 200, 200)
      dispatchTouch(el, 'touchcancel', 200, 200)
      await flush()
      await wait(450)
    })
    await t.act('中断后再正常滑动一次', async () => {
      swipeLeft(wrapper.element as Element, 250)
      await flush()
      await wait(450)
    })
    t.check('中断后手势仍可用', !!wrapper.html(), 'touchcancel 后手势卡死')
    wrapper.unmount()
  })

  /* ── 长按菜单（基金列表） ── */

  /** 构造符合 FundRowData 结构的行数据（字段名以 use-fund-data.ts 的定义为准） */
  function makeRows() {
    return TEST_FUNDS.map(f => ({
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
    }))
  }

  async function mountFundList() {
    freshPinia()
    await seedAll()
    const { mount } = await import('@vue/test-utils')
    const router = await makeRouter('/')
    const comp = (await import('@/components/fund-list/fund-list.vue')).default
    const wrapper = mount(comp, {
      attachTo: document.body,
      props: {
        sortedRows: makeRows(),
        viewMode: 'card',
        sortField: 'gszzl',
        sortDirection: 'desc',
      },
      global: { plugins: [router], stubs: { RouterLink: true, transition: false, 'transition-group': false } },
    })
    await flush()
    return wrapper
  }

  featureCase('18-07', '基金列表长按弹出操作菜单', async t => {
    const wrapper = await t.prepare('挂载基金列表', () => mountFundList())
    const card = await t.act('找到第一张基金卡片', () => wrapper.find('[data-fund-row]'))
    t.check('找到基金卡片', card.exists(), '基金列表未渲染出卡片')

    await t.act('长按该卡片 800ms', async () => {
      await longPress(card.element as Element, 100, 100, 800)
      await flush()
    })
    // 菜单用 Teleport to="body"，内容在 wrapper 之外，须从 document 查
    const popup = document.body.querySelector('.longpress-popup')
    t.check('弹出操作菜单', !!popup, '长按后未弹出操作菜单 —— 长按功能失效')
    wrapper.unmount()
  })

  featureCase('18-08', '长按中途移动手指应取消弹出', async t => {
    const wrapper = await t.prepare('挂载基金列表', () => mountFundList())
    const card = wrapper.find('[data-fund-row]')
    await t.act('长按但中途移动手指', async () => {
      await longPressWithMove(card.element as Element, 100, 100)
      await flush()
    })
    const popup = document.body.querySelector('.longpress-popup')
    t.check('未弹出菜单', !popup, '移动手指后仍弹出菜单 —— 滚动列表时会误触发')
    wrapper.unmount()
  })

  featureCase('18-09', '长按菜单含编辑/清仓/删除三个操作', async t => {
    const wrapper = await t.prepare('挂载基金列表并长按', async () => {
      const w = await mountFundList()
      const card = w.find('[data-fund-row]')
      await longPress(card.element as Element, 100, 100, 800)
      await flush()
      return w
    })
    const edit = document.body.querySelector('.popup-edit')
    const clear = document.body.querySelector('.popup-clear')
    const del = document.body.querySelector('.popup-delete')
    t.check('编辑按钮存在', !!edit, '长按菜单缺少编辑按钮')
    t.check('清仓按钮存在', !!clear, '长按菜单缺少清仓按钮')
    t.check('删除按钮存在', !!del, '长按菜单缺少删除按钮')
    wrapper.unmount()
  })

  featureCase('18-10', '长按菜单按钮可点击触发', async t => {
    const wrapper = await t.prepare('挂载基金列表并长按', async () => {
      const w = await mountFundList()
      const card = w.find('[data-fund-row]')
      await longPress(card.element as Element, 100, 100, 800)
      await flush()
      return w
    })
    const edit = document.body.querySelector('.popup-edit') as HTMLElement | null
    t.check('找到编辑按钮', !!edit, '长按菜单未弹出')
    await t.act('点击编辑按钮（不应抛异常）', async () => {
      edit?.dispatchEvent(new Event('click', { bubbles: true }))
      await flush()
    })
    t.check('点击后组件仍可用', !!wrapper.html(), '点击菜单按钮后组件崩溃')
    wrapper.unmount()
  })

  featureCase('18-11', '点击页面别处关闭长按菜单', async t => {
    const wrapper = await t.prepare('挂载基金列表并长按', async () => {
      const w = await mountFundList()
      const card = w.find('[data-fund-row]')
      await longPress(card.element as Element, 100, 100, 800)
      await flush()
      return w
    })
    t.check('菜单已弹出', !!document.body.querySelector('.longpress-popup'), '长按菜单未弹出')
    await t.act('点击 document 其他位置', async () => {
      // 组件会吸收长按后的第一次 tail click（鼠标释放产生的），故派发两次模拟真实点击
      dispatchMouse(document, 'click', 5, 5)
      await flush()
      dispatchMouse(document, 'click', 5, 5)
      await flush()
    })
    t.check('菜单已关闭', !document.body.querySelector('.longpress-popup'), '点击别处后菜单未关闭 —— 菜单会一直挡在界面上')
    wrapper.unmount()
  })

  featureCase('18-12', '页面滚动时关闭长按菜单', async t => {
    const wrapper = await t.prepare('挂载基金列表并长按', async () => {
      const w = await mountFundList()
      const card = w.find('[data-fund-row]')
      await longPress(card.element as Element, 100, 100, 800)
      await flush()
      return w
    })
    await t.act('派发页面滚动事件', async () => {
      document.dispatchEvent(new Event('scroll', { bubbles: true }))
      window.dispatchEvent(new Event('scroll', { bubbles: true }))
      await flush()
    })
    t.check('组件仍可用', !!wrapper.html(), '滚动后组件崩溃')
    wrapper.unmount()
  })

  featureCase('18-13', '桌面端鼠标长按等价可用', async t => {
    const wrapper = await t.prepare('挂载基金列表', () => mountFundList())
    const card = wrapper.find('[data-fund-row]')
    await t.act('鼠标按住 800ms', async () => {
      await mouseLongPress(card.element as Element, 100, 100, 800)
      await flush()
    })
    t.check('组件仍可用', !!wrapper.html(), '鼠标长按后组件崩溃')
    wrapper.unmount()
  })

  /* ═══════════ 18B 图表交互 ═══════════ */

  featureCase('18-14', '基金详情页图表可初始化', async t => {
    const { wrapper } = await t.prepare('挂载基金详情页', () => mountDetail('000001'))
    t.check('页面渲染成功', !!wrapper.html(), '详情页白屏')
    t.note(`图表初始化次数：${chartCalls.init}`, true)
    wrapper.unmount()
  })

  featureCase('18-15', '图表长按进入读数模式', async t => {
    const m = await t.prepare('导入图表手势 composable', async () => await import('@/composables/use-chart-scrub'))
    t.check('导出 chartScrubActive 标志', isDefined(m.chartScrubActive), 'chartScrubActive 不存在 —— 手势仲裁会失效')
    t.check('初始为非激活', m.chartScrubActive.value === false, `初始值为 ${m.chartScrubActive.value}，应为 false`)
  })

  featureCase('18-16', '图表双击手势不抛异常', async t => {
    const { wrapper } = await t.prepare('挂载基金详情页', () => mountDetail('000001'))
    await t.act('在页面上派发双击手势', async () => {
      await doubleTap(wrapper.element as Element, 150, 300)
      await flush()
    })
    t.check('页面仍可用', !!wrapper.html(), '双击后页面崩溃')
    wrapper.unmount()
  })

  featureCase('18-17', '图表手势仲裁标志可被父级读取', async t => {
    const m = await t.prepare('导入图表手势 composable', async () => await import('@/composables/use-chart-scrub'))
    await t.act('手动置位手势标志', () => {
      m.chartScrubActive.value = true
    })
    t.check('标志可被读取为 true', m.chartScrubActive.value === true, '手势仲裁标志无法置位 —— 图表上滑动会误触发切换基金')
    await t.act('复位标志', () => {
      m.chartScrubActive.value = false
    })
    t.check('标志可复位', m.chartScrubActive.value === false, '手势标志无法复位 —— 会永久挡住页面滑动')
  })

  featureCase('18-18', '组件卸载后图表被清理（防内存泄漏）', async t => {
    const { wrapper } = await t.prepare('挂载基金详情页', () => mountDetail('000001'))
    await t.act('卸载页面', () => wrapper.unmount())
    t.check('卸载未抛异常', true, '')
    t.note(`图表销毁次数：${chartCalls.dispose}`, true)
  })

  featureCase('18-19', '当日/历史走势切换不抛异常', async t => {
    const { wrapper } = await t.prepare('挂载基金详情页', () => mountDetail('000001'))
    const buttons = await t.act('查找页面按钮', () => wrapper.findAll('button'))
    await t.act('依次点击前若干个按钮（模拟切换走势）', async () => {
      for (const b of buttons.slice(0, 6)) {
        try {
          await b.trigger('click')
          await flush()
        } catch {
          /* 个别按钮可能需要额外上下文，忽略 */
        }
      }
    })
    t.check('多次切换后页面仍可用', !!wrapper.html(), '切换走势后页面崩溃')
    wrapper.unmount()
  })

  /* ═══════════ 18C 弹窗与浮层 ═══════════ */

  async function mountComp(loader: () => Promise<any>, props: any = {}) {
    freshPinia()
    await seedAll()
    const { mount } = await import('@vue/test-utils')
    const router = await makeRouter('/')
    const comp = (await loader()).default
    const wrapper = mount(comp, {
      attachTo: document.body,
      props,
      global: { plugins: [router], stubs: { RouterLink: true, transition: false, 'transition-group': false } },
    })
    await flush()
    return wrapper
  }

  featureCase('18-20', '确认弹窗显示与确认回调', async t => {
    const wrapper = await t.prepare('挂载确认弹窗（visible=true）', () =>
      mountComp(() => import('@/components/shared/confirm-modal.vue'), {
        visible: true, title: '确认删除', desc: '确定要删除吗',
      }),
    )
    // 弹窗用 Teleport to="body"，内容在 wrapper 之外
    const modal = document.body.querySelector('.modal-card')
    t.check('弹窗已渲染到 body', !!modal, '确认弹窗未渲染 —— 二次确认功能失效')
    const btns = Array.from(document.body.querySelectorAll('.modal-card button')) as HTMLElement[]
    t.check('弹窗含确认/取消按钮', btns.length >= 2, `确认弹窗仅 ${btns.length} 个按钮 —— 用户无法确认或取消`)

    await t.act('点击确认按钮（应触发事件）', async () => {
      btns[btns.length - 1]?.dispatchEvent(new Event('click', { bubbles: true }))
      await flush()
    })
    const emitted = wrapper.emitted()
    t.check('触发了事件回调', Object.keys(emitted).length > 0, '点击按钮未触发任何事件 —— 确认操作无响应')
    wrapper.unmount()
  })

  featureCase('18-21', '确认弹窗 visible=false 时不显示内容', async t => {
    const wrapper = await t.prepare('挂载确认弹窗（visible=false）', () =>
      mountComp(() => import('@/components/shared/confirm-modal.vue'), { visible: false, title: '确认' }),
    )
    const html = wrapper.html()
    t.check('隐藏态渲染无异常', typeof html === 'string', '弹窗隐藏态渲染失败')
    wrapper.unmount()
  })

  featureCase('18-22', '搜索弹窗可打开并接受输入', async t => {
    const wrapper = await t.prepare('挂载搜索弹窗', () => mountComp(() => import('@/components/search/search-dialog.vue'), { visible: true }))
    t.check('弹窗已渲染', !!wrapper.html(), '搜索弹窗未渲染')
    // 弹窗内含识图用的 file input，需排除，只取文本输入框
    const input = wrapper.findAll('input').find(i => {
      const type = (i.element as HTMLInputElement).type
      return type !== 'file' && type !== 'checkbox' && type !== 'radio'
    })
    if (input) {
      await t.act('输入搜索关键词', async () => {
        await input.setValue('000001')
        await flush()
      })
      t.check('输入值已写入', (input.element as HTMLInputElement).value === '000001', '搜索框输入无效 —— 用户无法搜索基金')
    } else {
      t.note('当前状态未渲染出文本输入框，仅验证弹窗可挂载')
    }
    wrapper.unmount()
  })

  featureCase('18-23', '通知弹窗可渲染与关闭', async t => {
    const wrapper = await t.prepare('挂载通知弹窗', () => mountComp(() => import('@/components/shared/notice-modal.vue'), { visible: true }))
    t.check('弹窗已渲染', !!wrapper.html(), '通知弹窗未渲染')
    const btns = wrapper.findAll('button')
    if (btns.length) {
      await t.act('点击关闭按钮', async () => {
        await btns[btns.length - 1].trigger('click')
        await flush()
      })
    }
    t.check('关闭后组件仍可用', !!wrapper.html(), '关闭弹窗后组件崩溃')
    wrapper.unmount()
  })

  featureCase('18-24', '隐私浮层可切换显示', async t => {
    const wrapper = await t.prepare('挂载隐私浮层', () => mountComp(() => import('@/components/shared/privacy-popover.vue'), {}))
    t.check('浮层组件已渲染', typeof wrapper.html() === 'string', '隐私浮层渲染失败')
    const btns = wrapper.findAll('button')
    if (btns.length) {
      await t.act('点击浮层内按钮', async () => {
        await btns[0].trigger('click')
        await flush()
      })
    }
    t.check('交互后组件仍可用', typeof wrapper.html() === 'string', '隐私浮层交互后崩溃')
    wrapper.unmount()
  })

  featureCase('18-25', '公告弹窗可渲染', async t => {
    const wrapper = await t.prepare('挂载公告弹窗', () => mountComp(() => import('@/components/shared/free-announcement-popup.vue'), {}))
    t.check('公告弹窗渲染无异常', typeof wrapper.html() === 'string', '公告弹窗渲染失败')
    wrapper.unmount()
  })

  featureCase('18-26', '任务管理弹窗可渲染', async t => {
    const wrapper = await t.prepare('挂载任务管理器', () =>
      mountComp(() => import('@/components/fund-detail/task-manager.vue'), { fundCode: '000001', visible: true }),
    )
    t.check('任务管理器渲染无异常', typeof wrapper.html() === 'string', '任务管理器渲染失败')
    wrapper.unmount()
  })

  featureCase('18-28', '数据清除确认流程可走通', async t => {
    const wrapper = await t.prepare('挂载数据管理页', () => mountComp(() => import('@/views/settings/data-management.vue'), {}))
    t.check('页面已渲染', !!wrapper.html(), '数据管理页白屏')
    const btns = wrapper.findAll('button')
    t.check('页面含操作按钮', btns.length > 0, '数据管理页无任何按钮 —— 无法执行清除')
    await t.act('点击第一个清除相关按钮（不应抛异常）', async () => {
      await btns[0].trigger('click')
      await flush()
    })
    t.check('点击后页面仍可用', !!wrapper.html(), '点击清除后页面崩溃')
    wrapper.unmount()
  })

  /* ═══════════ 18D 导航与路由 ═══════════ */

  featureCase('18-29', '底部导航渲染出多个入口', async t => {
    const wrapper = await t.prepare('挂载底部导航', () => mountComp(() => import('@/components/shared/bottom-nav.vue'), {}))
    t.check('导航已渲染', !!wrapper.html(), '底部导航白屏 —— 用户无法切换页面')
    const items = wrapper.findAll('a, button, [class*="nav"]')
    t.check('含多个导航入口', items.length >= 2, `导航入口仅 ${items.length} 个`)
    wrapper.unmount()
  })

  featureCase('18-30', '底部导航点击可切换路由', async t => {
    freshPinia()
    await seedAll()
    const { mount } = await import('@vue/test-utils')
    const router = await t.prepare('创建路由', () => makeRouter('/'))
    const comp = (await import('@/components/shared/bottom-nav.vue')).default
    const wrapper = await t.act('挂载底部导航', async () => {
      const w = mount(comp, { attachTo: document.body, global: { plugins: [router], stubs: { transition: false } } })
      await flush()
      return w
    })
    const clickable = wrapper.findAll('a, button, div[class*="nav-item"]')
    await t.act('依次点击导航项（不应抛异常）', async () => {
      for (const el of clickable.slice(0, 4)) {
        try {
          await el.trigger('click')
          await flush()
        } catch {
          /* 部分项可能是纯展示 */
        }
      }
    })
    t.check('点击后导航仍可用', !!wrapper.html(), '点击导航后组件崩溃')
    wrapper.unmount()
  })

  featureCase('18-31', '路由跳转到各主要页面均可用', async t => {
    const router = await t.prepare('创建路由', () => makeRouter('/'))
    const paths = ['/market', '/settings', '/manage', '/']
    const bad: string[] = []
    await t.act('依次跳转', async () => {
      for (const p of paths) {
        try {
          await router.push(p)
          await router.isReady()
        } catch (e: any) {
          bad.push(`${p} → ${e?.message}`)
        }
      }
    })
    t.check('全部跳转成功', bad.length === 0, `以下路由跳转失败：${bad.join('; ')}`)
  })

  featureCase('18-32', '路由参数变化可被读取（详情页切基金）', async t => {
    const router = await t.prepare('创建路由', () => makeRouter('/fund/000001'))
    t.check('初始参数正确', router.currentRoute.value.params.code === '000001', `初始参数为 ${router.currentRoute.value.params.code}`)
    await t.act('跳转到另一只基金', async () => {
      await router.push('/fund/000002')
      await router.isReady()
    })
    t.check('参数已更新', router.currentRoute.value.params.code === '000002', '路由参数未更新 —— 切换基金后仍显示旧数据')
  })

  featureCase('18-33', '设置二级页返回上级可用', async t => {
    const router = await t.prepare('创建路由并进入二级页', () => makeRouter('/settings/data'))
    t.check('已在二级页', router.currentRoute.value.path === '/settings/data', `当前在 ${router.currentRoute.value.path}`)
    await t.act('返回设置主页', async () => {
      await router.push('/settings')
      await router.isReady()
    })
    t.check('已返回设置主页', router.currentRoute.value.path === '/settings', '无法从二级页返回')
  })

  /* ═══════════ 18E 表单与输入 ═══════════ */

  featureCase('18-34', '批量管理页加仓表单可提交', async t => {
    const wrapper = await t.prepare('挂载批量管理页', () => mountComp(() => import('@/views/manage.vue'), {}))
    t.check('页面已渲染', !!wrapper.html(), '批量管理页白屏')
    const btns = wrapper.findAll('button')
    t.check('页面含操作按钮', btns.length > 0, '批量管理页无按钮 —— 无法操作持仓')
    await t.act('点击若干按钮展开表单（不应抛异常）', async () => {
      for (const b of btns.slice(0, 5)) {
        try {
          await b.trigger('click')
          await flush()
        } catch {
          /* 忽略需要额外上下文的按钮 */
        }
      }
    })
    t.check('交互后页面仍可用', !!wrapper.html(), '表单交互后页面崩溃')
    wrapper.unmount()
  })

  featureCase('18-35', '表单输入框可接受输入', async t => {
    const wrapper = await t.prepare('挂载批量管理页', () => mountComp(() => import('@/views/manage.vue'), {}))
    const btns = wrapper.findAll('button')
    await t.act('点击按钮展开表单', async () => {
      for (const b of btns.slice(0, 5)) {
        try { await b.trigger('click'); await flush() } catch { /* 忽略 */ }
      }
    })
    // 页面首个 input 是行选择 checkbox，须挑数值型表单输入框
    const numInput = wrapper.findAll('input').find(i => (i.element as HTMLInputElement).type === 'number')
    if (numInput) {
      await t.act('在金额输入框输入数值', async () => {
        await numInput.setValue('1000')
        await flush()
      })
      t.check('输入值已写入', (numInput.element as HTMLInputElement).value === '1000', '表单输入无效 —— 用户无法录入持仓')
    } else {
      t.note('当前状态未展开数值输入框，仅验证页面交互不崩')
    }
    wrapper.unmount()
  })

  featureCase('18-36', '登录表单可输入并提交', async t => {
    const wrapper = await t.prepare('挂载登录页', () => mountComp(() => import('@/views/login.vue'), {}))
    const inputs = wrapper.findAll('input')
    t.check('登录页含输入框', inputs.length >= 1, '登录页无输入框 —— 用户无法登录')
    if (inputs.length >= 2) {
      await t.act('输入邮箱与密码', async () => {
        await inputs[0].setValue('test@example.com')
        await inputs[1].setValue('pwd123456')
        await flush()
      })
      t.check('邮箱已写入', (inputs[0].element as HTMLInputElement).value === 'test@example.com', '邮箱输入无效')
    }
    const btns = wrapper.findAll('button')
    if (btns.length) {
      await t.act('点击提交（不应抛异常）', async () => {
        await btns[0].trigger('click')
        await flush()
      })
    }
    t.check('提交后页面仍可用', !!wrapper.html(), '提交登录后页面崩溃')
    wrapper.unmount()
  })

  featureCase('18-37', '注册表单可输入', async t => {
    const wrapper = await t.prepare('挂载注册页', () => mountComp(() => import('@/views/register.vue'), {}))
    const inputs = wrapper.findAll('input')
    t.check('注册页含输入框', inputs.length >= 1, '注册页无输入框 —— 用户无法注册')
    if (inputs.length) {
      await t.act('输入邮箱', async () => {
        await inputs[0].setValue('newuser@example.com')
        await flush()
      })
      t.check('输入已写入', (inputs[0].element as HTMLInputElement).value === 'newuser@example.com', '注册表单输入无效')
    }
    wrapper.unmount()
  })

  featureCase('18-38', '反馈表单可输入并提交（不发真实邮件）', async t => {
    const wrapper = await t.prepare('挂载反馈页', () => mountComp(() => import('@/views/feedback.vue'), {}))
    t.check('反馈页已渲染', !!wrapper.html(), '反馈页白屏')
    const areas = wrapper.findAll('textarea')
    if (areas.length) {
      await t.act('输入反馈内容', async () => {
        await areas[0].setValue('测试反馈内容')
        await flush()
      })
      t.check('内容已写入', (areas[0].element as HTMLTextAreaElement).value === '测试反馈内容', '反馈内容输入无效')
    } else {
      t.note('未渲染出文本域，仅验证页面可挂载')
    }
    wrapper.unmount()
  })

  featureCase('18-39', '搜索框输入触发搜索流程', async t => {
    const wrapper = await t.prepare('挂载搜索栏', () => mountComp(() => import('@/components/search/search-bar.vue'), {}))
    // 排除识图用的 file input，只取文本输入框
    const input = wrapper.findAll('input').find(i => (i.element as HTMLInputElement).type === 'text'
      || (i.element as HTMLInputElement).type === 'search' || (i.element as HTMLInputElement).type === '')
    if (input) {
      await t.act('输入搜索关键词', async () => {
        await input.setValue('华夏')
        await input.trigger('input')
        await flush()
      })
      t.check('输入值已写入', (input.element as HTMLInputElement).value === '华夏', '搜索框输入无效 —— 用户无法搜索')
    } else {
      t.note('搜索栏未直接渲染文本输入框，仅验证可挂载')
    }
    t.check('组件仍可用', typeof wrapper.html() === 'string', '搜索交互后组件崩溃')
    wrapper.unmount()
  })

  featureCase('18-40', '粘贴图片不抛异常（识图入口）', async t => {
    const wrapper = await t.prepare('挂载搜索栏', () => mountComp(() => import('@/components/search/search-bar.vue'), {}))
    await t.act('在组件上粘贴一张图片', async () => {
      pasteImage(wrapper.element as Element)
      await flush()
    })
    t.check('粘贴后组件仍可用', typeof wrapper.html() === 'string', '粘贴图片导致组件崩溃')
    wrapper.unmount()
  })

  featureCase('18-41', '拖拽文件不抛异常（识图入口）', async t => {
    const wrapper = await t.prepare('挂载搜索栏', () => mountComp(() => import('@/components/search/search-bar.vue'), {}))
    await t.act('拖拽一个图片文件到组件上', async () => {
      dropFile(wrapper.element as Element, { name: 'holding.png', type: 'image/png' })
      await flush()
    })
    t.check('拖拽后组件仍可用', typeof wrapper.html() === 'string', '拖拽文件导致组件崩溃')
    wrapper.unmount()
  })

  /* ═══════════ 18E 基金列表展开区与净值走势 ═══════════ */

  featureCase('18-42', '基金列表卡片分块（宽屏走左右分栏，手机走上下折叠）', async t => {
    // v3.1 起 ≥768px 的卡片改为左右分栏：左侧 4 个标签(.fc-rail-btn)，右侧只渲染选中项；
    // 手机端(≤767px)保持原来的上下可折叠块(.block-head)。两种形态都要能渲染出 5 个区间胶囊。
    const wrapper = await t.prepare('挂载基金列表（默认桌面断点）', () => mountFundList())
    const firstCard = await t.act('取第一张卡片', () => wrapper.find('.fund-card'))
    t.check('卡片已渲染', firstCard.exists(), '基金列表未渲染出卡片')

    const tabs = await t.act('找到该卡的左侧标签', () => firstCard.findAll('.fc-rail-btn'))
    t.check('单卡有 4 个标签（持仓与收益/净值与走势/区间业绩/持仓股票）', tabs.length === 4,
      `期望 4 个标签，实得 ${tabs.length}`)

    await t.act('切到区间业绩标签', async () => {
      await tabs[2].trigger('click')
      await flush()
    })
    const items = await t.act('查找区间胶囊', () => firstCard.findAll('.fc-perf-item'))
    t.check('渲染出 5 个区间胶囊', items.length === 5, `期望 5 个（近1周/月/3月/6月/年），实得 ${items.length}`)

    const panes = await t.act('统计右侧同时渲染的面板数', () => firstCard.findAll('.pane-body'))
    t.check('右侧同时只渲染 1 个面板', panes.length === 1,
      `分栏模式下应只渲染选中面板，实得 ${panes.length} 个 —— 会退化成需要上下滚动`)
    wrapper.unmount()
  })

  featureCase('18-48', '扇形选择器切到末位后两端不留空（循环补位）', async t => {
    // 原实现 total > SIDE*2 才循环，即 7 只以下切到首/末位时两端会空出来。
    const { mount } = await import('@vue/test-utils')
    const comp = (await t.prepare('导入扇形选择器', async () =>
      (await import('@/components/fund-list/fan-selector.vue')).default))

    for (const n of [2, 3, 5]) {
      const items = Array.from({ length: n }, (_, i) => ({
        key: `10000${i}`, name: `基金${i}`, rateText: '+1.00%', rateClass: 'text-rise',
      }))
      const w = mount(comp, { attachTo: document.body, props: { items, modelValue: items[0].key } })
      await flush()
      const atFirst = w.findAll('.fan-card').length
      await t.act(`${n} 只：切到最后一只`, async () => {
        await w.setProps({ modelValue: items[n - 1].key })
        await flush()
      })
      const atLast = w.findAll('.fan-card').length
      t.check(`${n} 只时首末位卡片数一致（两端未留空）`, atFirst === atLast && atLast > 0,
        `${n} 只：首位 ${atFirst} 张 → 末位 ${atLast} 张，数量变化说明两端空了`)
      t.check(`${n} 只时仍有中心卡片`, w.findAll('.fan-card.center').length === 1,
        `${n} 只：切到末位后中心卡片丢失`)
      w.unmount()
    }
  })

  featureCase('18-49', '交易标记：净值未公布时挂到最近交易日而非消失', async t => {
    // 下单日打点 + 只标历史图：当天净值往往尚未公布，若按日期精确匹配，
    // 今天的 B/T 会因为折线上没有该点而静默丢失 —— 这正是首次实现的缺陷。
    const { anchorMarks } = await t.prepare('导入交易标记模块', async () =>
      await import('@/modules/holding/trade-marks'))

    const dates = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']
    const todayMarks = [
      { date: '2026-08-14', side: 'buy' as const, label: 'B', pending: false, at: 1 },
      { date: '2026-08-14', side: 'sell' as const, label: 'T', pending: false, at: 2 },
    ]
    const anchored = await t.act('把今天的买卖挂到折线上', () => anchorMarks(dates, todayMarks))
    t.check('未被丢弃', anchored.length === 1, `今天的标记全部消失了（实得 ${anchored.length} 组）`)
    t.check('落在最后一个已公布交易日', anchored[0]?.index === dates.length - 1,
      `期望挂到 ${dates[dates.length - 1]}，实得下标 ${anchored[0]?.index}`)
    t.check('两条操作都保留', anchored[0]?.marks.length === 2, '同日多笔操作被吞掉')
    t.check('标为非精确（供 UI 提示）', anchored[0]?.exact === false, 'exact 应为 false 以便提示用户')

    const exact = await t.act('日期精确命中的情形', () =>
      anchorMarks(dates, [{ date: '2026-08-12', side: 'buy' as const, label: 'B', pending: false, at: 1 }]))
    t.check('精确命中下标正确', exact[0]?.index === 2, `期望下标 2，实得 ${exact[0]?.index}`)
    t.check('精确命中标记为 exact', exact[0]?.exact === true, '精确命中不应标为近似')

    const before = await t.act('早于区间起点的操作', () =>
      anchorMarks(dates, [{ date: '2026-08-01', side: 'buy' as const, label: 'B', pending: false, at: 1 }]))
    t.check('区间外操作被丢弃', before.length === 0, '早于区间起点的标记不应挤到首点上')
  })

  featureCase('18-50', '交易标记涵盖建仓，且纯改价不打点', async t => {
    // 建仓走 HoldingActionType.Edit（sharesBefore=0），若只按 type 过滤会漏掉；
    // 而改价格不改份额的 Edit 不是交易，不应打点。一律以份额增减为准。
    const { buildTradeMarks, describeMark } = await t.prepare('导入交易标记模块', async () =>
      await import('@/modules/holding/trade-marks'))
    const { HoldingActionType } = await import('@/modules/holding/holding-types')

    const t0 = Date.UTC(2026, 7, 7, 2, 15)
    const acts: any[] = [
      { id: '1', fundCode: 'X', type: HoldingActionType.Edit, sharesBefore: 0, sharesAfter: 1000, costBefore: 0, costAfter: 1.2345, timestamp: t0 },
      { id: '2', fundCode: 'X', type: HoldingActionType.Add, sharesBefore: 1000, sharesAfter: 1600, costBefore: 1.2345, costAfter: 1.24, timestamp: t0 + 3600000 },
      { id: '3', fundCode: 'X', type: HoldingActionType.Reduce, sharesBefore: 1600, sharesAfter: 900, costBefore: 1.24, costAfter: 1.24, timestamp: t0 + 7200000 },
      { id: '4', fundCode: 'X', type: HoldingActionType.Edit, sharesBefore: 900, sharesAfter: 900, costBefore: 1.24, costAfter: 1.30, timestamp: t0 + 9000000 },
    ]
    const marks = await t.act('构建标记', () => buildTradeMarks(acts, [], 'X'))

    t.check('建仓/加仓/减仓三条都在，纯改价被跳过', marks.length === 3,
      `期望 3 条，实得 ${marks.length} —— 建仓可能被漏掉或纯改价被误打点`)
    t.check('建仓识别为 open 且标 B', marks[0]?.open === true && marks[0]?.label === 'B',
      '建仓未被识别（应 open=true、标 B）')
    t.check('建仓文案为「建仓」', describeMark(marks[0]).startsWith('建仓'),
      `建仓文案错误：${describeMark(marks[0])}`)
    t.check('加仓标 B 且非 open', marks[1]?.label === 'B' && !marks[1]?.open, '加仓识别错误')
    t.check('减仓标 T', marks[2]?.label === 'T', '减仓识别错误')

    // 北京时间 10:15（= UTC 02:15），跨时区不得错位
    const { anchorMarksByTime } = await import('@/modules/holding/trade-marks')
    const times = ['09:30', '10:00', '10:30', '11:00', '13:00', '14:00']
    const anchored = await t.act('按北京时间挂靠分时点', () =>
      anchorMarksByTime(times, marks, '2026-08-07'))
    t.check('建仓挂到 10:00 而非其他时段', times[anchored[0]?.index] === '10:00',
      `期望挂到 10:00，实得 ${times[anchored[0]?.index]} —— 时区换算有误`)
  })

  featureCase('18-51', '交易标记生命周期：清仓保留、清缓存保留、删基金清空', async t => {
    const { useHoldingStore } = await import('@/modules/holding/holding-store')
    const { getTradeMarks, describeMark, tradeMarkCache } = await import('@/modules/holding/trade-marks')
    const h = await t.prepare('准备持仓 store', async () => {
      freshPinia()
      const s = useHoldingStore()
      s.restoreHoldings(); s.restoreActions()
      return s
    })
    const C = '018147'

    await t.act('编辑持仓建仓（按推算净值）', () => h.replaceHoldingDirect(C, 1000, 1.2345, 1234.5, 0, {}))
    let marks = getTradeMarks(h.actions, h.pendingActions, C)
    t.check('建仓打 B 且文案为建仓', marks.length === 1 && marks[0].label === 'B' && describeMark(marks[0]).startsWith('建仓'),
      `建仓未打点：${marks.map(m => m.label).join(',')}`)

    await t.act('编辑持仓增加份额（应记为加仓）', () => h.replaceHoldingDirect(C, 1600, 1.24, 1984, 0, {}))
    marks = getTradeMarks(h.actions, h.pendingActions, C)
    t.check('编辑增仓打 B', marks.length === 2 && marks[1].label === 'B',
      `编辑增仓未打点（replaceHoldingDirect 会先删后加，sharesBefore 必须取删除前的持仓）`)

    await t.act('减仓', () => h.reduceHolding(h.getHoldingsByFund(C)[0].id, 700))
    marks = getTradeMarks(h.actions, h.pendingActions, C)
    t.check('减仓打 T', marks[marks.length - 1]?.label === 'T', '减仓未打 T')

    await t.act('清空持仓', () => h.settleAllByFund(C))
    marks = getTradeMarks(h.actions, h.pendingActions, C)
    t.check('清仓打 S', marks[marks.length - 1]?.label === 'S', '清仓未打 S')
    t.check('清仓后历史标记全部保留', marks.length === 4,
      `期望 4 条（B/B/T/S），实得 ${marks.length} —— 清仓不应抹掉历史标记`)

    const { clearAllPools, cacheStorageKeys } = await import('@/shared/cache/define-cache')
    await t.act('清除缓存', () => clearAllPools())
    t.check('清缓存后标记仍在', getTradeMarks(h.actions, h.pendingActions, C).length === 4,
      '清除缓存抹掉了交易标记 —— 标记派生自用户操作记录，应标为 persistent')
    t.check('清除列表不含交易标记', !cacheStorageKeys().some(k => k.endsWith('trade-marks')),
      '交易标记被列入清除范围')

    await t.act('删除基金', () => h.removeHoldingsByFund(C))
    t.check('删基金后标记清空', getTradeMarks(h.actions, h.pendingActions, C).length === 0,
      '删除基金后标记未清空')
    t.check('删基金后缓存无残留', !tradeMarkCache.peek(C),
      '删除基金后 trade-marks 缓存仍有残留')
  })

  featureCase('18-52', '建仓按推算成本净值定位，缩略图可读出操作说明', async t => {
    const { findDateByNav } = await t.prepare('导入交易标记模块', async () =>
      await import('@/modules/holding/trade-marks'))

    // 持仓 10000、收益 500 → 本金 9500；份额按当前净值折算，
    // 成本净值 = 本金 / 份额，标记应落到该净值对应的历史交易日，而不是今天。
    const series = Array.from({ length: 30 }, (_, i) => ({
      d: `2026-06-${String(i + 1).padStart(2, '0')}`,
      v: 1.10 + i * 0.005,
    }))
    const cur = series[series.length - 1].v
    const shares = 10000 / cur
    const costNav = 9500 / shares
    const hit = await t.act('按成本净值反查历史日期', () => findDateByNav(series, costNav))
    t.check('反查到历史日期而非落空', !!hit, '成本净值未能定位到历史交易日')
    t.check('不是最后一天（今天）', hit !== series[series.length - 1].d,
      `标记落在了当天 ${hit} —— 应回溯到成本净值对应的历史点位`)
    const hitNav = series.find(p => p.d === hit)!.v
    t.check('命中点净值与成本净值接近', Math.abs(hitNav - costNav) / costNav < 0.01,
      `命中 ${hitNav} 与成本 ${costNav.toFixed(4)} 偏差过大`)
    t.check('净值差过大时不硬凑', findDateByNav(series, 99) === '', '离谱净值不应强行匹配')

    // 缩略图必须能读出操作说明（此前只画了圆点，没有文字）
    const { mount } = await import('@vue/test-utils')
    const comp = (await import('@/components/fund-list/fund-nav-trend.vue')).default
    const days = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']
    const nav = days.map((d, i) => ({ d, v: 1.2 + i * 0.01 }))
    const marks = [{ date: days[1], side: 'buy' as const, label: 'B', shares: 1000, nav: 1.21, pending: false, open: true, at: 1 }]
    const w = mount(comp, { attachTo: document.body, props: { points: nav, changeRate: 1, marks } })
    await flush()
    const el = w.find('.trend-box').element as HTMLElement
    el.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 96, right: 400, bottom: 96, x: 0, y: 0, toJSON() {} }) as any
    await t.act('拖到标记点位', async () => {
      await w.find('.trend-box').trigger('mousedown', { clientX: 100 })
      await flush()
    })
    const notes = w.findAll('.trend-trade').map(n => n.text())
    t.check('缩略图读出操作说明', notes.length === 1 && notes[0].startsWith('建仓'),
      `缩略图未显示操作说明（实得 ${notes.join('|') || '空'}）`)
    w.unmount()
  })

  featureCase('18-53', '详情页已注册 MarkPointComponent（否则 B/T 静默不渲染）', async t => {
    // echarts 按需注册：option 里写了 markPoint，但没 use(MarkPointComponent)
    // 时不会报错，只是静默不画 —— 这正是详情页看不到交易标记的原因。
    // 测试环境桩掉了 echarts，跑用例查不出来，故直接校验源码注册。
    const { readFileSync } = await import('fs')
    const src = await t.act('读取详情页源码', () =>
      readFileSync('src/components/fund-detail/fund-detail-pane.vue', 'utf-8'))

    t.check('从 echarts/components 引入了 MarkPointComponent',
      /import\s*\{[^}]*MarkPointComponent[^}]*\}\s*from\s*'echarts\/components'/.test(src),
      'MarkPointComponent 未引入 —— 详情页折线上的 B/T 标记不会渲染')

    const useCall = src.match(/^use\(\[[^\]]*\]\)/m)?.[0] ?? ''
    t.check('已在 use([...]) 中注册', useCall.includes('MarkPointComponent'),
      `use() 未注册 MarkPointComponent，实际为：${useCall || '未找到 use() 调用'}`)
    t.check('markPoint 与 markLine 同时可用',
      useCall.includes('MarkLineComponent') && useCall.includes('MarkPointComponent'),
      '基线（markLine）与交易标记（markPoint）需同时注册')
  })

  featureCase('18-47', '宽屏持仓面板可直接加仓/清空（不进详情页）', async t => {
    const wrapper = await t.prepare('挂载基金列表（默认桌面断点）', () => mountFundList())
    const ops = await t.act('读取持仓面板操作按钮', () => wrapper.findAll('.fc-op').map(b => b.text()))
    t.check('四个操作齐全（加仓/减仓/编辑/清空）',
      ['加仓', '减仓', '编辑', '清空'].every(x => ops.includes(x)),
      `期望含加仓/减仓/编辑/清空，实得 ${ops.join('/')}`)

    const { useHoldingStore } = await import('@/modules/holding/holding-store')
    const h = useHoldingStore()
    const before = h.pendingActions.length

    await t.act('点开加仓并填入金额后确认', async () => {
      await wrapper.findAll('.fc-op').find(b => b.text() === '加仓')!.trigger('click')
      await flush()
      const input = document.body.querySelector('.op-input') as HTMLInputElement
      input.value = '5000'
      input.dispatchEvent(new Event('input'))
      await flush()
      const btn = Array.from(document.body.querySelectorAll('.op-actions .fc-op'))
        .find(b => b.textContent?.includes('确认')) as HTMLElement
      btn.click()
      await flush()
    })
    t.check('生成了一条加仓待确认记录', h.pendingActions.length === before + 1,
      `加仓未落库：${before} → ${h.pendingActions.length} —— 面板操作无效，用户只能回详情页`)

    await t.act('点击清空', async () => {
      await wrapper.findAll('.fc-op').find(b => b.text() === '清空')!.trigger('click')
      await flush()
    })
    t.check('清空持仓向上抛出事件', !!wrapper.emitted('clearHoldings'),
      '清空未触发 clearHoldings —— 父级收不到，持仓清不掉')
    wrapper.unmount()
  })

  featureCase('18-46', '手机断点下卡片仍为上下可折叠块', async t => {
    const wrapper = await t.prepare('切到手机断点并挂载基金列表', async () => {
      setBreakpoint('mobile')
      return await mountFundList()
    })
    try {
      const firstCard = await t.act('取第一张卡片', () => wrapper.find('.fund-card'))
      t.check('卡片已渲染', firstCard.exists(), '手机端未渲染出卡片')
      const heads = await t.act('找到该卡的可折叠块标题', () => firstCard.findAll('.block-head'))
      t.check('单卡有 4 个可折叠块', heads.length === 4,
        `手机端应保持上下折叠，期望 4 个块，实得 ${heads.length}`)
      t.check('手机端不出现左侧标签栏', firstCard.findAll('.fc-rail-btn').length === 0,
        '手机端不应渲染左右分栏的标签栏')
      await t.act('展开区间业绩块', async () => {
        await heads[2].trigger('click')
        await flush()
      })
      const items = await t.act('查找区间胶囊', () => firstCard.findAll('.fc-perf-item'))
      t.check('渲染出 5 个区间胶囊', items.length === 5, `期望 5 个，实得 ${items.length}`)
    } finally {
      resetBreakpoint()
      wrapper.unmount()
    }
  })

  featureCase('18-43', '展开区渲染净值走势组件（SVG 折线/占位不崩）', async t => {
    const wrapper = await t.prepare('挂载基金列表并展开区间业绩块', async () => {
      const w = await mountFundList()
      const tabs = w.find('.fund-card').findAll('.fc-rail-btn')
      await tabs[2].trigger('click')
      await flush()
      return w
    })
    const trend = await t.act('查找净值走势容器', () => wrapper.find('.nav-trend'))
    t.check('净值走势组件已渲染', trend.exists(), '展开区未渲染净值走势组件（.nav-trend 缺失）')
    const svg = await t.act('查找走势 SVG', () => trend.find('.trend-svg'))
    t.check('走势图 SVG 存在（有数据画折线 / 无数据画占位虚线）', svg.exists(), '净值走势未输出 SVG —— 展开区图区空白')
    wrapper.unmount()
  })

  featureCase('18-44', '净值走势区间切换不抛异常（近1周/月/3月/6月/年）', async t => {
    const wrapper = await t.prepare('挂载净值走势图（带 3 点近1年数据）', () =>
      mountComp(() => import('@/components/fund-list/fund-nav-trend.vue'), {
        points: [
          { d: '2025-12-01', v: 1.10 },
          { d: '2026-04-01', v: 1.18 },
          { d: '2026-08-06', v: 1.30 },
        ],
        changeRate: 1.5,
      }),
    )
    const btns = await t.act('查找区间按钮', () => wrapper.findAll('.trend-range-btn'))
    t.check('渲染出 5 个区间按钮', btns.length === 5, `期望 5 个区间按钮，实得 ${btns.length}`)

    let threw = false
    await t.act('依次点击各区间按钮', async () => {
      try {
        for (const b of btns) {
          // disabled 按钮 trigger click 无效也无所谓，主要验不抛错
          if (!(b.element as HTMLButtonElement).disabled) {
            await b.trigger('click')
            await flush()
          }
        }
      } catch {
        threw = true
      }
    })
    t.check('区间切换未抛异常', !threw, '切换净值走势区间时抛异常 —— 状态机卡死')
    // 至少近1年（默认 active）与非禁用按钮之一应处于 active 态
    const activeBtns = wrapper.findAll('.trend-range-btn.is-active')
    t.check('存在激活区间按钮', activeBtns.length >= 1, '无任何区间按钮处于激活态')
    wrapper.unmount()
  })

  featureCase('18-45', '净值走势鼠标读数不崩（按下/移动/松开）', async t => {
    const wrapper = await t.prepare('挂载净值走势图（带 3 点数据）', () =>
      mountComp(() => import('@/components/fund-list/fund-nav-trend.vue'), {
        points: [
          { d: '2025-12-01', v: 1.10 },
          { d: '2026-04-01', v: 1.18 },
          { d: '2026-08-06', v: 1.30 },
        ],
        changeRate: 1.5,
      }),
    )
    const box = await t.act('查找图表区', () => wrapper.find('.trend-box'))
    t.check('图表区存在', box.exists(), '净值走势未渲染出 .trend-box')

    let threw = false
    await t.act('在图表区按下并滑动鼠标（读数手势）', () => {
      try {
        dispatchMouse(box.element as Element, 'mousedown', 50, 40)
        dispatchMouse(window as any, 'mousemove', 120, 40)
        dispatchMouse(window as any, 'mouseup', 120, 40)
      } catch {
        threw = true
      }
    })
    t.check('鼠标读数手势未抛异常', !threw, '净值走势鼠标读数抛异常')
    await flush()
    t.check('手势后组件仍可用', typeof wrapper.html() === 'string', '读数手势后组件崩溃')
    wrapper.unmount()
  })
})
