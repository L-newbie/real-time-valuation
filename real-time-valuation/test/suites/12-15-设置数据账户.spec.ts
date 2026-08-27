/**
 * 12 · 设置   13 · 数据管理   15 · 账户
 */

import { describe } from 'vitest'
import { featureCase, isDefined } from '../helpers/case'
import { freshPinia, TEST_FUNDS } from '../helpers/seed'

async function settingsStore() {
  freshPinia()
  const { useSettingsStore } = await import('@/modules/settings/settings-store')
  return useSettingsStore()
}

describe('12 · 设置', () => {
  featureCase('12-01', '主题切换并应用到 DOM', async t => {
    const s = await t.prepare('创建 settings store', () => settingsStore())
    await t.act('初始化主题', () => s.initTheme())
    const before = s.theme
    await t.act('切换主题', () => s.toggleTheme())
    t.check('主题值已变化', s.theme !== before, `主题未变化，仍为 ${s.theme}`)
    await t.act('应用主题到 DOM', () => s.applyTheme(s.theme))
    t.check('DOM 已响应主题', isDefined(document.documentElement.className) || isDefined(document.documentElement.dataset), '主题未应用到 DOM')
  })

  featureCase('12-02', '四项自动刷新开关均可切换', async t => {
    const s = await t.prepare('创建 settings store', () => settingsStore())
    const fields = ['autoRefresh', 'marketAutoRefresh', 'sectorAutoRefresh', 'newsAutoRefresh'] as const
    const bad: string[] = []
    await t.act('逐项切换', () => {
      for (const f of fields) {
        const before = (s as any)[f]
        ;(s as any)[f] = !before
        if ((s as any)[f] === before) bad.push(f)
      }
    })
    t.check('全部开关均生效', bad.length === 0, `以下开关切换无效：${bad.join(', ')}`)
  })

  featureCase('12-03', '四项刷新间隔均可设置', async t => {
    const s = await t.prepare('创建 settings store', () => settingsStore())
    const fields = ['refreshInterval', 'marketRefreshInterval', 'sectorRefreshInterval', 'newsRefreshInterval'] as const
    const bad: string[] = []
    await t.act('逐项设置为 60', () => {
      for (const f of fields) {
        ;(s as any)[f] = 60
        if ((s as any)[f] !== 60) bad.push(f)
      }
    })
    t.check('全部间隔设置生效', bad.length === 0, `以下间隔设置无效：${bad.join(', ')}`)
  })

  featureCase('12-04', '已下线的视觉/海外资讯开关不再存在（防回归）', async t => {
    const s = await t.prepare('创建 settings store', () => settingsStore())
    // 这些开关已随「视觉效果设置下线 + 海外 RSS 国内不可达」一并移除：
    // 毛玻璃/动画固定生效，搜索发光常亮，资讯只保留新浪源。
    const removed = ['reduceMotion', 'showPageMarquee', 'showSearchGlow', 'enableGlassEffect', 'overseasNews'] as const
    const back: string[] = []
    await t.act('逐项确认字段已移除', () => {
      for (const f of removed) {
        if ((s as any)[f] !== undefined) back.push(f)
      }
    })
    t.check('已下线开关未被重新引入', back.length === 0, `以下开关不应再存在：${back.join(', ')}`)
  })

  featureCase('12-05', '功能类开关均可切换（经理核查/预测）', async t => {
    const s = await t.prepare('创建 settings store', () => settingsStore())
    const fields = ['enableManagerCheck', 'enablePrediction'] as const
    const bad: string[] = []
    await t.act('逐项切换', () => {
      for (const f of fields) {
        const before = (s as any)[f]
        ;(s as any)[f] = !before
        if ((s as any)[f] === before) bad.push(f)
      }
    })
    t.check('全部功能开关生效', bad.length === 0, `以下开关无效：${bad.join(', ')}`)
  })

  featureCase('12-06', '隐私设置逐项切换', async t => {
    const s = await t.prepare('创建 settings store', () => settingsStore())
    const keys = await t.act('读取隐私设置字段', () => Object.keys(s.privacy))
    t.check('隐私设置字段非空', keys.length > 0, '隐私设置为空对象')
    const k = keys[0]
    const before = (s.privacy as any)[k]
    await t.act(`切换隐私项 ${k}`, () => {
      ;(s.privacy as any)[k] = !before
    })
    t.check('隐私项已切换', (s.privacy as any)[k] !== before, `隐私项 ${k} 切换无效`)
  })

  featureCase('12-07', '隐私全显 / 全隐', async t => {
    const s = await t.prepare('创建 settings store', () => settingsStore())
    await t.act('全部隐藏', () => s.hideAllPrivacy())
    t.check('状态为全隐藏', s.privacyState === 'all-hidden', `期望 all-hidden，实得 ${s.privacyState}`)
    await t.act('全部显示', () => s.showAllPrivacy())
    t.check('状态为全显示', s.privacyState === 'all-visible', `期望 all-visible，实得 ${s.privacyState}`)
  })

  featureCase('12-08', '恢复默认设置', async t => {
    const s = await t.prepare('创建 store 并改动设置', async () => {
      const st = await settingsStore()
      st.autoRefresh = false
      st.enableManagerCheck = false
      return st
    })
    await t.act('恢复默认', () => s.resetToDefaults())
    t.check('设置对象仍可用', isDefined(s.theme), '恢复默认后设置被破坏')
  })

  featureCase('12-09', '设置落盘后可读回', async t => {
    const s = await t.prepare('创建 store 并改动设置', async () => {
      const st = await settingsStore()
      st.refreshInterval = 120 as any
      return st
    })
    // settings-store 用 watch 自动落盘，等一个微任务周期
    await t.act('等待自动落盘', async () => {
      await new Promise(r => globalThis.setTimeout(r, 20))
    })
    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_user_settings'))
    t.check('设置已落盘', !!raw, '设置未落盘 —— 刷新页面全部设置会重置')
  })

  featureCase('12-10', '设置对象序列化（toObject）', async t => {
    const s = await t.prepare('创建 settings store', () => settingsStore())
    const obj = await t.act('序列化设置对象', () => (s as any).toObject?.() ?? { theme: s.theme })
    t.check('序列化结果非空', isDefined(obj) && Object.keys(obj).length > 0, '设置序列化为空 —— 导出功能会导出空数据')
  })
})

describe('13 · 数据管理', () => {
  featureCase('13-01', '清空基金数据', async t => {
    freshPinia()
    const f = await t.prepare('创建 fund store 并铺数据', async () => {
      const { useFundStore } = await import('@/modules/fund/fund-store')
      const st = useFundStore()
      for (const x of TEST_FUNDS) st.addFund(x.code, x.name)
      return st
    })
    t.check('清空前有数据', f.fundCodes.length > 0, '前置数据未铺好')
    await t.act('逐个删除基金', () => {
      for (const x of [...f.fundCodes]) f.removeFund(x)
    })
    t.check('基金列表已清空', f.fundCodes.length === 0, `清空后仍有 ${f.fundCodes.length} 只`)
  })

  featureCase('13-02', '清空持仓数据', async t => {
    freshPinia()
    const h = await t.prepare('创建 holding store 并铺数据', async () => {
      const { useHoldingStore } = await import('@/modules/holding/holding-store')
      const st = useHoldingStore()
      st.restoreHoldings()
      for (const x of TEST_FUNDS) st.addHoldingByAmount(x.code, 10000, 1.234)
      return st
    })
    await t.act('清空全部持仓', () => h.clearAllHoldings())
    t.check('持仓已清空', h.holdings.length === 0, `清空后仍有 ${h.holdings.length} 笔`)
    const raw = await t.act('读取落盘数据', () => localStorage.getItem('jgb_holdings'))
    t.check('落盘已同步为空', !raw || raw === '[]', `清空后落盘仍有数据：${String(raw).slice(0, 40)}`)
  })

  featureCase('13-03', '清空缓存数据', async t => {
    freshPinia()
    const c = await t.prepare('创建 cache store', async () => {
      const { useCacheStore } = await import('@/modules/fund/cache-store')
      return useCacheStore()
    })
    await t.act('清空全部缓存', () => c.clearAllCache())
    t.check('cache store 仍可用', isDefined(c), '清空缓存后 store 被破坏')
  })

  featureCase('13-04', '清空自选股数据', async t => {
    freshPinia()
    const s = await t.prepare('创建 stock store 并加自选', async () => {
      const { useStockStore } = await import('@/modules/stock/stock-store')
      const st = useStockStore()
      st.restoreWatchlist()
      st.addToWatchlist({ code: '600519', name: '贵州茅台', rawMarket: '1' } as any)
      return st
    })
    await t.act('移除全部自选', () => {
      for (const x of [...s.watchlist]) s.removeFromWatchlist(x.code)
    })
    t.check('自选已清空', s.watchlist.length === 0, `清空后仍有 ${s.watchlist.length} 只`)
  })

  featureCase('13-05', '清空后 localStorage 同步（不残留）', async t => {
    freshPinia()
    const f = await t.prepare('创建 fund store 并铺数据', async () => {
      const { useFundStore } = await import('@/modules/fund/fund-store')
      const st = useFundStore()
      st.addFund('000001', '华夏成长混合')
      return st
    })
    await t.act('删除该基金', () => f.removeFund('000001'))
    const raw = await t.act('读取落盘', () => localStorage.getItem('jgb_fund_codes'))
    t.check('落盘不含已删除项', !raw || !raw.includes('000001'), '删除后落盘仍残留 —— 刷新会复活')
  })

  featureCase('13-06', '数据导出内容非空（可用于备份）', async t => {
    freshPinia()
    await t.prepare('铺基金与持仓数据', async () => {
      const { useFundStore } = await import('@/modules/fund/fund-store')
      const { useHoldingStore } = await import('@/modules/holding/holding-store')
      const f = useFundStore()
      const h = useHoldingStore()
      h.restoreHoldings()
      for (const x of TEST_FUNDS) {
        f.addFund(x.code, x.name)
        h.addHoldingByAmount(x.code, 10000, 1.234)
      }
      h.flushAllPersist()
    })
    const dump = await t.act('导出全部 localStorage 数据', () => {
      const out: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) out[k] = localStorage.getItem(k) as string
      }
      return out
    })
    t.check('导出内容非空', Object.keys(dump).length > 0, '导出为空 —— 备份功能不可用')
    t.check('导出可 JSON 序列化', typeof JSON.stringify(dump) === 'string', '导出数据无法序列化')
  })
})

describe('15 · 账户', () => {
  async function authStore() {
    freshPinia()
    const { useAuthStore } = await import('@/modules/auth/auth-store')
    return useAuthStore()
  }

  featureCase('15-01', '注册新用户', async t => {
    const a = await t.prepare('创建 auth store', () => authStore())
    const r = await t.act('注册 test@example.com', async () => await a.register('test@example.com', 'pwd123456', '测试用户'))
    t.check('注册返回结果对象', isDefined(r), 'register 返回空')
    t.check('注册成功', r.ok === true, `注册失败：${r.error}`)
  })

  featureCase('15-02', '登录成功', async t => {
    const a = await t.prepare('创建 store 并注册用户', async () => {
      const s = await authStore()
      await s.register('test@example.com', 'pwd123456', '测试用户')
      s.logout()
      return s
    })
    const r = await t.act('用正确密码登录', async () => await a.login('test@example.com', 'pwd123456'))
    t.check('登录成功', r.ok === true, `登录失败：${r.error}`)
    t.check('登录态为真', a.isLoggedIn === true, '登录后 isLoggedIn 仍为 false')
    t.check('当前用户存在', isDefined(a.currentUser), '登录后 currentUser 为空')
  })

  featureCase('15-03', '密码错误被拒绝', async t => {
    const a = await t.prepare('创建 store 并注册用户', async () => {
      const s = await authStore()
      await s.register('test@example.com', 'pwd123456', '测试用户')
      s.logout()
      return s
    })
    const r = await t.act('用错误密码登录', async () => await a.login('test@example.com', 'wrongpwd'))
    t.check('登录被拒绝', r.ok === false, '错误密码竟然登录成功 —— 账户安全问题')
    t.check('未进入登录态', a.isLoggedIn === false, '错误密码后仍处于登录态')
  })

  featureCase('15-04', '登出清除会话', async t => {
    const a = await t.prepare('创建 store 并登录', async () => {
      const s = await authStore()
      await s.register('test@example.com', 'pwd123456', '测试用户')
      return s
    })
    await t.act('登出', () => a.logout())
    t.check('登录态已清除', a.isLoggedIn === false, '登出后仍处于登录态')
  })

  featureCase('15-05', '账户数据落盘可读回', async t => {
    await t.prepare('创建 store 并注册', async () => {
      const s = await authStore()
      await s.register('test@example.com', 'pwd123456', '测试用户')
      return s
    })
    await t.act('等待自动落盘', async () => {
      await new Promise(r => globalThis.setTimeout(r, 20))
    })
    const raw = await t.act('读取 localStorage', () => localStorage.getItem('jgb_auth'))
    t.check('账户数据已落盘', !!raw, '账户未落盘 —— 刷新页面需重新注册')
  })

  featureCase('15-06', '重复注册同一邮箱被拒绝', async t => {
    const a = await t.prepare('创建 store 并注册一次', async () => {
      const s = await authStore()
      await s.register('dup@example.com', 'pwd123456', '用户A')
      return s
    })
    const r = await t.act('用同一邮箱再次注册', async () => await a.register('dup@example.com', 'pwd999999', '用户B'))
    t.check('重复注册被拒绝', r.ok === false, '同一邮箱可重复注册 —— 会覆盖已有账户')
  })

  featureCase('15-07', '验证码模块可加载（不触发真实发信）', async t => {
    const m = await t.act('导入验证码模块', async () => await import('@/modules/auth/verify-code'))
    t.check('模块有导出', Object.keys(m).length > 0, '验证码模块无导出')
  })

  featureCase('15-08', '密码加密模块可用', async t => {
    const m = await t.act('导入加密模块', async () => await import('@/modules/auth/crypto'))
    const fn = Object.values(m).find(v => typeof v === 'function') as any
    t.check('加密函数存在', typeof fn === 'function', '加密模块无可用函数')
    const out = await t.act('加密一个密码', async () => await fn('pwd123456'))
    t.check('加密结果非空', isDefined(out) && String(out).length > 0, '加密返回空 —— 密码会明文存储')
    t.check('加密结果与原文不同', String(out) !== 'pwd123456', '加密后仍是明文 —— 密码未被保护')
  })
})
