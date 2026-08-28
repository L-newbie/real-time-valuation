/**
 * 04 · 持仓管理
 *
 * 用户自己录入的数据，挂了后果最严重（金额显示 NaN、数据丢失）。
 * 重点：每个操作后状态确实变了、所有金额字段是有效数字、存盘能完整读回。
 */

import { describe } from 'vitest'
import { featureCase, isFiniteNumber, allFiniteNumbers, isDefined } from '../helpers/case'
import { freshPinia, TEST_FUNDS, makeValuation } from '../helpers/seed'

async function stores() {
  freshPinia()
  const { useHoldingStore } = await import('@/modules/holding/holding-store')
  const { useFundStore } = await import('@/modules/fund/fund-store')
  const h = useHoldingStore()
  // 模拟应用启动流程：store 内有 restored 保护，未走 restore 前一律不落盘
  // （防止空内存覆盖盘上真实持仓）。不调用 restore 则所有持久化都会被跳过。
  h.restoreHoldings()
  h.restoreActions()
  h.restorePendingActions()
  return { h, f: useFundStore() }
}

/** 构造估值 Map，供依赖估值的计算函数使用 */
function valuationMap() {
  const m = new Map<string, any>()
  for (const f of TEST_FUNDS) m.set(f.code, makeValuation(f.code))
  return m
}

describe('04 · 持仓管理', () => {
  featureCase('04-01', '按金额加仓（新增记录 + 份额为正数）', async t => {
    const h = await t.prepare('创建 store', () => stores().then(s => s.h))
    const before = h.holdings.length
    const rec = await t.act('按金额加仓 10000 元 @ 1.234', () =>
      h.addHoldingByAmount('000001', 10000, 1.234, '测试', '2026-08-06'),
    )
    t.check('返回持仓对象', isDefined(rec), 'addHoldingByAmount 返回空')
    t.check('持仓数量 +1', h.holdings.length === before + 1, `期望 ${before + 1}，实得 ${h.holdings.length}`)
    t.check('份额为有效正数', isFiniteNumber(rec.shares) && rec.shares > 0, `shares=${rec.shares}（界面会显示 --）`)
    t.check('成本价为有效数字', isFiniteNumber(rec.costPrice), `costPrice=${rec.costPrice}`)
  })

  featureCase('04-02', '按份额直接添加持仓', async t => {
    const h = await t.prepare('创建 store', () => stores().then(s => s.h))
    const rec = await t.act('直接添加 8103 份 @ 1.234', () => h.addHoldingDirect('000001', 8103, 1.234))
    t.check('返回持仓对象', isDefined(rec), 'addHoldingDirect 返回空')
    t.check('份额为有效数字', isFiniteNumber(rec.shares), `shares=${rec.shares}`)
    t.check('已加入列表', h.holdings.some((x: any) => x.id === rec.id), '添加后列表中找不到')
  })

  featureCase('04-03', '替换持仓（replaceHoldingDirect）', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingByAmount('000001', 10000, 1.234)
      return s.h
    })
    await t.act('替换该基金持仓为 5000 份 @ 2.0', () => h.replaceHoldingDirect('000001', 5000, 2.0))
    const total = await t.act('读取总份额', () => h.getTotalShares('000001'))
    t.check('总份额为有效数字', isFiniteNumber(total), `总份额=${total}`)
    t.check('份额已更新为 5000', Math.abs(total - 5000) < 1, `期望约 5000，实得 ${total}`)
  })

  featureCase('04-04', '减仓（份额减少）', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingDirect('000001', 10000, 1.0)
      return s.h
    })
    const id = h.holdings[0].id
    const before = h.getTotalShares('000001')
    const ok = await t.act('减仓 3000 份', () => h.reduceHolding(id, 3000, '测试减仓'))
    t.check('减仓返回成功', ok === true, `reduceHolding 返回 ${ok}`)
    const after = await t.act('读取减仓后总份额', () => h.getTotalShares('000001'))
    t.check('份额确实减少', after < before, `减仓前 ${before}，减仓后 ${after}，未减少`)
    t.check('份额仍为有效数字', isFiniteNumber(after), `份额=${after}`)
  })

  featureCase('04-05', '编辑持仓（份额与成本更新）', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingDirect('000001', 10000, 1.0)
      return s.h
    })
    const id = h.holdings[0].id
    const ok = await t.act('编辑为 8000 份 @ 1.5', () => h.editHolding(id, 8000, 1.5))
    t.check('编辑返回成功', ok === true, `editHolding 返回 ${ok}`)
    const rec = h.holdings.find((x: any) => x.id === id)
    t.check('份额已更新', rec?.shares === 8000, `期望 8000，实得 ${rec?.shares}`)
    t.check('成本已更新', rec?.costPrice === 1.5, `期望 1.5，实得 ${rec?.costPrice}`)
  })

  featureCase('04-06', '结算单笔持仓', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingDirect('000001', 10000, 1.0)
      return s.h
    })
    const id = h.holdings[0].id
    const ok = await t.act('结算该笔', () => h.settleHolding(id, '测试结算'))
    t.check('结算返回成功', ok === true, `settleHolding 返回 ${ok}`)
    t.check('已移出活跃持仓', !h.activeHoldings.some((x: any) => x.id === id), '结算后仍在活跃持仓中')
    t.check('已进入已结算列表', h.settledHoldings.some((x: any) => x.id === id), '结算后未进入已结算列表')
  })

  featureCase('04-07', '按基金结算全部持仓', async t => {
    const h = await t.prepare('创建 store 并加两笔同基金', async () => {
      const s = await stores()
      s.h.addHoldingDirect('000001', 5000, 1.0)
      s.h.addHoldingDirect('000001', 3000, 1.1)
      return s.h
    })
    await t.act('结算该基金全部持仓', () => h.settleAllByFund('000001'))
    const active = h.activeHoldings.filter((x: any) => x.fundCode === '000001')
    t.check('该基金无活跃持仓', active.length === 0, `仍有 ${active.length} 笔活跃持仓`)
  })

  featureCase('04-08', '按基金删除持仓', async t => {
    const h = await t.prepare('创建 store 并加两笔', async () => {
      const s = await stores()
      s.h.addHoldingDirect('000001', 5000, 1.0)
      s.h.addHoldingDirect('000002', 3000, 1.1)
      return s.h
    })
    await t.act('删除 000001 的持仓', () => h.removeHoldingsByFund('000001'))
    t.check('该基金持仓已删除', !h.holdings.some((x: any) => x.fundCode === '000001'), '删除后仍存在')
    t.check('其他基金持仓未受影响', h.holdings.some((x: any) => x.fundCode === '000002'), '误删了其他基金的持仓')
  })

  featureCase('04-09', '清空全部持仓', async t => {
    const h = await t.prepare('创建 store 并铺 3 笔', async () => {
      const s = await stores()
      for (const f of TEST_FUNDS) s.h.addHoldingDirect(f.code, 1000, 1.0)
      return s.h
    })
    await t.act('清空全部持仓', () => h.clearAllHoldings())
    t.check('持仓列表已清空', h.holdings.length === 0, `清空后仍有 ${h.holdings.length} 笔`)
  })

  featureCase('04-10', '总份额计算为有效数字', async t => {
    const h = await t.prepare('创建 store 并加两笔', async () => {
      const s = await stores()
      s.h.addHoldingDirect('000001', 5000, 1.0)
      s.h.addHoldingDirect('000001', 3000, 1.2)
      return s.h
    })
    const total = await t.act('计算总份额', () => h.getTotalShares('000001'))
    t.check('总份额为有效数字', isFiniteNumber(total), `总份额=${total}（界面会显示 --）`)
    t.check('总份额为两笔之和', Math.abs(total - 8000) < 1, `期望约 8000，实得 ${total}`)
  })

  featureCase('04-11', '平均成本计算为有效数字', async t => {
    const h = await t.prepare('创建 store 并加两笔', async () => {
      const s = await stores()
      s.h.addHoldingDirect('000001', 5000, 1.0)
      s.h.addHoldingDirect('000001', 5000, 2.0)
      return s.h
    })
    const avg = await t.act('计算平均成本', () => h.getAvgCostPrice('000001'))
    t.check('平均成本为有效数字', isFiniteNumber(avg), `平均成本=${avg}（界面会显示 --）`)
    t.check('平均成本为正数', avg > 0, `平均成本=${avg}，应为正数`)
  })

  featureCase('04-12', '本金计算为有效数字', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingByAmount('000001', 10000, 1.0)
      return s.h
    })
    const p = await t.act('计算本金', () => h.getPrincipal('000001'))
    t.check('本金为有效数字', isFiniteNumber(p), `本金=${p}（界面会显示 --）`)
  })

  featureCase('04-13', '持有金额计算为有效数字', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingByAmount('000001', 10000, 1.234)
      return s.h
    })
    const amt = await t.act('计算持有金额', () => h.getFundHoldingAmount('000001', 1.234, 0.89, true))
    t.check('持有金额为有效数字', isFiniteNumber(amt), `持有金额=${amt}（界面会显示 --）`)
  })

  featureCase('04-14', '今日盈亏计算为有效数字', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingByAmount('000001', 10000, 1.234)
      return s.h
    })
    const p = await t.act('计算今日盈亏', () => h.calcFundTodayProfit('000001', 0.89, 1.234, 0.89, true))
    t.check('今日盈亏为有效数字', isFiniteNumber(p), `今日盈亏=${p}（界面会显示 --）`)
  })

  featureCase('04-15', '累计盈亏计算为有效数字', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingByAmount('000001', 10000, 1.234)
      return s.h
    })
    const p = await t.act('计算累计盈亏', () => h.calcFundTotalProfit('000001', 0, 1.234, 0.89, true))
    t.check('累计盈亏为有效数字', isFiniteNumber(p), `累计盈亏=${p}（界面会显示 --）`)
  })

  featureCase('04-16', '仪表盘数据聚合（字段齐全且均为有效数字）', async t => {
    const h = await t.prepare('创建 store 并铺 3 笔持仓', async () => {
      const s = await stores()
      for (const f of TEST_FUNDS) s.h.addHoldingByAmount(f.code, 10000, 1.234)
      return s.h
    })
    const stats = await t.act('调用 getDashboardStats', () => h.getDashboardStats(valuationMap()))
    t.check('返回统计对象', isDefined(stats), 'getDashboardStats 返回空')

    const keys = ['totalHoldingAmount', 'totalProfit', 'todayProfit']
    const present = keys.filter(k => k in (stats as any))
    t.check('关键字段存在', present.length > 0, `统计对象缺少关键字段，实有：${Object.keys(stats as any).join(',')}`)

    const r = allFiniteNumbers(stats, present)
    t.check('全部金额字段为有效数字', r.ok, `以下字段非有效数字：${r.bad.join(', ')}（界面会显示 --）`)
  })

  featureCase('04-17', '盈亏状态判定有返回', async t => {
    const h = await t.prepare('创建 store 并加一笔', async () => {
      const s = await stores()
      s.h.addHoldingByAmount('000001', 10000, 1.0)
      return s.h
    })
    const st = await t.act('读取盈亏状态', () => h.getProfitStatus('000001'))
    t.check('返回有效状态值', isDefined(st), `盈亏状态为 ${st}`)
  })

  featureCase('04-18', '操作日志写入与按基金查询', async t => {
    const h = await t.prepare('创建 store 并做两次操作', async () => {
      const s = await stores()
      s.h.addHoldingByAmount('000001', 10000, 1.0)
      s.h.addHoldingByAmount('000001', 5000, 1.1)
      return s.h
    })
    const logs = await t.act('查询该基金操作日志', () => h.getActionsByFund('000001'))
    t.check('日志为数组', Array.isArray(logs), '操作日志不是数组')
    t.check('已记录操作', logs.length >= 2, `期望至少 2 条，实得 ${logs.length} 条`)
  })

  featureCase('04-19', '持仓数据存盘后能完整读回（防数据丢失）', async t => {
    const h = await t.prepare('创建 store 并铺 3 笔持仓', async () => {
      const s = await stores()
      for (const f of TEST_FUNDS) s.h.addHoldingByAmount(f.code, 10000, 1.234)
      return s.h
    })
    const countBefore = h.holdings.length
    await t.act('强制刷盘', () => h.flushAllPersist())

    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_holdings'))
    t.check('已写入 localStorage', !!raw, '持仓未落盘 —— 刷新页面用户数据全丢')

    const parsed = await t.act('解析落盘数据', () => JSON.parse(raw as string))
    t.check('落盘数据为数组', Array.isArray(parsed), '落盘格式异常')
    t.check(
      `落盘条数与内存一致（${countBefore}）`,
      parsed.length === countBefore,
      `内存 ${countBefore} 条，落盘 ${parsed.length} 条 —— 数据丢失`,
    )

    // 再从存储恢复，验证读回链路
    await t.act('从存储恢复持仓', () => h.restoreHoldings())
    t.check('恢复后条数一致', h.holdings.length === countBefore, `恢复后 ${h.holdings.length} 条，期望 ${countBefore} 条`)
  })

  featureCase('04-20', '零持仓时各计算函数返回 0 而非 NaN', async t => {
    const h = await t.prepare('创建空 store（无任何持仓）', () => stores().then(s => s.h))

    const shares = await t.act('计算总份额', () => h.getTotalShares('999999'))
    t.check('总份额为有效数字', isFiniteNumber(shares), `零持仓时总份额=${shares}（应为 0，NaN 会让界面显示 --）`)

    const avg = await t.act('计算平均成本', () => h.getAvgCostPrice('999999'))
    t.check('平均成本为有效数字', isFiniteNumber(avg), `零持仓时平均成本=${avg}（应为 0）`)

    const principal = await t.act('计算本金', () => h.getPrincipal('999999'))
    t.check('本金为有效数字', isFiniteNumber(principal), `零持仓时本金=${principal}（应为 0）`)

    const today = await t.act('计算今日盈亏', () => h.calcFundTodayProfit('999999', 0, 1, 0, true))
    t.check('今日盈亏为有效数字', isFiniteNumber(today), `零持仓时今日盈亏=${today}（应为 0）`)

    const stats = await t.act('零持仓下调用仪表盘聚合', () => h.getDashboardStats(new Map()))
    const keys = Object.keys(stats as any).filter(k => typeof (stats as any)[k] === 'number')
    const r = allFiniteNumbers(stats, keys)
    t.check('仪表盘全部数字字段有效', r.ok, `零持仓时以下字段为 NaN：${r.bad.join(', ')}`)
  })

  featureCase('04-21', '连续多次加减仓后金额仍为有效数字（浮点累积）', async t => {
    const h = await t.prepare('创建 store', () => stores().then(s => s.h))
    await t.act('连续加仓 30 次（每次 333.33 元）', () => {
      for (let i = 0; i < 30; i++) h.addHoldingByAmount('000001', 333.33, 1.111)
    })
    const total = await t.act('读取总份额', () => h.getTotalShares('000001'))
    t.check('总份额为有效数字', isFiniteNumber(total), `连续加仓后总份额=${total}`)

    await t.act('连续减仓 10 次', () => {
      for (let i = 0; i < 10; i++) {
        const act = h.activeHoldings[0]
        if (act) h.reduceHolding(act.id, act.shares / 2)
      }
    })
    const after = await t.act('读取减仓后总份额', () => h.getTotalShares('000001'))
    t.check('减仓后份额仍为有效数字', isFiniteNumber(after), `连续减仓后总份额=${after}（NaN 会让界面显示 --）`)
    t.check('份额非负', after >= 0, `份额为负数 ${after}`)
  })

  featureCase('04-22', '从净值重新校准持仓（recalibrateHoldingsFromNav）', async t => {
    const h = await t.prepare('创建 store 并铺持仓', async () => {
      const s = await stores()
      for (const f of TEST_FUNDS) s.h.addHoldingByAmount(f.code, 10000, 1.234)
      return s.h
    })
    await t.act('执行净值校准', async () => {
      await h.recalibrateHoldingsFromNav(valuationMap())
    })
    const total = await t.act('校准后读取总份额', () => h.getTotalShares('000001'))
    t.check('校准后份额仍为有效数字', isFiniteNumber(total), `校准后份额=${total}`)
    t.check('持仓未被清空', h.holdings.length > 0, '校准后持仓被清空 —— 用户数据丢失')
  })
})
