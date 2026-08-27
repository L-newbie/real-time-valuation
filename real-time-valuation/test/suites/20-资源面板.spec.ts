import { describe } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { featureCase } from '../helpers/case'
import ResourcePanel from '@/views/resource-panel.vue'

async function nextFrame(): Promise<void> {
  await new Promise(r => requestAnimationFrame(() => r(null)))
}

describe('20 · 资源使用面板', () => {
  featureCase('20-01', '面板可挂载并渲染四个统计区块', async t => {
    await t.prepare('初始化 pinia 与存储样本', () => {
      setActivePinia(createPinia())
      localStorage.setItem('jgb_fund_codes', JSON.stringify(['110011', '000001']))
    })
    const w = await t.act('挂载资源面板', async () => {
      const c = mount(ResourcePanel)
      await nextFrame()
      await c.vm.$nextTick()
      return c
    })
    const txt = w.text()
    t.check('标题渲染', txt.includes('资源使用'), '未渲染标题')
    t.check('存储区渲染', txt.includes('存储占用'), '未渲染存储区')
    t.check('网络区渲染', txt.includes('网络请求'), '未渲染网络区')
    t.check('缓存区渲染', txt.includes('缓存命中'), '未渲染缓存区')
    t.check('运行时区渲染', txt.includes('运行时'), '未渲染运行时区')
    t.check('四个卡片齐全', w.findAll('.rp-card').length === 4, '卡片数不为 4')
  })

  featureCase('20-02', '存储统计可读且按字节降序', async t => {
    await t.prepare('写入大小差异明显的两条数据', () => {
      setActivePinia(createPinia())
      localStorage.setItem('jgb_big_sample', 'x'.repeat(4000))
      localStorage.setItem('jgb_small_sample', 'y')
    })
    const mod = await t.act('导入统计模块', async () =>
      await import('@/modules/resource/resource-stats'))
    const s = mod.readStorageSummary()
    t.check('总量为正', s.total > 0, '总量为 0')
    t.check('条目非空', s.items.length > 0, '条目为空')
    t.check('按字节降序', s.items.every((it, i) => i === 0 || s.items[i - 1].bytes >= it.bytes), '未降序')
    t.check('占比为有效数值', Number.isFinite(s.percent), 'percent 非数值')
    t.check('字节格式化可用', mod.formatBytes(2048) === '2.0 KB', `实得 ${mod.formatBytes(2048)}`)
  })

  featureCase('20-03', '刷新可重新采集且面板不崩', async t => {
    await t.prepare('初始化', () => setActivePinia(createPinia()))
    const w = await t.act('挂载并点击刷新', async () => {
      const c = mount(ResourcePanel)
      await nextFrame()
      await c.find('.rp-refresh').trigger('click')
      await nextFrame()
      await c.vm.$nextTick()
      return c
    })
    t.check('面板仍存活', w.find('.rp-page').exists(), '刷新后面板消失')
    t.check('卡片仍为 4 个', w.findAll('.rp-card').length === 4, '刷新后卡片数异常')
  })
})
