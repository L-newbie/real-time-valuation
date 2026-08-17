<div align="center">
  <a href="https://L-newbie.github.io/real-time-valuation/">
    <img src="public/banner.svg" alt="基攻宝 — 实时基金估值 · 全球行情追踪 · 财经资讯聚合" width="100%" />
  </a>
</div>

---

## 🚀 部署

<p align="center">
  <code>npm install</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>npm run dev</code>&nbsp;&nbsp;→&nbsp;&nbsp;打开浏览器
</p>

<p align="center" style="color:#888;font-size:0.9em;">
  推送代码到 <code>master</code> 分支，GitHub Actions 自动构建部署至 Pages<br/>
</p>

---

## 🧪 提交前测试

```bash
npm run test        # 全绿才提交
```

**19 个功能域 · 257 条用例**，覆盖页面渲染、持仓计算、跨日结算、取数容错、UI 手势交互。
提交前跑一次即可确认每个功能是否仍然可用，无需肉眼逐个点。

> 第一段完全离线，不访问真实接口、不消耗密钥额度、不发送真实邮件；
> 第二段已跳过 GLM 与 EmailJS，同样不消耗额度、不发出真实邮件。
>
> 详见 [test/README.md](test/README.md)　·　AI 协作规约见 [CLAUDE.md](CLAUDE.md)

| 命令 | 用途 |
| :-- | :-- |
| `npm run test` | **提交前跑这个** — 功能测试 + 接口探活，一次跑完 |
| `SKIP_SMOKE=1 npm run test` | 只跑功能测试，跳过探活（省 1~2 分钟） |
| `npm run test:watch` | 开发时实时监听，改一存就重跑（常驻，`q` 退出） |
| `node test/run.mjs --smoke-only` | 只跑接口探活 |
| `npm run precommit` | `vue-tsc` 类型检查 + 上述全部 |

### 只看第一段

`npm run test` 输出两段，**退出码只取第一段**：

| | 内容 | 是否决定成败 |
| :-- | :-- | :-- |
| **①** | **功能可用性检查**（桩数据 · 离线 · 18 秒） | ✅ **唯一的通过条件** |
| **②** | 外部接口探活（真实请求） | ❌ 仅供参考，永远不影响退出码 |

<br/>

<details>
<summary><b>✅ 通过时长这样</b> —— 每个功能域折叠成一行</summary>

<br/>

```
  基攻宝 · 功能可用性检查                               2026/8/7 08:08:15
  ═══════════════════════════════════════════════════════════════════════

  ▎00 基础健康                   8/8   ✔
  ▎01 页面渲染                 46/46   ✔
  ▎02 组件渲染                 19/19   ✔
  ▎03 基金管理                 15/15   ✔
  ▎04 持仓管理                 22/22   ✔
  ▎05 T+N与跨日                12/12   ✔
  ▎06 计划任务                   7/7   ✔
  ▎07 自选股票                   8/8   ✔
  ▎08 指数                       6/6   ✔
  ▎09 搜索                       8/8   ✔
  ▎10 资讯                     10/10   ✔
  ▎11 板块行情                   4/4   ✔
  ▎12 设置                     10/10   ✔
  ▎13 数据管理                   6/6   ✔
  ▎14 批量管理                   6/6   ✔
  ▎15 账户                       8/8   ✔
  ▎16 取数容错                 15/15   ✔
  ▎17 识图与反馈                 6/6   ✔
  ▎18 UI交互                   41/41   ✔

  ═══════════════════════════════════════════════════════════════════════
  功能域 19 · 用例 257 · 可用 257 · 耗时 18.4s

  ✔ 全部功能可用，可以提交
  ═══════════════════════════════════════════════════════════════════════
```

退出码 `0`。

</details>

<br/>

<details>
<summary><b>✘ 失败时长这样</b> —— 自动展开到「卡在第几步 · 现象 · 位置」</summary>

<br/>

下面是一次真实的失败：把 `src/shared/utils/safe-math.ts` 的 `roundMoney()`
改成不再兜底脏输入（直接返回 `NaN`）之后跑出来的结果 —— 一处改动，
连带打挂 **2 个功能域、5 条用例**（该函数有 25 处调用点）：

```
  ▎04 持仓管理                 18/22   ✘
    ✔ CASE-04-13  持有金额计算为有效数字
    ✘ CASE-04-14  今日盈亏计算为有效数字
        步骤1  准备：创建 store 并加一笔               ✔
        步骤2  执行：计算今日盈亏                      ✔
        步骤3  验证：今日盈亏为有效数字                ✘
                └ 今日盈亏=NaN（界面会显示 --）
        用例   test/suites/04-持仓管理.spec.ts
    ✘ CASE-04-15  累计盈亏计算为有效数字
        步骤3  验证：累计盈亏为有效数字                ✘
                └ 累计盈亏=NaN（界面会显示 --）
        用例   test/suites/04-持仓管理.spec.ts
    ✘ CASE-04-16  仪表盘数据聚合（字段齐全且均为有效数字）
        步骤4  验证：关键字段存在                      ✔
        步骤5  验证：全部金额字段为有效数字            ✘
                └ 以下字段非有效数字：totalHoldingAmount=NaN, totalProfit=NaN, todayProfit=NaN（界面会显示 --）
        用例   test/suites/04-持仓管理.spec.ts
    ✔ CASE-04-19  持仓数据存盘后能完整读回（防数据丢失）
    ✘ CASE-04-20  零持仓时各计算函数返回 0 而非 NaN
        步骤10  执行：零持仓下调用仪表盘聚合            ✔
        步骤11  验证：仪表盘全部数字字段有效            ✘
                └ 零持仓时以下字段为 NaN：totalHoldingAmount=NaN, todayProfit=NaN, totalProfit=NaN, totalCost=NaN
        用例   test/suites/04-持仓管理.spec.ts

  ▎05 T+N与跨日                11/12   ✘
    ✘ CASE-05-11  同日一加一减：两笔待确认互不干扰，净值确认后各自成交
        步骤14  执行：计算持有金额                      ✔
        步骤15  验证：持有金额为有效数字                ✘
                └ 持有金额=NaN（界面会显示 --）
        用例   test/suites/05-跨日与TN.spec.ts

  ═══════════════════════════════════════════════════════════════════════
  功能域 19 · 用例 257 · 可用 252 · 不可用 5 · 耗时 18.3s

  ✘ 5 项功能不可用，不建议提交
    首个失败：CASE-04-14「今日盈亏计算为有效数字」
    若你是 AI：请修改业务代码修复，禁止修改 test/ 下任何文件
  ═══════════════════════════════════════════════════════════════════════
```

退出码 `1`，可用于本地 pre-commit 钩子拦截。

**读法：** 通过的域仍折叠成一行，失败的才展开。每条失败给出卡住的步骤、
具体现象（哪个字段成了 NaN、界面会显示什么）、以及用例文件位置。
一处改动常牵连多条用例 —— 先修末尾「首个失败」指向的那条，多半是同一个根因。

**修复方式：改你写的业务代码，不要改 `test/` 下任何文件。**

</details>

<br/>

---

<br/>

<div align="center">
  <p>
    <img src="https://img.shields.io/github/license/L-newbie/real-time-valuation?style=flat-square&color=6366f1" />
    <img src="https://img.shields.io/github/stars/L-newbie/real-time-valuation?style=flat-square&color=eab308" />
    <img src="https://img.shields.io/github/issues/L-newbie/real-time-valuation?style=flat-square&color=ef4444" />
  </p>
  <p style="color:#64748b;font-size:0.9rem;margin-top:16px;">
    ⭐ 如果这个项目对你有帮助，欢迎 Star 支持
  </p>
  <p style="color:#475569;font-size:0.8rem;">
    交流反馈请提交 <a href="https://github.com/L-newbie/real-time-valuation/issues">Issue</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/L-newbie/real-time-valuation">GitHub</a>
  </p>
  <br/>
  <p style="color:#334155;font-size:0.75rem;">Made with ❤️ for A-share investors</p>
</div>
