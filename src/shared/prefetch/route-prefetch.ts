

function onIdle(fn: () => void): void {
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  }).requestIdleCallback
  if (typeof ric === 'function') ric(fn, { timeout: 3000 })
  else setTimeout(fn, 300)
}

function shouldSkip(): boolean {
  const conn = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  if (!conn) return false
  if (conn.saveData) return true
  return conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g'
}

const ROUTES: Array<() => Promise<unknown>> = [
  () => import('@/views/stock-news-hub.vue'),
  () => import('@/views/mine.vue'),
  () => import('@/views/fund-detail.vue'),
]

let started = false

export function startRoutePrefetch(): void {
  if (started || shouldSkip()) return
  started = true

  let i = 0
  const next = (): void => {
    if (i >= ROUTES.length) return
    const load = ROUTES[i++]!

    load().catch(() => {  }).then(() => onIdle(next))
  }
  onIdle(next)
}
