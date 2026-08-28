

import { NUMBER_FORMAT } from '@/config/constants'

export function formatMoney(value: number): string {
  return value.toFixed(NUMBER_FORMAT.MONEY_DECIMALS)
}

export function formatChangeRate(value: number): string {
  if (value === 0) return '0.00%'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(NUMBER_FORMAT.RATE_DECIMALS)}%`
}

export function formatNetValue(value: number): string {
  return value.toFixed(NUMBER_FORMAT.NET_VALUE_DECIMALS)
}

export function formatProfitWithColor(value: number): { text: string; cssClass: string } {
  if (value > 0) return { text: `+${formatMoney(value)}`, cssClass: 'text-rise' }
  if (value < 0) return { text: formatMoney(value), cssClass: 'text-fall' }
  return { text: formatMoney(0), cssClass: 'text-flat' }
}

export function formatRateWithColor(value: number): { text: string; cssClass: string } {
  if (value > 0) return { text: formatChangeRate(value), cssClass: 'text-rise' }
  if (value < 0) return { text: formatChangeRate(value), cssClass: 'text-fall' }
  return { text: '0.00%', cssClass: 'text-flat' }
}

export function formatCompactMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(value / 1e4).toFixed(2)}万`
  return formatMoney(value)
}

export function formatProfitCompact(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatCompactMoney(value)}`
}

export function formatTurnover(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(value / 1e4).toFixed(2)}万`
  return formatMoney(value)
}
