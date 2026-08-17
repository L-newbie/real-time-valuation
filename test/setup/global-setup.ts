/**
 * 全局 setup - 装配所有环境替身
 *
 * 每个测试文件加载前执行一次；每条用例前自动复位，保证用例互相独立。
 */

import { beforeEach, afterEach, vi } from 'vitest'
import { installMemoryStorage, resetStorage } from './memory-storage'
import { installFakeClock, resetClock } from './fake-clock'
import { installNetStub, resetNet } from './net-stub'
import { installWorkerStub, resetWorker } from './worker-stub'
import { installMediaStub, resetBreakpoint, installCanvasStub, resetChartCalls } from './media-stub'

// 1) 存储：必须在任何 store 导入前装好
installMemoryStorage()

// 2) 时钟：冻结到 2026-08-07（周五）14:30 北京时间，A股盘中
installFakeClock()

// 3) 网络：拦截 fetch 与 JSONP，绝不真联网
installNetStub()

// 4) Worker：同线程假实现
installWorkerStub()

// 5) matchMedia + Canvas
installMediaStub()
installCanvasStub()

// happy-dom 缺失的零散 API 补齐
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((cb: any) => globalThis.setTimeout(() => cb(Date.now()), 16)) as any
  globalThis.cancelAnimationFrame = ((id: any) => globalThis.clearTimeout(id)) as any
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
}
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as any
}
if (typeof globalThis.scrollTo === 'undefined') {
  globalThis.scrollTo = (() => {}) as any
}
if (typeof (globalThis as any).FileReader === 'undefined') {
  ;(globalThis as any).FileReader = class {
    result: any = 'data:image/png;base64,AAAA'
    onload: any = null
    onerror: any = null
    readAsDataURL() {
      globalThis.setTimeout(() => this.onload?.({ target: this }), 0)
    }
    readAsText() {
      globalThis.setTimeout(() => this.onload?.({ target: this }), 0)
    }
  }
}
if (typeof (globalThis as any).URL.createObjectURL === 'undefined') {
  ;(globalThis as any).URL.createObjectURL = () => 'blob:stub'
  ;(globalThis as any).URL.revokeObjectURL = () => {}
}

// 屏蔽业务代码的 console 噪音，让报告干净（保留 error 供排查）
const noop = () => {}
globalThis.console.log = noop as any
globalThis.console.info = noop as any
globalThis.console.warn = noop as any
globalThis.console.debug = noop as any

beforeEach(() => {
  resetStorage()
  resetClock()
  resetNet()
  resetWorker()
  resetBreakpoint()
  resetChartCalls()
})

afterEach(() => {
  vi.restoreAllMocks()
  // 清掉 JSONP 遗留的全局回调，避免用例间串扰
  const w = globalThis as any
  for (const k of Object.keys(w)) {
    if (/^jsonp|^apidata$|^Data_|^fS_|^stockCodes$/.test(k)) {
      try {
        delete w[k]
      } catch {
        /* 忽略不可删属性 */
      }
    }
  }
})
