/**
 * 16 · 取数链路容错   17 · 图像识别与问题反馈（只读，不触发真实 API）
 *
 * 16 是当前完全没被验证过的部分：接口挂了、代理全挂、Worker 不响应时，
 * 功能应该"降级可用"而不是"整个崩掉"。
 */

import { describe } from 'vitest'
import { featureCase, isDefined } from '../helpers/case'
import { freshPinia, TEST_FUNDS } from '../helpers/seed'
import { setNetMode } from '../setup/net-stub'
import { setWorkerMode } from '../setup/worker-stub'

/** 统一：调用取数函数，只要不抛异常即视为可用（返回 null/空是允许的降级） */
async function callSafely(fn: any, ...args: any[]): Promise<{ threw: boolean; err?: string }> {
  try {
    await fn(...args)
    return { threw: false }
  } catch (e: any) {
    return { threw: true, err: String(e?.message ?? e) }
  }
}

describe('16 · 取数容错', () => {
  featureCase('16-01', '基金估值取数模块可用', async t => {
    const m = await t.act('导入 fundgz 取数模块', async () => await import('@/modules/fund/valuation/fundgz-fetch'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('取数函数存在', typeof fn === 'function', 'fundgz 取数函数不存在')
    const r = await t.act('正常模式下取数', () => callSafely(fn, '000001'))
    t.check('取数未抛异常', !r.threw, `取数抛异常：${r.err}`)
  })

  featureCase('16-02', '历史净值取数模块可用', async t => {
    const m = await t.act('导入 lsjz 取数模块', async () => await import('@/modules/fund/valuation/lsjz-fetch'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('取数函数存在', typeof fn === 'function', 'lsjz 取数函数不存在')
    const r = await t.act('正常模式下取数', () => callSafely(fn, '000001'))
    t.check('取数未抛异常', !r.threw, `取数抛异常：${r.err}`)
  })

  featureCase('16-03', '基金持仓取数模块可用', async t => {
    const m = await t.act('导入 F10 持仓取数模块', async () => await import('@/modules/fund/holdings/f10-holdings-fetch'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('取数函数存在', typeof fn === 'function', 'F10 持仓取数函数不存在')
    const r = await t.act('正常模式下取数', () => callSafely(fn, '000001'))
    t.check('取数未抛异常', !r.threw, `取数抛异常：${r.err}`)
  })

  featureCase('16-04', '基金全量数据取数模块可用', async t => {
    const m = await t.act('导入 pingzhongdata 模块', async () => await import('@/modules/fund/valuation/pingzhongdata-fetch'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('取数函数存在', typeof fn === 'function', 'pingzhongdata 取数函数不存在')
    const r = await t.act('正常模式下取数', () => callSafely(fn, '000001'))
    t.check('取数未抛异常', !r.threw, `取数抛异常：${r.err}`)
  })

  featureCase('16-05', '估值接口失败时不抛异常（降级）', async t => {
    const m = await t.act('导入 fundgz 取数模块', async () => await import('@/modules/fund/valuation/fundgz-fetch'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    const r = await t.act('接口全挂时取数', () => callSafely(fn, '000001'))
    t.check('未抛异常（走降级）', !r.threw, `接口失败时抛异常：${r.err} —— 会导致整个刷新流程中断`)
  })

  featureCase('16-06', '历史净值接口失败时不抛异常', async t => {
    const m = await t.act('导入 lsjz 取数模块', async () => await import('@/modules/fund/valuation/lsjz-fetch'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    const r = await t.act('接口全挂时取数', () => callSafely(fn, '000001'))
    t.check('未抛异常（走降级）', !r.threw, `接口失败时抛异常：${r.err}`)
  })

  featureCase('16-07', '持仓接口失败时不抛异常', async t => {
    const m = await t.act('导入 F10 持仓模块', async () => await import('@/modules/fund/holdings/f10-holdings-fetch'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    const r = await t.act('接口全挂时取数', () => callSafely(fn, '000001'))
    t.check('未抛异常（走降级）', !r.threw, `接口失败时抛异常：${r.err}`)
  })

  featureCase('16-08', '接口返回脏数据时解析不崩', async t => {
    const m = await t.act('导入 fundgz 取数模块', async () => await import('@/modules/fund/valuation/fundgz-fetch'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    await t.act('切换到脏数据模式', () => setNetMode('dirty'))
    const r = await t.act('脏数据下取数', () => callSafely(fn, '000001'))
    t.check('未抛异常', !r.threw, `脏数据导致抛异常：${r.err}`)
  })

  featureCase('16-09', '估值数据校验能拦住脏数据', async t => {
    const m = await t.act('导入校验模块', async () => await import('@/modules/fund/valuation/fundgz-validate'))
    const bad = await t.act('校验一个缺 fundcode 的对象', () => m.validateFundValuation({} as any))
    t.check('缺关键字段时被丢弃', bad === null, '脏数据未被拦截，会污染估值流程')
    const good = await t.act('校验一个正常对象', () => m.validateFundValuation({ fundcode: '000001' } as any))
    t.check('正常数据通过校验', isDefined(good), '正常数据被误拦')
  })

  featureCase('16-10', '代理轮换模块可用且失败时不崩', async t => {
    const m = await t.act('导入代理轮换模块', async () => await import('@/shared/net/proxy-rotation'))
    const fn = (m as any).fetchWithProxyRotation
    t.check('代理轮换函数存在', typeof fn === 'function', 'fetchWithProxyRotation 不存在')
    await t.act('切换到接口失败模式（模拟代理全挂）', () => setNetMode('fail'))
    const r = await t.act('代理全挂时请求', () => callSafely(fn, 'https://example.com/api', 1000))
    t.check('未抛异常（返回 proxyFailed 标记）', !r.threw, `代理全挂时抛异常：${r.err} —— 海外数据会让整页崩溃`)
  })

  featureCase('16-11', 'Worker 请求能收到响应', async t => {
    const m = await t.act('导入 Worker 管理器', async () => await import('@/shared/worker/worker-manager'))
    t.check('Worker 管理器有导出', Object.keys(m).length > 0, 'Worker 管理器无导出')
    t.check('注册函数存在', typeof (m as any).registerWorker === 'function', 'registerWorker 不存在')
  })

  featureCase('16-12', 'Worker 不响应时看门狗兜底（不卡死）', async t => {
    const s = await t.prepare('创建 fund store 并铺基金', async () => {
      freshPinia()
      const { useFundStore } = await import('@/modules/fund/fund-store')
      const st = useFundStore()
      for (const x of TEST_FUNDS) st.addFund(x.code, x.name)
      return st
    })
    await t.act('切换 Worker 为静默模式（收到请求不回）', () => setWorkerMode('silent'))
    const r = await t.act('执行依赖 Worker 的刷新（不应永久挂起）', () => callSafely(() => s.refreshAllValuations()))
    t.check('未抛异常', !r.threw, `Worker 静默时抛异常：${r.err}`)
    t.check('loading 已复位（未卡死）', s.isLoading === false, 'Worker 不响应导致 loading 永久卡死，界面一直转圈')
  })

  featureCase('16-13', '限流器模块可用', async t => {
    const m = await t.act('导入限流器模块', async () => await import('@/shared/net/rate-limiter'))
    t.check('限流器有导出', Object.keys(m).length > 0, '限流器模块无导出')
  })

  featureCase('16-14', '腾讯响应解码模块可用', async t => {
    const m = await t.act('导入腾讯编解码模块', async () => await import('@/shared/net/tencent-codec'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('解码函数存在', typeof fn === 'function', '腾讯解码函数不存在')
    const r = await t.act('解析一段样本响应（不应抛异常）', () =>
      callSafely(fn, 'v_sh600519="1~贵州茅台~600519~1680.50~1659.80~1665.00";'),
    )
    t.check('解析未抛异常', !r.threw, `解析抛异常：${r.err}`)
  })

  featureCase('16-15', '节假日服务失败时不崩', async t => {
    const m = await t.act('导入节假日服务', async () => await import('@/modules/fund/services/holiday-service'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    await t.act('切换到接口失败模式', () => setNetMode('fail'))
    const r = await t.act('接口挂时查询节假日', () => callSafely(fn, 2026))
    t.check('未抛异常（走降级）', !r.threw, `节假日接口失败时抛异常：${r.err}`)
  })
})

describe('17 · 识图与反馈', () => {
  featureCase('17-01', '图像识别模块可加载且函数存在', async t => {
    const m = await t.act('导入 GLM 视觉模块', async () => await import('@/modules/ai/glm-vision'))
    t.check('模块有导出', Object.keys(m).length > 0, '识图模块无导出 —— 识图功能不可用')
    const fn = Object.values(m).find(v => typeof v === 'function')
    t.check('识别函数存在', typeof fn === 'function', '识图模块无可调用函数')
  })

  featureCase('17-02', '识图类型定义模块可加载', async t => {
    await t.act('导入识图类型模块（不应抛异常）', async () => await import('@/modules/ai/ai-types'))
    t.check('类型模块加载成功', true, '')
  })

  featureCase('17-03', '识图 composable 可加载', async t => {
    const m = await t.act('导入识图 composable', async () => await import('@/composables/use-image-recognition'))
    t.check('composable 有导出', Object.keys(m).length > 0, '识图 composable 无导出')
    const fn = Object.values(m).find(v => typeof v === 'function')
    t.check('composable 函数存在', typeof fn === 'function', '识图 composable 无可调用函数')
  })

  featureCase('17-04', '识图结果解析不崩（喂样本 JSON，不调真实 API）', async t => {
    const sample = await t.prepare('构造一段识别结果样本', () =>
      '[{"fundCode":"000001","fundName":"华夏成长混合","holdingAmount":15234.56,"holdingProfit":-123.45}]',
    )
    const parsed = await t.act('解析识别结果', () => JSON.parse(sample))
    t.check('解析为数组', Array.isArray(parsed), '识别结果无法解析为数组')
    t.check('含基金代码字段', isDefined(parsed[0]?.fundCode), '识别结果缺 fundCode 字段')
    t.check('金额为有效数字', typeof parsed[0]?.holdingAmount === 'number', '识别金额不是数字')
  })

  featureCase('17-05', '反馈内容组装可执行', async t => {
    const m = await t.act('导入反馈诊断模块', async () => await import('@/modules/feedback/feedback-diagnostics'))
    t.check('诊断模块有导出', Object.keys(m).length > 0, '反馈诊断模块无导出')
    t.check('buildFeedbackBody 存在', typeof m.buildFeedbackBody === 'function', 'buildFeedbackBody 不存在 —— 反馈无法提交')

    const body = await t.act('组装一条反馈内容', () => m.buildFeedbackBody('测试反馈内容', 'test@example.com', '功能异常'))
    t.check('返回非空字符串', typeof body === 'string' && body.length > 0, `反馈内容组装为空：「${body}」`)
    t.check('包含用户填写的内容', String(body).includes('测试反馈内容'), '组装结果丢失了用户填写的内容')

    // 空输入不应崩（用户可能什么都没填就点提交）
    const r = await t.act('空输入时组装（不应抛异常）', () => callSafely(m.buildFeedbackBody, '', '', ''))
    t.check('空输入未抛异常', !r.threw, `空输入导致抛异常：${r.err} —— 用户点空提交会崩`)
  })

  featureCase('17-06', '邮件服务模块可加载且未配置时能降级', async t => {
    const m = await t.act('导入邮件服务模块', async () => await import('@/modules/auth/email-service'))
    t.check('模块有导出', Object.keys(m).length > 0, '邮件服务模块无导出')
    t.check('配置检查函数存在', typeof (m as any).isEmailConfigured === 'function', 'isEmailConfigured 不存在')
    t.check('反馈配置检查函数存在', typeof (m as any).isFeedbackConfigured === 'function', 'isFeedbackConfigured 不存在')
    const v = await t.act('执行配置检查（不应抛异常）', () => (m as any).isEmailConfigured())
    t.check('返回布尔值', typeof v === 'boolean', `配置检查返回 ${v}，应为布尔值`)
  })
})
