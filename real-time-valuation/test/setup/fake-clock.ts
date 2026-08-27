/**
 * 固定时钟 - 让时间相关代码有确定输入
 *
 * 项目 34 个文件用 Date.now()/new Date()，若跑测试时正好是周末/节假日/凌晨，
 * 交易日判定、跨日清理、T+N 确认等结果都会变，导致测试时好时坏。
 * 故统一冻结到一个"工作日盘中"时刻。
 *
 * 默认基准：2026-08-07（周五）14:30 北京时间 = 06:30 UTC，A股盘中。
 */

/** 默认基准时刻（UTC 毫秒） */
export const BASE_TIME_MS = Date.UTC(2026, 7, 7, 6, 30, 0)

const RealDate = Date
let currentNow = BASE_TIME_MS

/** 安装伪时钟：Date.now() 与 new Date() 都返回受控时间 */
export function installFakeClock(): void {
  class FakeDate extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(currentNow)
      } else {
        // @ts-expect-error 透传原始构造参数
        super(...args)
      }
    }
    static now(): number {
      return currentNow
    }
  }
  // @ts-expect-error 覆盖全局 Date
  globalThis.Date = FakeDate
}

/** 设置当前时间（用例内穿越用） */
export function setNow(ms: number): void {
  currentNow = ms
}

/** 按北京时间设置：setNowBeijing(2026, 8, 7, 14, 30) */
export function setNowBeijing(y: number, m: number, d: number, hh = 9, mm = 30): void {
  currentNow = Date.UTC(y, m - 1, d, hh - 8, mm, 0)
}

/** 时间前进 n 毫秒 */
export function advanceTime(ms: number): void {
  currentNow += ms
}

/** 前进 n 天（用于跨日/漏日回放测试） */
export function advanceDays(days: number): void {
  currentNow += days * 24 * 60 * 60 * 1000
}

/** 复位到基准时刻 */
export function resetClock(): void {
  currentNow = BASE_TIME_MS
}
