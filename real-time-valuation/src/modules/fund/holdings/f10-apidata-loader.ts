

import { F10_CONFIG } from '@/config/constants'
import { runScriptTask } from '@/shared/net/script-data-locks'

function extractCode(url: string): string {
  const m = /code=(\d{6})/.exec(url)
  return m ? m[1] : url
}

export function loadApidata(url: string, timeout: number = F10_CONFIG.TIMEOUT): Promise<any> {
  const code = extractCode(url)
  return runScriptTask(`f10:${code}`, () => loadApidataRaw(url, timeout))
}

function loadApidataRaw(url: string, timeout: number): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const w = window as any
    let resolved = false

    w.apidata = (data: any) => {
      if (resolved) return
      resolved = true
      cleanup(false)
      resolve(data)
    }

    const script = document.createElement('script')
    const timer = setTimeout(() => {
      if (resolved) return

      const maybeData = w.apidata
      if (maybeData && typeof maybeData === 'object' && !(maybeData instanceof Function)) {
        resolved = true
        cleanup(false)
        resolve(maybeData)
        return
      }

      resolved = true
      cleanup(true)
      reject(new Error(`F10 数据加载超时: ${url}`))
    }, timeout)

    function cleanup(timedOut: boolean) {
      clearTimeout(timer)

      w.apidata = timedOut ? () => {} : undefined
      if (timedOut) {
        script.onerror = null
        script.onload = null

        try { script.src = '' } catch {  }
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }

    script.src = url
    script.onload = () => {
      if (resolved) return

      const maybeData = w.apidata
      if (maybeData && typeof maybeData === 'object' && !(maybeData instanceof Function)) {
        resolved = true
        cleanup(false)
        resolve(maybeData)
      } else {
        resolved = true
        cleanup(false)
        resolve(undefined)
      }
    }
    script.onerror = () => {
      if (resolved) return
      resolved = true
      cleanup(false)
      reject(new Error(`F10 数据加载失败: ${url}`))
    }
    document.head.appendChild(script)
  })
}
