# runtime.md — 怎么装、怎么起、跑哪些质量命令?

## 装

<!-- 覆盖:仓根 package.json / pnpm-workspace.yaml / pnpm-lock.yaml、apps/*/package.json、packages/*/package.json、tools/*/package.json(2026-09-10) -->

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `RUN-1` | 仓根 `pnpm-lock.yaml` + `pnpm-workspace.yaml` | 包管理器锁定为 **pnpm**,工作区三段 `packages/*` / `apps/*` / `tools/*`,共 9 个工作区包 + 仓根。装依赖只在仓根跑一次,不要进子包装 | 全部工作区包 |
| `RUN-2` | `pnpm-workspace.yaml` 的 `allowBuilds` 段 | 构建脚本白名单只放开 `esbuild`；旧 Postgres/Testcontainers 依赖退出后，`cpu-features` / `protobufjs` / `ssh2` 已不在锁文件中 | pnpm 安装期 |

**Node 与包管理器版本:仓内没有任何声明。** 没有 `engines` 字段、没有 `.nvmrc`、没有 `packageManager` 字段。这是显式结论而不是漏查:仓库对版本零约束,换机器出问题时不要去找不存在的版本声明,也不要在计划里引用一条本仓没有的版本门。

## 起

<!-- 覆盖:仓根 package.json scripts、tools/dqe-sim/package.json、apps/*/package.json、packages/embed/package.json(2026-09-10) -->

| ID | script(仓根,除注明) | 适用范围与前置条件 |
| --- | --- | --- |
| `RUN-3` | `dev` | 用 pnpm 直接并行启动 platform 与 dqe-sim 两个包的 `dev`；无 Node 开发启动器，无离线存储档 |
| `RUN-5` | `dev:playground` / `dev:platform` / `dev:dqe` | `dev:playground` 只起页面试验场；`dev:platform` 只起平台；`dev:dqe` 联合启动页面试验场与 DQE 仿真。页面试验场不由默认 `dev` 启动 |
| `RUN-7` | `build` | 默认构建 embed 与 platform；页面试验场通过 `build:playground` 按需构建，不上传为产品交付物 |
| `RUN-8` | `preview:examples`(`packages/embed`) | 起静态服务看 embed 的示例页;端口见 `packages/embed/playwright.config.ts` 的 `webServer` |

### 隐性坑(代码里读不出来的)

1. Platform 只在 Vite DEV 下由 `packages/application-runtime` 安装本地运行配置；生产构建不会带入本地 token 或端点。
2. **`RUN-3` 起的是 platform + dqe-sim 两个服务,不含 playground 或 embed。** embed 没有 `dev` script,它只有 `build` 与浏览器测试。
3. 质量命令一律**在仓根跑**。`test` 与 `validate` 都定义在仓根且依赖仓根路径(`vitest.config.ts` 的 glob、页面资产目录),进子包跑会找不到用例或页。

## 环境变量

<!-- 覆盖:apps/playground/.env*、apps/platform/.env.example、tools/dqe-sim/src/,以及全仓 import.meta.env / process.env 引用点(2026-09-10) -->

**只记键名与性质,不记任何值,也不记模板默认值文本。** `.gitignore` 把 `.env` 与 `.env.*` 全部排除,只有 `.env.example` 入库——本机已有的 `.env` / `.env.local` 属于本机配置,不要覆盖它们。

| ID | 键名 | 读取方 | 敏感 | 有模板默认值 |
| --- | --- | --- | --- | --- |
| `RUN-9` | ~~`VITE_PLATFORM_URL`~~ | 已退场：页面试验场固定读取仓库页面，不再连接旧平台 API | 否 | 否 |
| `RUN-10` | ~~`VITE_DQE_ENDPOINT`~~ | 已退场（ADR-0073）：页面试验场 DQE 端点改由运行配置注入面供给，不再读构建期变量 | 否 | 否 |
| `RUN-11` | `VITE_AI_SUMMARY_ENDPOINT`、`VITE_AI_SUMMARY_ENV` | playground 浏览器侧 | 否 | `VITE_AI_SUMMARY_ENDPOINT` 在 `.env.example` 中以可选示例说明。缺席时 AI 总结组件局部显示配置错误,页面其余部分照常 |
| `RUN-15` | `DQE_SIM_PORT` | `tools/dqe-sim` | 否 | 否 |
| `RUN-21` | `METRICCANVAS_BASE_PATH` | Platform 构建期路由前缀 | 否 | 是(`apps/platform/.env.example` 中为空) |

**`apps/playground/.env` 与 `.env.local` 里可能仍有源码不再读取的键(`VITE_DATA_GATEWAY`、`VITE_DQE_ENDPOINT`)。** DQE 端点改由运行配置注入面供给（ADR-0073）。本机配置已漂,但按门禁不覆盖已有 `.env*`——要清就手动清。

## 质量命令

<!-- 覆盖:仓根 package.json scripts、9 个工作区包的 check script、packages/embed/playwright.config.ts、.github/(2026-09-10) -->

**版本号:4**(质量命令有实质变动时手动加一;它是下游起点命令缓存的键)

| ID | script(仓根) | 适用范围 | 前置条件 |
| --- | --- | --- | --- |
| `RUN-16` | `test` | 全仓单元与集成用例(vitest)。日常最主要的门 | 无外部服务。它会先跑一次 platform 的 `svelte-kit sync`,所以比裸 `vitest run` 慢一点 |
| `RUN-17` | `validate` | 校验 `STRUCT-7` 下全部页面文档 | 无。改页面 JSON 后必跑,见 `PATTERN-TEST-4` |
| `RUN-18` | `check` | 全部 9 个工作区包的类型检查(`tsc --noEmit` + `svelte-check`) | 无。首次会在 app 目录生成 `.svelte-kit`(已 gitignore) |
| `RUN-19` | `test:embed` | 唯一起浏览器的测试(Playwright,21 个用例) | 先 build embed(script 自己带),用**系统安装的 Chrome**(`channel: 'chrome'`),并起一个本地静态服务占用固定端口。见 `TEST-3` |
| `RUN-20` | `build` | 产物构建,兼作构建期回归 | 见 `RUN-7` 的顺序约束 |

**没有体积 / 性能预算检查命令,也没有 lint 与格式化命令。** 全仓没有 ESLint、Prettier、stylelint 配置,也没有 bundle 体积门。检视**不得**按「没跑 lint」判违规;代码风格靠 `PATTERN-STRUCT-*` 的命名约定与评审,不靠工具。

## 规范

#### `PATTERN-RUN-1` · 质量门是这四条,不多也不少

| 项 | 内容 |
| --- | --- |
| 规则 | 一次改动的质量门是 `RUN-16`(逻辑)+ `RUN-17`(页面文档)+ `RUN-18`(类型),触及统一运行时渲染或嵌入契约时加 `RUN-19`。不存在第五条门 |
| 依据清单 | `RUN-16`~`RUN-20` |
| 依据样本 | 仓根 `package.json` 的 scripts 段;9 个子包的 `check` script;`.github/` 下无额外质量步骤 |
| 违例判定 | 声称跑了 lint / 格式化 / 体积检查(仓内不存在),或改了页面文档却没跑 `RUN-17` |

#### `PATTERN-RUN-2` · 不覆盖本机环境文件

| 项 | 内容 |
| --- | --- |
| 规则 | `.env` / `.env.local` 是本机配置,只能读不能改写;需要新键时改 `.env.example`(只加键名,不写真实值)并在 `RUN-9`~`RUN-15` 补一行 |
| 依据清单 | `RUN-9`~`RUN-15` |
| 依据样本 | `.gitignore` 第 12–16 行只放行 `.env.example`;playground 的 `.env` 已含一个源码不读的遗留键 |
| 违例判定 | 提交里出现 `.env` / `.env.local`,或 baseline / 文档里出现变量的真实值 |
