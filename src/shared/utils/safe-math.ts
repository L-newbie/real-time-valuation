

const PRECISION = 1000000

export function safeParseFloat(value: unknown): number {
  if (value === null || value === undefined) return 0
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  return isNaN(num) ? 0 : num
}

export function safeMultiply(a: unknown, b: unknown): number {
  const numA = safeParseFloat(a)
  const numB = safeParseFloat(b)
  return Math.round(numA * PRECISION * numB) / PRECISION
}

export function safeDivide(a: unknown, b: unknown): number {
  const numA = safeParseFloat(a)
  const numB = safeParseFloat(b)
  if (numB === 0) return 0
  return Math.round((numA * PRECISION) / numB) / PRECISION
}

export function safeAdd(a: unknown, b: unknown): number {
  const numA = safeParseFloat(a)
  const numB = safeParseFloat(b)
  return Math.round((numA + numB) * PRECISION) / PRECISION
}

export function safeSubtract(a: unknown, b: unknown): number {
  const numA = safeParseFloat(a)
  const numB = safeParseFloat(b)
  return Math.round((numA - numB) * PRECISION) / PRECISION
}

export function roundMoney(value: unknown): number {
  return Math.round(safeParseFloat(value) * 100) / 100
}

export function displayRate(gszzl: number): number {
  return Math.round(gszzl * 100) / 100
}
