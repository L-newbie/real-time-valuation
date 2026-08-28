

import type { StockMarket } from '@/shared/types/common-types'

export const EM_MARKET_MAP: Record<string, StockMarket> = {
  '1': 'A', '0': 'A',
  '116': 'HK',
  '105': 'US', '106': 'US',
  '124': 'JP', '130': 'KR', '118': 'TW',
  '155': 'DE', '156': 'FR', '157': 'UK',
}

export const MARKET_SECID_PREFIX: Record<string, string> = {
  '1': '1', '0': '0',
  '116': '116',
  '105': '105', '106': '106',
}

export const EM_TO_YAHOO_SUFFIX: Record<string, string> = {
  '1': '.SS',
  '0': '.SZ',
  '116': '.HK',
  '105': '', '106': '',
  '124': '.T',
  '130': '.KS',
  '118': '.TW',
  '155': '.DE',
  '156': '.PA',
  '157': '.L',
}

export const EM_MARKET_LABEL: Record<string, string> = {
  '1': '沪', '0': '深', '116': '港', '105': '美', '106': '美',
  '124': '日', '130': '韩', '118': '台',
  '155': '德', '156': '法', '157': '英',
  '173': '巴', '174': '印', '175': '新', '177': '澳',
}
