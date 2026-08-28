import { defineCache } from '@/shared/cache/define-cache'

export interface SectorRow {
  code: string
  name: string
  rate: number
  turnover: number
  inflow: number
}

export interface SectorSnapshot {
  rows: SectorRow[]
  at: number
  day: string
}

export const sectorCache = defineCache<SectorSnapshot>({
  pool: 'board',
  name: 'sector-rank',
  ttl: 24 * 60 * 60 * 1000,
  max: 12,
  isEmpty: (v) => !v?.rows?.length,
})
