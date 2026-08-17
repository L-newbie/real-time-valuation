/**
 * 27 · 分组界面
 *
 * 分组功能的 UI 层：工具栏切换与管理面板、汇总页卡片、搜索多选加组。
 * store 层的隔离逻辑在 24 域已覆盖，这里只验证「界面能挂载、能反映分组状态、
 * 交互后状态确实变了」——即白屏与状态机卡死。
 */

import { describe } from 'vitest'
import { featureCase } from '../helpers/case'
import { freshPinia, TEST_FUNDS, makeValuation } from '../helpers/seed'
import { flush } from '../helpers/gesture'

async function setup(withData = true) {
  freshPinia()
  const { useFundStore } = await import('@/modules/fund/fund-store')
  const { useGroupStore } = await import('@/modules/group/group-store')
  const { useHoldingStore } = await import('@/modules/holding/holding-store')

  const g = useGroupStore()
  g.restoreGroups([])
  const h = useHoldingStore()
  h.restoreHoldings()
  h.restoreActions()
  h.restorePendingActions()
  const f = useFundStore()

  if (withData) {
    for (const x of TEST_FUNDS) {
      f.addFund(x.code, x.name)
      f.valuationMap.set(x.code, makeValuation(x.code) as any)
      h.addHoldingByAmount(x.code, 10000, 1.234)
    }
  }
  return { f, g, h }
}

async function mountComp(loader: () => Promise<any>, props: any = {}) {
  const { mount } = await import('@vue/test-utils')
  const { createRouter, createWebHashHistory } = await import('vue-router')
  const real = (await import('@/router/index')).default
  const router = createRouter({ history: createWebHashHistory(), routes: real.getRoutes() as any })
  await router.push('/')
  await router.isReady()

  const comp = (await loader()).default
  const wrapper = mount(comp, {
    props,
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: { RouterLink: true, RouterView: true, transition: false, 'transition-group': false },
    },
  })
  await flush()
  return wrapper
}

const TOOLBAR_PROPS = {
  viewMode: 'table' as const,
  sortField: 'changeRate' as const,
  sortDirection: 'desc' as const,
  sortFields: [{ label: '今日收益率', field: 'changeRate' as const }],
}

describe('27 · 分组界面', () => {
  featureCase('27-01', '工具栏渲染当前分组名与数量', async t => {
    const { g } = await t.prepare('铺 3 只基金', () => setup())
    const wrapper = await t.act('挂载工具栏', () =>
      mountComp(() => import('@/components/fund-list/fund-toolbar.vue'), TOOLBAR_PROPS))

    const html = wrapper.html()
    t.check('组件已渲染', !!html, '工具栏白屏')
    t.check('显示分组按钮', html.includes('tb-group-switch'), '找不到分组切换按钮')
    t.check('显示当前分组名', html.includes(g.activeGroup!.name), `界面上看不到分组名 ${g.activeGroup!.name}`)
    t.check('显示成员数量', wrapper.find('.tb-group-count').text() === String(g.activeCodes.length),
      `数量显示为 ${wrapper.find('.tb-group-count').text()}，实际 ${g.activeCodes.length}`)
    wrapper.unmount()
  })

  featureCase('27-02', '展开分组面板并切换分组', async t => {
    const { g } = await t.prepare('铺数据并新建第二个分组', async () => {
      const s = await setup()
      s.g.createGroup('实盘')
      return s
    })
    const wrapper = await t.act('挂载工具栏', () =>
      mountComp(() => import('@/components/fund-list/fund-toolbar.vue'), TOOLBAR_PROPS))

    await t.act('点击分组按钮展开面板', async () => {
      await wrapper.find('.tb-group-switch').trigger('click')
      await flush()
    })
    t.check('面板已展开', wrapper.find('.tb-group-list').exists(), '点击后分组面板未出现')

    const items = wrapper.findAll('.tb-group-item')
    t.check('列出全部分组', items.length === g.sortedGroups.length,
      `列表 ${items.length} 项，实际 ${g.sortedGroups.length} 个分组`)

    const before = g.activeGroupId
    await t.act('点击第二个分组', async () => {
      await wrapper.findAll('.tb-group-pick')[1].trigger('click')
      await flush()
    })
    t.check('当前分组已切换', g.activeGroupId !== before, '点击后 activeGroupId 未变，切组无反应')
    t.check('切换后面板收起', !wrapper.find('.tb-group-list').exists(), '选完分组面板没关，挡住列表')
    wrapper.unmount()
  })

  featureCase('27-03', '管理态显示编辑与删除操作', async t => {
    const { g } = await t.prepare('铺数据并新建第二个分组', async () => {
      const s = await setup()
      s.g.createGroup('实盘')
      return s
    })
    const wrapper = await t.act('挂载工具栏', () =>
      mountComp(() => import('@/components/fund-list/fund-toolbar.vue'), TOOLBAR_PROPS))

    await t.act('展开分组面板', async () => {
      await wrapper.find('.tb-group-switch').trigger('click')
      await flush()
    })
    t.check('非管理态无操作按钮', wrapper.findAll('.tb-group-op').length === 0,
      '默认就露出了编辑删除按钮，切组时容易误触')

    await t.act('点击「管理」', async () => {
      await wrapper.findAll('.tb-mini')[0].trigger('click')
      await flush()
    })
    t.check('出现操作按钮', wrapper.findAll('.tb-group-op').length > 0, '管理态下没有编辑删除按钮')
    t.check('预置组显示锁标记', wrapper.find('.tb-group-lock').exists(),
      '自选组没有锁标记，用户会以为能删')

    const deletable = wrapper.findAll('.tb-group-op-danger')
    t.check('仅非预置组可删', deletable.length === g.sortedGroups.filter(x => !x.builtin).length,
      `可删按钮 ${deletable.length} 个，非预置分组 ${g.sortedGroups.filter(x => !x.builtin).length} 个`)
    wrapper.unmount()
  })

  featureCase('27-04', '面板内新建分组', async t => {
    const { g } = await t.prepare('铺 3 只基金', () => setup())
    const wrapper = await t.act('挂载工具栏', () =>
      mountComp(() => import('@/components/fund-list/fund-toolbar.vue'), TOOLBAR_PROPS))

    await t.act('展开分组面板', async () => {
      await wrapper.find('.tb-group-switch').trigger('click')
      await flush()
    })

    const before = g.sortedGroups.length
    await t.act('点击「＋ 新建」', async () => {
      const btns = wrapper.findAll('.tb-mini')
      await btns[btns.length - 1].trigger('click')
      await flush()
    })
    t.check('出现名称输入框', wrapper.find('.tb-group-input').exists(), '新建表单未展开')

    await t.act('输入名称并提交', async () => {
      const input = wrapper.find('.tb-group-input')
      await input.setValue('医药')
      await input.trigger('keydown.enter')
      await flush()
    })
    t.check('分组数量 +1', g.sortedGroups.length === before + 1,
      `期望 ${before + 1} 个，实得 ${g.sortedGroups.length}`)
    t.check('新分组已选中', g.activeGroup?.name === '医药', `当前分组为 ${g.activeGroup?.name}，未切到新建的组`)
    wrapper.unmount()
  })

  featureCase('27-05', '汇总页渲染分组卡片与总计', async t => {
    const { g } = await t.prepare('铺数据并新建第二个分组', async () => {
      const s = await setup()
      s.g.createGroup('实盘')
      return s
    })
    const wrapper = await t.act('挂载汇总页', () =>
      mountComp(() => import('@/views/groups-summary.vue')))

    const html = wrapper.html()
    t.check('页面已渲染', !!html, '汇总页白屏')
    t.check('渲染分组卡片', wrapper.findAll('.gs-card').length === g.sortedGroups.length,
      `卡片 ${wrapper.findAll('.gs-card').length} 张，分组 ${g.sortedGroups.length} 个`)
    t.check('显示分组名', html.includes('自选') && html.includes('实盘'), '卡片上看不到分组名')
    t.check('显示基金数量', html.includes('只基金'), '卡片未显示基金数量')
    t.check('顶部有总资产', html.includes('总资产'), '缺少全局汇总区')
    wrapper.unmount()
  })

  featureCase('27-06', '汇总页卡片两段式点击', async t => {
    const { g } = await t.prepare('铺数据并新建第二个分组', async () => {
      const s = await setup()
      s.g.createGroup('实盘')
      return s
    })
    const wrapper = await t.act('挂载汇总页', () =>
      mountComp(() => import('@/views/groups-summary.vue')))

    const second = wrapper.findAll('.gs-card')[1]
    await t.act('第一次点击第二张卡片', async () => {
      await second.trigger('click')
      await flush()
    })
    t.check('已切到该分组', g.activeGroup?.name === '实盘', `当前分组为 ${g.activeGroup?.name}`)
    t.check('卡片进入选中态', wrapper.findAll('.gs-card')[1].classes().includes('selected'),
      '第一次点击没有选中反馈，用户不知道要点第二次')
    t.check('出现进入提示', wrapper.html().includes('再次点击进入'), '缺少二次点击提示')
    wrapper.unmount()
  })

  featureCase('27-07', '汇总页顶部总计等于各分组之和', async t => {
    const { g, h } = await t.prepare('两组各建一笔不同金额的持仓', async () => {
      const s = await setup(false)
      const { useFundStore } = await import('@/modules/fund/fund-store')
      const f = useFundStore()
      f.addFund('000001', '华夏成长混合')
      f.valuationMap.set('000001', makeValuation('000001') as any)
      s.h.addHoldingByAmount('000001', 10000, 1.0)

      const extra = s.g.createGroup('实盘')!
      s.g.addToGroup(extra.id, ['000001'])
      s.g.setActiveGroup(extra.id)
      s.h.addHoldingByAmount('000001', 3000, 1.0)
      return s
    })
    const vMap = new Map([['000001', { gz: 1.245, dwjz: 1.234, gszzl: 0.89, isEstimated: true, jzrq: '2026-08-06', delayDays: 1 as 1 }]])

    const sum = await t.act('累加各分组统计', () =>
      g.sortedGroups.reduce((acc, x) => acc + h.getDashboardStats(vMap, x.id).totalHoldingAmount, 0))
    const all = await t.act('取全局汇总', () => h.getAllGroupsStats(vMap).totalHoldingAmount)

    t.check('总计等于各组之和', all === sum, `汇总 ${all}，各组之和 ${sum}，页面上下对不上`)

    const wrapper = await t.act('挂载汇总页', () => mountComp(() => import('@/views/groups-summary.vue')))
    t.check('页面渲染无异常', !!wrapper.html(), '有数据时汇总页白屏')
    wrapper.unmount()
  })

  featureCase('27-08', '分组选择条列出全部分组', async t => {
    const { g } = await t.prepare('新建两个额外分组', async () => {
      const s = await setup()
      s.g.createGroup('实盘')
      s.g.createGroup('医药')
      return s
    })
    const wrapper = await t.act('挂载分组选择条', () =>
      mountComp(() => import('@/components/search/group-picker-bar.vue'), { count: 2 }))

    const html = wrapper.html()
    t.check('组件已渲染', !!html, '分组选择条白屏')
    t.check('显示已选数量', html.includes('已选 2'), '未显示已选数量')

    const chips = wrapper.findAll('.gp-chip')
    t.check('每个分组一个 chip 外加新建', chips.length === g.sortedGroups.length + 1,
      `chip ${chips.length} 个，分组 ${g.sortedGroups.length} 个（应多一个「新建」）`)
    t.check('包含全部分组名', html.includes('自选') && html.includes('实盘') && html.includes('医药'),
      '有分组没出现在选择条里，用户无法把基金加进去')
    wrapper.unmount()
  })

  featureCase('27-09', '点击分组 chip 派发选中事件', async t => {
    const { g } = await t.prepare('新建第二个分组', async () => {
      const s = await setup()
      s.g.createGroup('实盘')
      return s
    })
    const wrapper = await t.act('挂载分组选择条', () =>
      mountComp(() => import('@/components/search/group-picker-bar.vue'), { count: 1 }))

    await t.act('点击第一个分组 chip', async () => {
      await wrapper.findAll('.gp-chip')[0].trigger('click')
      await flush()
    })

    const emitted = wrapper.emitted('pick')
    t.check('派发了 pick 事件', !!emitted && emitted.length > 0, '点击分组没有任何反应')
    t.check('携带正确的分组 id', !!emitted && emitted[0][0] === g.sortedGroups[0].id,
      `派发的 id 为 ${emitted?.[0]?.[0]}，期望 ${g.sortedGroups[0].id}`)
    wrapper.unmount()
  })

  featureCase('27-10', '列表页随分组切换刷新行数据', async t => {
    const { f, g } = await t.prepare('自选 3 只，实盘组 1 只', async () => {
      const s = await setup()
      const extra = s.g.createGroup('实盘')!
      s.f.addFund('110022', '易方达消费行业', extra.id)
      return s
    })
    const { useFundData } = await import('@/composables/use-fund-data')
    const { rows, extra } = await t.act('取当前分组行数据', () => {
      const d = useFundData()
      return { rows: d.fundRows.value.length, extra: g.sortedGroups.find(x => x.name === '实盘')! }
    })
    t.check('自选组显示 3 行', rows === TEST_FUNDS.length, `实得 ${rows} 行，期望 ${TEST_FUNDS.length}`)

    const after = await t.act('切到实盘组后重新取数', () => {
      g.setActiveGroup(extra.id)
      return useFundData().fundRows.value.length
    })
    t.check('实盘组只显示 1 行', after === 1, `实得 ${after} 行，列表没跟随分组切换`)
    void f
  })
})
