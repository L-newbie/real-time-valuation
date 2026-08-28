

export async function runBatched<T>(
  items: T[],
  batchSize: number,
  gapMs: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map((item) => fn(item).catch(() => {  })))
    if (i + batchSize < items.length) await new Promise((r) => setTimeout(r, gapMs))
  }
}

export async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  let index = 0
  const size = Math.min(concurrency, items.length)
  const workers = Array.from({ length: size }, async () => {
    while (index < items.length) {
      const i = index++
      try {
        await fn(items[i])
      } catch {  }
    }
  })
  await Promise.all(workers)
}
