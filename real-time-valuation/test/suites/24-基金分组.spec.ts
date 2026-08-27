/**
 * 24 · 基金分组
 *
 * 分组增删改、跨组持仓隔离、删组连带清理、孤儿基金判定、存量迁移。
 */

import { describe } from 'vitest'
import { featureCase } from '../helpers/case'
import { freshPinia, TEST_FUNDS, makeValuation } from '../helpers/seed'

async function stores() {
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
  return { f: useFundStore(), g, h }
}

describe('24 · 基金分组', () => {
  featureCase('24-01', '初始只提供「自选」一个预置分组', async t => {
    const { g } = await t.prepare('初始化分组 store', () => stores())
    t.check('分组数量为 1', g.sortedGroups.length === 1, `实得 ${g.sortedGroups.length} 个`)
    t.check('含「自选」', g.sortedGroups.some(x => x.name === '自选'), '缺少自选分组')
    t.check('默认选中自选', g.activeGroup?.name === '自选', `实得 ${g.activeGroup?.name}`)
    t.check('预置组不可删', g.sortedGroups.every(x => x.builtin === true), '预置组缺少 builtin 标记')
  })

  featureCase('24-02', '新建分组并落盘', async t => {
    const { g } = await t.prepare('初始化分组 store', () => stores())
    const created = await t.act('新建「红利」分组', () => g.createGroup('红利'))
    t.check('返回新分组对象', !!created && created.name === '红利', 'createGroup 未返回分组')
    t.check('分组数量 +1', g.sortedGroups.length === 2, `实得 ${g.sortedGroups.length}`)

    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_fund_groups'))
    t.check('已落盘且可读回', !!raw && raw.includes('红利'), '新建分组未写入 localStorage，刷新会丢失')
  })

  featureCase('24-03', '空名称不能创建分组', async t => {
    const { g } = await t.prepare('初始化分组 store', () => stores())
    const before = g.sortedGroups.length
    const r = await t.act('用空白名创建', () => g.createGroup('   '))
    t.check('创建被拒绝', r === null, 'createGroup 接受了空名称')
    t.check('分组数量未变', g.sortedGroups.length === before, `数量从 ${before} 变成 ${g.sortedGroups.length}`)
  })

  featureCase('24-04', '添加基金默认进入当前分组', async t => {
    const { f, g } = await t.prepare('初始化 store', () => stores())
    await t.act('添加 000001', () => f.addFund('000001', '华夏成长混合'))
    t.check('进入全集', f.fundCodes.includes('000001'), '基金未进入 fundCodes 全集')
    t.check('进入当前分组', g.activeCodes.includes('000001'), '基金未进入当前分组，列表将看不见它')
  })

  featureCase('24-05', '同一基金可同时存在于多个分组', async t => {
    const { f, g } = await t.prepare('初始化 store', () => stores())
    const extra = g.createGroup('实盘')!
    await t.act('添加到自选', () => f.addFund('000001', '华夏成长混合'))
    await t.act('同一基金加到实盘组', () => g.addToGroup(extra.id, ['000001']))

    t.check('两个分组都含该基金', g.groupsOf('000001').length === 2, `实得归属 ${g.groupsOf('000001').length} 个组`)
    t.check('全集中只有一条', f.fundCodes.filter(c => c === '000001').length === 1, '全集出现重复代码，会导致重复请求')
  })

  featureCase('24-06', '同一基金在两个分组的持仓互相隔离', async t => {
    const { f, g, h } = await t.prepare('铺设两组同一只基金', async () => {
      const s = await stores()
      const extra = s.g.createGroup('实盘')!
      s.f.addFund('000001', '华夏成长混合')
      s.g.addToGroup(extra.id, ['000001'])
      return s
    })
    const watch = g.sortedGroups.find(x => x.name === '自选')!
    const custom = g.sortedGroups.find(x => x.name === '实盘')!

    await t.act('在自选组建仓 10000 元', () => h.addHoldingByAmount('000001', 10000, 1.0))
    const watchAmount = h.getFundHoldingAmount('000001')
    t.check('自选组有持仓', watchAmount > 0, `自选组持仓为 ${watchAmount}`)

    await t.act('切换到实盘组', () => g.setActiveGroup(custom.id))
    const customAmount = h.getFundHoldingAmount('000001')
    t.check('实盘组无持仓', customAmount === 0, `切组后仍看到 ${customAmount}，说明持仓未隔离`)

    await t.act('在实盘组建仓 5000 元', () => h.addHoldingByAmount('000001', 5000, 1.0))
    t.check('实盘组持仓为 5000', h.getFundHoldingAmount('000001') === 5000, `实得 ${h.getFundHoldingAmount('000001')}`)

    await t.act('切回自选组', () => g.setActiveGroup(watch.id))
    t.check('自选组持仓仍为 10000', h.getFundHoldingAmount('000001') === 10000,
      `实得 ${h.getFundHoldingAmount('000001')}，另一组的操作污染了本组`)
    void f
  })

  featureCase('24-07', '仪表盘统计按分组切换', async t => {
    const { f, g, h } = await t.prepare('两组各建一笔不同金额的持仓', async () => {
      const s = await stores()
      const extra = s.g.createGroup('实盘')!
      s.f.addFund('000001', '华夏成长混合')
      s.f.valuationMap.set('000001', makeValuation('000001') as any)
      s.h.addHoldingByAmount('000001', 10000, 1.0)
      s.g.addToGroup(extra.id, ['000001'])
      s.g.setActiveGroup(extra.id)
      s.h.addHoldingByAmount('000001', 3000, 1.0)
      return s
    })
    const vMap = new Map([['000001', { gz: 1.245, dwjz: 1.234, gszzl: 0.89, isEstimated: true, jzrq: '2026-08-06', delayDays: 1 as 1 }]])

    const customStats = await t.act('取当前（实盘）组统计', () => h.getDashboardStats(vMap))
    t.check('实盘组总资产为 3000', customStats.totalHoldingAmount === 3000, `实得 ${customStats.totalHoldingAmount}`)

    const watch = g.sortedGroups.find(x => x.name === '自选')!
    const watchStats = await t.act('指定自选组统计', () => h.getDashboardStats(vMap, watch.id))
    t.check('自选组总资产为 10000', watchStats.totalHoldingAmount === 10000, `实得 ${watchStats.totalHoldingAmount}`)

    const all = await t.act('取全分组汇总', () => h.getAllGroupsStats(vMap))
    t.check('汇总为两组之和 13000', all.totalHoldingAmount === 13000,
      `实得 ${all.totalHoldingAmount}，汇总页顶部数字会对不上各卡片之和`)
    void f
  })

  featureCase('24-08', '从分组移除基金：仍属其他组时保留全局数据', async t => {
    const { f, g } = await t.prepare('把一只基金放进两个组', async () => {
      const s = await stores()
      const extra = s.g.createGroup('实盘')!
      s.f.addFund('000001', '华夏成长混合')
      s.g.addToGroup(extra.id, ['000001'])
      return s
    })
    const { removeFundFromActiveGroup } = await import('@/modules/group/group-actions')

    await t.act('从当前（自选）组移除', () => removeFundFromActiveGroup('000001'))
    t.check('已移出自选组', !g.activeCodes.includes('000001'), '仍留在自选组')
    t.check('仍在全集中', f.fundCodes.includes('000001'), '另一分组还在用它，不该从全集删除')
    t.check('仍属实盘组', g.groupsOf('000001').length === 1, `实得归属 ${g.groupsOf('000001').length} 个组`)
  })

  featureCase('24-09', '从最后一个分组移除基金时彻底删除', async t => {
    const { f, g } = await t.prepare('只在一个分组里放一只基金', async () => {
      const s = await stores()
      s.f.addFund('000001', '华夏成长混合')
      return s
    })
    const { removeFundFromActiveGroup } = await import('@/modules/group/group-actions')

    await t.act('从唯一所属分组移除', () => removeFundFromActiveGroup('000001'))
    t.check('已成为孤儿并移出全集', !f.fundCodes.includes('000001'),
      '不属于任何分组却仍在全集，会继续后台刷估值且用户永远看不见')
    t.check('不属于任何分组', g.isOrphan('000001'), 'groupsOf 仍返回归属')
  })

  featureCase('24-10', '删除分组连带清除组内持仓，不影响其他分组', async t => {
    const { f, g, h } = await t.prepare('新建分组并在其中建仓', async () => {
      const s = await stores()
      s.f.addFund('000001', '华夏成长混合')
      s.h.addHoldingByAmount('000001', 10000, 1.0)
      const extra = s.g.createGroup('实盘')!
      s.g.addToGroup(extra.id, ['000001', '110022'])
      s.f.addFund('110022', '易方达消费行业', extra.id)
      s.g.setActiveGroup(extra.id)
      s.h.addHoldingByAmount('000001', 5000, 1.0)
      return s
    })
    const extra = g.sortedGroups.find(x => x.name === '实盘')!
    const watch = g.sortedGroups.find(x => x.name === '自选')!
    const { purgeGroup } = await import('@/modules/group/group-actions')

    await t.act('删除「实盘」分组', () => purgeGroup(extra.id))

    t.check('分组已删除', !g.groups.some(x => x.id === extra.id), '分组仍存在')
    t.check('当前分组已回落', g.activeGroupId !== extra.id, '当前分组仍指向已删除的组')

    await t.act('切到自选组', () => g.setActiveGroup(watch.id))
    t.check('自选组持仓不受影响', h.getFundHoldingAmount('000001') === 10000,
      `实得 ${h.getFundHoldingAmount('000001')}，删组误伤了其他分组的持仓`)
    t.check('跨组基金保留在全集', f.fundCodes.includes('000001'), '自选组还在用它，不该删')
    t.check('仅属该组的基金已清除', !f.fundCodes.includes('110022'), '孤儿基金未从全集清除')
  })

  featureCase('24-11', '预置分组不可删除', async t => {
    const { g } = await t.prepare('初始化分组 store', () => stores())
    const watch = g.sortedGroups.find(x => x.name === '自选')!
    const before = g.sortedGroups.length
    await t.act('尝试删除自选组', () => g.deleteGroup(watch.id))
    t.check('删除被拒绝', g.sortedGroups.length === before, `预置组被删掉了，实得 ${g.sortedGroups.length} 个组`)
    t.check('自选组仍在', g.groups.some(x => x.id === watch.id), '自选组已消失')
  })

  featureCase('24-12', '重命名分组', async t => {
    const { g } = await t.prepare('初始化分组 store', () => stores())
    const custom = g.createGroup('自定义')!
    const ok = await t.act('改名为「观察池」', () => g.renameGroup(custom.id, '观察池'))
    t.check('重命名成功', ok === true, `renameGroup 返回 ${ok}`)
    t.check('名称已更新', g.groups.find(x => x.id === custom.id)?.name === '观察池',
      `实得 ${g.groups.find(x => x.id === custom.id)?.name}`)

    const rejected = await t.act('尝试改成空白名', () => g.renameGroup(custom.id, '  '))
    t.check('空名被拒绝', rejected === false, 'renameGroup 接受了空名称')
    t.check('名称保持不变', g.groups.find(x => x.id === custom.id)?.name === '观察池', '空名称覆盖了原名')
  })

  featureCase('24-13', '存量用户升级：原有基金整体迁入自选组', async t => {
    const g = await t.prepare('模拟老版本数据后初始化分组', async () => {
      freshPinia()
      localStorage.setItem('jgb_fund_codes', JSON.stringify(TEST_FUNDS.map(f => f.code)))
      const { useFundStore } = await import('@/modules/fund/fund-store')
      const { useGroupStore } = await import('@/modules/group/group-store')
      const f = useFundStore()
      f.restoreFundCodes()
      const gs = useGroupStore()
      gs.restoreGroups(f.fundCodes)
      return gs
    })

    t.check('全部迁入自选组', g.activeCodes.length === TEST_FUNDS.length,
      `期望 ${TEST_FUNDS.length} 只，实得 ${g.activeCodes.length}，老用户升级后列表会空掉`)
    t.check('当前分组为自选', g.activeGroup?.name === '自选', `实得 ${g.activeGroup?.name}`)
    t.check('迁移结果已落盘', !!localStorage.getItem('jgb_group_members'), '迁移未落盘，每次启动都要重算')
  })

  featureCase('24-14', '存量持仓无 groupId 时归属自选组', async t => {
    const h = await t.prepare('写入无 groupId 的老持仓后恢复', async () => {
      freshPinia()
      localStorage.setItem('jgb_holdings', JSON.stringify([
        { id: 'old1', fundCode: '000001', shares: 10000, costPrice: 1, holdingDate: '2026-08-01', createdAt: 1, settled: false, initialAmount: 10000, yesterdayAmount: 10000 },
      ]))
      const { useGroupStore } = await import('@/modules/group/group-store')
      const { useHoldingStore } = await import('@/modules/holding/holding-store')
      useGroupStore().restoreGroups([])
      const hs = useHoldingStore()
      hs.restoreHoldings()
      return hs
    })

    t.check('老持仓被补上 groupId', h.holdings[0]?.groupId === 'watch', `实得 ${h.holdings[0]?.groupId}`)
    t.check('在自选组下可见', h.getFundHoldingAmount('000001') === 10000,
      `实得 ${h.getFundHoldingAmount('000001')}，老用户升级后持仓会凭空消失`)
  })

  featureCase('24-15', '交易标记按分组隔离', async t => {
    const { g, h } = await t.prepare('两组各建一笔不同金额的持仓', async () => {
      const s = await stores()
      const extra = s.g.createGroup('实盘')!
      s.f.addFund('000001', '华夏成长混合')
      s.h.addHoldingByAmount('000001', 10000, 1.0)
      s.g.addToGroup(extra.id, ['000001'])
      return s
    })
    const { getTradeMarks } = await import('@/modules/holding/trade-marks')
    const watch = g.sortedGroups.find(x => x.name === '自选')!
    const custom = g.sortedGroups.find(x => x.name === '实盘')!

    const watchMarks = await t.act('取自选组交易标记', () =>
      getTradeMarks(h.groupActions, h.groupPendingActions, '000001', watch.id))
    t.check('自选组有交易标记', watchMarks.length > 0, '建仓后未生成交易标记')

    await t.act('切换到实盘组', () => g.setActiveGroup(custom.id))
    const customMarks = await t.act('取实盘组交易标记', () =>
      getTradeMarks(h.groupActions, h.groupPendingActions, '000001', custom.id))
    t.check('实盘组无交易标记', customMarks.length === 0,
      `实得 ${customMarks.length} 条，另一组的交易记录串到了本组图表上`)
  })

  featureCase('24-16', '清空分组：保留分组本身，不影响其他分组', async t => {
    const { f, g, h } = await t.prepare('自选与实盘组各持有同一只基金', async () => {
      const s = await stores()
      s.f.addFund('000001', '华夏成长混合')
      s.h.addHoldingByAmount('000001', 10000, 1.0)
      const extra = s.g.createGroup('实盘')!
      s.g.addToGroup(extra.id, ['000001'])
      s.f.addFund('110022', '易方达消费行业', extra.id)
      s.g.setActiveGroup(extra.id)
      s.h.addHoldingByAmount('000001', 5000, 1.0)
      return s
    })
    const extra = g.sortedGroups.find(x => x.name === '实盘')!
    const watch = g.sortedGroups.find(x => x.name === '自选')!
    const { clearGroup } = await import('@/modules/group/group-actions')

    await t.act('清空「实盘」分组', () => clearGroup(extra.id))

    t.check('分组本身保留', g.groups.some(x => x.id === extra.id), '清空把分组也删掉了')
    t.check('分组已无成员', g.getMembers(extra.id).length === 0, `实得 ${g.getMembers(extra.id).length} 只`)
    t.check('组内持仓已清除', h.getFundHoldingAmount('000001') === 0,
      `实得 ${h.getFundHoldingAmount('000001')}，清空后仍有持仓`)
    t.check('仅属该组的基金已移出全集', !f.fundCodes.includes('110022'), '孤儿基金未清除')

    await t.act('切到自选组', () => g.setActiveGroup(watch.id))
    t.check('自选组持仓不受影响', h.getFundHoldingAmount('000001') === 10000,
      `实得 ${h.getFundHoldingAmount('000001')}，清空误伤了其他分组`)
    t.check('跨组基金保留在全集', f.fundCodes.includes('000001'), '自选组还在用它，不该删')
  })

  featureCase('24-17', '预置分组可清空但不可删除', async t => {
    const { f, g, h } = await t.prepare('自选组内建仓', async () => {
      const s = await stores()
      s.f.addFund('000001', '华夏成长混合')
      s.h.addHoldingByAmount('000001', 10000, 1.0)
      return s
    })
    const watch = g.sortedGroups.find(x => x.name === '自选')!
    const { clearGroup } = await import('@/modules/group/group-actions')

    await t.act('清空自选组', () => clearGroup(watch.id))
    t.check('自选组仍在', g.groups.some(x => x.id === watch.id), '预置组被清空操作删掉了')
    t.check('成员已清空', g.getMembers(watch.id).length === 0, `实得 ${g.getMembers(watch.id).length} 只`)
    t.check('持仓已清除', h.getFundHoldingAmount('000001') === 0, `实得 ${h.getFundHoldingAmount('000001')}`)
    t.check('孤儿基金移出全集', !f.fundCodes.includes('000001'), '基金已不属任何分组却仍在全集')
  })

  featureCase('24-18', '旧版残留的空「自定义」分组自动移除', async t => {
    const g = await t.prepare('模拟已落盘的旧版双预置分组', async () => {
      freshPinia()
      localStorage.setItem('jgb_fund_groups', JSON.stringify([
        { id: 'watch', name: '自选', createdAt: 1, order: 0, builtin: true },
        { id: 'custom', name: '自定义', createdAt: 1, order: 1, builtin: true },
      ]))
      localStorage.setItem('jgb_group_members', JSON.stringify({ watch: ['000001'], custom: [] }))
      const { useGroupStore } = await import('@/modules/group/group-store')
      const gs = useGroupStore()
      gs.restoreGroups([])
      return gs
    })

    t.check('空自定义组已移除', !g.groups.some(x => x.id === 'custom'),
      '旧版残留的空分组仍在，用户会一直看到多余的「自定义」')
    t.check('自选组保留', g.groups.some(x => x.id === 'watch'), '自选组被误删')
    t.check('自选组成员未受影响', g.getMembers('watch').length === 1, `实得 ${g.getMembers('watch').length} 只`)

    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_fund_groups'))
    t.check('清理结果已落盘', !!raw && !raw.includes('"custom"'), '未落盘，下次启动又会出现')
  })

  featureCase('24-19', '旧版「自定义」组内有基金时保留且可删', async t => {
    const g = await t.prepare('模拟用户已往自定义组放过基金', async () => {
      freshPinia()
      localStorage.setItem('jgb_fund_groups', JSON.stringify([
        { id: 'watch', name: '自选', createdAt: 1, order: 0, builtin: true },
        { id: 'custom', name: '自定义', createdAt: 1, order: 1, builtin: true },
      ]))
      localStorage.setItem('jgb_group_members', JSON.stringify({ watch: [], custom: ['110022'] }))
      const { useGroupStore } = await import('@/modules/group/group-store')
      const gs = useGroupStore()
      gs.restoreGroups([])
      return gs
    })

    t.check('有数据的分组被保留', g.groups.some(x => x.id === 'custom'), '用户数据被凭空吞掉')
    t.check('成员保留', g.getMembers('custom').length === 1, `实得 ${g.getMembers('custom').length} 只`)
    t.check('降级为普通分组可删除', g.groups.find(x => x.id === 'custom')?.builtin !== true,
      '仍是 builtin，用户无法删掉它')

    await t.act('删除该分组', () => g.deleteGroup('custom'))
    t.check('删除成功', !g.groups.some(x => x.id === 'custom'), '降级后仍删不掉')
  })
})
