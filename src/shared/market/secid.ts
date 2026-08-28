

import { MARKET_SECID_PREFIX } from './em-market-map'

export function secidFor(code: string, emMarketCode?: string): string | null {
  if (emMarketCode && MARKET_SECID_PREFIX[emMarketCode] != null) {
    const prefix = MARKET_SECID_PREFIX[emMarketCode]
    const c = emMarketCode === '116' ? code.padStart(5, '0')
      : emMarketCode === '105' || emMarketCode === '106' ? code.toUpperCase()
      : code
    return `${prefix}.${c}`
  }

  if (/^(60|30|68|8|4)\d{4,5}$/.test(code) || /^\d{6}$/.test(code)) {
    return parseInt(code) >= 600000 ? `1.${code}` : `0.${code}`
  }

  if (/^[A-Za-z]{1,6}$/.test(code)) {
    return `105.${code.toUpperCase()}`
  }
  if (/^\d{4,5}$/.test(code)) {
    return `116.${code.padStart(5, '0')}`
  }
  return null
}
