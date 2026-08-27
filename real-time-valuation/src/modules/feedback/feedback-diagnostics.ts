

import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { useIndexStore } from '@/modules/index/index-store'
import { STORAGE_KEYS } from '@/config/constants'
import { getNowStr } from '@/shared/utils/date-format'

declare const __APP_VERSION__: string

function safe(fn: () => string | number | boolean | null | undefined): string {
  try {
    const v = fn()
    if (v === null || v === undefined || v === '') return '--'
    return String(v)
  } catch {
    return '(取值失败)'
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(2)}MB`
}

function storageSummary(): string {
  try {
    const rows: string[] = []
    let total = 0
    for (const key of Object.values(STORAGE_KEYS)) {
      const raw = localStorage.getItem(key as string)
      if (raw === null) continue
      total += raw.length
      rows.push(`  ${key}: ${fmtBytes(raw.length)}`)
    }
    if (rows.length === 0) return '  (空)'
    return `  合计 ${fmtBytes(total)} / ${rows.length} 项\n` + rows.join('\n')
  } catch {
    return '  (读取失败)'
  }
}

function envSection(): string {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator)
  const conn = (nav as unknown as { connection?: { effectiveType?: string; downlink?: number } }).connection
  const displayMode = safe(() =>
    ['standalone', 'fullscreen', 'minimal-ui'].find(m => window.matchMedia(`(display-mode: ${m})`).matches) ?? 'browser',
  )
  return [
    '【运行环境】',
    `  应用版本: ${safe(() => (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''))}`,
    `  提交时间: ${safe(() => getNowStr())}（北京时间）`,
    `  本地时间: ${safe(() => new Date().toString())}`,
    `  时区: ${safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
    `  页面地址: ${safe(() => location.href)}`,
    `  显示模式: ${displayMode}`,
    `  UA: ${safe(() => nav.userAgent)}`,
    `  平台: ${safe(() => nav.platform)}`,
    `  语言: ${safe(() => nav.language)}`,
    `  屏幕: ${safe(() => `${screen.width}x${screen.height}`)} / 视口 ${safe(() => `${window.innerWidth}x${window.innerHeight}`)} / DPR ${safe(() => window.devicePixelRatio)}`,
    `  触摸点数: ${safe(() => nav.maxTouchPoints)}`,
    `  在线状态: ${safe(() => (nav.onLine ? '在线' : '离线'))}`,
    `  网络类型: ${safe(() => conn?.effectiveType)} / 下行 ${safe(() => conn?.downlink)}Mbps`,
    `  CPU 核数: ${safe(() => nav.hardwareConcurrency)}`,
  ].join('\n')
}

function settingsSection(): string {
  try {
    const s = useSettingsStore()
    const obj = s.toObject()
    const lines = Object.entries(obj).map(([k, v]) =>
      `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`,
    )
    return '【用户设置】\n' + lines.join('\n')
  } catch {
    return '【用户设置】\n  (读取失败)'
  }
}

function fundSection(): string {
  try {
    const fs = useFundStore()
    const hs = useHoldingStore()
    const codes = fs.fundCodes
    const lines: string[] = ['【基金状态】']
    lines.push(`  关注数量: ${codes.length}`)
    lines.push(`  估值已加载: ${fs.valuationMap.size}`)
    lines.push(`  推算持仓缓存: ${fs.estimatedHoldingsCache.size} / T+1持仓缓存: ${fs.t1HoldingsCache.size}`)
    lines.push(`  个股昨收缓存: ${fs.stockPrevDayCache.size} / 实时缓存: ${fs.stockRealtimeCache.size}`)
    lines.push(`  上次刷新业务日: ${safe(() => fs.lastBusinessDay)}`)

    lines.push('  明细:')
    for (const code of codes) {
      const v = fs.getValuation(code)
      const name = safe(() => fs.resolveFundName(code))
      const amount = safe(() => hs.getFundHoldingAmount(code, v?.dwjz, v?.gszzl ?? 0, v?.isEstimated).toFixed(2))
      const principal = safe(() => hs.getPrincipal(code).toFixed(2))
      lines.push(
        `    ${code} ${name} | T+${v?.delayDays ?? '?'} | 今日 ${v?.gszzl ?? '--'}% | ` +
        `实时 ${v?.realtimeGszzl ?? '--'}% | dwjz ${v?.dwjz ?? '--'} | jzrq ${v?.jzrq ?? '--'} | ` +
        `gztime ${v?.gztime || '--'} | 估值中 ${v?.isEstimated ?? '--'} | 持仓 ${amount} | 本金 ${principal}`,
      )
    }
    return lines.join('\n')
  } catch {
    return '【基金状态】\n  (读取失败)'
  }
}

function indexSection(): string {
  try {
    const is = useIndexStore()
    return [
      '【指数】',
      `  已选 ${is.selectedIndices.length} 个: ${is.selectedIndices.join(', ') || '--'}`,
      `  行情已加载: ${is.indexQuotes.size}`,
    ].join('\n')
  } catch {
    return '【指数】\n  (读取失败)'
  }
}

export function buildFeedbackBody(userText: string, contact: string, category: string): string {
  return [
    '════════ 用户反馈 ════════',
    `类型: ${category}`,
    `联系方式: ${contact.trim() || '(未填写)'}`,
    '',
    '【问题描述】',
    userText.trim() || '(未填写)',
    '',
    '════════ 诊断信息 ════════',
    envSection(),
    '',
    settingsSection(),
    '',
    fundSection(),
    '',
    indexSection(),
    '',
    '【本地存储】',
    storageSummary(),
  ].join('\n')
}
