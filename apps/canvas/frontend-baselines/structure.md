# structure.md — 这是什么栈、什么形态?代码放哪、怎么命名?

## 栈签名

| 项 | 结论 | 判据 |
| --- | --- | --- |
| 框架 | **SvelteKit(Svelte 5,runes)** | `.svelte` 文件 + `$props()` / `$state()` / `$derived()` 声明;`apps/canvas/vite.config.ts` 挂 `sveltekit()` 插件;`apps/canvas/svelte.config.js` 声明 kit 配置 |
| 形态 | **应用**(统一运行时参考宿主 + 静态 SPA) | `apps/canvas` 有 SvelteKit 应用入口 `src/app.html` 挂载到 DOM 根;`+layout.ts` 关掉 SSR 与预渲染,`adapter-static` 出静态 SPA |

`packages/embed` 另行提供宿主嵌入能力,但不是目标 app `apps/canvas` 的形态判据;其数据网关注入与 Shadow DOM 契约分别由 `api.md` 和 `styles.md` 记录。

目标 app 是 `apps/canvas`(页面查看器)。`apps/platform`(创作与管理平台)是同仓第二个 app,不是本次的目标 app,覆盖声明里逐节说明扫到什么程度。

## 目录实况

<!-- 覆盖:仓根、apps/canvas/、packages/*/src/、tools/、pages/(2026-08-24) -->

**按角色分包的 pnpm workspace monorepo,不是特性分目录,也不是页面平铺。** `pnpm-workspace.yaml` 声明三段:`packages/*`、`apps/*`、`tools/*`。

**「消费单元」在本仓有两个粒度**,取哪个看问的是什么(这条定义被 `components.md` 与 `data.md` 的分层判据直接引用):

| 问的是 | 消费单元 | 理由 |
| --- | --- | --- |
| 源码里谁引用了这个符号 | **工作区包或 app** | 目录实况是按角色分包,包边界就是引用边界 |
| 界面拼装时谁用了这个构件 | **页面文档 `pages/*.json`** | 界面拼装不发生在源码里,发生在页面元数据的 `component.type` 上;源码侧所有构件都只被 `COMP-3` 一处分发,按源码计数会把全部构件判成「只被一处引用」 |

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `STRUCT-1` | `@metriccanvas/page` 包(`packages/page/src/`,出口 `index.ts`) | 页面元数据协议的唯一事实源:页面文档类型、Zod schema、校验、字段与查询契约。任何「页面文档能写什么」的问题从这里进,不要在下游包里重新定义形状 | 97 个源码文件(含测试 164) |
| `STRUCT-2` | `packages/page/src/schema/`,组件形状在 `schema/components/<type>.ts` | 校验规则(schema)所在层:一个组件类型一个文件,Zod 定义与该类型的目录元数据(`registry.add`)同文件维护 | 由 `STRUCT-1` 的 `schema.ts` / `schema/index.ts` 汇总 |
| `STRUCT-3` | `@metriccanvas/runtime`(`packages/runtime/src/`) | 领域逻辑层,**零框架导入**:数据编排、筛选状态、页面参数、受控计算、端口定义。要改「数据怎么流」改这里,不要改表现层 | 30 个源码文件 |
| `STRUCT-4` | `@metriccanvas/runtime-ui`(`packages/runtime-ui/src/`) | Svelte 表现层(统一运行时视图):把 `STRUCT-3` 的状态与快照接到构件上,持有交互状态 | 10 个源码文件(canvas 3、embed 3、platform 4) |
| `STRUCT-5` | `@metriccanvas/widgets`(`packages/widgets/src/`,`components/<component>/` 一目录一构件) | 纯渲染组件包:只吃已投影的数据槽与 props,不取数、不持状态 | 5 个源码文件,全在 `STRUCT-4` 内 |
| `STRUCT-6` | `@metriccanvas/embed`(`packages/embed/src/`) | 第二形态的对外导出面:嵌入式运行时的挂载契约与类型。第三方宿主页面的唯一接入口 | `packages/embed/examples/`、`tests/browser/` |
| `STRUCT-7` | 仓根 `pages/*.json`,源码内经 `$pages` 别名引用 | 页面资产(页面文档)目录。加一个看板页面只往这里加 JSON,见 `PATTERN-ROUTE-2` | `apps/canvas/src/lib/page-repository.ts` 的 glob;10 份页面文档 |
| `STRUCT-8` | 仓根 `AGENTS.md` / `CONTEXT.md` / `PAGE-METADATA.md` / `docs/adr/` | 领域事实源:词汇表、页面 Schema 说明、关键决策。源码注释大量以 `ADR-00xx` / `issue #nn` 反指这里,读不懂某条不变量时回这里 | 源码注释内引用 |
| `STRUCT-9` | `apps/platform/static/prototype/*.prototype.html`;仓外参考稿在 `参考/`(已列入 `.gitignore`,不随仓交付) | 原型与设计稿的位置。仓内原型是可直接开的 HTML;`参考/` 是本机参考资料,不是交付物,**源码不得 import、打包或在运行时读取其中任何文件**。<br>「不是交付物」只管代码依赖,**不管它能不能当还原期望的来源**——后者按 `PATTERN-STYLE-4` 分层判定,不要把本行读成「设计稿一律不可引」 | `apps/platform` 的原型切换入口 |

## 命名约定

<!-- 覆盖:packages/*/src/、apps/canvas/src/(2026-08-24) -->

只写能从多个样本归纳出来的:

| ID | 规则 | 依据样本 |
| --- | --- | --- |
| `STRUCT-10` | Svelte 构件文件用 `PascalCase.svelte`,同名目录下配一个同名或近名的 `.ts` 放纯逻辑(`Gauge.svelte` + `gauge.ts`、`Table.svelte` + `columns.ts` / `rows.ts` / `view-state.ts` / `presentation.ts`) | `packages/widgets/src/components/` 下 16 个组件目录 |
| `STRUCT-11` | 非构件模块一律 `kebab-case.ts`,文件名说的是**职责**而不是类型(`filter-state.ts`、`widget-host-state.ts`、`page-params.ts`) | `packages/runtime/src/`、`packages/runtime-ui/src/` |
| `STRUCT-12` | 工厂函数一律 `createXxx`(`createFilterState`、`createDqeGateway`、`createStaticPageRepository`、`createDimensionValuesLoader`) | `packages/runtime`、`packages/data-gateway`、`apps/canvas/src/lib` |
| `STRUCT-13` | 测试文件在包内 `tests/` 目录、后缀 `.test.ts`,**不与被测文件同目录**;跨实现共享的契约用例放 `tests/contract.ts` | 见 `tests.md` 的 `TEST-2` |

## 规范

#### `PATTERN-STRUCT-1` · 分层依赖单向

| 项 | 内容 |
| --- | --- |
| 规则 | 依赖方向只能是 app → `STRUCT-4` → `STRUCT-3` → `STRUCT-1`,`STRUCT-5` 只依赖 `STRUCT-1`。`STRUCT-1` 与 `STRUCT-3` 不得导入任何框架符号 |
| 依据清单 | `STRUCT-1`、`STRUCT-3`、`STRUCT-4`、`STRUCT-5` |
| 依据样本 | 全仓搜 `from 'svelte`、`$app/`、`$state`、`$derived` 在 `packages/page/src` 与 `packages/runtime/src` 内**零命中**;`packages/*/package.json` 的 `dependencies` 呈单向 |
| 违例判定 | `packages/page/src/**` 或 `packages/runtime/src/**` 出现 `svelte` / `$app/*` 导入或 runes 声明;或 `packages/widgets` 依赖 `@metriccanvas/runtime` |

#### `PATTERN-STRUCT-2` · 跨包引用只用包名与工作区协议

| 项 | 内容 |
| --- | --- |
| 规则 | 跨工作区包一律 `@metriccanvas/<pkg>` 导入 + `package.json` 里 `workspace:*`,不得用相对路径穿包边界。全仓唯一路径别名是 `$pages`(指向 `STRUCT-7`),别名新增要同时改 vite 配置与 tsconfig |
| 依据清单 | `STRUCT-1`~`STRUCT-7` |
| 依据样本 | 各 `package.json` 全部用 `workspace:*`;`apps/canvas/vite.config.ts` 只声明了 `$pages` 一个别名 |
| 违例判定 | 源码出现 `../../packages/` 或 `../../../` 跨出本包目录的导入 |

#### `PATTERN-STRUCT-3` · 新增组件类型的落点固定

| 项 | 内容 |
| --- | --- |
| 规则 | 一个页面组件类型的 Zod 形状与它的目录元数据(`label` / `purpose` / `chooseWhen` / `dataShape` / `title` / `defaultSpan`)必须写在**同一个** `schema/components/<type>.ts` 里;缺目录元数据会在构造组件目录时直接抛错,不是静默降级 |
| 依据清单 | `STRUCT-2`、`COMP-2` |
| 依据样本 | `packages/page/src/component-catalog.ts` 的 registry 缺失分支抛错;`schema/registry.ts` 的注释说明为什么不用 `.meta()` |
| 违例判定 | 新增 `schema/components/*.ts` 没有对应 `registry.add(...)`;或把面向 Agent 的说明字段塞进 Zod `.meta()` |

#### `PATTERN-STRUCT-4` · 无 i18n 机制,界面文案是源码内字面量

| 项 | 内容 |
| --- | --- |
| 规则 | 仓内**没有**文案资源层、没有语言键、没有取文案入口、没有语言切换状态。界面文案是构件源码里的中文字面量。计划期据此**不要**发明 `t()` 之类的取文案入口,也不要假设有语言前缀路由 |
| 依据清单 | `STRUCT-4`、`STRUCT-5` |
| 依据样本 | 全仓无 i18n 依赖与语言资源文件;`WidgetHost.svelte` 的错误标题、`RuntimeView.svelte` 的四种页面态提示、`apps/canvas` 三个路由页面的文案全部是内联中文字符串 |
| 违例判定 | 引入 i18n 运行时或语言资源目录而没有同时更新本条 |

#### `PATTERN-STRUCT-5` · 无监控 / 埋点 SDK 初始化

| 项 | 内容 |
| --- | --- |
| 规则 | 仓内没有任何前端监控或埋点 SDK 的初始化调用,因此没有「SDK 初始化写在哪个层」这条事实。检视**不得**判「漏了埋点初始化」 |
| 依据清单 | `STRUCT-4`、`ROUTE-3` |
| 依据样本 | 全仓搜 Sentry / analytics / gtag / datadog / posthog,命中全部落在 `docs/`、`tools/dqe-sim/fixtures/`、测试数据(业务字段名里的 analytics),源码零命中;`apps/canvas` 的两个 `+layout.svelte` 无任何初始化调用 |
| 违例判定 | 出现 SDK 初始化调用而本条未更新 |
