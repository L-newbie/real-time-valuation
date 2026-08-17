/**
 * 05 · T+N 待确认与跨日
 *
 * 肉眼几乎测不了的部分：待确认操作到期执行、昨日基数推进、漏日回放、跨日缓存清理。
 * 借助可穿越时钟模拟"关页数天后再打开"。
 */

import { describe } from 'vitest'
import { featureCase, isFiniteNumber, isDefined } from '../helpers/case'
import { freshPinia, TEST_FUNDS, makeValuation } from '../helpers/seed'
import { advanceDays } from '../setup/fake-clock'

async function bootHolding() {
  freshPinia()
  const { useHoldingStore } = await import('@/modules/holding/holding-store')
  const h = useHoldingStore()
  h.restoreHoldings()
  h.restoreActions()
  h.restorePendingActions()
  return h
}

function valuationMap() {
  const m = new Map<string, any>()
  for (const f of TEST_FUNDS) m.set(f.code, makeValuation(f.code))
  return m
}

describe('05 · T+N与跨日', () => {
  featureCase('05-01', '创建 T+1 待确认加仓', async t => {
    const h = await t.prepare('启动持仓 store', () => bootHolding())
    const before = h.pendingActions.length
    const act = await t.act('创建待确认加仓 5000 元', () => h.createPendingAdd('000001', 5000, 1.234, 1, '测试'))
    t.check('返回待确认对象', isDefined(act), 'createPendingAdd 返回空')
    t.check('待确认列表 +1', h.pendingActions.length === before + 1, `期望 ${before + 1}，实得 ${h.pendingActions.length}`)
    t.check('有预定执行日期', !!act.scheduledDate, 'scheduledDate 为空，永远不会被执行')
  })

  featureCase('05-02', '创建 T+1 待确认减仓', async t => {
    const h = await t.prepare('启动持仓 store', () => bootHolding())
    const act = await t.act('创建待确认减仓 1000 份', () => h.createPendingReduce('000001', 1000, 1.234, 1))
    t.check('返回待确认对象', isDefined(act), 'createPendingReduce 返回空')
    t.check('类型为减仓', act.type === 'reduce', `期望 reduce，实得 ${act.type}`)
  })

  featureCase('05-03', '取消待确认操作', async t => {
    const h = await t.prepare('启动 store 并创建一条待确认', async () => {
      const s = await bootHolding()
      s.createPendingAdd('000001', 5000, 1.234, 1)
      return s
    })
    const id = h.pendingActions[0].id
    const before = h.pendingActions.length
    await t.act('取消该待确认', () => h.cancelPendingAction(id))
    const stillPending = h.pendingActions.filter((p: any) => p.id === id && p.status === 'pending')
    t.check('该条已不再是待确认', stillPending.length === 0, `取消后仍处于 pending（共 ${before} 条）`)
  })

  featureCase('05-04', '按基金查询待确认操作', async t => {
    const h = await t.prepare('启动 store 并创建两条', async () => {
      const s = await bootHolding()
      s.createPendingAdd('000001', 5000, 1.234, 1)
      s.createPendingAdd('000002', 3000, 1.5, 1)
      return s
    })
    const list = await t.act('查询 000001 的待确认', () => h.getPendingByFund('000001'))
    t.check('返回数组', Array.isArray(list), '查询结果不是数组')
    t.check('只含该基金', list.every((p: any) => p.fundCode === '000001'), '查询结果混入了其他基金')
  })

  featureCase('05-05', '待确认操作到期执行（跨日后）', async t => {
    const h = await t.prepare('启动 store 并创建待确认', async () => {
      const s = await bootHolding()
      s.createPendingAdd('000001', 5000, 1.234, 1)
      return s
    })
    await t.act('时间前进 3 天（越过预定执行日）', () => advanceDays(3))
    await t.act('执行到期待确认（不应抛异常）', async () => {
      await h.executePendingActions(valuationMap())
    })
    t.check('store 仍可用', Array.isArray(h.holdings), '执行待确认后 store 被破坏')
  })

  featureCase('05-06', '昨日金额同步（syncYesterdayAmounts）', async t => {
    const h = await t.prepare('启动 store 并铺持仓', async () => {
      const s = await bootHolding()
      for (const f of TEST_FUNDS) s.addHoldingByAmount(f.code, 10000, 1.234)
      return s
    })
    await t.act('执行昨日金额同步', () => h.syncYesterdayAmounts(valuationMap()))
    const amt = await t.act('读取昨日持仓金额', () => h.getYesterdayHoldingAmount('000001'))
    t.check('昨日金额为有效数字', isFiniteNumber(amt), `昨日金额=${amt}（今日盈亏会算成 NaN）`)
  })

  featureCase('05-07', '漏日回放补齐（模拟关页数天后打开）', async t => {
    const h = await t.prepare('启动 store 并铺持仓', async () => {
      const s = await bootHolding()
      for (const f of TEST_FUNDS) s.addHoldingByAmount(f.code, 10000, 1.234)
      return s
    })
    const countBefore = h.holdings.length
    await t.act('时间前进 5 天（模拟关页 5 天）', () => advanceDays(5))
    await t.act('执行漏日回放（不应抛异常）', async () => {
      await h.replayGappedHoldings(valuationMap())
    })
    t.check('持仓未丢失', h.holdings.length === countBefore, `回放后持仓从 ${countBefore} 变成 ${h.holdings.length} —— 用户数据丢失`)
    const total = await t.act('读取总份额', () => h.getTotalShares('000001'))
    t.check('份额仍为有效数字', isFiniteNumber(total), `回放后份额=${total}`)
  })

  featureCase('05-08', '跨日缓存清理（clearCrossDayCaches）', async t => {
    freshPinia()
    const f = await t.prepare('创建 fund store 并铺数据', async () => {
      const { useFundStore } = await import('@/modules/fund/fund-store')
      const st = useFundStore()
      for (const x of TEST_FUNDS) st.addFund(x.code, x.name)
      st.valuationMap.set('000001', makeValuation('000001'))
      return st
    })
    await t.act('时间前进 1 天', () => advanceDays(1))
    await t.act('执行跨日缓存清理（不应抛异常）', () => f.clearCrossDayCaches())
    t.check('自选基金列表保留（不应被跨日清掉）', f.fundCodes.length === TEST_FUNDS.length, `跨日后自选基金从 ${TEST_FUNDS.length} 变成 ${f.fundCodes.length}`)
  })

  featureCase('05-09', '跨日过期估值清理不影响自选列表', async t => {
    freshPinia()
    const f = await t.prepare('创建 fund store 并铺数据', async () => {
      const { useFundStore } = await import('@/modules/fund/fund-store')
      const st = useFundStore()
      for (const x of TEST_FUNDS) st.addFund(x.code, x.name)
      return st
    })
    await t.act('执行过期估值清理', () => f.expireCrossDayValuations())
    await t.act('执行过期实时缓存清理', () => f.expireStaleRealtimeCache())
    t.check('自选列表完好', f.fundCodes.length === TEST_FUNDS.length, '清理误删了自选基金')
  })

  featureCase('05-10', '跨日检测工具（isCrossDay）', async t => {
    const m = await t.act('导入跨日模块', async () => await import('@/shared/cache/cross-day'))
    const df = await t.act('导入日期工具', async () => await import('@/shared/utils/date-format'))
    const same = await t.act('用今日日期判定', () => m.isCrossDay(df.getBeijingTodayStr()))
    t.check('同日判定为 false', same === false, '同一天被判为跨日，会导致缓存被反复清空')
    const diff = await t.act('用一个旧日期判定', () => m.isCrossDay('2020-01-01'))
    t.check('旧日期判定为 true', diff === true, '跨日未被识别，缓存不会失效')
  })

  featureCase('05-11', '同日一加一减：两笔待确认互不干扰，净值确认后各自成交', async t => {
    const CODE = '000001'
    const h = await t.prepare('启动持仓 store 并建仓 1000 元 @ 1.0', async () => {
      const s = await bootHolding()
      s.addHoldingByAmount(CODE, 1000, 1.0, '初始建仓', '2026-08-06')
      return s
    })
    t.check('起始份额 1000', Math.abs(h.getTotalShares(CODE) - 1000) < 0.01, `起始份额=${h.getTotalShares(CODE)}`)

    // 同一天里既加仓又减仓 —— 两笔 T+1 计划并存
    const add = await t.act('提交加仓计划：500 元', () => h.createPendingAdd(CODE, 500, 1.0, 1, '加仓'))
    const red = await t.act('提交减仓计划：100 份', () => h.createPendingReduce(CODE, 100, 1.0, 1, '减仓'))
    t.check('两笔计划均已创建', isDefined(add) && isDefined(red), '待确认计划创建失败')
    t.check(
      '待确认中同时存在加仓与减仓',
      h.pendingActions.filter((p: any) => p.status === 'pending').length === 2,
      `待确认笔数=${h.pendingActions.filter((p: any) => p.status === 'pending').length}，两笔应并存互不覆盖`,
    )
    // T+1 关键行为：提交当天持仓不动，要等次日净值确认
    t.check('提交当天持仓未变动', Math.abs(h.getTotalShares(CODE) - 1000) < 0.01, `提交当天份额被提前改成 ${h.getTotalShares(CODE)}`)

    // 次日：确认净值 1.2 公布
    await t.act('时间前进到次日', () => advanceDays(1))
    const NAV = 1.2
    const vmap = new Map<string, any>([
      [CODE, { fundcode: CODE, name: '测试基金', gztime: '', gz: NAV, dwjz: NAV, gszzl: 20, jzrq: add.scheduledDate, isEstimated: false, delayDays: 1 }],
    ])
    await t.act('净值确认后执行两笔待确认', async () => {
      await h.executePendingActions(vmap)
    })

    const done = h.pendingActions.filter((p: any) => p.status === 'executed')
    t.check('两笔均已成交', done.length === 2, `仅 ${done.length} 笔成交 —— 同日加减仓存在互相覆盖/漏执行`)

    // 加仓生成新一笔（成本价=确认净值），减仓在原有笔上扣份额
    const shares = h.getTotalShares(CODE)
    const principal = h.getPrincipal(CODE)
    t.check('总份额为有效数字', isFiniteNumber(shares), `总份额=${shares}`)
    t.check(
      `总份额约为 1316.67（900 + 500/1.2）`,
      Math.abs(shares - 1316.67) < 1,
      `总份额=${shares.toFixed(2)}，期望约 1316.67（减 100 份后 900 + 加仓 416.67）`,
    )
    // 减仓按比例同步缩减本金，不应凭空产生或消灭收益
    t.check(
      '投入本金约为 1400（900 + 500）',
      Math.abs(principal - 1400) < 1,
      `本金=${principal.toFixed(2)}，期望约 1400 —— 减仓未按比例缩减本金会导致收益虚增/虚减`,
    )
    const amount = await t.act('计算持有金额', () => h.getFundHoldingAmount(CODE, NAV, 20, false))
    t.check('持有金额为有效数字', isFiniteNumber(amount), `持有金额=${amount}（界面会显示 --）`)
    const avg = h.getAvgCostPrice(CODE)
    t.check('平均成本为有效数字且介于两笔成本之间', isFiniteNumber(avg) && avg > 1.0 && avg < 1.2, `平均成本=${avg}`)
  })

  featureCase('05-12', '减仓份额超过单笔时跨笔扣减（不静默吞掉超出部分）', async t => {
    const CODE = '000001'
    const h = await t.prepare('启动 store 并分两笔建仓（500 + 500 份）', async () => {
      const s = await bootHolding()
      s.addHoldingDirect(CODE, 500, 1.0)
      s.addHoldingDirect(CODE, 500, 1.1)
      return s
    })
    t.check('起始总份额 1000', Math.abs(h.getTotalShares(CODE) - 1000) < 0.01, `起始份额=${h.getTotalShares(CODE)}`)

    await t.act('提交减仓 800 份（超过单笔的 500）', () => h.createPendingReduce(CODE, 800, 1.0, 1))
    await t.act('时间前进到次日', () => advanceDays(1))
    const vmap = new Map<string, any>([
      [CODE, { fundcode: CODE, name: '测试基金', gztime: '', gz: 1.2, dwjz: 1.2, gszzl: 20, jzrq: '2026-08-07', isEstimated: false, delayDays: 1 }],
    ])
    await t.act('执行减仓', async () => {
      await h.executePendingActions(vmap)
    })

    const left = h.getTotalShares(CODE)
    t.check('剩余份额为有效数字', isFiniteNumber(left), `剩余份额=${left}`)
    t.check(
      '剩余约 200 份（1000 - 800，跨笔扣满）',
      Math.abs(left - 200) < 1,
      `剩余=${left.toFixed(2)}，期望约 200 —— 超出首笔的部分被静默吞掉了`,
    )
  })
})
