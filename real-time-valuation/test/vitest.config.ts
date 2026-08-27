/**
 * Vitest 配置 - 功能可用性测试
 *
 * 与 vite.config.ts 保持同一套 @ 别名，避免测试与业务解析路径不一致。
 * environment 用 happy-dom：提供 document/window/matchMedia，供组件挂载与手势合成。
 */

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  test: {
    root: resolve(__dirname, '..'),
    include: ['test/suites/**/*.spec.ts'],
    environment: 'happy-dom',
    // 关掉 happy-dom 的资源加载：否则 JSONP 注入的 <script src> 会被它真的去请求，
    // 造成 ECONNRESET 并让测试依赖外网。所有出站请求应由 net-stub 接管。
    environmentOptions: {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: true,
          disableJavaScriptEvaluation: true,
          disableCSSFileLoading: true,
          disableIframePageLoading: true,
          disableComputedStyleRendering: true,
        },
      },
    },
    globals: true,
    setupFiles: [resolve(__dirname, 'setup/global-setup.ts')],
    reporters: [resolve(__dirname, 'reporter/feature-reporter.ts')],
    // 用例之间互不影响：每个文件独立环境
    isolate: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    // 关掉 vitest 自身的多余输出，交给自定义 reporter
    silent: false,
  },
})
