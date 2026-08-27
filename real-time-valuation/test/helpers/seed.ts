/**
 * 测试数据装载 - 统一构造测试用的基金/持仓/自选/资讯数据
 *
 * 用例用它快速铺出"有数据态"，避免每条用例重复造数据。
 */

import { setActivePinia, createPinia } from 'pinia'

/** 重建 Pinia，保证用例之间 store 状态互不影响 */
export function freshPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

/** 测试用基金代码 */
export const TEST_FUNDS = [
  { code: '000001', name: '华夏成长混合' },
  { code: '000002', name: '华夏成长混合2' },
  { code: '110022', name: '易方达消费行业' },
]

/** 测试用股票 */
export const TEST_STOCKS = [
  { code: '600519', name: '贵州茅台' },
  { code: '000858', name: '五粮液' },
]

/** 构造一条估值数据 */
export function makeValuation(code = '000001', over: Record<string, any> = {}) {
  return {
    fundcode: code,
    name: `基金(${code})`,
    gztime: '2026-08-07 14:30',
    gz: 1.245,
    dwjz: 1.234,
    gszzl: 0.89,
    jzrq: '2026-08-06',
    isEstimated: true,
    delayDays: 1 as 1 | 2,
    ...over,
  }
}

/** 构造持仓明细项 */
export function makeHoldingDetail(stockCode = '600519', ratio = 8.5) {
  return { stockCode, stockName: '测试股', ratio }
}

/** 构造股票行情 */
export function makeQuote(code = '600519', changeRate = 1.25) {
  return { code, name: '测试股', price: 100, changeRate, market: 'A' as const }
}

/**
 * 给 fund store 铺基础数据：3 只自选基金 + 名称 + 估值
 */
export async function seedFunds(fundStore: any): Promise<void> {
  for (const f of TEST_FUNDS) {
    fundStore.addFund(f.code, f.name)
    fundStore.setFundName(f.code, f.name)
  }
  for (const f of TEST_FUNDS) {
    fundStore.valuationMap.set?.(f.code, makeValuation(f.code))
  }
}

/**
 * 给 holding store 铺持仓：每只基金一笔
 */
export function seedHoldings(holdingStore: any): void {
  for (const f of TEST_FUNDS) {
    holdingStore.addHoldingByAmount(f.code, 10000, 1.234, '测试持仓', '2026-08-06')
  }
}

/** 给自选股 store 铺数据 */
export function seedStocks(stockStore: any): void {
  for (const s of TEST_STOCKS) {
    stockStore.addToWatchlist?.({ code: s.code, name: s.name, market: 'A', secid: `1.${s.code}` })
  }
}
