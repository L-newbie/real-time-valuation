#!/usr/bin/env node
/**
 * 测试总入口 - 一条命令跑完「功能可用性测试」+「外部接口探活」
 *
 *   npm run test                 全跑（功能测试 + 接口探活）
 *   SKIP_SMOKE=1 npm run test    只跑功能测试，跳过探活
 *   npm run test:smoke           只跑接口探活
 *
 * 为什么用两个子进程而不是合成一次 vitest 运行：
 *   主测试装了网络桩（拦截所有 fetch，保证离线可跑、结果稳定），
 *   探活则必须真发请求 —— 两者的环境要求互斥，同进程内无法共存。
 *   分进程跑最干净，也便于单独吞掉探活的退出码。
 *
 * 退出码规则（关键）：
 *   只取主测试的退出码。探活无论结果如何都不影响，它只是「看一下」——
 *   公共接口和免费代理本就会抖，本地无外网时更是全红，不能让它拦住提交。
 *
 * ⚠️ 本文件属 test/ 禁改范围：它是测试门槛的执行者，
 *    改动它等于改动"什么情况下算通过"。需要调整请先与用户确认。
 */

import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// 本文件位于 test/ 下，上一级即仓库根目录
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const argv = process.argv.slice(2)
const skipSmoke = argv.includes('--no-smoke') || process.env.SKIP_SMOKE === '1'
const onlySmoke = argv.includes('--smoke-only')

function run(cfg) {
  const r = spawnSync(
    process.execPath,
    [resolve(ROOT, 'node_modules/vitest/vitest.mjs'), 'run', '--config', resolve(ROOT, cfg)],
    { cwd: ROOT, stdio: 'inherit', env: process.env },
  )
  return r.status ?? 1
}

let mainCode = 0

if (!onlySmoke) {
  // ① 功能可用性测试 —— 唯一的通过条件
  mainCode = run('test/vitest.config.ts')
}

if (!skipSmoke) {
  // ② 外部接口探活 —— 仅供了解，退出码一律忽略
  run('test/vitest.smoke.config.ts')
}

// 只认主测试的结果
process.exit(onlySmoke ? 0 : mainCode)
