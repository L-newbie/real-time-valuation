/**
 * 03 · 基金管理
 *
 * 自选基金增删改查、名称映射、估值取数、排序视图、缓存与容错。
 */

import { describe } from 'vitest'
import { featureCase, isDefined, isFiniteNumber } from '../helpers/case'
import { freshPinia, TEST_FUNDS, makeValuation } from '../helpers/seed'
import { setNetMode } from '../setup/net-stub'

async function fundStore() {
  freshPinia()
  const { useFundStore } = await import('@/modules/fund/fund-store')
  return useFundStore()
}

describe('03 · 基金管理', () => {
  featureCase('03-01', '添加自选基金（列表增加 + 落盘可读回）', async t => {
    const s = await t.prepare('创建 fund store', () => fundStore())
    const before = s.fundCodes.length
    const ok = await t.act('添加基金 000001', () => s.addFund('000001', '华夏成长混合'))
    t.check('添加返回成功', ok === true, `addFund 返回 ${ok}`)
    t.check('列表数量 +1', s.fundCodes.length === before + 1, `期望 ${before + 1}，实得 ${s.fundCodes.length}`)
    t.check('列表包含该基金', s.fundCodes.includes('000001'), '添加后列表中找不到该基金')

    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_fund_codes'))
    t.check('已落盘且可读回', !!raw && raw.includes('000001'), '添加后未写入 localStorage，刷新页面会丢失')
  })

  featureCase('03-02', '重复添加同一基金不产生重复项', async t => {
    const s = await t.prepare('创建 store 并添加一次', async () => {
      const st = await fundStore()
      st.addFund('000001', '华夏成长混合')
      return st
    })
    const n1 = s.fundCodes.length
    await t.act('再次添加同一代码', () => s.addFund('000001', '华夏成长混合'))
    t.check('数量未增加', s.fundCodes.length === n1, `重复添加后数量从 ${n1} 变成 ${s.fundCodes.length}`)
  })

  featureCase('03-03', '删除自选基金（列表减少 + 落盘同步）', async t => {
    const s = await t.prepare('创建 store 并铺 3 只基金', async () => {
      const st = await fundStore()
      for (const f of TEST_FUNDS) st.addFund(f.code, f.name)
      return st
    })
    const before = s.fundCodes.length
    await t.act('删除 000001', () => s.removeFund('000001'))
    t.check('列表数量 -1', s.fundCodes.length === before - 1, `期望 ${before - 1}，实得 ${s.fundCodes.length}`)
    t.check('列表不再包含该基金', !s.fundCodes.includes('000001'), '删除后列表中仍存在')

    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_fund_codes'))
    t.check('落盘已同步', !!raw && !raw.includes('000001'), '删除后 localStorage 未同步，刷新会复活')
  })

  featureCase('03-04', '批量添加基金', async t => {
    const s = await t.prepare('创建 store', () => fundStore())
    const n = await t.act('批量添加 3 只', () => s.batchAddFunds(TEST_FUNDS))
    t.check('返回新增数量为有效数字', isFiniteNumber(n), `batchAddFunds 返回 ${n}`)
    t.check('列表包含全部 3 只', TEST_FUNDS.every(f => s.fundCodes.includes(f.code)), '批量添加后有遗漏')
  })

  featureCase('03-05', '基金名称设置与读取', async t => {
    const s = await t.prepare('创建 store 并添加基金', async () => {
      const st = await fundStore()
      st.addFund('000001')
      return st
    })
    await t.act('设置名称', () => s.setFundName('000001', '华夏成长混合'))
    const name = await t.act('读取名称', () => s.getFundName('000001'))
    t.check('读回的名称正确', name === '华夏成长混合', `期望「华夏成长混合」，实得「${name}」`)
  })

  featureCase('03-06', '基金名称缺失时有兜底显示（不返回空）', async t => {
    const s = await t.prepare('创建 store', () => fundStore())
    const name = await t.act('解析一个从未设置过名称的代码', () => s.resolveFundName('999999'))
    t.check('返回非空字符串', typeof name === 'string' && name.length > 0, `名称兜底失效，实得「${name}」——界面会显示空白`)
  })

  featureCase('03-07', '单只基金估值取数（字段为有效数字）', async t => {
    const s = await t.prepare('创建 store 并添加基金', async () => {
      const st = await fundStore()
      st.addFund('000001')
      return st
    })
    await t.act('拉取估值', async () => {
      await s.fetchValuation('000001')
    })
    const v = await t.act('读取估值结果', () => s.getValuation('000001'))
    t.check('估值对象存在', isDefined(v), '取数后仍无估值数据')
    if (v) {
      t.check('净值 dwjz 为有效数字', isFiniteNumber(v.dwjz), `dwjz=${v.dwjz}（界面会显示 --）`)
      t.check('估值 gz 为有效数字', isFiniteNumber(v.gz), `gz=${v.gz}（界面会显示 --）`)
      t.check('涨跌 gszzl 为有效数字', isFiniteNumber(v.gszzl), `gszzl=${v.gszzl}（界面会显示 --）`)
    }
  })

  featureCase('03-08', '全量刷新估值跑完不抛错', async t => {
    const s = await t.prepare('创建 store 并铺 3 只基金', async () => {
      const st = await fundStore()
      for (const f of TEST_FUNDS) st.addFund(f.code, f.name)
      return st
    })
    await t.act('执行全量刷新', async () => {
      await s.refreshAllValuations()
    })
    t.check('刷新后 loading 已复位', s.isLoading === false, 'loading 卡在 true，界面会一直转圈')
  })

  featureCase('03-09', '排序切换（字段与方向均生效）', async t => {
    const s = await t.prepare('创建 store', () => fundStore())
    await t.act('按涨跌幅排序', () => s.setSort('gszzl'))
    t.check('排序字段已切换', s.sortField === 'gszzl', `期望 gszzl，实得 ${s.sortField}`)
    const dir1 = s.sortDirection
    await t.act('再次点击同字段（应反向）', () => s.setSort('gszzl'))
    t.check('排序方向已翻转', s.sortDirection !== dir1, `方向未翻转，仍为 ${s.sortDirection}`)
  })

  featureCase('03-10', '视图模式切换（卡片/表格）', async t => {
    const s = await t.prepare('创建 store', () => fundStore())
    const before = s.viewMode
    await t.act('切换视图模式', () => {
      s.viewMode = before === 'table' ? 'card' : 'table'
    })
    t.check('视图模式已变化', s.viewMode !== before, `视图模式未变化，仍为 ${s.viewMode}`)
  })

  featureCase('03-11', '列配置保存与恢复', async t => {
    const s = await t.prepare('创建 store', () => fundStore())
    const cols = await t.act('读取当前列配置', () => s.columnConfig)
    t.check('默认列配置非空', Array.isArray(cols) && cols.length > 0, '默认列配置为空，表格将无列可显示')

    await t.act('保存列配置', () => s.saveColumnConfig(cols))
    await t.act('恢复列配置', () => s.restoreColumnConfig())
    t.check('恢复后列配置仍非空', Array.isArray(s.columnConfig) && s.columnConfig.length > 0, '列配置恢复后为空')
  })

  featureCase('03-12', '从缓存预热列表（seedFromCache）', async t => {
    const s = await t.prepare('创建 store 并添加基金', async () => {
      const st = await fundStore()
      st.addFund('000001', '华夏成长混合')
      return st
    })
    const cacheMap = await t.prepare('构造缓存 Map', () => new Map<string, any>())
    await t.act('执行缓存预热', () => s.seedFromCache(cacheMap))
    t.check('预热后 store 仍可用', Array.isArray(s.fundCodes), '预热破坏了 store 状态')
  })

  featureCase('03-13', '接口失败时刷新不崩（降级可用）', async t => {
    const s = await t.prepare('创建 store 并铺基金', async () => {
      const st = await fundStore()
      for (const f of TEST_FUNDS) st.addFund(f.code, f.name)
      return st
    })
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    await t.act('接口全挂时执行刷新（不应抛异常）', async () => {
      await s.refreshAllValuations()
    })
    t.check('loading 已复位（未卡死）', s.isLoading === false, '接口失败后 loading 卡在 true，界面永远转圈')
    t.check('基金列表仍完整', s.fundCodes.length === TEST_FUNDS.length, '接口失败导致自选列表被清空')
  })

  featureCase('03-14', '接口返回脏数据时不崩', async t => {
    const s = await t.prepare('创建 store 并添加基金', async () => {
      const st = await fundStore()
      st.addFund('000001')
      return st
    })
    await t.act('切换到脏数据模式', () => setNetMode('dirty'))
    await t.act('拉取估值（不应抛异常）', async () => {
      await s.fetchValuation('000001')
    })
    t.check('store 仍可用', Array.isArray(s.fundCodes), '脏数据破坏了 store')
  })

  featureCase('03-15', '估值合并到缓存后可重算', async t => {
    const s = await t.prepare('创建 store 并添加基金', async () => {
      const st = await fundStore()
      st.addFund('000001')
      st.valuationMap.set('000001', makeValuation('000001'))
      return st
    })
    await t.act('从缓存重算全部', () => s.recomputeAllFromCache())
    const v = await t.act('读取估值', () => s.getValuation('000001'))
    t.check('重算后估值仍在', isDefined(v), '重算后估值丢失')
  })
})
