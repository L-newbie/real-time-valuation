

import type { WorkerRequest, WorkerResponse } from './worker-protocol'
import { nextRequestId } from './worker-protocol'

interface PendingRequest {
  resolve: (data: any) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface WorkerSlot {
  worker: Worker | null

  pending: Map<number, PendingRequest>

  failStreak: number

  broken: boolean

  factory: (() => Worker) | null
}

const slots = new Map<string, WorkerSlot>()

export function registerWorker(name: string, factory: () => Worker): void {
  let slot = slots.get(name)
  if (!slot) {
    slot = { worker: null, pending: new Map(), failStreak: 0, broken: false, factory: null }
    slots.set(name, slot)
  }
  slot.factory = factory
}

function getSlot(name: string): WorkerSlot {
  let slot = slots.get(name)
  if (!slot) {
    slot = { worker: null, pending: new Map(), failStreak: 0, broken: false, factory: null }
    slots.set(name, slot)
  }
  return slot
}

function createWorker(name: string, slot: WorkerSlot): Worker | null {
  if (!slot.factory) {
    slot.broken = true
    return null
  }
  try {
    const worker = slot.factory()
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      handleResponse(name, e.data)
    }
    worker.onerror = () => {
      slot.broken = true
      slot.worker = null
      for (const [, p] of slot.pending) {
        clearTimeout(p.timer)
        p.reject(new Error(`Worker ${name} 崩溃`))
      }
      slot.pending.clear()
    }
    slot.broken = false
    return worker
  } catch {
    slot.broken = true
    return null
  }
}

function handleResponse(name: string, resp: WorkerResponse): void {
  const slot = slots.get(name)
  if (!slot) return
  const pending = slot.pending.get(resp.id)
  if (!pending) return
  clearTimeout(pending.timer)
  slot.pending.delete(resp.id)
  if (resp.ok) {
    pending.resolve(resp.data)
    slot.failStreak = 0
  } else {
    pending.reject(new Error(resp.err || `Worker ${name} 请求失败`))
    slot.failStreak++
    if (slot.failStreak >= 5) rebuildWorker(name)
  }
}

function rebuildWorker(name: string): void {
  const slot = slots.get(name)
  if (!slot) return
  if (slot.worker) {
    slot.worker.terminate()
    slot.worker = null
  }
  for (const [, p] of slot.pending) {
    clearTimeout(p.timer)
    p.reject(new Error(`Worker ${name} 重建`))
  }
  slot.pending.clear()
  slot.failStreak = 0
  slot.broken = false
}

export function request<P = unknown, D = unknown>(
  name: string,
  type: string,
  payload: P,
  timeoutMs: number = 8000,
): Promise<D> {
  const slot = getSlot(name)

  if (!slot.worker && !slot.broken) {
    slot.worker = createWorker(name, slot)
  }
  if (!slot.worker || slot.broken) {
    return Promise.reject(new Error(`Worker ${name} 不可用`))
  }

  const id = nextRequestId()
  const req: WorkerRequest<P> = { id, type, payload, timeoutMs }
  const worker = slot.worker

  return new Promise<D>((resolve, reject) => {
    const timer = setTimeout(() => {
      slot.pending.delete(id)
      slot.failStreak++
      reject(new Error(`Worker ${name} 请求超时 (${type})`))
      if (slot.failStreak >= 5) rebuildWorker(name)
    }, timeoutMs)

    slot.pending.set(id, { resolve: resolve as (d: any) => void, reject, timer })
    worker.postMessage(req)
  })
}

export function rebuildAllWorkers(): void {
  for (const name of slots.keys()) {
    rebuildWorker(name)
  }
}

export function terminateAllWorkers(): void {
  for (const [, slot] of slots) {
    if (slot.worker) {
      slot.worker.terminate()
      slot.worker = null
    }
    for (const [, p] of slot.pending) {
      clearTimeout(p.timer)
      p.reject(new Error(`Worker 终止`))
    }
    slot.pending.clear()
  }
}

export const workerManager = {
  registerWorker,
  request,
  rebuildAllWorkers,
  terminateAllWorkers,
}
