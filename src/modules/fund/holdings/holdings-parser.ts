

import type { HoldingDetailItem } from '@/modules/fund/fund-types'

export function extractHoldingsReportDate(html: string): string | null {
  if (!html) return null

  const m1 = html.match(/(报告期|截止日期|截止至)[\s\S]{0,40}?(\d{4}-\d{2}-\d{2})/)
  if (m1) return m1[2]
  const m2 = html.match(/(\d{4}-\d{2}-\d{2})/)
  return m2 ? m2[1] : null
}

export interface ReportBlock {
  html: string

  reportDate: string

  title: string
}

export function extractLatestReportBlock(content: string): ReportBlock | null {
  if (!content || content.includes('暂无数据')) return null

  const blocks: { html: string; date: string; title: string }[] = []

  const parts = content.split(/<h4[^>]*class=['"]t['"]/i)
  for (let i = 1; i < parts.length; i++) {
    const blockHtml = parts[i]
    const dateM = blockHtml.match(/截止至[\s\S]{0,80}?(\d{4}-\d{2}-\d{2})/)
    const date = dateM ? dateM[1] : ''
    const titleM = blockHtml.match(/(\d{4}年[一二三四1234]季度股票投资明细)/)
    const title = titleM ? titleM[1] : ''
    const tableMatch = blockHtml.match(/<table[\s\S]*?<\/table>/i)
    const tableHtml = tableMatch ? tableMatch[0] : ''
    if (tableHtml) blocks.push({ html: tableHtml, date, title })
  }
  if (blocks.length === 0) {
    const tableMatch = content.match(/<table[\s\S]*?<\/table>/i)
    if (tableMatch) return { html: tableMatch[0], reportDate: extractHoldingsReportDate(content) ?? '', title: '' }
    return null
  }
  blocks.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date)
    if (a.date) return -1
    if (b.date) return 1
    return 0
  })
  const latest = blocks[0]
  return { html: latest.html, reportDate: latest.date || extractHoldingsReportDate(latest.html) || '', title: latest.title }
}

export function parseHoldingsHtml(content: string): HoldingDetailItem[] {
  if (!content || content.includes('暂无数据')) return []

  const headerRow = (content.match(/<thead[\s\S]*?<tr[\s\S]*?<\/tr>[\s\S]*?<\/thead>/i) || [])[0] || ''
  const headerCells = (headerRow.match(/<th[\s\S]*?>([\s\S]*?)<\/th>/gi) || []).map(th => th.replace(/<[^>]+>/g, '').trim())
  let idxCode = -1, idxName = -1, idxWeight = -1
  headerCells.forEach((h, i) => {
    const t = h.replace(/\s+/g, '')
    if (idxCode < 0 && (t.includes('股票代码') || t.includes('证券代码') || t.includes('基金代码'))) idxCode = i
    if (idxName < 0 && (t.includes('股票名称') || t.includes('证券名称') || t.includes('基金名称'))) idxName = i
    if (idxWeight < 0 && (t.includes('占净值比例') || t.includes('占比'))) idxWeight = i
  })

  const tbodyMatch = content.match(/<tbody[\s\S]*?<\/tbody>/i)
  const dataRows = tbodyMatch
    ? (tbodyMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) || [])
    : (content.match(/<tr[\s\S]*?<\/tr>/gi) || [])

  const getText = (td: string) => td.replace(/<[^>]+>/g, '').trim()
  const getEmMarket = (td: string): string | undefined => {
    const m = td.match(/quote\.eastmoney\.com\/unify\/r\/(\d+)\./)
    return m ? m[1] : undefined
  }
  const results: HoldingDetailItem[] = []

  for (const row of dataRows) {
    const rawTds = (row.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi) || [])
    const tds = rawTds.map(td => getText(td))
    if (!tds.length) continue

    let stockCode = ''
    let stockName = ''
    let ratioStr = ''
    let emMarketCode: string | undefined

    if (idxCode >= 0 && tds[idxCode]) {
      const raw = String(tds[idxCode]).trim()
      emMarketCode = getEmMarket(rawTds[idxCode] || '')
      const mA = raw.match(/(\d{6})/)
      const mHK = raw.match(/(?<!\d)(\d{4,5})(?!\d)/) // 港股4-5位独立数字串
      const mAlpha = raw.match(/\b([A-Za-z]{1,10})\b/)
      stockCode = mA ? mA[1] : (mHK ? mHK[1] : (mAlpha ? mAlpha[1].toUpperCase() : raw))
    } else {
      const ci = tds.findIndex(txt => /^\d{6}$/.test(txt))
      if (ci >= 0) stockCode = tds[ci]
    }

    if (idxName >= 0 && tds[idxName]) {
      stockName = tds[idxName]
    } else if (stockCode) {
      const ni = tds.findIndex(txt => txt && txt !== stockCode && !/%$/.test(txt))
      stockName = ni >= 0 ? tds[ni] : ''
    }

    if (idxWeight >= 0 && tds[idxWeight]) {
      const wm = tds[idxWeight].match(/([\d.]+)\s*%/)
      ratioStr = wm ? wm[1] : tds[idxWeight]
    } else {
      const wi = tds.findIndex(txt => /\d+(?:\.\d+)?\s*%/.test(txt))
      if (wi >= 0) {
        const wm = tds[wi].match(/([\d.]+)\s*%/)
        ratioStr = wm ? wm[1] : ''
      }
    }

    const ratio = parseFloat(ratioStr)
    if (!stockCode && !stockName) continue
    if (!Number.isFinite(ratio)) continue

    results.push({ stockCode, stockName, ratio, emMarketCode })
  }

  return results
}
