type Listener = (visible: boolean) => void

const listeners = new Set<Listener>()
let bound = false

export function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

function onChange(): void {
  const v = isPageVisible()
  for (const fn of listeners) {
    try { fn(v) } catch {  }
  }
}

export function onVisibilityChange(fn: Listener): () => void {
  if (typeof document !== 'undefined' && !bound) {
    bound = true
    document.addEventListener('visibilitychange', onChange)
  }
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function waitUntilVisible(): Promise<void> {
  if (isPageVisible()) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const off = onVisibilityChange((visible) => {
      if (!visible) return
      off()
      resolve()
    })
  })
}
