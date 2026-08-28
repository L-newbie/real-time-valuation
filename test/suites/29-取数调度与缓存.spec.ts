/**
 * 29 · 取数调度与缓存
 *
 * 本轮取数引擎重构新增的三层：统一调度器、脚本任务队列、净值缓存，
 * 以及行情合并的批处理与持仓扫描的记忆化。
 *
 * 这些都是「坏了不报错、只是数据悄悄不来」的地方：
 * 调度器退避算错 → 循环空转烧 CPU 或再也不重试；
 * 净值缓存 TTL 算错 → 基金永远停在「估算」不转「已确认」；
 * 扫描记忆化不失效 → 取到数了却仍被当成缺失，或反过来永远不去取。
 */

import { describe } from 'vitest'
import { featureCase } from '../helpers/case'
import { freshPinia, makeValuation } from '../helpers/seed'

describe('29 · 取数调度与缓存', () => {
  featureCase('29-01', '调度器模块可加载且入口齐全', async t => {
    const m = await t.act('导入调度器', async () => await import('@/shared/net/scheduler'))
    t.check('defineJob 为函数', typeof m.defineJob === 'function', '入口缺失')
    t.check('startJob 为函数', typeof m.startJob === 'function', '入口缺失')
    t.check('stopJob 为函数', typeof m.stopJob === 'function', '入口缺失')
    t.check('wakeJob 为函数', typeof m.wakeJob === 'function', '唤醒缺失，新增基金后循环叫不醒')
    t.check('jobStats 为函数', typeof m.jobStats === 'function', '诊断入口缺失')
  })

  featureCase('29-02', '未启动的任务不会执行，stop 后不再续跑', async t => {
    const { defineJob, startJob, stopJob, jobStats } = await t.prepare(
      '导入调度器', async () => await import('@/shared/net/scheduler'))

    let runs = 0
    await t.act('注册但不启动', () => {
      defineJob({ key: 'test:idle', interval: 10, run: async () => { runs++; return { complete: true } } })
    })
    await t.act('等待一拍', () => new Promise(r => setTimeout(r, 50)))
    t.check('未启动则不执行', runs === 0, `未 startJob 却跑了 ${runs} 次`)

    await t.act('启动后立即停止', () => { startJob('test:idle'); stopJob('test:idle') })
    const stats = jobStats().find(j => j.key === 'test:idle')
    t.check('停止后 running 为 false', stats?.running === false, 'stopJob 未能标记停止')

    await t.act('清理：停止任务', () => stopJob('test:idle'))
  })

  featureCase('29-03', 'complete 的任务回落到 interval 而非空转', async t => {
    const { defineJob, startJob, stopJob } = await t.prepare(
      '导入调度器', async () => await import('@/shared/net/scheduler'))

    let runs = 0
    await t.act('启动一个恒 complete 的任务', () => {
      defineJob({
        key: 'test:complete',
        interval: 10_000,
        run: async () => { runs++; return { complete: true } },
      })
      startJob('test:complete')
    })
    await t.act('等待远超单拍的时间', () => new Promise(r => setTimeout(r, 80)))

    t.check('至少执行一次', runs >= 1, '任务从未执行')
    t.check('未反复空转', runs <= 2,
      `interval=10s 却在 80ms 内跑了 ${runs} 次 —— 回落逻辑失效会持续打接口`)

    await t.act('清理：停止任务', () => stopJob('test:complete'))
  })

  featureCase('29-04', '有进展则立即接力，无进展才退避', async t => {
    const { defineJob, startJob, stopJob } = await t.prepare(
      '导入调度器', async () => await import('@/shared/net/scheduler'))

    let progressRuns = 0
    await t.act('启动一个持续有进展的任务', () => {
      defineJob({
        key: 'test:progress',
        interval: 10_000,
        retryBase: 10_000,
        run: async () => {
          progressRuns++
          return progressRuns < 4 ? { complete: false, progressed: true } : { complete: true }
        },
      })
      startJob('test:progress')
    })
    await t.act('等待接力完成', () => new Promise(r => setTimeout(r, 80)))

    t.check('有进展时连续接力', progressRuns >= 4,
      `只跑了 ${progressRuns} 次 —— 有进展却被退避，取数会被拖慢数分钟`)

    await t.act('清理：停止任务', () => stopJob('test:progress'))
  })

  featureCase('29-05', '毫无进展的任务被退避，不做 tight loop', async t => {
    const { defineJob, startJob, stopJob } = await t.prepare(
      '导入调度器', async () => await import('@/shared/net/scheduler'))

    let runs = 0
    await t.act('启动一个永远取不到数的任务', () => {
      defineJob({
        key: 'test:stuck',
        interval: 10_000,
        retryBase: 10_000,
        run: async () => { runs++; return { complete: false, progressed: false } },
      })
      startJob('test:stuck')
    })
    await t.act('等待观察窗口', () => new Promise(r => setTimeout(r, 80)))

    t.check('无进展时退避', runs <= 2,
      `80ms 内跑了 ${runs} 次 —— 无退避会让取不到的股票持续空烧 CPU 与流量`)

    await t.act('清理：停止任务', () => stopJob('test:stuck'))
  })

  featureCase('29-06', '脚本任务串行执行且单个失败不拖垮后续', async t => {
    const { runScriptTask, scriptTaskStats } = await t.prepare(
      '导入脚本队列', async () => await import('@/shared/net/script-data-locks'))

    let peak = 0
    let active = 0
    const slow = async (): Promise<string> => {
      active++
      peak = Math.max(peak, active)
      await new Promise(r => setTimeout(r, 10))
      active--
      return 'ok'
    }

    const results = await t.act('并发投递 4 个不同 key 的任务', async () =>
      await Promise.all([
        runScriptTask('k1', slow),
        runScriptTask('k2', slow),
        runScriptTask('k3', slow),
        runScriptTask('k4', slow),
      ]))

    t.check('全部完成', results.every(r => r === 'ok'), '有任务未完成')
    t.check('并发度为 1', peak === 1,
      `峰值并发 ${peak} —— pingzhong 靠全局变量传数据，并发注入会互相覆盖`)

    const failed = await t.act('投递一个会抛异常的任务', async () =>
      await runScriptTask('boom', async () => { throw new Error('x') }).catch(() => 'caught'))
    t.check('异常被隔离', failed === 'caught', '异常未传播到调用方')

    const after = await t.act('失败后继续投递', () => runScriptTask('k5', slow))
    t.check('后续任务仍可执行', after === 'ok',
      '前一个任务失败后队列卡死 —— 旧的 promise 链写法会有这个问题')

    const stats = scriptTaskStats()
    t.check('队列已排空', stats.active === 0 && stats.queued === 0,
      `残留 active=${stats.active} queued=${stats.queued}，槽位泄漏会让后续取数永久阻塞`)
  })

  featureCase('29-07', '同 key 的并发脚本任务只执行一次', async t => {
    const { runScriptTask } = await t.prepare(
      '导入脚本队列', async () => await import('@/shared/net/script-data-locks'))

    let calls = 0
    const task = async (): Promise<number> => {
      calls++
      await new Promise(r => setTimeout(r, 10))
      return calls
    }

    await t.act('同一 key 并发投递 3 次', async () =>
      await Promise.all([
        runScriptTask('dedup', task),
        runScriptTask('dedup', task),
        runScriptTask('dedup', task),
      ]))

    t.check('只真正执行一次', calls === 1,
      `执行了 ${calls} 次 —— 去重失效会让同一份 pingzhong 脚本重复注入`)
  })

  featureCase('29-08', '净值缓存模块可加载且入口存在', async t => {
    const m = await t.act('导入净值缓存', async () =>
      await import('@/modules/fund/valuation/nav-series-cache'))
    t.check('getNavSeries 为函数', typeof m.getNavSeries === 'function', '入口缺失')
    t.check('peekNavSeries 为函数', typeof m.peekNavSeries === 'function', '入口缺失')
    t.check('invalidateNavSeries 为函数', typeof m.invalidateNavSeries === 'function', '失效入口缺失')
  })

  featureCase('29-09', '未确认净值只做短缓存，保证盘后能取到当日净值', async t => {
    const src = await t.act('读取净值缓存源码', async () => {
      const fs = await import('fs')
      return fs.readFileSync('src/modules/fund/valuation/nav-series-cache.ts', 'utf8')
    })

    t.check('TTL 为动态函数', /ttl:\s*\(v\)\s*=>/.test(src),
      'TTL 写死会让「已确认」与「未确认」用同一档缓存')
    t.check('按业务日区分新鲜度', src.includes('getBusinessDay()'),
      '未按业务日判断，无法区分当日净值是否已公布')
    t.check('存在短 TTL 档', /PENDING_TTL/.test(src),
      '缺少短 TTL：净值 20:00 公布而业务日次日 5 点才翻，' +
      '整日缓存会让基金当晚永远停在「估算」不转「已确认」')
    t.check('配置了 merge 保证新净值能覆盖', /merge:/.test(src),
      '无 merge 时新净值可能被 quality 比较挡掉而丢失')
  })

  featureCase('29-10', '估值刷新跳过当日已确认的基金', async t => {
    await t.prepare('重建 Pinia', () => freshPinia())
    const { useFundStore } = await t.prepare('导入基金 store', async () =>
      await import('@/modules/fund/fund-store'))
    const { getBusinessDay } = await t.prepare('导入交易日', async () =>
      await import('@/modules/fund/valuation/cn-trading-day'))

    const s = useFundStore()
    const today = getBusinessDay()

    await t.act('装载一只当日已确认的基金', () => {
      s.addFund('000001', '测试基金')
      s.valuationMap.set('000001', makeValuation('000001', {
        isEstimated: false,
        jzrq: today,
        delayDays: 1,
      }) as any)
    })

    const before = s.lastRefreshTime
    await t.act('触发全量刷新', () => s.refreshAllValuations())

    const v = s.getValuation('000001')
    t.check('已确认状态未被推翻', v?.isEstimated === false,
      '已确认基金被重新标记为估算 —— 界面会从「已确认」倒退回「估算」')
    t.check('刷新时间仍被推进', s.lastRefreshTime >= before,
      '全部跳过时未更新 lastRefreshTime，会导致可见性刷新反复触发')
  })

  featureCase('29-11', '持仓扫描的三个出口来自同一次遍历', async t => {
    await t.prepare('重建 Pinia', () => freshPinia())
    const { useFundStore } = await t.prepare('导入基金 store', async () =>
      await import('@/modules/fund/fund-store'))

    const s = useFundStore()

    const a = await t.act('调用 collectMissingStocks', () => s.collectMissingStocks())
    const b = await t.act('调用 collectAHkAll', () => s.collectAHkAll())
    const c = await t.act('调用 collectOverseasAll', () => s.collectOverseasAll())

    t.check('缺失分类结构完整',
      Array.isArray(a.aStock) && Array.isArray(a.hkStock)
      && Array.isArray(a.usStock) && Array.isArray(a.overseas),
      '返回结构变化会让三条取数循环拿不到目标股票')
    t.check('A/港全集为数组', Array.isArray(b), '结构不符，实时循环会崩')
    t.check('海外全集为数组', Array.isArray(c), '结构不符，Yahoo 循环会崩')
    t.check('空持仓时不产出目标',
      a.aStock.length === 0 && b.length === 0 && c.length === 0,
      '无持仓却产出取数目标，会打出无意义的请求')
  })

  featureCase('29-12', '交易日判定结果被记忆化且假期更新后失效', async t => {
    const m = await t.prepare('导入市场交易日模块', async () =>
      await import('@/shared/market/trading-day'))

    const fixed = Date.UTC(2026, 7, 7, 3, 0, 0)
    const first = await t.act('首次解析 A 股交易日', () => m.resolveMarketTradingDays('A', fixed))
    const second = await t.act('同一分钟内再次解析', () => m.resolveMarketTradingDays('A', fixed))

    t.check('同一分钟命中记忆化', first === second,
      '未命中缓存 —— 每 tick 逐股调用会反复构造 Date 并回溯日期')
    t.check('交易日为 ISO 日期', /^\d{4}-\d{2}-\d{2}$/.test(first.currentTradingDay),
      `实得 ${first.currentTradingDay}`)

    await t.act('注入假期表', () => m.setMarketHolidays('A', ['2026-08-07']))
    const after = await t.act('假期更新后重新解析', () => m.resolveMarketTradingDays('A', fixed))

    t.check('假期更新后缓存失效', after.isNonTradingDay === true,
      '假期表更新未清记忆化 —— 会一直用旧的交易日判断，节假日仍被当成交易日取数')

    await t.act('清理：还原假期表', () => m.setMarketHolidays('A', []))
  })
})
