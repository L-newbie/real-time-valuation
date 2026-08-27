

import { searchFunds } from './fund-search'
import type { SearchResult } from '@/modules/fund/fund-types'

const OVERLAP_MIN = 0.5

export function extractShare(name: string): string {
  if (!name) return ''
  const s = String(name).replace(/\s+/g, '').replace(/[\(（][^)）]*[\)）]/g, '')
  let m = s.match(/([A-E])份额?$/); if (m) return m[1]
  m = s.match(/([A-Za-z])类$/); if (m) return m[1].toUpperCase()
  m = s.match(/([A-Z])$/); if (m) return m[1]
  return ''
}

function bracketTags(name: string): string[] {
  const tags: string[] = []
  const re = /[\(（]([^)）]+)[\)）]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(String(name)))) {
    if (!/^(QDII|FOF|LOF|ETF|联接)$/.test(m[1])) tags.push(m[1])
  }
  return tags
}

export function searchKeyword(name: string): string {
  return String(name)
    .replace(/\s+/g, '')
    .replace(/[\(（][^)）]*[\)）]/g, '')
    .replace(/[人民币美元港元欧元日元]/g, '')
}

function overlapScore(modelName: string, candName: string): number {
  const m = String(modelName).replace(/\s+/g, '')
  const c = String(candName).replace(/\s+/g, '')
  if (m === c) return 1
  if (c.includes(m) || m.includes(c)) return 0.95
  let best = 0
  for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < c.length; j++) {
      let k = 0
      while (i + k < m.length && j + k < c.length && m[i + k] === c[j + k]) k++
      if (k > best) best = k
    }
  }
  return best / Math.max(m.length, c.length)
}

export interface FundMatchResult {
  fundCode: string

  matchedName: string

  score: number

  method: string
}

export async function matchFundByCatalogName(fundName: string): Promise<FundMatchResult | null> {
  if (!fundName) return null

  const keyword = searchKeyword(fundName)
  const results = await searchFunds(keyword || fundName)
  if (!results.length) return null

  const share = extractShare(fundName)
  const modelTags = bracketTags(fundName)
  const hasAllTags = (name: string): boolean => modelTags.every(t => name.includes(t))

  const scored = results.map((r: SearchResult) => {
    const shareMatch = share !== '' && extractShare(r.fundName) === share
    const tagMatch = modelTags.length > 0 && hasAllTags(r.fundName)
    const ov = overlapScore(fundName, r.fundName)
    return { r, shareMatch, tagMatch, ov }
  })
  scored.sort((a, b) => {
    if (a.shareMatch !== b.shareMatch) return a.shareMatch ? -1 : 1
    if (a.tagMatch !== b.tagMatch) return a.tagMatch ? -1 : 1
    return b.ov - a.ov
  })

  const best = scored[0]
  let score: number
  let method: string
  if (best.shareMatch && best.tagMatch) { score = 1; method = 'share-tag' }
  else if (best.shareMatch) { score = 0.95; method = 'share' }
  else { score = best.ov; method = 'overlap' }

  if (method === 'overlap' && best.ov < OVERLAP_MIN) return null

  return {
    fundCode: best.r.fundCode,
    matchedName: best.r.fundName,
    score: Math.round(score * 100) / 100,
    method,
  }
}

