/**
 * 探活辅助 - 真实请求 + 结构校验
 *
 * 判定分三档，对应三种完全不同的处置方式：
 *   OK        接口活着、结构没变            → 无需处理
 *   STRUCT    接口活着，但少了预期字段      → **需要更新桩数据和解析代码**（最危险，最容易被忽略）
 *   DOWN      连不上/超时/非 2xx           → 接口挂了或被限流，功能当前不可用
 *
 * 重点是 STRUCT：接口悄悄改结构时，主测试（桩数据）依然全绿，只有这里能发现。
 */

import { it } from 'vitest'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'

export type ProbeVerdict = 'OK' | 'STRUCT' | 'DOWN'

export interface ProbeRecord {
  id: string
  name: string
  url: string
  verdict: ProbeVerdict
  detail: string
  ms: number
  /** 缺失的预期字段（STRUCT 时有值） */
  missing?: string[]
  /** DOWN 的归因，供报告解释可能原因 */
  reason?: 'timeout' | 'dns' | 'conn' | 'net' | 'limited' | 'http' | 'other'
}

/** 全局收集，供 reporter 汇总 */
export const probeRecords: ProbeRecord[] = []

/**
 * 结果落盘路径。
 * reporter 运行在独立的模块上下文里，无法直接 import 到本文件的内存变量，
 * 故通过临时文件交接（每次运行前清空、每条探活后追加写入）。
 */
export const PROBE_OUT = resolve(tmpdir(), 'jgb-smoke-probe.json')

function flush(): void {
  try {
    writeFileSync(PROBE_OUT, JSON.stringify(probeRecords), 'utf-8')
  } catch {
    /* 落盘失败不影响探活本身 */
  }
}

interface ProbeOptions {
  /** 期望在响应文本中出现的关键片段（字段名/变量名），缺失即判 STRUCT */
  expect: string[]
  /** 响应应为 JSON（会尝试解析） */
  json?: boolean
  /** 超时毫秒 */
  timeout?: number
  /** 自定义请求头（部分东财接口需要 Referer） */
  headers?: Record<string, string>
}

/** 发一次真实请求并按三档判定 */
export async function probe(
  id: string,
  name: string,
  url: string,
  opts: ProbeOptions,
): Promise<ProbeRecord> {
  const started = Date.now()
  const rec: ProbeRecord = { id, name, url, verdict: 'DOWN', detail: '', ms: 0 }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 15000)

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 部分东财/新浪接口对无 UA 请求返回空
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        ...(opts.headers ?? {}),
      },
    })
    clearTimeout(timer)
    rec.ms = Date.now() - started

    if (!resp.ok) {
      rec.verdict = 'DOWN'
      rec.detail = `HTTP ${resp.status} ${resp.statusText}`
      rec.reason = resp.status === 429 || resp.status === 403 ? 'limited' : 'http'
      probeRecords.push(rec); flush()
      return rec
    }

    const text = await resp.text()
    if (!text || text.trim().length === 0) {
      rec.verdict = 'DOWN'
      rec.detail = '响应为空'
      probeRecords.push(rec); flush()
      return rec
    }

    if (opts.json) {
      try {
        JSON.parse(text)
      } catch {
        // 非 JSON 不一定是故障：JSONP / var 定义型脚本本就不是 JSON，
        // 故只在明确声明 json:true 时提示，仍继续做字段校验
        rec.detail = '响应非标准 JSON（可能是 JSONP 包装）；'
      }
    }

    const missing = opts.expect.filter(k => !text.includes(k))
    if (missing.length > 0) {
      rec.verdict = 'STRUCT'
      rec.missing = missing
      rec.detail += `缺失预期字段：${missing.join(', ')}`
      probeRecords.push(rec); flush()
      return rec
    }

    rec.verdict = 'OK'
    rec.detail += `${(text.length / 1024).toFixed(1)}KB`
    probeRecords.push(rec); flush()
    return rec
  } catch (e: any) {
    clearTimeout(timer)
    rec.ms = Date.now() - started
    rec.verdict = 'DOWN'
    const msg = String(e?.message ?? e)
    if (e?.name === 'AbortError') {
      rec.detail = '请求超时'
      rec.reason = 'timeout'
    } else if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) {
      rec.detail = 'DNS 解析失败'
      rec.reason = 'dns'
    } else if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|certificate|TLS/i.test(msg)) {
      rec.detail = '连接被拒绝/中断'
      rec.reason = 'conn'
    } else if (/fetch failed/i.test(msg)) {
      rec.detail = '网络不可达'
      rec.reason = 'net'
    } else {
      rec.detail = msg.slice(0, 80)
      rec.reason = 'other'
    }
    probeRecords.push(rec); flush()
    return rec
  }
}

/**
 * 声明一条探活用例。
 *
 * ⚠️ 探活**不会让测试失败退出**（不 throw）——接口抖动、地域限流、
 * 公共代理不稳定都会造成偶发失败。让它红会导致你很快忽略它。
 * 结果全部汇总到报告里，由你自己判断是否需要处理。
 */
export function smokeCase(
  id: string,
  name: string,
  url: string,
  opts: ProbeOptions,
): void {
  it(`SMOKE-${id} · ${name}`, async () => {
    await probe(id, name, url, opts)
    // 故意不断言：探活是"体检报告"，不是"红绿灯"
  })
}
