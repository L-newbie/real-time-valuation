/**
 * 28 · 落地页
 *
 * /landing 是独立营销页，脱离 app-shell 的 100dvh 容器自己管滚动。
 * 这里验证它能挂载、结构完整、滚动驱动的动效参数确实随进度变化、
 * 以及 CTA 能真的跳进应用 —— 白屏与状态机卡死是这层唯一致命的问题。
 */

import { describe } from 'vitest'
import { featureCase } from '../helpers/case'
import { freshPinia } from '../helpers/seed'
import { flush } from '../helpers/gesture'

async function mountLanding() {
  freshPinia()
  const { mount } = await import('@vue/test-utils')
  const { createRouter, createWebHashHistory } = await import('vue-router')
  const real = (await import('@/router/index')).default
  const router = createRouter({ history: createWebHashHistory(), routes: real.getRoutes() as any })
  await router.push('/landing')
  await router.isReady()

  const comp = (await import('@/views/landing.vue')).default
  const wrapper = mount(comp, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: { RouterLink: true, transition: false, 'transition-group': false },
    },
  })
  await flush()
  return { wrapper, router }
}

describe('28 · 落地页', () => {
  featureCase('28-01', '落地页挂载且首屏结构完整', async t => {
    const { wrapper } = await t.prepare('挂载 /landing', () => mountLanding())
    const html = wrapper.html()

    t.check('页面已渲染', !!html, '落地页白屏')
    t.check('有顶部导航', wrapper.find('.lp-nav').exists(), '缺少顶部导航')
    t.check('有品牌标识', wrapper.find('.lp-brand').exists(), '缺少品牌区')
    t.check('有主标题', wrapper.find('.lp-title').exists(), '缺少 Hero 标题')
    t.check('有主视觉卡片', wrapper.find('.lp-card').exists(), '缺少持仓卡主视觉')
    t.check('有背景层', wrapper.find('.lp-bg').exists(), '缺少背景装饰层')
    wrapper.unmount()
  })

  featureCase('28-02', '各内容分区齐全', async t => {
    const { wrapper } = await t.prepare('挂载 /landing', () => mountLanding())

    for (const id of ['features', 'groups', 'trust']) {
      t.check(`存在 #${id} 分区`, wrapper.find(`#${id}`).exists(), `缺少 ${id} 分区，导航点了会没反应`)
    }
    t.check('渲染出特性面板', wrapper.findAll('.lp-face').length >= 4,
      `实得 ${wrapper.findAll('.lp-face').length} 个特性面`)
    t.check('同时只有一面处于展示态', wrapper.findAll('.lp-face.on').length === 1,
      `实得 ${wrapper.findAll('.lp-face.on').length} 个当前面，轮播会重叠显示`)
    t.check('每个面都有对应的切换点', wrapper.findAll('.lp-orb-dot').length === wrapper.findAll('.lp-face').length,
      '切换点与面数量不一致，点了会跳错')
    t.check('渲染出分组示意卡', wrapper.findAll('.lp-mini').length >= 3,
      `实得 ${wrapper.findAll('.lp-mini').length} 张分组卡`)
    t.check('有数据统计区', wrapper.findAll('.lp-stat').length >= 3,
      `实得 ${wrapper.findAll('.lp-stat').length} 项统计`)
    t.check('有免责声明', wrapper.html().includes('不构成任何投资建议'), '缺少免责声明')
    wrapper.unmount()
  })

  featureCase('28-03', '滚动驱动的动效随进度变化', async t => {
    const { wrapper } = await t.prepare('挂载 /landing', () => mountLanding())
    const root = wrapper.find('.lp').element as HTMLElement

    const before = {
      card: wrapper.find('.lp-card').attributes('style') ?? '',
      flash: wrapper.find('.lp-flash').attributes('style') ?? '',
    }
    t.check('初始卡片有 transform', before.card.includes('transform'), '卡片未应用 3D 变换')

    await t.act('模拟向下滚动', async () => {
      Object.defineProperty(root, 'clientHeight', { value: 800, configurable: true })
      root.scrollTop = 500
      root.dispatchEvent(new Event('scroll'))
      await flush()
      await new Promise(r => requestAnimationFrame(() => r(null)))
      await flush()
    })

    const after = {
      card: wrapper.find('.lp-card').attributes('style') ?? '',
      flash: wrapper.find('.lp-flash').attributes('style') ?? '',
    }
    t.check('卡片变换随滚动改变', after.card !== before.card,
      '滚动后卡片 transform 没变，穿越镜头动效失效')
    t.check('白光遮罩随滚动改变', after.flash !== before.flash,
      '滚动后白光透明度没变，转场看不出来')
    wrapper.unmount()
  })

  featureCase('28-04', 'CTA 能进入应用', async t => {
    const { wrapper, router } = await t.prepare('挂载 /landing', () => mountLanding())

    const targets: string[] = []
    const origPush = router.push.bind(router)
    ;(router as any).push = (to: any) => { targets.push(String(to)); return origPush(to) }

    const btns = wrapper.findAll('.lp-cta')
    t.check('存在主 CTA 按钮', btns.length > 0, '找不到「开始使用」按钮')
    t.check('页面内多处提供入口', btns.length >= 2, `只有 ${btns.length} 个 CTA，滚到底部就没有入口了`)

    await t.act('点击主 CTA', async () => {
      await btns[0].trigger('click')
      await flush()
    })
    t.check('触发了跳转到首页', targets.includes('/'),
      `实得跳转目标 ${JSON.stringify(targets)}，CTA 点了没有发起导航`)

    await t.act('点击底部 CTA', async () => {
      await btns[btns.length - 1].trigger('click')
      await flush()
    })
    t.check('底部 CTA 同样可用', targets.filter(x => x === '/').length >= 2,
      `底部 CTA 未发起导航，实得 ${JSON.stringify(targets)}`)
    wrapper.unmount()
  })

  featureCase('28-05', '导航胶囊可跳转到对应分区', async t => {
    const { wrapper } = await t.prepare('挂载 /landing', () => mountLanding())

    const pills = wrapper.findAll('.lp-pill')
    t.check('渲染出导航胶囊', pills.length === 3, `实得 ${pills.length} 个胶囊`)

    await t.act('点击第一个胶囊', async () => {
      await pills[0].trigger('click')
      await flush()
    })
    t.check('点击后未抛异常', !!wrapper.html(), '点击导航后页面崩溃')
    wrapper.unmount()
  })

  featureCase('28-06', '落地页不显示应用底部导航', async t => {
    freshPinia()
    const { mount } = await import('@vue/test-utils')
    const { createRouter, createWebHashHistory } = await import('vue-router')
    const real = (await import('@/router/index')).default
    const router = createRouter({ history: createWebHashHistory(), routes: real.getRoutes() as any })

    const wrapper = await t.prepare('以 /landing 路由挂载 App', async () => {
      await router.push('/landing')
      await router.isReady()
      const App = (await import('@/App.vue')).default
      const w = mount(App, {
        attachTo: document.body,
        global: { plugins: [router], stubs: { transition: false, 'transition-group': false } },
      })
      await flush()
      return w
    })

    t.check('App 已渲染', !!wrapper.html(), 'App 在 /landing 下白屏')
    t.check('无底部导航', !wrapper.find('.main-nav').exists(),
      '落地页出现了应用的底部导航，营销页不该有')
    t.check('shell 解除高度锁定', wrapper.find('.shell-free').exists(),
      'shell 未进入 free 模式，落地页会被锁在 100dvh 里滚不动')
    wrapper.unmount()
  })

  featureCase('28-07', 'logo 点击回到顶部而不是跳错路由', async t => {
    const { wrapper, router } = await t.prepare('挂载 /landing', () => mountLanding())

    const brand = wrapper.find('.lp-brand')
    t.check('存在品牌区', brand.exists(), '找不到左上角 logo')
    t.check('不是 a[href] 锚点', brand.element.tagName === 'BUTTON',
      'logo 仍是 <a href="#top">，hash 路由下会被当成路由 /top 而白屏')

    await t.act('点击 logo', async () => {
      await brand.trigger('click')
      await flush()
    })
    t.check('路由仍停在落地页', router.currentRoute.value.path === '/landing',
      `实得路由 ${router.currentRoute.value.path}，点 logo 跳走了`)
    t.check('页面未白屏', !!wrapper.find('.lp-hero').exists(), '点 logo 后首屏消失')
    wrapper.unmount()
  })

  featureCase('28-08', '首次进入展示主页，看过后直接进应用', async t => {
    const { shouldShowLanding, markLandingSeen } = await t.prepare('加载路由判定', async () => {
      localStorage.removeItem('jgb_landing_seen')
      return import('@/router/index')
    })

    const wide = await t.act('模拟宽屏首次访问', () => {
      window.matchMedia = ((q: string) => ({ matches: q.includes('1024'), media: q, addEventListener() {}, removeEventListener() {} })) as any
      return shouldShowLanding()
    })
    t.check('宽屏首次应展示主页', wide === true, '宽屏新用户没看到落地页')

    await t.act('标记为已看过', () => markLandingSeen())
    t.check('已落盘', localStorage.getItem('jgb_landing_seen') === '1', '标记未写入，每次打开都会看到主页')
    t.check('第二次不再展示', shouldShowLanding() === false, '看过之后仍被拦到落地页，很打扰')
  })

  featureCase('28-09', '移动端与电脑端一致，首次都先看落地页', async t => {
    const { shouldShowLanding, markLandingSeen } = await t.prepare('加载路由判定', async () => {
      localStorage.removeItem('jgb_landing_seen')
      return import('@/router/index')
    })

    const narrow = await t.act('模拟窄屏首次访问', () => {
      window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any
      return shouldShowLanding()
    })
    t.check('移动端首次也展示主页', narrow === true, '手机端首次进入没看到落地页，与电脑端不一致')

    const noMql = await t.act('matchMedia 不可用时', () => {
      const orig = window.matchMedia
      ;(window as any).matchMedia = undefined
      try { return shouldShowLanding() } finally { window.matchMedia = orig }
    })
    t.check('判定不再依赖 matchMedia', noMql === true, '屏宽探测缺失时判定就失灵了，说明仍在看屏宽')

    await t.act('标记为已看过', () => markLandingSeen())
    t.check('移动端看过后直接进应用', shouldShowLanding() === false, '手机端每次打开都被拦到落地页')
  })

  featureCase('28-10', '特性轮播可点切换，一次只展示一面', async t => {
    const { wrapper } = await t.prepare('挂载 /landing', () => mountLanding())

    const dots = wrapper.findAll('.lp-orb-dot')
    t.check('切换点已渲染', dots.length >= 4, `实得 ${dots.length} 个切换点`)

    const firstOn = wrapper.findAll('.lp-face').findIndex(f => f.classes().includes('on'))
    t.check('初始定位在第一面', firstOn === 0, `实得当前面 ${firstOn}`)

    await t.act('点击第三个切换点', async () => {
      await dots[2].trigger('click')
      await wrapper.vm.$nextTick()
    })

    const nowOn = wrapper.findAll('.lp-face').findIndex(f => f.classes().includes('on'))
    t.check('切到第三面', nowOn === 2, `实得当前面 ${nowOn}，点了没反应或跳错`)
    t.check('仍只有一面展示', wrapper.findAll('.lp-face.on').length === 1,
      `实得 ${wrapper.findAll('.lp-face.on').length} 面同时展示`)

    wrapper.unmount()
  })
})
