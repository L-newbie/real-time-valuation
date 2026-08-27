/**
 * 真实接口探活（smoke）- 独立配置
 *
 * 与主测试（npm run test）完全隔离：
 *   主测试  —— 桩数据、离线、18 秒、提交前必跑
 *   本探活  —— 真实请求、需联网、1~2 分钟、定期手动跑
 *
 * 不复用 setup/global-setup.ts —— 那里装了网络桩会拦截所有请求，
 * 本文件的全部意义就是"真的打出去"。
 */

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, '../src') },
  },
  test: {
    root: resolve(__dirname, '..'),
    include: ['test/smoke/**/*.smoke.ts'],
    // node 环境即可：探活只发请求验结构，不挂组件。
    // 且 node 无浏览器 CORS 限制，可直连各接口（浏览器里要靠 JSONP/代理的接口这里能直接 fetch）
    environment: 'node',
    globals: true,
    reporters: [resolve(__dirname, 'reporter/smoke-reporter.ts')],
    testTimeout: 30000,
    hookTimeout: 30000,
    // 探活按顺序跑，避免并发把对方限流
    fileParallelism: false,
    maxConcurrency: 3,
  },
})
