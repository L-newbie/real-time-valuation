/**
 * 25 · 数值与格式化
 *
 * safe-math / money-format / validation 三个纯函数模块。
 * 这层被全 app 的金额与涨跌幅显示依赖，一旦返回 NaN 或格式跑偏，
 * 界面上出现的就是「--」或错误的钱数，且没有任何报错线索。
 */

import { describe } from 'vitest'
import { featureCase, isFiniteNumber } from '../helpers/case'

describe('25 · 数值与格式化', () => {
  featureCase('25-01', '脏输入一律降级为 0 而非 NaN', async t => {
    const m = await t.prepare('加载 safe-math', () => import('@/shared/utils/safe-math'))
    const dirty = [null, undefined, '', 'abc', {}, [], NaN]

    for (const v of dirty) {
      const n = m.safeParseFloat(v as unknown)
      t.check(`safeParseFloat(${JSON.stringify(v) ?? String(v)}) 为 0`, n === 0, `实得 ${n}`)
    }
    t.check('乘法脏输入不产生 NaN', isFiniteNumber(m.safeMultiply('x', 3)), `实得 ${m.safeMultiply('x', 3)}`)
    t.check('加法脏输入不产生 NaN', isFiniteNumber(m.safeAdd(null, undefined)), '出现 NaN')
    t.check('减法脏输入不产生 NaN', isFiniteNumber(m.safeSubtract(undefined, 'y')), '出现 NaN')
    t.check('金额取整脏输入为 0', m.roundMoney('abc') === 0, `实得 ${m.roundMoney('abc')}`)
  })

  featureCase('25-02', '除零返回 0 而不是 Infinity', async t => {
    const m = await t.prepare('加载 safe-math', () => import('@/shared/utils/safe-math'))
    t.check('正数除以 0 得 0', m.safeDivide(100, 0) === 0, `实得 ${m.safeDivide(100, 0)}`)
    t.check('0 除以 0 得 0', m.safeDivide(0, 0) === 0, `实得 ${m.safeDivide(0, 0)}`)
    t.check('负数除以 0 得 0', m.safeDivide(-5, 0) === 0, `实得 ${m.safeDivide(-5, 0)}`)
    t.check('结果不是 Infinity', Number.isFinite(m.safeDivide(1, 0)), '出现 Infinity，界面会显示 ∞')
  })

  featureCase('25-03', '浮点累积不产生长尾误差', async t => {
    const m = await t.prepare('加载 safe-math', () => import('@/shared/utils/safe-math'))

    // 0.1 + 0.2 在 IEEE754 下是 0.30000000000000004，直接显示会露馅
    const sum = await t.act('0.1 + 0.2', () => m.safeAdd(0.1, 0.2))
    t.check('等于 0.3', sum === 0.3, `实得 ${sum}`)

    const diff = await t.act('0.3 - 0.1', () => m.safeSubtract(0.3, 0.1))
    t.check('等于 0.2', diff === 0.2, `实得 ${diff}`)

    const prod = await t.act('0.07 × 100', () => m.safeMultiply(0.07, 100))
    t.check('等于 7', prod === 7, `实得 ${prod}`)
  })

  featureCase('25-04', '金额与涨跌幅按精度收敛', async t => {
    const m = await t.prepare('加载 safe-math', () => import('@/shared/utils/safe-math'))
    t.check('金额保留两位', m.roundMoney(1.005) === 1.01 || m.roundMoney(1.005) === 1.0,
      `实得 ${m.roundMoney(1.005)}，两位小数外还有残留`)
    t.check('金额向下截断正确', m.roundMoney(12.344) === 12.34, `实得 ${m.roundMoney(12.344)}`)
    t.check('涨跌幅保留两位', m.displayRate(2.4149) === 2.41, `实得 ${m.displayRate(2.4149)}`)
    t.check('负涨跌幅同样收敛', m.displayRate(-0.8666) === -0.87, `实得 ${m.displayRate(-0.8666)}`)
  })

  featureCase('25-05', '紧凑金额按万/亿进位', async t => {
    const f = await t.prepare('加载 money-format', () => import('@/shared/utils/money-format'))
    t.check('一万显示为万', f.formatCompactMoney(10000) === '1.00万', `实得 ${f.formatCompactMoney(10000)}`)
    t.check('一亿显示为亿', f.formatCompactMoney(1e8) === '1.00亿', `实得 ${f.formatCompactMoney(1e8)}`)
    t.check('不足一万保留原值', f.formatCompactMoney(9999) === '9999.00', `实得 ${f.formatCompactMoney(9999)}`)
    t.check('负数按绝对值进位', f.formatCompactMoney(-20000) === '-2.00万', `实得 ${f.formatCompactMoney(-20000)}`)
    t.check('零不进位', f.formatCompactMoney(0) === '0.00', `实得 ${f.formatCompactMoney(0)}`)
  })

  featureCase('25-06', '盈亏与涨跌带正负号和涨跌色', async t => {
    const f = await t.prepare('加载 money-format', () => import('@/shared/utils/money-format'))

    const up = f.formatProfitWithColor(241)
    t.check('盈利带 + 号', up.text.startsWith('+'), `实得 ${up.text}`)
    t.check('盈利为涨色', up.cssClass === 'text-rise', `实得 ${up.cssClass}`)

    const down = f.formatProfitWithColor(-100)
    t.check('亏损带 - 号', down.text.startsWith('-'), `实得 ${down.text}`)
    t.check('亏损为跌色', down.cssClass === 'text-fall', `实得 ${down.cssClass}`)

    const flat = f.formatProfitWithColor(0)
    t.check('持平无符号', !flat.text.startsWith('+') && !flat.text.startsWith('-'), `实得 ${flat.text}`)
    t.check('持平为平色', flat.cssClass === 'text-flat', `实得 ${flat.cssClass}`)

    t.check('零涨跌幅显示 0.00%', f.formatRateWithColor(0).text === '0.00%', `实得 ${f.formatRateWithColor(0).text}`)
    t.check('正涨跌幅带 + 号', f.formatRateWithColor(2.41).text === '+2.41%', `实得 ${f.formatRateWithColor(2.41).text}`)
  })

  featureCase('25-07', '基金代码校验只认 6 位数字', async t => {
    const v = await t.prepare('加载 validation', () => import('@/shared/utils/validation'))
    t.check('000001 合法', v.isValidFundCode('000001'), '6 位数字被判非法')
    t.check('5 位非法', !v.isValidFundCode('00001'), '位数不足被放行')
    t.check('7 位非法', !v.isValidFundCode('0000012'), '超长被放行')
    t.check('含字母非法', !v.isValidFundCode('00000a'), '字母被放行')
    t.check('空串非法', !v.isValidFundCode(''), '空串被放行')
  })

  featureCase('25-08', '价格与占比校验拒绝越界值', async t => {
    const v = await t.prepare('加载 validation', () => import('@/shared/utils/validation'))
    t.check('正价格合法', v.isValidPrice(1.234), '正价格被判非法')
    t.check('零价格非法', !v.isValidPrice(0), '零价格被放行，会导致除零')
    t.check('负价格非法', !v.isValidPrice(-1), '负价格被放行')
    t.check('NaN 非法', !v.isValidPrice('abc'), '脏值被放行')

    t.check('占比 0 合法', v.isValidRatio(0), '0 被判非法')
    t.check('占比 100 合法', v.isValidRatio(100), '100 被判非法')
    t.check('占比 101 非法', !v.isValidRatio(101), '超过 100 被放行')
    t.check('占比负数非法', !v.isValidRatio(-1), '负占比被放行')

    t.check('负涨跌幅合法', v.isValidRate(-5), '负涨跌幅被判非法')
    t.check('NaN 涨跌幅非法', !v.isValidRate('x'), '脏值被放行')
  })

  featureCase('25-09', '生成的 ID 唯一', async t => {
    const v = await t.prepare('加载 validation', () => import('@/shared/utils/validation'))
    const ids = await t.act('连续生成 500 个 ID', () =>
      Array.from({ length: 500 }, () => v.generateId()))
    t.check('无重复', new Set(ids).size === ids.length,
      `500 个 ID 里只有 ${new Set(ids).size} 个唯一，持仓记录会互相覆盖`)
    t.check('均非空', ids.every(x => !!x), '出现空 ID')
  })
})
