

type Task<T> = () => Promise<T>

const inflight = new Map<string, Promise<unknown>>()

let chain: Promise<void> = Promise.resolve()

export function runScriptTask<T>(key: string, task: Task<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>

  const result = chain.then(async () => {
    try {
      return await task()
    } finally {
      inflight.delete(key)
    }
  })

  inflight.set(key, result)

  chain = result.then(() => undefined, () => undefined)
  return result as Promise<T>
}
