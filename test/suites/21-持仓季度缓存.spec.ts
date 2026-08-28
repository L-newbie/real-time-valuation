import { describe } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { featureCase } from '../helpers/case'

async function store() {
  setActivePinia(createPinia())
  const { useFundStore } = await import('@/modules/fund/fund-store')
  return useFundStore()
}

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000)
  return d.toISOString().slice(0, 10)
}

function holdingsPayload(code: string) {
  return {
    fundCode: code,
    quarterReportDate: '2026-06-30',
    annualReportDate: '',
    description: '前十大重仓及占比',
    holdings: [{ stockCode: '600519', stockName: '贵州茅台', ratio: 8.5, isEstimated: false }],
    optimizationMeta: { method: 'proportional-scaling', navDaysUsed: 0, stockCoverage: 0 },
  }
}

describe('21 · 持仓季度级缓存', () => {
  featureCase('21-01', '数日前的持仓缓存仍可从磁盘恢复', async t => {
    await t.prepare('写入 10 天前的持仓缓存', () => {
      localStorage.setItem('jgb_estimated_holdings_date', daysAgo(10))
      localStorage.setItem('jgb_estimated_holdings_cache', JSON.stringify({
        '110011': { data: holdingsPayload('110011'), cachedDate: daysAgo(10) },
      }))
    })
    const s = await t.act('恢复持仓缓存', async () => {
      const st = await store()
      st.restoreEstimatedHoldingsCache()
      return st
    })
    t.check('缓存已恢复', s.estimatedHoldingsCache.size === 1, `实得 ${s.estimatedHoldingsCache.size} 条`)
    t.check('占比保留', s.estimatedHoldingsCache.get('110011')?.data.holdings[0].ratio === 8.5, '占比丢失')
  })

  featureCase('21-02', '超过季度期限的持仓缓存被丢弃', async t => {
    await t.prepare('写入 200 天前的持仓缓存', () => {
      localStorage.setItem('jgb_estimated_holdings_date', daysAgo(200))
      localStorage.setItem('jgb_estimated_holdings_cache', JSON.stringify({
        '110011': { data: holdingsPayload('110011'), cachedDate: daysAgo(200) },
      }))
    })
    const s = await t.act('恢复持仓缓存', async () => {
      const st = await store()
      st.restoreEstimatedHoldingsCache()
      return st
    })
    t.check('过期缓存已丢弃', s.estimatedHoldingsCache.size === 0, `实得 ${s.estimatedHoldingsCache.size} 条`)
    t.check('磁盘键已清理', localStorage.getItem('jgb_estimated_holdings_cache') === null, '磁盘残留')
  })

  featureCase('21-03', '跨日清理不再抹掉持仓', async t => {
    const s = await t.prepare('装载持仓缓存', async () => {
      const st = await store()
      st.setEstimatedHoldingsCache('110011', holdingsPayload('110011') as never)
      return st
    })
    t.check('清理前有缓存', s.estimatedHoldingsCache.size === 1, '前置装载失败')
    await t.act('执行跨日清理', () => s.clearCrossDayCaches())
    t.check('持仓仍在', s.estimatedHoldingsCache.size === 1, '持仓被跨日清理误删')
    t.check('行情已清空', s.stockPrevDayCache.size === 0, '行情未被清理')
  })
})
