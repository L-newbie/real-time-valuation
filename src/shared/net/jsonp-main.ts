

import { withBudget } from '@/shared/net/net-budget'

let jsonpCounter = 0

export function jsonpRequest<T>(url: string, callbackName: string = 'jsonpgz', timeout: number = 6000): Promise<T> {
  return withBudget(url, () => jsonpRaw<T>(url, callbackName, timeout))
}

function jsonpRaw<T>(url: string, callbackName: string, timeout: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const w = window as any
    let resolved = false
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; cleanup(); reject(new Error(`JSONP 请求超时: ${url}`)) }
    }, timeout)

    w[callbackName] = (data: T) => {
      if (resolved) return
      resolved = true
      cleanup()
      resolve(data)
    }

    function cleanup() {
      clearTimeout(timer)

      w[callbackName] = () => {}
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }

    script.src = url
    script.onerror = () => {
      if (resolved) return
      resolved = true
      cleanup()
      reject(new Error(`JSONP 请求失败: ${url}`))
    }
    document.body.appendChild(script)
  })
}

export function loadScriptVar<T>(url: string, varName: string, timeout: number = 4000, charset?: string): Promise<T | null> {
  return new Promise((resolve) => {
    const w = window as any
    delete w[varName]

    const script = document.createElement('script')
    let resolved = false

    const timer = setTimeout(() => {
      if (resolved) return
      resolved = true
      if (script.parentNode) script.parentNode.removeChild(script)
      resolve(null)
    }, timeout)

    script.onload = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      const value = w[varName]
      if (script.parentNode) script.parentNode.removeChild(script)
      resolve(value as T | null)
    }

    script.onerror = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      if (script.parentNode) script.parentNode.removeChild(script)
      resolve(null)
    }

    if (charset) script.charset = charset
    script.src = url
    document.body.appendChild(script)
  })
}

export function genCallbackName(prefix: string = 'jsonpgz'): string {
  return `${prefix}_${Date.now()}_${(++jsonpCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}
