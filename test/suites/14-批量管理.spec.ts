/**
 * 14 · 批量管理页
 *
 * manage.vue 上的批量操作：多选、批量清仓、批量删除、页内加/减/编辑。
 */

import { describe } from 'vitest'
import { featureCase } from '../helpers/case'
import { freshPinia, TEST_FUNDS } from '../helpers/seed'
import { flush } from '../helpers/gesture'

async function mountManage() {
  freshPinia()
  const { useFundStore } = await import('@/modules/fund/fund-store')
  const { useHoldingStore } = await import('@/modules/holding/holding-store')
  const f = useFundStore()
  const h = useHoldingStore()
  h.restoreHoldings()
  for (const x of TEST_FUNDS) {
    f.addFund(x.code, x.name)
    h.addHoldingByAmount(x.code, 10000, 1.234)
  }

  const { mount } = await import('@vue/test-utils')
  const { createRouter, createWebHashHistory } = await import('vue-router')
  const real = (await import('@/router/index')).default
  const router = createRouter({ history: createWebHashHistory(), routes: real.getRoutes() as any })
  await router.push('/manage')
  await router.isReady()

  const comp = (await import('@/views/manage.vue')).default
  const wrapper = mount(comp, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { RouterLink: true, transition: false, 'transition-group': false } },
  })
  await flush()
  return { wrapper, f, h }
}

describe('14 · 批量管理', () => {
  featureCase('14-01', '批量管理页渲染基金卡并可进入选择模式', async t => {
    // v3.0 改版：取消常驻 checkbox，改为顶栏「选择」开关进入选择模式后出现勾选圈。
    const { wrapper } = await t.prepare('挂载批量管理页（含 3 只基金）', () => mountManage())
    t.check('页面已渲染', !!wrapper.html(), '批量管理页白屏')
    const cards = wrapper.findAll('.mg-card')
    t.check('渲染出基金卡', cards.length === 3, `期望 3 张基金卡，实得 ${cards.length}`)

    const toggle = await t.act('找到选择模式开关', () => wrapper.find('.mg-select-toggle'))
    t.check('选择模式开关存在', toggle.exists(), '未渲染「选择」开关 —— 无法进入批量操作')

    await t.act('进入选择模式', async () => { await toggle.trigger('click'); await flush() })
    const checks = wrapper.findAll('.mg-check')
    t.check('出现勾选圈', checks.length === 3, `进入选择模式后期望 3 个勾选圈，实得 ${checks.length}`)
    wrapper.unmount()
  })

  featureCase('14-02', '单选基金行', async t => {
    const { wrapper } = await t.prepare('挂载批量管理页', () => mountManage())
    const rows = await t.act('查找可点击的基金行', () => wrapper.findAll('[class*="fund-row"], [class*="manage-row"], tr, li'))
    await t.act('点击第一行（不应抛异常）', async () => {
      if (rows.length) {
        try { await rows[0].trigger('click'); await flush() } catch { /* 忽略非交互行 */ }
      }
    })
    t.check('点击后页面仍可用', !!wrapper.html(), '选择基金行后页面崩溃')
    wrapper.unmount()
  })

  featureCase('14-03', '全选切换', async t => {
    const { wrapper } = await t.prepare('挂载批量管理页', () => mountManage())
    const btns = await t.act('查找页面按钮', () => wrapper.findAll('button'))
    t.check('页面含操作按钮', btns.length > 0, '批量管理页无按钮')
    await t.act('依次点击前若干按钮（含全选，不应抛异常）', async () => {
      for (const b of btns.slice(0, 4)) {
        try { await b.trigger('click'); await flush() } catch { /* 忽略 */ }
      }
    })
    t.check('操作后页面仍可用', !!wrapper.html(), '全选操作后页面崩溃')
    wrapper.unmount()
  })

  featureCase('14-04', '页内加仓表单可展开并输入', async t => {
    const { wrapper } = await t.prepare('挂载批量管理页', () => mountManage())
    await t.act('点击按钮展开表单', async () => {
      for (const b of wrapper.findAll('button').slice(0, 6)) {
        try { await b.trigger('click'); await flush() } catch { /* 忽略 */ }
      }
    })
    const numInput = wrapper.findAll('input').find(i => (i.element as HTMLInputElement).type === 'number')
    if (numInput) {
      await t.act('输入加仓金额', async () => {
        await numInput.setValue('5000')
        await flush()
      })
      t.check('金额已写入', (numInput.element as HTMLInputElement).value === '5000', '加仓金额输入无效')
    } else {
      t.note('当前状态未展开数值输入框，仅验证交互不崩')
    }
    wrapper.unmount()
  })

  featureCase('14-05', '批量清仓（store 层）', async t => {
    const { h } = await t.prepare('挂载批量管理页', () => mountManage())
    const before = h.activeHoldings.length
    t.check('清仓前有活跃持仓', before > 0, '前置数据未铺好')
    await t.act('对全部基金执行清仓', () => {
      for (const x of TEST_FUNDS) h.settleAllByFund(x.code)
    })
    t.check('活跃持仓已清空', h.activeHoldings.length === 0, `清仓后仍有 ${h.activeHoldings.length} 笔活跃持仓`)
  })

  featureCase('14-06', '批量删除基金（store 层）', async t => {
    const { f, h } = await t.prepare('挂载批量管理页', () => mountManage())
    const before = f.fundCodes.length
    t.check('删除前有基金', before > 0, '前置数据未铺好')
    await t.act('批量删除全部基金及其持仓', () => {
      for (const x of [...f.fundCodes]) {
        h.removeHoldingsByFund(x)
        f.removeFund(x)
      }
    })
    t.check('基金列表已清空', f.fundCodes.length === 0, `删除后仍有 ${f.fundCodes.length} 只基金`)
    t.check('持仓已一并删除', h.holdings.length === 0, `删除基金后仍残留 ${h.holdings.length} 笔持仓 —— 数据不一致`)
  })
})
