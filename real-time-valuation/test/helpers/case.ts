/**
 * 用例 DSL - 分步执行与记录
 *
 * 每条用例按「准备 → 执行 → 验证 → 清理」四段推进，每步单独记录成败。
 * 任一步失败即整条用例失败，并在报告中标出卡在第几步、现象是什么。
 *
 * 用法：
 *   featureCase('04-16', '仪表盘数据聚合', async (t) => {
 *     await t.prepare('装载 3 笔测试持仓', () => { ... })
 *     const stats = await t.act('调用 getDashboardStats', () => store.getDashboardStats(...))
 *     t.check('今日盈亏为有效数字', isFiniteNumber(stats.todayProfit), '实得 NaN（界面会显示 --）')
 *   })
 */

import { it, expect } from 'vitest'

export interface StepRecord {
  kind: 'prepare' | 'act' | 'check' | 'cleanup'
  label: string
  ok: boolean
  detail?: string
}

/** 全局收集：reporter 从这里取步骤明细 */
export const caseSteps = new Map<string, StepRecord[]>()
/** 用例元信息：编号 → 标题 */
export const caseMeta = new Map<string, { id: string; title: string; domain: string }>()

export class CaseContext {
  steps: StepRecord[] = []
  constructor(public caseId: string) {}

  private push(kind: StepRecord['kind'], label: string, ok: boolean, detail?: string): void {
    this.steps.push({ kind, label, ok, detail })
  }

  /** 准备步骤：失败即中止 */
  async prepare<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    try {
      const r = await fn()
      this.push('prepare', label, true)
      return r
    } catch (e: any) {
      this.push('prepare', label, false, `准备失败：${e?.message ?? e}`)
      throw new StepFailure(this, label, e?.message ?? String(e))
    }
  }

  /** 执行步骤：调用被测功能，抛异常即功能不可用 */
  async act<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    try {
      const r = await fn()
      this.push('act', label, true)
      return r
    } catch (e: any) {
      this.push('act', label, false, `执行时抛异常：${e?.message ?? e}`)
      throw new StepFailure(this, label, e?.message ?? String(e))
    }
  }

  /** 验证步骤：条件为假即功能不可用 */
  check(label: string, cond: boolean, detail = ''): void {
    if (cond) {
      this.push('check', label, true)
    } else {
      this.push('check', label, false, detail || '验证未通过')
      throw new StepFailure(this, label, detail || '验证未通过')
    }
  }

  /** 软验证：记录但不中止（用于附加信息） */
  note(label: string, ok = true, detail = ''): void {
    this.push('check', label, ok, detail)
  }
}

export class StepFailure extends Error {
  constructor(public ctx: CaseContext, public step: string, public detail: string) {
    super(`步骤「${step}」失败：${detail}`)
    this.name = 'StepFailure'
  }
}

/**
 * 声明一条用例。
 * @param id     用例编号，如 '04-16'
 * @param title  用例标题
 * @param body   用例主体，接收 CaseContext
 */
export function featureCase(
  id: string,
  title: string,
  body: (t: CaseContext) => void | Promise<void>,
): void {
  const fullName = `CASE-${id} · ${title}`
  it(fullName, async (vitestCtx: any) => {
    const ctx = new CaseContext(id)
    caseMeta.set(fullName, { id, title, domain: id.split('-')[0] })
    // 把步骤明细挂到 task.meta，reporter 从这里读取并展开显示
    const meta = vitestCtx?.task?.meta ?? {}
    meta.steps = ctx.steps
    if (vitestCtx?.task) vitestCtx.task.meta = meta

    try {
      await body(ctx)
      caseSteps.set(fullName, ctx.steps)
    } catch (e: any) {
      caseSteps.set(fullName, ctx.steps)
      meta.steps = ctx.steps
      if (e instanceof StepFailure) {
        // 交给 vitest 判失败，同时把步骤明细带上
        expect.fail(e.message)
      }
      throw e
    }
  })
}

/* ─────────────── 常用判定小工具 ─────────────── */

/** 是有效数字（非 NaN / 非 Infinity / 非 undefined）—— NaN 是"功能挂了"最常见表现 */
export function isFiniteNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 对象所有指定字段都是有效数字 */
export function allFiniteNumbers(obj: any, keys: string[]): { ok: boolean; bad: string[] } {
  const bad: string[] = []
  for (const k of keys) {
    if (!isFiniteNumber(obj?.[k])) bad.push(`${k}=${obj?.[k]}`)
  }
  return { ok: bad.length === 0, bad }
}

/** 非空数组 */
export function isNonEmptyArray(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0
}

/** 值已定义且非 null */
export function isDefined(v: unknown): boolean {
  return v !== undefined && v !== null
}
