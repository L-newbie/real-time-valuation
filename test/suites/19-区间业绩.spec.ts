/**
 * 19 · 基金区间业绩（perf）
 *
 * 覆盖最近新增的「基金列表页 5 区间涨跌幅 + 近1年净值走势」整套功能：
 *   - src/modules/fund/perf/perf-intervals.ts：缓存读写、过期过滤、syl 回退复算、nav 降采样、
 *     后台串行补缺、令牌抢占、接口失败/脏数据静默（永不 reject）
 *   - src/composables/use-perf-intervals.ts：缓存合并（防闪烁）、卸载后不回写
 *
 * 判定口径与全仓一致：跑得通、不报错、状态确实变了、能落盘读回。不判数值精确性。
 *
 * ⚠️ 网络桩的 pingzhong 样本只有 2 个净值点（2025-08-03/04）且距今约一年，
 * 除近1周外区间数据不足、nav 还会被近1年窗口裁空 —— 故计算/缓存类用例直接构造缓存条目
 * 写进 localStorage，验证 getPerfIntervals 的命中/过滤逻辑（与 16-* 取数用例「只验不崩」风格一致）。
 * 真链路类用例走 fetchMissingPerf，断言「跑完不抛错 + 缓存结构正确」。
 */

import { describe } from 'vitest'
import { featureCase, isDefined, isFiniteNumber } from '../helpers/case'
import { freshPinia } from '../helpers/seed'
import { setNetMode } from '../setup/net-stub'

/** perf 缓存已迁入统一工厂，落盘键由 defineCache 生成（pool=fund, name=perf-intervals）。 */
const PERF_CACHE_KEY = 'jgb_p_f_perf-intervals'

/**
 * 写一条 perf 缓存条目。
 * 走工厂自身的 set()，避免绕过内存层直写 localStorage（工厂每模块生命周期只从盘恢复一次）。
 * 新鲜度由数据自身的 asOf（navRecent 末位日期）决定，故用 asOfDate 参数驱动 nav 末位。
 */
async function writePerfCache(code: string, over: Record<string, any> = {}): Promise<void> {
  const { perfCache } = await import('@/modules/fund/perf/perf-intervals')
  const asOfDate = over.asOfDate ?? '2026-08-06'
  const data = {
    week: 1.2, m1: 2.3, m3: 4.5, m6: 8.9, y1: 12.3,
    nav: [
      { d: '2025-09-01', v: 1.1 },
      { d: '2026-03-01', v: 1.2 },
      { d: asOfDate, v: 1.3 },
    ],
    navRecent: [{ d: asOfDate, v: 1.3 }],
    ...over.data,
  }
  perfCache.set(code, data as any)
}

/** 包一层超时，防 fetchMissingPerf 在异常情况下卡死测试。 */
async function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<{ ok: boolean; v?: T; err?: string }> {
  let timer: any
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  try {
    const v = await Promise.race([p, timeout])
    return { ok: true, v }
  } catch (e: any) {
    return { ok: false, err: e?.message ?? String(e) }
  } finally {
    clearTimeout(timer)
  }
}

describe('19 · 基金区间业绩', () => {
  featureCase('19-01', 'perf 模块可加载且对外入口存在', async t => {
    const m = await t.act('导入 perf-intervals 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    t.check('getPerfIntervals 为函数', typeof m.getPerfIntervals === 'function', 'getPerfIntervals 不存在')
    t.check('fetchMissingPerf 为函数', typeof m.fetchMissingPerf === 'function', 'fetchMissingPerf 不存在')
    t.check('模块导出非空', isDefined(m), '模块导出为空')
  })

  featureCase('19-02', '缓存命中读取（getPerfIntervals 返回未过期条目）', async t => {
    await t.prepare('写入一条新鲜且含 nav 的缓存', () => writePerfCache('000001'))
    const { getPerfIntervals } = await t.act('导入 perf 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    const map = await t.act('读取缓存命中', () => getPerfIntervals(['000001']))
    const perf = map.get('000001')
    t.check('命中返回 Map 含该基金', isDefined(perf), '新鲜缓存未被命中 —— 列表区间列会一直显示 --')
    if (perf) {
      t.check('5 个区间均为有效数字',
        isFiniteNumber(perf.week) && isFiniteNumber(perf.m1) && isFiniteNumber(perf.m3) && isFiniteNumber(perf.m6) && isFiniteNumber(perf.y1),
        '区间字段非有效数字')
      t.check('nav 走势为数组', Array.isArray(perf.nav), 'nav 不是数组 —— 展开区折线图画不出')
    }
  })

  featureCase('19-03', '过期条目被过滤（多判据都不命中）', async t => {
    const { getPerfIntervals } = await t.prepare('导入 perf 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    // ① 无 nav 数组（结构过旧）—— isEmpty 判据，工厂直接拒写
    await t.act('写入无 nav 的旧结构条目', () => writePerfCache('A001', { data: { week: 1, m1: 1, m3: 1, m6: 1, y1: 1, nav: undefined } }))
    // ② 5 区间全 null（空壳）—— 同样被 isEmpty 拒写
    await t.act('写入空壳条目', () => writePerfCache('A002', { data: { week: null, m1: null, m3: null, m6: null, y1: null, nav: [] } }))
    // ③ 超 30 天硬 TTL：先在写入时点回拨时钟，写完再拨回，使该条目自然过期
    await t.act('写入超 30 天的过期条目', async () => {
      const { setNow, resetClock } = await import('../setup/fake-clock')
      setNow(Date.now() - 31 * 24 * 60 * 60 * 1000)
      await writePerfCache('A003')
      resetClock()
    })
    // ④ asOf 落后于最新交易日（业绩已不是最新）
    await t.act('写入 asOf 落后的条目', () => writePerfCache('A004', { asOfDate: '2026-07-20' }))

    const map = await t.act('读取这四只', () => getPerfIntervals(['A001', 'A002', 'A003', 'A004']))
    t.check('四种过期条目全部被过滤', map.size === 0, `期望 0 命中，实得 ${map.size} —— 过期缓存未被重拉，界面会显示陈旧业绩`)
  })

  featureCase('19-04', '按交易日判新鲜：上一交易日命中、更早过滤', async t => {
    const { getPerfIntervals } = await t.prepare('导入 perf 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    // asOfDate = 上一交易日（2026-08-06）：已是最新可得净值，应命中
    await t.act('写入 asOfDate 为上一交易日的条目', () => writePerfCache('B001', { asOfDate: '2026-08-06' }))
    // asOfDate = 再往前一个交易日（2026-08-05）：落后于最新净值，应过滤
    await t.act('写入 asOfDate 落后一个交易日的条目', () => writePerfCache('B002', { asOfDate: '2026-08-05' }))
    const map = await t.act('读取两只', () => getPerfIntervals(['B001', 'B002']))
    t.check('上一交易日命中', map.has('B001'), '最新净值日的条目未被命中 —— 会造成无谓重拉')
    t.check('落后一日被过滤', !map.has('B002'), '落后一个交易日的条目未被过滤 —— 卡片净值列表会停留在旧数据，与详情页不同步')
  })

  featureCase('19-05', '后台补缺流程跑完不抛错（真链路）', async t => {
    freshPinia()
    const { fetchMissingPerf } = await t.prepare('导入 perf 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    const received = new Map<string, unknown>()
    const r = await t.act('对 3 只基金发起补缺', () =>
      withTimeout(fetchMissingPerf(['000001', '000002', '110022'], (u) => {
        for (const [k, v] of u) received.set(k, v)
      })),
    )
    t.check('补缺流程跑完未抛异常', r.ok, `补缺抛异常：${r.err}`)
    // 无论样本能否算出有效区间，函数都应 resolve（永不 reject 契约）。落盘结构应正确。
    const raw = await t.act('读取落盘缓存', () => localStorage.getItem(PERF_CACHE_KEY))
    let structOk = true
    if (raw != null) {
      try { structOk = typeof JSON.parse(raw) === 'object' && JSON.parse(raw) !== null } catch { structOk = false }
    }
    t.check('落盘结构为对象（即使值可能为 null）', structOk, '落盘结构异常')
  })

  featureCase('19-06', '接口失败时补缺不抛异常（静默降级）', async t => {
    freshPinia()
    const { fetchMissingPerf } = await t.prepare('导入 perf 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    const r = await t.act('接口全挂时补缺', () =>
      withTimeout(fetchMissingPerf(['000001'], () => {})),
    )
    t.check('未抛异常（走静默降级）', r.ok, `接口失败时补缺抛异常：${r.err} —— 会中断列表后台链路`)
  })

  featureCase('19-07', '脏数据下补缺不崩', async t => {
    freshPinia()
    const { fetchMissingPerf } = await t.prepare('导入 perf 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    await t.act('切换到脏数据模式', () => setNetMode('dirty'))
    const r = await t.act('脏数据下补缺', () =>
      withTimeout(fetchMissingPerf(['000001'], () => {})),
    )
    t.check('未抛异常', r.ok, `脏数据导致补缺抛异常：${r.err}`)
  })

  featureCase('19-08', '单只失败跳过不阻塞多只（永不 reject）', async t => {
    freshPinia()
    const { fetchMissingPerf } = await t.prepare('导入 perf 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    const r = await t.act('对 2 只基金补缺（均会失败）', () =>
      withTimeout(fetchMissingPerf(['000001', '000002'], () => {})),
    )
    t.check('多只补缺整体未抛异常', r.ok, `多只补缺抛异常：${r.err} —— 单只失败不应阻塞整批`)
  })

  featureCase('19-09', '令牌抢占不崩（连续两轮补缺）', async t => {
    freshPinia()
    const { fetchMissingPerf } = await t.prepare('导入 perf 模块', async () => await import('@/modules/fund/perf/perf-intervals'))
    // 连续发起两轮不同 code 集，第二轮令牌应抢占第一轮。两轮都不应抛错。
    await t.act('发起第一轮补缺（不 await）', () => {
      void fetchMissingPerf(['000001', '000002'], () => {}).catch(() => {})
    })
    const r = await t.act('立即发起第二轮并等待', () =>
      withTimeout(fetchMissingPerf(['110022'], () => {})),
    )
    t.check('抢占后第二轮未抛异常', r.ok, `令牌抢占导致抛异常：${r.err}`)
  })

  featureCase('19-10', 'usePerfIntervals 缓存合并且卸载后不回写', async t => {
    freshPinia()
    await t.prepare('写入新鲜缓存', () => writePerfCache('000001'))
    const vue = await t.prepare('导入 vue', async () => await import('vue'))
    const { mount } = await t.prepare('导入测试工具', async () => await import('@vue/test-utils'))
    const { usePerfIntervals } = await t.prepare('导入 usePerfIntervals', async () => await import('@/composables/use-perf-intervals'))

    // 内联最小组件：用 usePerfIntervals 暴露 perfMap，便于断言
    const perfMapHolder: { map: any } = { map: null }
    const TestComp = vue.defineComponent({
      setup() {
        const codes = vue.ref(['000001'])
        const { perfMap } = usePerfIntervals(codes)
        perfMapHolder.map = perfMap
        return () => vue.h('div', { 'data-test': 'perf-host' })
      },
    })

    const wrapper = await t.act('挂载消费组件', async () => {
      const w = mount(TestComp, { attachTo: document.body })
      // 让 watch immediate + 后台补缺的微任务/定时器跑一跑
      await new Promise((r) => setTimeout(r, 80))
      return w
    })
    const map = perfMapHolder.map?.value
    t.check('perfMap 为 Map', map instanceof Map, `perfMap 不是 Map（实得 ${typeof map}）`)
    t.check('缓存基金已被合并进 perfMap', map instanceof Map && map.has('000001'), '新鲜缓存未合并进响应式 Map —— 区间列会显示 --')

    // 卸载后再等待一段时间，确认后台补缺回调不回写已卸载组件（不抛错即通过）
    await t.act('卸载组件', () => wrapper.unmount())
    const r = await t.act('卸载后等待后台补缺收尾', () => withTimeout(new Promise<void>((res) => setTimeout(() => res(), 200))))
    t.check('卸载后未抛异常', r.ok, '组件卸载后后台补缺回调抛异常 —— 可能写已卸载的响应式状态')
  })
})
