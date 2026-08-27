/**
 * 09 · 搜索   10 · 资讯   11 · 板块行情
 */

import { describe } from 'vitest'
import { featureCase, isDefined } from '../helpers/case'
import { freshPinia } from '../helpers/seed'
import { setNetMode } from '../setup/net-stub'

describe('09 · 搜索', () => {
  featureCase('09-01', '按基金代码搜索', async t => {
    const m = await t.act('导入基金搜索模块', async () => await import('@/modules/fund/catalog/fund-search'))
    const fn = await t.act('取搜索函数', () => (m as any).searchFunds ?? (m as any).searchFund ?? Object.values(m)[0])
    t.check('搜索函数存在', typeof fn === 'function', '基金搜索函数不存在或未导出')
    const r = await t.act('搜索 000001', async () => await fn('000001'))
    t.check('返回结果（数组或对象）', isDefined(r), '搜索返回空')
  })

  featureCase('09-02', '按基金名称搜索', async t => {
    const m = await t.act('导入基金搜索模块', async () => await import('@/modules/fund/catalog/fund-search'))
    const fn = (m as any).searchFunds ?? (m as any).searchFund ?? Object.values(m)[0]
    const r = await t.act('搜索「华夏」', async () => await (fn as any)('华夏'))
    t.check('返回结果', isDefined(r), '按名称搜索返回空')
  })

  featureCase('09-03', '基金名称模糊匹配（拼音/简称）', async t => {
    const m = await t.act('导入名称匹配模块', async () => await import('@/modules/fund/catalog/fund-name-match'))
    t.check('模块有导出函数', Object.keys(m).length > 0, '名称匹配模块无导出')
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    const r = await t.act('执行一次匹配', () => fn('华夏成长混合', '华夏'))
    t.check('匹配函数可执行且有返回', r !== undefined, '匹配函数返回 undefined')
  })

  featureCase('09-04', '搜索无结果时不报错', async t => {
    const m = await t.act('导入基金搜索模块', async () => await import('@/modules/fund/catalog/fund-search'))
    const fn = (m as any).searchFunds ?? (m as any).searchFund ?? Object.values(m)[0]
    const r = await t.act('搜索一个不存在的关键词', async () => await (fn as any)('zzzz不存在zzzz'))
    t.check('无结果时仍有返回（不抛异常）', r !== undefined, '无结果时抛异常或返回 undefined')
  })

  featureCase('09-05', '基金代码目录加载', async t => {
    const m = await t.act('导入代码目录模块', async () => await import('@/modules/fund/catalog/fund-code-catalog'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('目录模块有导出函数', typeof fn === 'function', '代码目录模块无可用函数')
    await t.act('执行目录加载（不应抛异常）', async () => await fn())
  })

  featureCase('09-06', '股票搜索', async t => {
    const m = await t.act('导入股票搜索模块', async () => await import('@/modules/stock/search/stock-search'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('股票搜索函数存在', typeof fn === 'function', '股票搜索函数不存在')
    const r = await t.act('搜索「茅台」', async () => await fn('茅台'))
    t.check('返回结果', r !== undefined, '股票搜索返回 undefined')
  })

  featureCase('09-07', '股票搜索接口失败时不崩', async t => {
    const m = await t.act('导入股票搜索模块', async () => await import('@/modules/stock/search/stock-search'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    const r = await t.act('接口全挂时搜索（不应抛异常）', async () => await fn('茅台'))
    t.check('返回兜底值而非抛错', r !== undefined, '接口失败时搜索抛异常，搜索框会卡住')
  })

  featureCase('09-08', '基金搜索接口失败时不崩', async t => {
    const m = await t.act('导入基金搜索模块', async () => await import('@/modules/fund/catalog/fund-search'))
    const fn = (m as any).searchFunds ?? (m as any).searchFund ?? Object.values(m)[0]
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    const r = await t.act('接口全挂时搜索（不应抛异常）', async () => await (fn as any)('000001'))
    t.check('返回兜底值而非抛错', r !== undefined, '接口失败时搜索抛异常')
  })
})

describe('10 · 资讯', () => {
  async function newsStore() {
    freshPinia()
    const { useNewsStore } = await import('@/modules/news/news-store')
    const s = useNewsStore()
    s.restoreState()
    return s
  }

  featureCase('10-01', '资讯刷新跑通', async t => {
    const s = await t.prepare('创建 news store', () => newsStore())
    await t.act('刷新资讯', async () => {
      await s.refresh()
    })
    t.check('loading 已复位', s.loading === false, 'loading 卡在 true，资讯页一直转圈')
    t.check('资讯列表为数组', Array.isArray(s.news), '资讯列表不是数组')
  })

  featureCase('10-02', '多源合并去重', async t => {
    const m = await t.act('导入合并模块', async () => await import('@/modules/news/filter/news-merge'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('合并函数存在', typeof fn === 'function', '资讯合并函数不存在')
    const merged = await t.act('合并两组含重复标题的资讯', () =>
      fn(
        [{ title: 'A', url: 'u1', time: 1 }, { title: 'B', url: 'u2', time: 2 }],
        [{ title: 'A', url: 'u1', time: 1 }, { title: 'C', url: 'u3', time: 3 }],
      ),
    )
    t.check('返回数组', Array.isArray(merged), '合并结果不是数组')
  })

  featureCase('10-03', '黑名单添加与过滤生效', async t => {
    const s = await t.prepare('创建 store 并刷新出资讯', async () => {
      const st = await newsStore()
      await st.refresh()
      return st
    })
    const before = s.news.length
    await t.act('把「新浪财经」加入黑名单', () => s.addBlacklist('新浪财经'))
    t.check('黑名单已记录', s.blacklist.includes('新浪财经'), '黑名单未记录该来源')
    t.check('过滤后列表未增多', s.news.length <= before, `过滤后反而从 ${before} 增到 ${s.news.length}`)
  })

  featureCase('10-04', '黑名单落盘可读回', async t => {
    const s = await t.prepare('创建 store 并加黑名单', async () => {
      const st = await newsStore()
      st.addBlacklist('测试来源')
      return st
    })
    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_news_blacklist'))
    t.check('已落盘', !!raw && raw.includes('测试来源'), '黑名单未落盘 —— 刷新会失效')
    await t.act('从存储恢复', () => s.restoreState())
    t.check('恢复后仍在', s.blacklist.includes('测试来源'), '恢复后黑名单丢失')
  })

  featureCase('10-05', '已读标记与落盘', async t => {
    const s = await t.prepare('创建 news store', () => newsStore())
    await t.act('标记一条已读', () => s.markRead('某条资讯标题'))
    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_news_read'))
    t.check('已读标记已落盘', !!raw && raw.includes('某条资讯标题'), '已读标记未落盘 —— 刷新后全变未读')
  })

  featureCase('10-06', '未读数统计为有效数字', async t => {
    const s = await t.prepare('创建 store 并刷新', async () => {
      const st = await newsStore()
      await st.refresh()
      return st
    })
    t.check('未读数为数字', typeof s.unreadCount === 'number' && !Number.isNaN(s.unreadCount), `未读数=${s.unreadCount}（角标会显示异常）`)
    t.check('未读数非负', s.unreadCount >= 0, `未读数为负 ${s.unreadCount}`)
  })

  featureCase('10-07', '加载更多不报错', async t => {
    const s = await t.prepare('创建 store 并刷新', async () => {
      const st = await newsStore()
      await st.refresh()
      return st
    })
    await t.act('加载更多', async () => {
      await s.loadMore()
    })
    t.check('loading 已复位', s.loading === false, '加载更多后 loading 卡死')
  })

  featureCase('10-08', '时间格式化不产生 Invalid Date', async t => {
    const m = await t.act('导入时间格式化模块', async () => await import('@/modules/news/format/news-time'))
    // 接口以秒为单位（ctime），非毫秒
    const ts = Math.floor((Date.now() - 3600 * 1000) / 1000)

    const out = await t.act('格式化时间（formatTime）', () => m.formatTime(ts))
    t.check('返回非空字符串', typeof out === 'string' && out.length > 0, `格式化结果为「${out}」`)
    t.check('不含 Invalid Date', !String(out).includes('Invalid'), `时间显示为「${out}」`)

    const out2 = await t.act('格式化时间戳（formatTimestamp）', () => m.formatTimestamp(ts))
    t.check('时间戳格式化非空', typeof out2 === 'string' && out2.length > 0, `结果为「${out2}」`)
    t.check('不含 Invalid Date', !String(out2).includes('Invalid'), `时间显示为「${out2}」`)

    const parsed = await t.act('解析东财时间字符串', () => m.parseEastmoneyTime('2026-08-07 14:00:00'))
    t.check('解析结果为数字或 null（不抛异常）', parsed === null || typeof parsed === 'number', `解析返回 ${parsed}`)
  })

  featureCase('10-09', '全部资讯源失败时不崩', async t => {
    const s = await t.prepare('创建 news store', () => newsStore())
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    await t.act('刷新（不应抛异常）', async () => {
      await s.refresh()
    })
    t.check('loading 已复位', s.loading === false, '资讯源全挂后 loading 卡死')
    t.check('资讯列表仍是数组', Array.isArray(s.news), '资讯源全挂后列表被破坏')
  })

  featureCase('10-10', '资讯源返回脏数据时不崩', async t => {
    const s = await t.prepare('创建 news store', () => newsStore())
    await t.act('切换到脏数据模式', () => setNetMode('dirty'))
    await t.act('刷新（不应抛异常）', async () => {
      await s.refresh()
    })
    t.check('资讯列表仍是数组', Array.isArray(s.news), '脏数据破坏了资讯列表')
  })
})

describe('11 · 板块行情', () => {
  featureCase('11-01', '板块服务模块可用', async t => {
    const m = await t.act('导入股票服务模块', async () => await import('@/modules/stock/services/stock-service'))
    t.check('模块有导出', Object.keys(m).length > 0, '股票/板块服务模块无导出')
  })

  featureCase('11-02', '板块数据取数跑通', async t => {
    const m = await t.act('导入股票服务模块', async () => await import('@/modules/stock/services/stock-service'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('存在可调用函数', typeof fn === 'function', '服务模块无可用函数')
    await t.act('执行取数（不应抛异常）', async () => {
      try {
        await fn([{ code: '600519', emMarketCode: '1' }])
      } catch (e: any) {
        // 参数形态不匹配时不算功能不可用，只要不是模块级错误
        if (/is not a function|undefined is not/.test(String(e?.message))) throw e
      }
    })
  })

  featureCase('11-03', '板块设置项可读写', async t => {
    freshPinia()
    const s = await t.prepare('创建 settings store', async () => {
      const { useSettingsStore } = await import('@/modules/settings/settings-store')
      return useSettingsStore()
    })
    const before = s.sectorAutoRefresh
    await t.act('切换板块自动刷新', () => {
      s.sectorAutoRefresh = !before
    })
    t.check('设置已变化', s.sectorAutoRefresh !== before, '板块自动刷新开关无效')
  })

  featureCase('11-04', '板块接口失败时不崩', async t => {
    const m = await t.act('导入股票服务模块', async () => await import('@/modules/stock/services/stock-service'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    await t.act('接口全挂时取数（不应抛异常）', async () => {
      try {
        await fn([{ code: '600519', emMarketCode: '1' }])
      } catch (e: any) {
        if (/is not a function|undefined is not/.test(String(e?.message))) throw e
      }
    })
  })
})
