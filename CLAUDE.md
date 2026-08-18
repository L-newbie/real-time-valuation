# AI 协作规约

> 本文件在 AI 会话开始时自动读取，用户无感。
> 配套硬拦截见 `.claude/settings.json`（`permissions.deny` + `PreToolUse` hook 双层拦截）。
> 本文档与 hook 提示一致：**改动禁改清单内文件会导致功能静默失效，必须先告诉用户，由用户决定。**

---

## 一、禁改清单

以下文件/目录**禁止修改**（Edit / Write / `sed -i` / 重定向覆写 / `rm` / `mv` / `cp` 均在拦截范围内）。需要变更时，先向用户说明原因与影响，由用户亲自操作或明确授权。

| 范围 | 路径 |
|---|---|
| 配置密钥 | `src/config/constants.ts`（整文件） |
| 图像识别 | `src/modules/ai/**`、`src/composables/use-image-recognition.ts` |
| 问题反馈 | `src/views/feedback.vue`、`src/modules/feedback/**`、`src/modules/auth/email-service.ts` |
| 测试流程 | `test/**`、`CLAUDE.md`（本文件）、`.claude/**` |

**为什么禁改**：这些文件涉及密钥常量、外部服务接入与测试基准，静默改动不会在编译期报错，但会导致图像识别、问题反馈、邮件发送等功能静默失效，或让测试失去守门作用。

---

## 二、测试规则

**测试失败时：修改业务代码修复，禁止修改 `test/` 下任何文件。**

- 提交前跑 `npm run test`，全绿才提交；完整的验证是 `npm run precommit`（`vue-tsc` 类型检查 + 全部测试）。
- 测试输出分两段，**退出码只取第一段**（功能可用性检查，桩数据、离线、约 18 秒）；
  第二段外部接口探活只是体检报告，永不影响退出码，不用为它改代码。
- 失败报告会自动展开到「卡在第几步 · 现象 · 用例位置」。一处改动常牵连多条用例，
  先修末尾「首个失败」指向的那条，多半是同一个根因。
- 常见失败模式：金额字段算出 `NaN`（界面显示 `--`）。修 `src/shared/utils/safe-math.ts`
  等被多处调用的工具函数时尤其小心。
- `test/suites/00-*.spec.ts` 里有**用例数基线**：新增功能时在对应 suite 加用例并**上调**基线；
  基线只能上调不能下调，下调等于放行删除测试。
- 接口结构变化时更新 `test/setup/net-stub.ts` 的网络样本，不要为用例去适配业务代码。

---

## 三、代码风格

- **不写注释**：代码中不保留任何注释，已有注释维持原样即可，新增代码一律不加。
- 命名与结构跟随所在模块的既有写法。

---

## 四、常用命令

```bash
npm run dev                # 开发（绑定局域网 IP，见 package.json）
npm run test               # 提交前跑这个：功能测试 + 接口探活
SKIP_SMOKE=1 npm run test  # 只跑功能测试，跳过探活
npm run test:watch         # 开发时监听重跑
npm run precommit          # vue-tsc 类型检查 + 上述全部
npm run build              # vue-tsc --noEmit && vite build
```

推送 `master` 分支后 GitHub Actions 自动构建部署至 Pages；CI **不跑测试**，测试是本地自测工具。

---

## 五、项目速览

- 基攻宝：基金实时估值 + 全球行情追踪 + 财经资讯聚合，Vue 3 + Pinia + Vite + Element Plus + ECharts。
- `src/modules/` 按业务域分模块，`src/shared/` 为跨域共享（缓存、行情、网络、工具等）。
- 测试体系细节见 `test/README.md`。
