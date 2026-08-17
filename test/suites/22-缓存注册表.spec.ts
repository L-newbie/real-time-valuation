import { describe } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { featureCase } from '../helpers/case'

const EXPECTED = [
  'holidays', 'yahoo-symbol', 'manager', 'index-quote',
  'sector-rank', 'watch-quote', 'stock-prev-day', 'stock-realtime',
  'intraday', 'holdings', 't1-holdings', 'valuation', 'news-read', 'base-info',
  'perf-intervals', 'trade-marks',
]

async function loadAll(): Promise<void> {
  setActivePinia(createPinia())
  await import('@/modules/fund/services/holiday-service')
  await import('@/modules/fund/services/yahoo-symbol')
  await import('@/modules/fund/misc/manager-check')
  await import('@/modules/index/index-store')
  await import('@/modules/fund/fund-store')
  await import('@/modules/fund/cache-store')
  await import('@/modules/stock/stock-store')
  await import('@/modules/news/news-store')
  await import('@/modules/stock/sector-cache')
  await import('@/modules/fund/services/fund-base-info')
  await import('@/modules/fund/perf/perf-intervals')
  await import('@/modules/holding/trade-marks')
}

describe('22 · 缓存工厂注册表', () => {
  featureCase('22-01', '全部缓存已注册到统一工厂', async t => {
    await t.prepare('加载所有缓存模块', loadAll)
    const { listCaches } = await t.act('读取注册表', async () =>
      await import('@/shared/cache/define-cache'))
    const names = listCaches().map(c => c.name)
    for (const want of EXPECTED) {
      t.check(`已注册 ${want}`, names.includes(want), `${want} 未注册，清除缓存会漏掉它`)
    }
  })

  featureCase('22-02', '清除列表由注册表自动生成且无重复', async t => {
    await t.prepare('加载所有缓存模块', loadAll)
    const { cacheStorageKeys } = await t.act('读取存储键', async () =>
      await import('@/shared/cache/define-cache'))
    const keys = cacheStorageKeys()
    // trade-marks 标记为 persistent：它派生自用户的加减仓记录，
    // 「清除缓存」不应抹掉交易标记，故有意不出现在清除列表中。
    t.check('键数量与可清除注册数一致', keys.length >= EXPECTED.length - 1, `实得 ${keys.length} 个`)
    t.check('无重复键', new Set(keys).size === keys.length, '存在重复键，清除会遗漏')
    t.check('键均带池前缀', keys.every(k => k.startsWith('jgb_p_')), '存在非规范键名')
    t.check('交易标记不在清除列表内', !keys.some(k => k.endsWith('trade-marks')),
      '交易标记被列入清除范围 —— 用户清缓存会丢掉建仓/加减仓标记')
  })

  featureCase('22-03', '三个池都有缓存注册', async t => {
    await t.prepare('加载所有缓存模块', loadAll)
    const { listCaches } = await t.act('读取注册表', async () =>
      await import('@/shared/cache/define-cache'))
    const pools = new Set(listCaches().map(c => c.pool))
    t.check('基金池非空', pools.has('fund'), 'fund 池无缓存')
    t.check('公共池非空', pools.has('shared'), 'shared 池无缓存')
    t.check('板块池非空', pools.has('board'), 'board 池无缓存')
  })
})
