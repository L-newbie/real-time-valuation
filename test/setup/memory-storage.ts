/**
 * 内存版 Storage - 替代浏览器 localStorage / sessionStorage
 *
 * 项目所有持久化都经 src/shared/cache/local-storage-io.ts 收口，
 * 故此处注入一次即对全部 store 生效，无需逐个 mock。
 *
 * 额外提供"故障模式"：模拟隐私模式/配额超限，用于验证 app 在写入失败时不崩。
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  /** 故障模式：true 时所有写入抛错（模拟隐私模式/配额满） */
  public failMode = false

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    if (this.failMode) throw new DOMException('storage unavailable')
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }

  removeItem(key: string): void {
    if (this.failMode) throw new DOMException('storage unavailable')
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    if (this.failMode) throw new DOMException('QuotaExceededError')
    this.map.set(key, String(value))
  }
}

export const memoryLocalStorage = new MemoryStorage()
export const memorySessionStorage = new MemoryStorage()

/** 注入到全局，覆盖 happy-dom 自带实现 */
export function installMemoryStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryLocalStorage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: memorySessionStorage,
    writable: true,
    configurable: true,
  })
}

/** 清空存储（每条用例前调用，保证用例独立） */
export function resetStorage(): void {
  memoryLocalStorage.failMode = false
  memorySessionStorage.failMode = false
  memoryLocalStorage.clear()
  memorySessionStorage.clear()
}

/** 开启/关闭存储故障模式 */
export function setStorageFailMode(on: boolean): void {
  memoryLocalStorage.failMode = on
  memorySessionStorage.failMode = on
}
