type Task<T> = () => Promise<T>

const inflight = new Map<string, Promise<unknown>>()

const queue: Array<() => void> = []

let active = 0

const CONCURRENCY = 1

function acquire(): Promise<void> {
  if (active < CONCURRENCY) {
    active++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    queue.push(() => { active++; resolve() })
  })
}

function release(): void {
  active--
  const next = queue.shift()
  if (next) next()
}

export function runScriptTask<T>(key: string, task: Task<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>

  const result = (async () => {
    await acquire()
    try {
      return await task()
    } finally {
      release()
      inflight.delete(key)
    }
  })()

  inflight.set(key, result)
  return result
}

export function scriptTaskStats(): { active: number; queued: number; inflight: number } {
  return { active, queued: queue.length, inflight: inflight.size }
}
