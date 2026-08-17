/**
 * 26 · 交易日历与市场判定
 *
 * cn-trading-day / trading-day / market-classify / report-date。
 * T+1 与 T+2 的净值确认全靠这层给基准日期，算错一天，
 * 界面上就是「昨日净值显示成今天」或「更新角标永不出现」——
 * 两者都不报错，只是数字悄悄不对。
 */

import { describe } from 'vitest'
import { featureCase } from '../helpers/case'
import { setNowBeijing, resetClock } from '../setup/fake-clock'

const ISO = /^\d{4}-\d{2}-\d{2}$/

describe('26 · 交易日历与市场判定', () => {
  featureCase('26-01', '周末与法定节假日不算交易日', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))
    const dayjs = (await import('dayjs')).default

    t.check('周五是交易日', d.isCnTradingDay(dayjs('2026-08-07')), '2026-08-07 周五被判非交易日')
    t.check('周六不是', !d.isCnTradingDay(dayjs('2026-08-08')), '周六被判为交易日')
    t.check('周日不是', !d.isCnTradingDay(dayjs('2026-08-09')), '周日被判为交易日')
    t.check('元旦不是', !d.isCnTradingDay(dayjs('2026-01-01')), '法定节假日被判为交易日')
    t.check('国庆首日不是', !d.isCnTradingDay(dayjs('2026-10-01')), '国庆被判为交易日')
    t.check('春节假期不是', !d.isCnTradingDay(dayjs('2026-02-17')), '春节被判为交易日')
  })

  featureCase('26-02', '上一交易日跳过周末', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))
    const dayjs = (await import('dayjs')).default

    const fromMonday = await t.act('从周一回看一个交易日', () => d.getPreviousTradingDay(dayjs('2026-08-10')))
    t.check('周一的上一交易日是上周五', fromMonday === '2026-08-07', `实得 ${fromMonday}，周末被当成了交易日`)

    const twoBack = await t.act('从周一回看两个交易日', () => d.getPreviousNTradingDay(2, dayjs('2026-08-10')))
    t.check('回看两日到周四', twoBack === '2026-08-06', `实得 ${twoBack}`)

    const overHoliday = await t.act('从国庆后首个工作日回看', () => d.getPreviousTradingDay(dayjs('2026-10-08')))
    t.check('跳过整个国庆假期', overHoliday === '2026-09-30', `实得 ${overHoliday}，假期被当成交易日`)
  })

  featureCase('26-03', '下一交易日同样跳过休市', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))
    const dayjs = (await import('dayjs')).default

    const fromFriday = await t.act('从周五前进一个交易日', () => d.getNextTradingDay(dayjs('2026-08-07')))
    t.check('周五的下一交易日是下周一', fromFriday === '2026-08-10', `实得 ${fromFriday}`)

    const beforeHoliday = await t.act('从国庆前最后一日前进', () => d.getNextTradingDay(dayjs('2026-09-30')))
    t.check('跳过国庆到 10-08', beforeHoliday === '2026-10-08', `实得 ${beforeHoliday}`)
  })

  featureCase('26-04', '业务日在周末回落到最近交易日', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))

    await t.act('时间设为周六', () => setNowBeijing(2026, 8, 8, 10, 0))
    const sat = d.getBusinessDay()
    t.check('周六业务日回落到周五', sat === '2026-08-07', `实得 ${sat}，周末会按当天取数导致取不到净值`)

    await t.act('时间设为周日', () => setNowBeijing(2026, 8, 9, 10, 0))
    t.check('周日同样回落到周五', d.getBusinessDay() === '2026-08-07', `实得 ${d.getBusinessDay()}`)

    await t.act('复位时钟', () => resetClock())
  })

  featureCase('26-05', '凌晨归属前一业务日', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))

    // 换日阈值是 5 点：凌晨还在跑昨天的收盘数据，此时切日会把昨天的估值判成过期
    await t.act('时间设为周五凌晨 3 点', () => setNowBeijing(2026, 8, 7, 3, 0))
    const early = d.getBusinessDay()
    t.check('凌晨仍算前一交易日', early === '2026-08-06', `实得 ${early}，凌晨切日会误清昨日估值`)

    await t.act('时间设为周五上午 9 点', () => setNowBeijing(2026, 8, 7, 9, 0))
    t.check('过了换日点算当天', d.getBusinessDay() === '2026-08-07', `实得 ${d.getBusinessDay()}`)

    await t.act('复位时钟', () => resetClock())
  })

  featureCase('26-06', 'T+2 基准日比 T+1 早一个交易日', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))

    const t1 = await t.act('取当前业务日（T+1 基准）', () => d.getBusinessDay())
    const t2 = await t.act('取上一业务交易日（T+2 基准）', () => d.getPreviousBusinessTradingDay())

    t.check('两者格式均为 ISO 日期', ISO.test(t1) && ISO.test(t2), `实得 ${t1} / ${t2}`)
    t.check('T+2 基准更早', t2 < t1, `T+2 基准 ${t2} 不早于 T+1 基准 ${t1}，确认判定会错位`)
  })

  featureCase('26-07', 'QDII 与商品型识别为 T+2', async t => {
    const f = await t.prepare('加载基金类型模块', () => import('@/modules/fund/valuation/fund-type'))

    for (const type of ['QDII-混合偏股', 'QDII-普通股票', 'QDII-REITs', '商品', 'FOF-稳健型']) {
      t.check(`${type} 判为 T+2`, f.detectDelayDays(type) === 2, `${type} 被判成 T+1，净值确认会早一天`)
    }
    for (const type of ['混合型', '股票型', '债券型', '指数型', '']) {
      t.check(`${type || '空类型'} 判为 T+1`, f.detectDelayDays(type) === 1, `${type} 被判成 T+2`)
    }
    t.check('带空格的类型仍能识别', f.detectDelayDays('  QDII-商品  ') === 2, '未做 trim，前后空格导致误判')
    t.check('T+2 对应次日确认', f.getConfirmType(2) === 'nextDay', `实得 ${f.getConfirmType(2)}`)
    t.check('T+1 对应当日确认', f.getConfirmType(1) === 'sameDay', `实得 ${f.getConfirmType(1)}`)
  })

  featureCase('26-08', '东财市场代码分类', async t => {
    const m = await t.prepare('加载市场分类', () => import('@/shared/market/market-classify'))

    t.check('0 为沪深A股', m.classifyShare('0') === 'A', `实得 ${m.classifyShare('0')}`)
    t.check('1 为沪深A股', m.classifyShare('1') === 'A', `实得 ${m.classifyShare('1')}`)
    t.check('116 为港股', m.classifyShare('116') === 'HK', `实得 ${m.classifyShare('116')}`)
    t.check('105 为美股', m.classifyShare('105') === 'US', `实得 ${m.classifyShare('105')}`)
    t.check('106 为美股', m.classifyShare('106') === 'US', `实得 ${m.classifyShare('106')}`)
    t.check('未知代码归 unknown', m.classifyShare('999') === 'unknown', `实得 ${m.classifyShare('999')}`)
    t.check('缺省归 unknown', m.classifyShare(undefined) === 'unknown', `实得 ${m.classifyShare(undefined)}`)

    // 6 位纯数字曾被按位数猜成 A 股，三星 005930 因此被误判
    t.check('不按代码位数猜市场', m.classifyShare(undefined, '005930') === 'unknown',
      '仅凭 6 位数字就判成 A 股，韩股/日股会被当成沪深股取错行情')
  })

  featureCase('26-09', '各市场时区映射与收盘判定', async t => {
    const td = await t.prepare('加载市场交易日', () => import('@/shared/market/trading-day'))
    const m = await import('@/shared/market/market-classify')

    t.check('A 股映射到 A 时区', m.stockMarketToTz('A') === 'A', `实得 ${m.stockMarketToTz('A')}`)
    t.check('未知市场映射到 unknown', m.stockMarketToTz('unknown') === 'unknown', `实得 ${m.stockMarketToTz('unknown')}`)

    const a = await t.act('取 A 股交易日信息', () => td.resolveMarketTradingDays('A'))
    t.check('当前交易日为 ISO 日期', ISO.test(a.currentTradingDay), `实得 ${a.currentTradingDay}`)
    t.check('上一收盘日为 ISO 日期', ISO.test(a.lastClosedDay), `实得 ${a.lastClosedDay}`)
    t.check('上一收盘日不晚于当前交易日', a.lastClosedDay <= a.currentTradingDay,
      `lastClosedDay ${a.lastClosedDay} 晚于 currentTradingDay ${a.currentTradingDay}`)

    // 基准时刻是北京时间周五 14:30，A股盘中未收盘；美股当地时间还是周四晚间
    t.check('A 股盘中未标记收盘', a.isClosed === false, 'A股 14:30 被判为已收盘，分时会停止更新')

    const us = await t.act('取美股交易日信息', () => td.resolveMarketTradingDays('US'))
    t.check('美股交易日为 ISO 日期', ISO.test(us.currentTradingDay), `实得 ${us.currentTradingDay}`)
    t.check('美股交易日早于或等于 A 股', us.currentTradingDay <= a.currentTradingDay,
      `美股 ${us.currentTradingDay} 晚于 A股 ${a.currentTradingDay}，时差方向反了`)
  })

  featureCase('26-10', '周末不影响 T+2 今日涨跌的加权计算', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))

    // 周五晚间的美股行情要在周六被加权成 T+2 基金的今日涨跌，
    // 若基准日在周末回落失败，加权结果会挂到错误的日期上而不显示。
    await t.act('时间设为周六上午', () => setNowBeijing(2026, 8, 8, 10, 0))

    const businessDay = d.getBusinessDay()
    const t2Base = d.getPreviousBusinessTradingDay()

    t.check('周六业务日为周五', businessDay === '2026-08-07', `实得 ${businessDay}`)
    t.check('T+2 基准为周四', t2Base === '2026-08-06', `实得 ${t2Base}`)
    t.check('两者仍保持一个交易日间隔', t2Base < businessDay, `${t2Base} 不早于 ${businessDay}`)

    await t.act('复位时钟', () => resetClock())
  })

  featureCase('26-12', 'T+2 确认基准随日历前进，周末不定格在周五', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))

    // 业务日周末一律回退到周五，拿它判「今天是哪天」等于把时钟定格：
    // 周六周日的 T+2 确认基准恒等于周五的，周四净值永远「够新」，
    // 更新角标一直亮着不灭，今日涨跌也跟着按回周五的值。
    await t.act('时间设为周五上午', () => setNowBeijing(2026, 8, 7, 10, 0))
    const friBase = d.getPreviousCalendarTradingDay()
    t.check('周五基准为周四', friBase === '2026-08-06', `实得 ${friBase}`)

    await t.act('时间设为周六上午', () => setNowBeijing(2026, 8, 8, 10, 0))
    const satBase = d.getPreviousCalendarTradingDay()
    t.check('周六基准前进到周五', satBase === '2026-08-07', `实得 ${satBase}，基准仍停在周五之前`)
    t.check('周六基准不等于周五基准', satBase !== friBase, '周末沿用了周五的判定，时间被定格')

    await t.act('时间设为周日上午', () => setNowBeijing(2026, 8, 9, 10, 0))
    t.check('周日基准同为周五', d.getPreviousCalendarTradingDay() === '2026-08-07', `实得 ${d.getPreviousCalendarTradingDay()}`)

    await t.act('时间设为周一上午', () => setNowBeijing(2026, 8, 10, 10, 0))
    t.check('周一基准仍为周五', d.getPreviousCalendarTradingDay() === '2026-08-07', `实得 ${d.getPreviousCalendarTradingDay()}`)

    await t.act('复位时钟', () => resetClock())
  })

  featureCase('26-13', '日历业务日周末不回退，业务日照常回退', async t => {
    const d = await t.prepare('加载交易日模块', () => import('@/modules/fund/valuation/cn-trading-day'))

    await t.act('时间设为周六上午', () => setNowBeijing(2026, 8, 8, 10, 0))
    t.check('业务日回退到周五', d.getBusinessDay() === '2026-08-07',
      `实得 ${d.getBusinessDay()}，取行情要的是最后一个交易日`)
    t.check('日历日保持周六', d.getCalendarBusinessDay() === '2026-08-08',
      `实得 ${d.getCalendarBusinessDay()}，日历日跟着回退就失去了「今天是哪天」的意义`)

    await t.act('时间设为周六凌晨 3 点', () => setNowBeijing(2026, 8, 8, 3, 0))
    t.check('凌晨日历日仍算周五', d.getCalendarBusinessDay() === '2026-08-07',
      `实得 ${d.getCalendarBusinessDay()}，5 点滚动未生效`)

    await t.act('复位时钟', () => resetClock())
  })

  featureCase('26-11', '季报类型按月份识别', async t => {
    const r = await t.prepare('加载报告期模块', () => import('@/modules/fund/holdings/report-date'))

    t.check('03 为一季报', r.detectReportType('2026-03-31').reportType === '一季报', '一季报识别错误')
    t.check('06 为半年报', r.detectReportType('2026-06-30').reportType === '半年报', '半年报识别错误')
    t.check('09 为三季报', r.detectReportType('2026-09-30').reportType === '三季报', '三季报识别错误')
    t.check('12 为年报', r.detectReportType('2026-12-31').reportType === '年报', '年报识别错误')

    t.check('半年报为全量持仓', r.detectReportType('2026-06-30').isFull === true, '半年报未标记为全量')
    t.check('年报为全量持仓', r.detectReportType('2026-12-31').isFull === true, '年报未标记为全量')
    t.check('季报非全量', r.detectReportType('2026-03-31').isFull === false, '季报被标记为全量，只有前十大却按全量估算')

    t.check('空日期不崩', r.detectReportType('').reportType === '未知', '空输入未降级')
    t.check('非季末月份归未知', r.detectReportType('2026-07-15').reportType === '未知', '非季末月份未降级')
  })
})
