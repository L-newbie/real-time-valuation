/**
 * Worker 桩 - happy-dom 无真实 Worker，且 Vite 的 new URL(import.meta.url) 形式在测试环境无法解析
 *
 * 策略：提供一个假 Worker 类，postMessage 后按 worker-protocol 的请求格式，
 * 同线程构造一个成功响应回给 onmessage。
 * 目的只是让"走 Worker 的取数链路"能跑通，不验证真实并发行为。
 *
 * 额外支持故障模式：模拟 Worker 不响应（验证看门狗超时兜底不卡死）。
 */

let workerMode: 'ok' | 'silent' | 'error' = 'ok'

export function setWorkerMode(m: 'ok' | 'silent' | 'error'): void {
  workerMode = m
}
export function resetWorker(): void {
  workerMode = 'ok'
}

/** 记录所有 Worker 收到的消息，供用例断言 */
export const workerMessageLog: any[] = []

class FakeWorker implements Partial<Worker> {
  onmessage: ((ev: MessageEvent) => any) | null = null
  onerror: ((ev: any) => any) | null = null
  onmessageerror: ((ev: MessageEvent) => any) | null = null
  private listeners: Record<string, Function[]> = {}

  constructor(public url?: any, public opts?: any) {}

  postMessage(msg: any): void {
    workerMessageLog.push(msg)
    if (workerMode === 'silent') return // 不回，触发看门狗超时

    setTimeout(() => {
      if (workerMode === 'error') {
        const ev = new Event('error')
        this.onerror?.(ev)
        this.dispatch('error', ev)
        return
      }
      // worker-protocol: 请求 {id, type, payload} → 响应 {id, ok, data}
      const resp = { id: msg?.id, ok: true, data: buildWorkerResult(msg) }
      const ev = { data: resp } as MessageEvent
      this.onmessage?.(ev)
      this.dispatch('message', ev)
    }, 0)
  }

  terminate(): void {}

  addEventListener(type: string, fn: any): void {
    ;(this.listeners[type] ||= []).push(fn)
  }
  removeEventListener(type: string, fn: any): void {
    this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn)
  }
  private dispatch(type: string, ev: any): void {
    for (const fn of this.listeners[type] || []) fn(ev)
  }
}

/** 按请求类型造一个结构合理的空结果，让上层解析代码能跑完 */
function buildWorkerResult(msg: any): any {
  const type = String(msg?.type ?? '')
  if (type.includes('close') || type.includes('kline')) return { quotes: {}, list: [] }
  if (type.includes('realtime')) return { quotes: {}, list: [] }
  if (type.includes('yahoo')) return { quotes: {}, list: [] }
  if (type.includes('index')) return { list: [] }
  return {}
}

export function installWorkerStub(): void {
  // @ts-expect-error 覆盖全局 Worker
  globalThis.Worker = FakeWorker
}
