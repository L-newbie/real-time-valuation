/**
 * 06 · 计划任务   07 · 自选股票   08 · 指数
 */

import { describe } from 'vitest'
import { featureCase, isDefined, isFiniteNumber } from '../helpers/case'
import { freshPinia } from '../helpers/seed'
import { setNetMode } from '../setup/net-stub'

describe('06 · 计划任务', () => {
  async function taskStore() {
    freshPinia()
    const { useTaskStore } = await import('@/modules/reserved/task-store')
    const s = useTaskStore()
    s.restoreTasks()
    return s
  }

  featureCase('06-01', '新增计划任务', async t => {
    const s = await t.prepare('创建 task store', () => taskStore())
    const before = s.tasks.length
    const task = await t.act('新增一条任务', () =>
      s.addTask('000001', '华夏成长混合', 'buy' as any, 1000, '2026-08-10'),
    )
    t.check('返回任务对象', isDefined(task), 'addTask 返回空')
    t.check('任务列表 +1', s.tasks.length === before + 1, `期望 ${before + 1}，实得 ${s.tasks.length}`)
  })

  featureCase('06-02', '更新任务状态', async t => {
    const s = await t.prepare('创建 store 并加任务', async () => {
      const st = await taskStore()
      st.addTask('000001', '华夏成长混合', 'buy' as any, 1000, '2026-08-10')
      return st
    })
    const id = s.tasks[0].id
    await t.act('更新状态为已完成', () => s.updateStatus(id, 'completed' as any))
    const task = s.tasks.find((x: any) => x.id === id)
    t.check('状态已更新', task?.status === 'completed', `期望 completed，实得 ${task?.status}`)
  })

  featureCase('06-03', '标记任务已执行', async t => {
    const s = await t.prepare('创建 store 并加任务', async () => {
      const st = await taskStore()
      st.addTask('000001', '华夏成长混合', 'buy' as any, 1000, '2026-08-10')
      return st
    })
    await t.act('标记已执行', () => s.markExecuted(s.tasks[0].id))
    t.check('store 仍可用', Array.isArray(s.tasks), '标记后 store 被破坏')
  })

  featureCase('06-04', '取消任务', async t => {
    const s = await t.prepare('创建 store 并加任务', async () => {
      const st = await taskStore()
      st.addTask('000001', '华夏成长混合', 'buy' as any, 1000, '2026-08-10')
      return st
    })
    const id = s.tasks[0].id
    await t.act('取消该任务', () => s.cancelTaskById(id))
    const task = s.tasks.find((x: any) => x.id === id)
    t.check('任务已取消或移除', !task || task.status !== 'pending', '取消后仍为 pending')
  })

  featureCase('06-05', '清理已完成任务', async t => {
    const s = await t.prepare('创建 store 并加任务后标记完成', async () => {
      const st = await taskStore()
      const tk = st.addTask('000001', '华夏成长混合', 'buy' as any, 1000, '2026-08-10')
      st.updateStatus(tk.id, 'completed' as any)
      return st
    })
    await t.act('清理已完成任务', () => s.clearFinishedTasks())
    t.check('store 仍可用', Array.isArray(s.tasks), '清理后 store 被破坏')
  })

  featureCase('06-06', '按基金查询任务', async t => {
    const s = await t.prepare('创建 store 并加两只基金的任务', async () => {
      const st = await taskStore()
      st.addTask('000001', '基金A', 'buy' as any, 1000, '2026-08-10')
      st.addTask('000002', '基金B', 'buy' as any, 2000, '2026-08-10')
      return st
    })
    const list = await t.act('查询 000001 的任务', () => s.getTasksByFund('000001'))
    t.check('返回数组', Array.isArray(list), '查询结果不是数组')
    t.check('只含该基金', list.every((x: any) => x.fundCode === '000001'), '混入了其他基金的任务')
  })

  featureCase('06-07', '调度器启动与停止', async t => {
    const s = await t.prepare('创建 task store', () => taskStore())
    await t.act('启动调度器', () => s.startScheduler(() => {}))
    t.check('调度器处于运行中', s.isSchedulerRunning() === true, '启动后 isSchedulerRunning 仍为 false')
    await t.act('停止调度器', () => s.stopScheduler())
    t.check('调度器已停止', s.isSchedulerRunning() === false, '停止后仍在运行 —— 定时器泄漏')
  })
})

describe('07 · 自选股票', () => {
  async function stockStore() {
    freshPinia()
    const { useStockStore } = await import('@/modules/stock/stock-store')
    const s = useStockStore()
    s.restoreWatchlist()
    return s
  }
  const ITEM = { code: '600519', name: '贵州茅台', rawMarket: '1', market: 'A', secid: '1.600519' } as any

  featureCase('07-01', '加入自选股', async t => {
    const s = await t.prepare('创建 stock store', () => stockStore())
    const before = s.watchlist.length
    const ok = await t.act('加入贵州茅台', () => s.addToWatchlist(ITEM))
    t.check('加入返回成功', ok === true, `addToWatchlist 返回 ${ok}`)
    t.check('自选数量 +1', s.watchlist.length === before + 1, `期望 ${before + 1}，实得 ${s.watchlist.length}`)
  })

  featureCase('07-02', '重复加入不产生重复项', async t => {
    const s = await t.prepare('创建 store 并加入一次', async () => {
      const st = await stockStore()
      st.addToWatchlist(ITEM)
      return st
    })
    const n = s.watchlist.length
    const ok = await t.act('再次加入同一只', () => s.addToWatchlist(ITEM))
    t.check('返回 false（已存在）', ok === false, `重复加入返回 ${ok}`)
    t.check('数量未增加', s.watchlist.length === n, `数量从 ${n} 变成 ${s.watchlist.length}`)
  })

  featureCase('07-03', '移除自选股', async t => {
    const s = await t.prepare('创建 store 并加入', async () => {
      const st = await stockStore()
      st.addToWatchlist(ITEM)
      return st
    })
    await t.act('移除 600519', () => s.removeFromWatchlist('600519'))
    t.check('自选中已无该股', !s.watchlist.some((x: any) => x.code === '600519'), '移除后仍存在')
  })

  featureCase('07-04', '自选列表落盘可读回', async t => {
    const s = await t.prepare('创建 store 并加入', async () => {
      const st = await stockStore()
      st.addToWatchlist(ITEM)
      return st
    })
    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_watchlist'))
    t.check('已落盘', !!raw && raw.includes('600519'), '自选未落盘 —— 刷新页面会丢失')
    await t.act('从存储恢复', () => s.restoreWatchlist())
    t.check('恢复后仍在', s.watchlist.some((x: any) => x.code === '600519'), '恢复后自选丢失')
  })

  featureCase('07-05', '行情刷新跑通（价格为有效数字）', async t => {
    const s = await t.prepare('创建 store 并加入自选', async () => {
      const st = await stockStore()
      st.addToWatchlist(ITEM)
      return st
    })
    await t.act('刷新行情', async () => {
      await s.refresh()
    })
    t.check('loading 已复位', s.loading === false, 'loading 卡在 true，界面一直转圈')
    const q = s.quoteMap.get?.('600519')
    if (q) {
      t.check('价格为有效数字', isFiniteNumber(q.price), `price=${q.price}（界面会显示 --）`)
    } else {
      t.note('本轮未取到行情（桩数据未覆盖该市场），刷新链路本身未报错')
    }
  })

  featureCase('07-06', '接口失败时刷新不崩', async t => {
    const s = await t.prepare('创建 store 并加入自选', async () => {
      const st = await stockStore()
      st.addToWatchlist(ITEM)
      return st
    })
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    await t.act('刷新行情（不应抛异常）', async () => {
      await s.refresh()
    })
    t.check('loading 已复位', s.loading === false, '接口失败后 loading 卡死')
    t.check('自选列表完好', s.watchlist.length === 1, '接口失败导致自选被清空')
  })

  featureCase('07-07', '自选数量统计正确', async t => {
    const s = await t.prepare('创建 store 并加入两只', async () => {
      const st = await stockStore()
      st.addToWatchlist(ITEM)
      st.addToWatchlist({ ...ITEM, code: '000858', name: '五粮液' })
      return st
    })
    t.check('count 为有效数字', isFiniteNumber(s.count), `count=${s.count}`)
    t.check('count 等于列表长度', s.count === s.watchlist.length, `count=${s.count}，列表长度=${s.watchlist.length}`)
  })

  featureCase('07-08', '空自选时刷新不报错', async t => {
    const s = await t.prepare('创建空 store', () => stockStore())
    await t.act('空列表时刷新', async () => {
      await s.refresh()
    })
    t.check('loading 未卡死', s.loading === false, '空列表刷新后 loading 卡死')
  })
})

describe('08 · 指数', () => {
  async function indexStore() {
    freshPinia()
    const { useIndexStore } = await import('@/modules/index/index-store')
    const s = useIndexStore()
    s.restoreSelected()
    return s
  }

  featureCase('08-01', '指数预设列表非空', async t => {
    const s = await t.prepare('创建 index store', () => indexStore())
    t.check('预设指数列表非空', Array.isArray(s.allIndices) && s.allIndices.length > 0, '指数预设为空，设置页将无指数可选')
  })

  featureCase('08-02', '勾选指数', async t => {
    const s = await t.prepare('创建 index store', () => indexStore())
    const secid = s.allIndices[0].secid
    const had = s.selectedIndices.includes(secid)
    await t.act(`切换指数 ${secid}`, () => s.toggleIndex(secid))
    t.check('勾选状态已翻转', s.selectedIndices.includes(secid) !== had, '切换后勾选状态未变化')
  })

  featureCase('08-03', '取消勾选指数', async t => {
    const s = await t.prepare('创建 store 并确保已勾选', async () => {
      const st = await indexStore()
      const id = st.allIndices[0].secid
      if (!st.selectedIndices.includes(id)) st.toggleIndex(id)
      return st
    })
    const secid = s.allIndices[0].secid
    await t.act('取消勾选', () => s.toggleIndex(secid))
    t.check('已取消勾选', !s.selectedIndices.includes(secid), '取消后仍在勾选列表中')
  })

  featureCase('08-04', '勾选结果落盘可读回', async t => {
    const s = await t.prepare('创建 store', () => indexStore())
    // 无条件切换两次，确保确实触发过写盘（默认已勾选的指数直接跳过会导致没有落盘动作）
    const secid = s.allIndices[0].secid
    await t.act('切换勾选状态（触发写盘）', () => s.toggleIndex(secid))
    await t.act('再切换回来（再次写盘）', () => s.toggleIndex(secid))

    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_selected_indices'))
    t.check('已落盘', !!raw, '指数勾选未落盘 —— 刷新会恢复默认')

    const before = [...s.selectedIndices]
    await t.act('从存储恢复', () => s.restoreSelected())
    t.check('恢复后勾选一致', s.selectedIndices.length === before.length, `恢复前 ${before.length} 个，恢复后 ${s.selectedIndices.length} 个`)
  })

  featureCase('08-05', '指数行情刷新跑通', async t => {
    const s = await t.prepare('创建 store 并勾选一个', async () => {
      const st = await indexStore()
      const id = st.allIndices[0].secid
      if (!st.selectedIndices.includes(id)) st.toggleIndex(id)
      return st
    })
    await t.act('刷新指数行情', async () => {
      await s.refresh()
    })
    t.check('loading 已复位', s.loading === false, 'loading 卡在 true')
  })

  featureCase('08-06', '接口失败时指数刷新不崩', async t => {
    const s = await t.prepare('创建 store 并勾选', async () => {
      const st = await indexStore()
      const id = st.allIndices[0].secid
      if (!st.selectedIndices.includes(id)) st.toggleIndex(id)
      return st
    })
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    await t.act('刷新（不应抛异常）', async () => {
      await s.refresh()
    })
    t.check('loading 已复位', s.loading === false, '接口失败后 loading 卡死')
    t.check('勾选未丢失', s.selectedIndices.length > 0, '接口失败导致勾选被清空')
  })
})
