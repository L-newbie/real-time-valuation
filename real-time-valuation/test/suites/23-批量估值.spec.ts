import { describe } from 'vitest'
import { featureCase } from '../helpers/case'

describe('23 · 批量估值接口', () => {
  featureCase('23-01', '批量取数模块可加载且入口存在', async t => {
    const m = await t.act('导入批量估值模块', async () =>
      await import('@/modules/fund/valuation/valuation-batch-fetch'))
    t.check('fetchValuationBatch 为函数', typeof m.fetchValuationBatch === 'function', '入口缺失')
  })

  featureCase('23-02', '空输入与非法代码不发请求', async t => {
    const { fetchValuationBatch } = await t.act('导入模块', async () =>
      await import('@/modules/fund/valuation/valuation-batch-fetch'))
    const empty = await t.act('传入空数组', () => fetchValuationBatch([]))
    t.check('空数组返回空 Map', empty.size === 0, `实得 ${empty.size} 条`)
    const bad = await t.act('传入非法代码', () => fetchValuationBatch(['abc', '12', '']))
    t.check('非法代码被过滤', bad.size === 0, `实得 ${bad.size} 条`)
  })

  featureCase('23-03', '批量结果不携带净值日期，避免污染昨日净值', async t => {
    const src = await t.act('读取源码', async () => {
      const fs = await import('fs')
      return fs.readFileSync('src/modules/fund/valuation/valuation-batch-fetch.ts', 'utf8')
    })
    t.check('未写入 jzrq', !src.includes('v.jzrq'), '批量结果写了 jzrq，lsjz 失败时会把最新净值日当昨日')
    t.check('未请求 PDATE 字段', !src.includes('PDATE'), 'PDATE 字段已无用途')
  })

  featureCase('23-05', 'dwjz 为前一日净值而非最新净值', async t => {
    const src = await t.act('读取源码', async () => {
      const fs = await import('fs')
      return fs.readFileSync('src/modules/fund/valuation/valuation-batch-fetch.ts', 'utf8')
    })
    t.check('未直接使用 NAV 作 dwjz', !src.includes('NAV'), 'NAV 是最新净值，用作 dwjz 会让昨日净值等于今日')
    t.check('批量不自行填 dwjz', /dwjz: 0/.test(src), '批量应留空 dwjz，交由 lsjz 提供权威昨日净值')
  })

  featureCase('23-04', '批量失败时仍回退到单只取数', async t => {
    const src = await t.act('读取合并层源码', async () => {
      const fs = await import('fs')
      return fs.readFileSync('src/modules/fund/valuation/fund-valuation-merge.ts', 'utf8')
    })
    t.check('批量调用被 try 包裹', /try\s*\{[\s\S]{0,120}fetchValuationBatch/.test(src), '批量失败会中断整批')
    t.check('未命中时走单只路径', src.includes('getFundValuation(code, getFundType)'), '缺少回退分支')
  })
})
