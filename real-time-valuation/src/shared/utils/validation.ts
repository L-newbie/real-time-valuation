

export function isValidFundCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

export function isValidStockCode(code: string): boolean {
  if (!code) return false
  return /^\d{4,6}$/.test(code) || /^[A-Za-z]{1,6}$/.test(code)
}

export function isValidPrice(value: unknown): boolean {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) && n > 0
}

export function isValidRate(value: unknown): boolean {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n)
}

export function isValidRatio(value: unknown): boolean {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) && n >= 0 && n <= 100
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}
