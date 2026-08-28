

declare const __APP_VERSION__: string

const POLL_INTERVAL_MS = 10 * 60 * 1000

let reloadTriggered = false

function versionJsonUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}version.json`
}

async function fetchRemoteVersion(): Promise<string> {
  const url = `${versionJsonUrl()}?v=${Date.now()}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const resp = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!resp.ok) return ''
    const json = (await resp.json()) as { version?: string }
    return String(json?.version || '')
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

async function checkVersion(): Promise<void> {
  if (reloadTriggered) return
  const remote = await fetchRemoteVersion()
  if (!remote) return
  const current = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
  if (current && remote !== current) {
    reloadTriggered = true
    reloadBypassCache()
  }
}

function reloadBypassCache(): void {
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('_v', String(Date.now()))
    u.hash = ''
    window.location.replace(u.toString())
    return
  } catch {  }

  try {
    const { origin, pathname } = window.location
    window.location.replace(`${origin}${pathname}?_v=${Date.now()}`)
    return
  } catch {  }
  window.location.reload()
}

export function startVersionChecker(): void {
  setTimeout(checkVersion, 3000)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkVersion()
    }
  })

  setInterval(checkVersion, POLL_INTERVAL_MS)
}
