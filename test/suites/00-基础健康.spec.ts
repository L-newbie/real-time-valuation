/**
 * 00 · 基础健康
 *
 * 最底层的可用性：模块能加载、store 能建、路由完整、禁改文件未被动过。
 * 这一层挂了，后面所有用例都没有意义。
 */

import { describe } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { featureCase, isDefined, isNonEmptyArray } from '../helpers/case'
import { freshPinia } from '../helpers/seed'
import { setStorageFailMode } from '../setup/memory-storage'

const ROOT = resolve(__dirname, '../..')
const SRC = join(ROOT, 'src')

/** 递归列出 src 下所有 .ts / .vue */
function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) listSourceFiles(p, out)
    else if (/\.(ts|vue)$/.test(name) && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

describe('00 · 基础健康', () => {
  featureCase('00-01', '全部源码模块可加载（无语法错误/引用断裂/循环依赖）', async t => {
    const files = await t.prepare('扫描 src 下全部源码文件', () => listSourceFiles(SRC))
    t.check('扫描到源码文件', files.length > 100, `仅扫到 ${files.length} 个，疑似路径错误`)

    // Worker 入口文件在测试环境不能直接 import（依赖 self/importScripts），单独排除
    const skip = /workers?\/[a-z-]+worker\.ts$/

    const failures: string[] = []
    await t.act(`逐个 import ${files.length} 个模块`, async () => {
      for (const f of files) {
        if (skip.test(f)) continue
        const rel = '@/' + f.slice(SRC.length + 1)
        try {
          await import(/* @vite-ignore */ rel)
        } catch (e: any) {
          failures.push(`${rel.slice(2)} → ${String(e?.message ?? e).split('\n')[0]}`)
        }
      }
    })

    t.check(
      '全部模块加载成功',
      failures.length === 0,
      failures.length ? `${failures.length} 个模块加载失败：\n                  ` + failures.slice(0, 5).join('\n                  ') : '',
    )
  })

  featureCase('00-02', '9 个 Pinia store 均可实例化', async t => {
    await t.prepare('创建 Pinia', () => freshPinia())

    const mods = await t.act('导入全部 store 模块', async () => ({
      fund: (await import('@/modules/fund/fund-store')).useFundStore,
      holding: (await import('@/modules/holding/holding-store')).useHoldingStore,
      index: (await import('@/modules/index/index-store')).useIndexStore,
      news: (await import('@/modules/news/news-store')).useNewsStore,
      stock: (await import('@/modules/stock/stock-store')).useStockStore,
      task: (await import('@/modules/reserved/task-store')).useTaskStore,
      settings: (await import('@/modules/settings/settings-store')).useSettingsStore,
      cache: (await import('@/modules/fund/cache-store')).useCacheStore,
      auth: (await import('@/modules/auth/auth-store')).useAuthStore,
    }))

    const bad: string[] = []
    await t.act('逐个实例化', () => {
      for (const [name, use] of Object.entries(mods)) {
        try {
          const s = (use as any)()
          if (!isDefined(s)) bad.push(`${name} 返回空`)
        } catch (e: any) {
          bad.push(`${name} → ${e?.message}`)
        }
      }
    })
    t.check('全部 store 实例化成功', bad.length === 0, bad.join('; '))
  })

  featureCase('00-03', '路由表完整（20 条路由均存在）', async t => {
    const router = await t.act('导入路由模块', async () => (await import('@/router/index')).default)
    const routes = await t.act('读取路由表', () => router.getRoutes())
    t.check('路由表非空', isNonEmptyArray(routes), '路由表为空')

    const expected = [
      // v3.0：/mine 已改为首页右上角的节点浮层，不再是独立路由
      '/', '/charity', '/market', '/news/detail', '/login', '/register',
      // v3.0：appearance/fund/stock/news/sector 五个子页已合并进 /settings 单页折叠分组
      '/settings', '/settings/data', '/settings/about',
      '/settings/indices', '/manage', '/fund/:code', '/feedback',
    ]
    const paths = new Set(routes.map((r: any) => r.path))
    const missing = expected.filter(p => !paths.has(p))
    t.check('全部预期路由存在', missing.length === 0, `缺失路由：${missing.join(', ')}`)
  })

  featureCase('00-04', '应用入口 App.vue 可挂载', async t => {
    const { mount } = await t.prepare('导入测试工具', async () => await import('@vue/test-utils'))
    await t.prepare('创建 Pinia', () => freshPinia())
    const App = await t.act('导入 App.vue', async () => (await import('@/App.vue')).default)

    const router = await t.act('创建路由', async () => {
      const { createRouter, createWebHashHistory } = await import('vue-router')
      const real = (await import('@/router/index')).default
      return createRouter({ history: createWebHashHistory(), routes: real.getRoutes() as any })
    })
    await t.act('等待路由就绪', async () => {
      await router.push('/')
      await router.isReady()
    })

    const wrapper = await t.act('挂载 App', () =>
      mount(App, { global: { plugins: [router], stubs: { transition: false } } }),
    )
    t.check('挂载后有 DOM 输出', !!wrapper.html(), '挂载后 DOM 为空（白屏）')
    wrapper.unmount()
  })

  featureCase('00-05', '密钥死值未被改动（GLM / EmailJS）', async t => {
    const src = await t.prepare('读取 src/config/constants.ts', () =>
      readFileSync(join(SRC, 'config/constants.ts'), 'utf-8'),
    )

    // 只校验"密钥字段仍是硬编码字面量"这一形态，不把密钥值写进测试文件
    t.check(
      'GLM_CONFIG.API_KEY 仍为硬编码字符串',
      /API_KEY:\s*'[A-Za-z0-9._-]{20,}'/.test(src),
      'GLM API_KEY 被改动或改成了变量/环境变量注入 —— 会导致识图功能在无 .env 环境静默全挂',
    )
    t.check(
      'EmailJS PUBLIC_KEY 仍为硬编码字符串',
      /PUBLIC_KEY:\s*'[A-Za-z0-9._-]{10,}'/.test(src),
      'EmailJS PUBLIC_KEY 被改动 —— 会导致验证码与反馈发信静默失效',
    )
    t.check(
      'EmailJS SERVICE_ID 仍存在',
      /SERVICE_ID:\s*'[^']+'/.test(src),
      'EmailJS SERVICE_ID 被清空或改动',
    )
    t.check(
      '未被改成 import.meta.env 注入',
      !/API_KEY:\s*import\.meta\.env/.test(src) && !/PUBLIC_KEY:\s*import\.meta\.env/.test(src),
      '密钥被改成环境变量注入 —— 项目无 .env 文件，会导致功能全挂',
    )
  })

  featureCase('00-06', '禁改文件均存在且未被清空', async t => {
    const protectedFiles = [
      'modules/ai/glm-vision.ts',
      'modules/ai/ai-types.ts',
      'composables/use-image-recognition.ts',
      'views/feedback.vue',
      'modules/feedback/feedback-diagnostics.ts',
      'modules/auth/email-service.ts',
      'config/constants.ts',
    ]
    const bad: string[] = []
    await t.act('逐个检查禁改文件', () => {
      for (const rel of protectedFiles) {
        try {
          const s = readFileSync(join(SRC, rel), 'utf-8')
          if (s.trim().length < 200) bad.push(`${rel} 内容异常短(${s.length}字符)，疑似被清空`)
        } catch {
          bad.push(`${rel} 不存在或不可读`)
        }
      }
    })
    t.check('全部禁改文件完好', bad.length === 0, bad.join('; '))
  })

  featureCase('00-07', '测试用例总数不低于基线（防删用例）', async t => {
    const suiteDir = resolve(__dirname)
    const files = await t.prepare('扫描 suites 目录', () =>
      readdirSync(suiteDir).filter(f => f.endsWith('.spec.ts')),
    )

    // 两道基线：
    //  1) 测试文件数 —— 防止整个 suite 文件被删掉
    //  2) featureCase 静态调用数 —— 防止用例被逐条删除
    //     （注：01 页面/组件渲染用循环批量生成，静态数少于实际运行数，此处只卡静态written 的部分）
    const FILE_BASELINE = 12
    const CASE_BASELINE = 219

    t.check(
      `测试文件数 ${files.length} 不低于基线 ${FILE_BASELINE}`,
      files.length >= FILE_BASELINE,
      `测试文件从 ${FILE_BASELINE} 个减到 ${files.length} 个 —— 有整个功能域的测试被删除`,
    )

    const count = await t.act('统计 featureCase 静态调用数', () => {
      let n = 0
      for (const f of files) {
        const src = readFileSync(join(suiteDir, f), 'utf-8')
        n += (src.match(/featureCase\(/g) ?? []).length
      }
      return n
    })

    // 新增用例后可上调基线；**下调基线等于放行删除测试，禁止**。
    t.check(
      `用例数 ${count} 不低于基线 ${CASE_BASELINE}`,
      count >= CASE_BASELINE,
      `用例数从 ${CASE_BASELINE} 跌到 ${count} —— 有人删除了测试用例`,
    )
  })

  featureCase('00-09', '落地页对外展示的数字不虚高', async t => {
    const suiteDir = resolve(__dirname)
    const files = await t.prepare('扫描 suites 目录', () =>
      readdirSync(suiteDir).filter(f => f.endsWith('.spec.ts')),
    )

    // 静态统计只是下界：01 页面/组件渲染用循环批量生成用例，实际运行数会更多。
    // 因此用例数只卡「不得低于静态下界」，功能域数则可精确比对。
    const actual = await t.act('统计静态用例下界与功能域数', () => {
      let caseFloor = 0
      const domains = new Set<string>()
      for (const f of files) {
        const src = readFileSync(join(suiteDir, f), 'utf-8')
        caseFloor += (src.match(/featureCase\(/g) ?? []).length
        for (const m of src.matchAll(/describe\(\s*['"](\d+)\s*·/g)) domains.add(m[1])
      }
      return { caseFloor, domains: domains.size }
    })

    const landing = await t.act('读取落地页 STATS', () =>
      readFileSync(join(SRC, 'views/landing.vue'), 'utf-8'),
    )
    const shownCases = Number(landing.match(/value:\s*'(\d+)',\s*label:\s*'测试用例全绿'/)?.[1] ?? 0)
    const shownDomains = Number(landing.match(/value:\s*'(\d+)',\s*label:\s*'功能域覆盖'/)?.[1] ?? 0)

    t.check('落地页能解析出两个数字', shownCases > 0 && shownDomains > 0,
      `落地页 STATS 解析失败：用例数=${shownCases} 功能域=${shownDomains}`)
    t.check(
      `落地页功能域 ${shownDomains} 与实际 ${actual.domains} 一致`,
      shownDomains === actual.domains,
      `落地页写 ${shownDomains} 个功能域，实际 ${actual.domains} 个 —— 对外数字已过时`,
    )
    t.check(
      `落地页用例数 ${shownCases} 不低于静态下界 ${actual.caseFloor}`,
      shownCases >= actual.caseFloor,
      `落地页写 ${shownCases} 条用例，但静态可数的已有 ${actual.caseFloor} 条 —— 对外数字已过时`,
    )
  })

  featureCase('00-08', 'localStorage 不可用时应用不崩（隐私模式/配额超限）', async t => {
    await t.prepare('创建 Pinia', () => freshPinia())
    const io = await t.prepare('导入存储封装', async () => await import('@/shared/cache/local-storage-io'))

    await t.act('开启存储故障模式', () => setStorageFailMode(true))

    const r1 = await t.act('故障下读 JSON 应返回兜底值而非抛错', () => io.loadJSON('any_key', { fallback: 1 }))
    t.check('读取返回兜底值', (r1 as any)?.fallback === 1, '存储故障时读取未走兜底')

    await t.act('故障下写 JSON 应静默不抛错', () => io.saveJSON('any_key', { a: 1 }))
    await t.act('故障下删除应静默不抛错', () => io.removeKey('any_key'))

    const r2 = await t.act('故障下读字符串应返回 null', () => io.loadString('any_key'))
    t.check('读字符串返回 null', r2 === null, `期望 null，实得 ${r2}`)

    await t.act('恢复存储', () => setStorageFailMode(false))
  })
})
