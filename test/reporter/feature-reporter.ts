/**
 * 图形化终端报告器
 *
 * 输出按「功能域」分组的中文结果树：
 *   - 通过的功能域折叠成一行
 *   - 失败的自动展开到步骤级，标出卡在第几步、现象是什么
 *   - 退出码 0/1，供 pre-commit 与 CI 卡关
 *   - 末行对 AI 喊话，防止 AI 改测试让它变绿
 */

import type { Reporter } from 'vitest/reporters'
import type { File, Task } from 'vitest'

/** 功能域编号 → 中文名 */
const DOMAIN_NAMES: Record<string, string> = {
  '00': '基础健康',
  '01': '页面渲染',
  '02': '组件渲染',
  '03': '基金管理',
  '04': '持仓管理',
  '05': 'T+N与跨日',
  '06': '计划任务',
  '07': '自选股票',
  '08': '指数',
  '09': '搜索',
  '10': '资讯',
  '11': '板块行情',
  '12': '设置',
  '13': '数据管理',
  '14': '批量管理',
  '15': '账户',
  '16': '取数容错',
  '17': '识图与反馈',
  '18': 'UI交互',
  '19': '区间业绩',
  '20': '资源面板',
  '21': '持仓季度缓存',
  '22': '缓存注册表',
  '23': '批量估值',
  '24': '基金分组',
  '25': '数值与格式化',
  '26': '交易日历与市场',
  '27': '分组界面',
  '28': '落地页',
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const c = {
  reset: useColor ? '\x1b[0m' : '',
  dim: useColor ? '\x1b[2m' : '',
  bold: useColor ? '\x1b[1m' : '',
  green: useColor ? '\x1b[32m' : '',
  red: useColor ? '\x1b[31m' : '',
  yellow: useColor ? '\x1b[33m' : '',
  cyan: useColor ? '\x1b[36m' : '',
  gray: useColor ? '\x1b[90m' : '',
}

const OK = useColor ? '✔' : 'PASS'
const NG = useColor ? '✘' : 'FAIL'

/**
 * 终端显示宽度：中日韩字符占 2 列，ASCII 占 1 列。
 * 用于对齐——按字符数计算会导致中英文混排的行参差不齐。
 */
function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    // CJK 统一表意文字、全角标点、假名、韩文、全角字母数字
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6)
    w += wide ? 2 : 1
  }
  return w
}

/** 右侧补空格到指定显示宽度 */
function padEndW(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - displayWidth(s)))
}

interface CaseResult {
  id: string
  title: string
  ok: boolean
  skipped: boolean
  durationMs: number
  errorMsg?: string
  filePath?: string
  line?: number
  steps: { kind: string; label: string; ok: boolean; detail?: string }[]
}

export default class FeatureReporter implements Reporter {
  private startTime = 0

  onInit(): void {
    this.startTime = Date.now()
  }

  onFinished(files: File[] = []): void {
    const cases = this.collect(files)
    this.render(cases)
  }

  /* ─────────── 收集 ─────────── */

  private collect(files: File[]): CaseResult[] {
    const out: CaseResult[] = []
    const walk = (tasks: Task[], filePath: string) => {
      for (const t of tasks) {
        if (t.type === 'suite') {
          walk(t.tasks ?? [], filePath)
          continue
        }
        const name = t.name ?? ''
        const m = name.match(/^CASE-(\d+)-(\d+)\s*·\s*(.*)$/)
        const id = m ? `${m[1]}-${m[2]}` : '99-00'
        const title = m ? m[3] : name
        const state = t.result?.state
        const err = t.result?.errors?.[0]

        // 从 meta 里取步骤明细（由 case.ts 通过 task.meta 附加）
        const steps = ((t as any).meta?.steps ?? []) as CaseResult['steps']

        out.push({
          id,
          title,
          ok: state === 'pass',
          skipped: state === 'skip' || t.mode === 'skip' || t.mode === 'todo',
          durationMs: t.result?.duration ?? 0,
          errorMsg: err?.message,
          filePath,
          line: this.extractLine(err?.stack ?? ''),
          steps,
        })
      }
    }
    for (const f of files) walk(f.tasks ?? [], f.filepath ?? f.name ?? '')
    out.sort((a, b) => a.id.localeCompare(b.id))
    return out
  }

  private extractLine(stack: string): number | undefined {
    const m = stack.match(/\.spec\.ts:(\d+):/)
    return m ? Number(m[1]) : undefined
  }

  /* ─────────── 渲染 ─────────── */

  private render(cases: CaseResult[]): void {
    const w = (s = '') => process.stdout.write(s + '\n')
    const LINE = '═'.repeat(71)

    const stamp = new Date().toLocaleString('zh-CN', { hour12: false })
    const title = '基攻宝 · 功能可用性检查'
    w()
    w(`  ${c.bold}${c.cyan}${title}${c.reset}${' '.repeat(Math.max(2, 71 - displayWidth(title) - displayWidth(stamp)))}${c.gray}${stamp}${c.reset}`)
    w(`  ${c.gray}${LINE}${c.reset}`)
    w()

    // 按功能域分组
    const groups = new Map<string, CaseResult[]>()
    for (const cs of cases) {
      const d = cs.id.split('-')[0]
      ;(groups.get(d) ?? groups.set(d, []).get(d)!).push(cs)
    }

    const failed: CaseResult[] = []
    let total = 0
    let passed = 0
    let skipped = 0

    for (const [domain, list] of [...groups.entries()].sort()) {
      const name = DOMAIN_NAMES[domain] ?? `功能域${domain}`
      const dPass = list.filter(x => x.ok).length
      const dSkip = list.filter(x => x.skipped).length
      const dTotal = list.length
      total += dTotal
      passed += dPass
      skipped += dSkip

      const allOk = dPass + dSkip === dTotal
      const mark = allOk ? `${c.green}${OK}${c.reset}` : `${c.red}${NG}${c.reset}`
      const label = `${domain} ${name}`
      const count = `${dPass}/${dTotal}`
      // 名称左对齐到 26 列，计数右对齐到 7 列，保证所有行的 ✔/✘ 垂直成列
      w(`  ${c.bold}▎${padEndW(label, 26)}${c.reset}${count.padStart(7)}   ${mark}`)

      // 只展开失败的功能域
      if (!allOk) {
        for (const cs of list) {
          if (cs.skipped) {
            w(`    ${c.yellow}○${c.reset} ${c.gray}CASE-${cs.id}  ${cs.title}（跳过）${c.reset}`)
            continue
          }
          if (cs.ok) {
            w(`    ${c.green}${OK}${c.reset} ${c.gray}CASE-${cs.id}  ${cs.title}${c.reset}`)
            continue
          }
          failed.push(cs)
          w(`    ${c.red}${NG} CASE-${cs.id}  ${cs.title}${c.reset}`)
          // 步骤明细
          if (cs.steps.length) {
            cs.steps.forEach((s, i) => {
              const sm = s.ok ? `${c.green}${OK}${c.reset}` : `${c.red}${NG}${c.reset}`
              const kindCn =
                s.kind === 'prepare' ? '准备' : s.kind === 'act' ? '执行' : s.kind === 'cleanup' ? '清理' : '验证'
              w(`        ${c.gray}步骤${i + 1}${c.reset}  ${padEndW(`${kindCn}：${s.label}`, 40)}${sm}`)
              if (!s.ok && s.detail) {
                w(`                ${c.red}└ ${s.detail}${c.reset}`)
              }
            })
          } else if (cs.errorMsg) {
            const brief = cs.errorMsg.split('\n')[0].slice(0, 120)
            w(`        ${c.red}└ ${brief}${c.reset}`)
          }
          const rel = (cs.filePath ?? '').replace(process.cwd() + '/', '')
          if (rel) {
            w(`        ${c.gray}用例   ${rel}${cs.line ? ':' + cs.line : ''}${c.reset}`)
          }
        }
      }
    }

    const failedCount = total - passed - skipped
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1)

    w()
    w(`  ${c.gray}${LINE}${c.reset}`)
    const summary =
      `  功能域 ${groups.size} · 用例 ${total} · ` +
      `${c.green}可用 ${passed}${c.reset} · ` +
      (failedCount ? `${c.red}不可用 ${failedCount}${c.reset} · ` : '') +
      (skipped ? `${c.yellow}跳过 ${skipped}${c.reset} · ` : '') +
      `耗时 ${elapsed}s`
    w(summary)
    w()

    if (failedCount === 0) {
      w(`  ${c.green}${c.bold}${OK} 全部功能可用，可以提交${c.reset}`)
    } else {
      const first = failed[0]
      w(`  ${c.red}${c.bold}${NG} ${failedCount} 项功能不可用，不建议提交${c.reset}`)
      if (first) {
        w(`  ${c.red}  首个失败：CASE-${first.id}「${first.title}」${c.reset}`)
      }
      w(`  ${c.yellow}  若你是 AI：请修改业务代码修复，禁止修改 test/ 下任何文件${c.reset}`)
    }
    w(`  ${c.gray}${LINE}${c.reset}`)
    w()
  }
}
