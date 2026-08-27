/**
 * 探活报告器
 *
 * 与主测试报告的关键差别：探活**没有"失败"概念**，只有"体检结论"。
 * 三档结论对应三种处置：
 *   OK       无需处理
 *   结构变化  ← 最重要：主测试仍会全绿，但线上已经挂了，需更新桩数据与解析代码
 *   不可达    接口挂了/限流/本机无外网
 */

import type { Reporter } from 'vitest/reporters'
import type { File } from 'vitest'
import { readFileSync, existsSync, unlinkSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'

/** 与 smoke/probe.ts 约定的交接文件（reporter 与用例不在同一模块上下文，无法直接共享内存） */
const PROBE_OUT = resolve(tmpdir(), 'jgb-smoke-probe.json')

interface ProbeRecord {
  id: string
  name: string
  url: string
  verdict: 'OK' | 'STRUCT' | 'DOWN'
  detail: string
  ms: number
  missing?: string[]
  reason?: 'timeout' | 'dns' | 'conn' | 'net' | 'limited' | 'http' | 'other'
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

function displayWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6)
    w += wide ? 2 : 1
  }
  return w
}
function padEndW(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - displayWidth(s)))
}

const MARK = {
  OK: useColor ? `${c.green}✔${c.reset}` : 'OK  ',
  STRUCT: useColor ? `${c.yellow}▲${c.reset}` : 'DIFF',
  DOWN: useColor ? `${c.red}✘${c.reset}` : 'DOWN',
}

export default class SmokeReporter implements Reporter {
  onInit(): void {
    // 清掉上一轮结果，避免读到陈旧数据
    try { if (existsSync(PROBE_OUT)) unlinkSync(PROBE_OUT) } catch { /* 忽略 */ }
  }

  onFinished(_files: File[] = []): void {
    const w = (s = '') => process.stdout.write(s + '\n')
    const LINE = '═'.repeat(71)
    let loaded: ProbeRecord[] = []
    try {
      if (existsSync(PROBE_OUT)) loaded = JSON.parse(readFileSync(PROBE_OUT, 'utf-8'))
    } catch { /* 读不到就按空处理 */ }
    const recs = loaded.sort((a, b) => a.id.localeCompare(b.id))

    const stamp = new Date().toLocaleString('zh-CN', { hour12: false })
    const title = '外部接口探活 · 仅供参考，不影响测试结果'
    w()
    w(`  ${c.bold}${c.cyan}${title}${c.reset}${' '.repeat(Math.max(2, 71 - displayWidth(title) - displayWidth(stamp)))}${c.gray}${stamp}${c.reset}`)
    w(`  ${c.gray}${LINE}${c.reset}`)
    w()

    if (recs.length === 0) {
      w(`  ${c.yellow}未采集到任何探活结果${c.reset}`)
      w(`  ${c.gray}${LINE}${c.reset}`)
      w()
      return
    }

    const allUnreachable = recs.every(r => r.verdict === 'DOWN')
    if (allUnreachable) {
      // 本机无外网：逐条打印 24 行没有任何信息量，一行带过
      w(`  ${c.gray}全部 ${recs.length} 个接口均未连通（详见下方原因说明）${c.reset}`)
    } else {
      for (const r of recs) {
        const mark = MARK[r.verdict]
        const name = padEndW(`${r.id} ${r.name}`, 46)
        const ms = r.verdict === 'DOWN' ? '' : `${String(r.ms).padStart(5)}ms`
        w(`  ${name}${c.gray}${ms.padStart(8)}${c.reset}   ${mark}`)
        if (r.verdict !== 'OK') {
          w(`      ${r.verdict === 'STRUCT' ? c.yellow : c.red}└ ${r.detail}${c.reset}`)
        }
      }
    }

    const ok = recs.filter(r => r.verdict === 'OK')
    const struct = recs.filter(r => r.verdict === 'STRUCT')
    const down = recs.filter(r => r.verdict === 'DOWN')

    w()
    w(`  ${c.gray}${LINE}${c.reset}`)
    w(
      `  接口 ${recs.length} 个 · ` +
        `${c.green}正常 ${ok.length}${c.reset}` +
        (struct.length ? ` · ${c.yellow}结构变化 ${struct.length}${c.reset}` : '') +
        (down.length ? ` · ${c.red}不可达 ${down.length}${c.reset}` : ''),
    )
    w()

    if (struct.length) {
      w(`  ${c.yellow}${c.bold}▲ 检测到接口结构变化 —— 需要处理${c.reset}`)
      w(`  ${c.gray}  这类问题主测试（npm run test）发现不了：桩数据还是老结构，测试照样全绿，${c.reset}`)
      w(`  ${c.gray}  但线上真实接口已经变了，功能实际已挂。${c.reset}`)
      for (const r of struct) {
        w(`    ${c.yellow}·${c.reset} ${r.name}`)
        w(`      ${c.gray}缺失字段：${(r.missing ?? []).join(', ')}${c.reset}`)
      }
      w(`  ${c.gray}  处置：核对该接口新结构 → 更新解析代码 → 同步更新 test/setup/net-stub.ts 的样本${c.reset}`)
      w()
    }

    if (down.length) {
      const allDown = down.length === recs.length
      w(`  ${c.yellow}${c.bold}✘ ${down.length} 个接口未连通${c.reset}`)
      // 全挂时不逐条列（信息量为零，只会刷屏）；部分挂才需要知道具体是哪几个
      if (!allDown) {
        for (const r of down) {
          w(`    ${c.gray}·${c.reset} ${r.name} ${c.gray}— ${r.detail}${c.reset}`)
        }
      }
      w()

      if (allDown) {
        // 全挂 = 几乎必然是本地网络问题，而不是 24 家接口同时下线
        w(`  ${c.cyan}  ▸ 全部接口均未连通，基本可判定为「本机网络限制」，而非接口方故障：${c.reset}`)
        w(`  ${c.gray}      · 当前环境无外网出口（公司内网 / 容器 / CI 沙箱）${c.reset}`)
        w(`  ${c.gray}      · 需要配置 HTTP 代理才能访问外网${c.reset}`)
        w(`  ${c.gray}      · VPN 或防火墙拦截${c.reset}`)
        w(`  ${c.gray}    这种情况属预期，${c.reset}${c.bold}无需处理，也不影响提交${c.reset}`)
      } else {
        const kinds = new Set(down.map(r => r.reason))
        w(`  ${c.cyan}  ▸ 可能原因：${c.reset}`)
        if (kinds.has('net') || kinds.has('dns'))
          w(`  ${c.gray}      · 本机网络受限 / DNS 不可用（最常见，与代码无关）${c.reset}`)
        if (kinds.has('timeout'))
          w(`  ${c.gray}      · 接口响应慢或被墙，超时（跨境接口如 Yahoo、RSS 常见）${c.reset}`)
        if (kinds.has('limited'))
          w(`  ${c.gray}      · 被限流或封禁（429/403）——短时间请求过多，稍后再试${c.reset}`)
        if (kinds.has('conn'))
          w(`  ${c.gray}      · 连接被拒绝/中断，可能是代理不稳定或服务临时故障${c.reset}`)
        if (kinds.has('http'))
          w(`  ${c.gray}      · 接口返回非 2xx，可能已下线或改了地址${c.reset}`)
        w(`  ${c.gray}    公共免费接口与代理本就不稳定，偶发红项属正常现象${c.reset}`)
      }
      w()
    }

    if (!struct.length && !down.length) {
      w(`  ${c.green}${c.bold}✔ 全部外部接口正常，桩数据与真实结构一致${c.reset}`)
      w()
    }

    w(`  ${c.gray}注：以上仅为参考信息，${c.reset}${c.bold}不作为测试通过条件${c.reset}${c.gray}——`)
    w(`  ${c.gray}    测试是否通过只看上方「功能可用性检查」的结果。${c.reset}`)
    w(`  ${c.gray}${LINE}${c.reset}`)
    w()
  }
}
