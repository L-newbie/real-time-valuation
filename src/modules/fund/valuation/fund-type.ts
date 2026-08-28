

const T2_EXACT_TYPES = new Set<string>([
  'QDII-纯债',
  'QDII-混合偏股',
  'QDII-混合债',
  'QDII-混合灵活',
  'QDII-商品',
  'QDII-混合平衡',
  'QDII-REITs',
  'QDII-FOF',
  "QDII-普通股票",
  'FOF-稳健型',
  'FOF-进取型',
  'FOF-均衡型',
  '商品',
])

export function isT2FundType(fundType: string): boolean {
  if (!fundType) return false
  return T2_EXACT_TYPES.has(fundType.trim())
}

export function detectDelayDays(fundType: string): 1 | 2 {
  return isT2FundType(fundType) ? 2 : 1
}

export type FundConfirmType = 'sameDay' | 'nextDay'

export function getConfirmType(delayDays: 1 | 2 | undefined | null): FundConfirmType {
  return delayDays === 2 ? 'nextDay' : 'sameDay'
}

export function confirmTypeLabel(t: FundConfirmType): string {
  return t === 'nextDay' ? '次日确认' : '当日确认'
}

export function confirmTypeDesc(t: FundConfirmType): string {
  return t === 'nextDay'
    ? '次日确认：今日更新昨日净值'
    : '当日确认：今日更新今日净值'
}
