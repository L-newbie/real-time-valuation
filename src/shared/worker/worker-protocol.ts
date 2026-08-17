

export interface WorkerRequest<P = unknown> {
  id: number

  type: string

  payload: P

  timeoutMs?: number
}

export interface WorkerResponse<D = unknown> {
  id: number

  ok: boolean

  data?: D

  err?: string

  proxyFailed?: boolean
}

export type WorkerIncomingMessage = WorkerRequest

let reqIdCounter = 0

export function nextRequestId(): number {
  return ++reqIdCounter
}
