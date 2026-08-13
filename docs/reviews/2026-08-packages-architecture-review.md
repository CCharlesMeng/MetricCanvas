# packages 架构诊断报告（2026-08）

> **性质**：只读诊断基线。本文记录问题与证据，不含修改；修复进度以文末「修复追踪」列出的 GitHub Issues 为准。
>
> **诊断基线**：`94dc55f`（分区容器更名后、问数 V0 夜间轨道合入前）。落盘时 HEAD 为 `7ec9bd3`，受夜间合入影响的 `packages/mcp` 与 `apps/platform` 相关发现已在该 HEAD 复核，全部仍然成立（文中相关行号已更新）。
>
> **范围与方法**：`packages/` 下 9 个包（src + tests，约 17.1k 行 ts/svelte），对照 `docs/solution.md`、38 份 ADR（经 `docs/adr/README.md` 基线）与 `CONTEXT.md` 词汇表逐条核验；4 路并行深度探查 + 人工交叉裁决，每条发现均有文件行号级证据（1 条子任务误报已在裁决中剔除）。

## 1. 总体判断

宏观骨架是对的：

- 跨包依赖方向与 `docs/solution.md` 声明完全一致，全部指向领域包 `page`，无循环依赖；
- `widgets` 纯渲染约束零违规（无网络、无全局状态访问、无 DQE 解析）；
- 产品源码无页面 id 字面量、无按 id 分支（ADR-0021 成立）；
- 端点与凭据注入边界干净。

真正的问题不在包图，而在三种系统性模式：

1. **无守护的双实现与副本（真元归一违背）**——同一事实存在 2–4 份可独立修改的真源，共清点 17 处，其中至少 8 处已实证漂移；
2. **领域层被具体交付物反向塑形（领域驱动违背）**——报告页的像素、变体名、中文月份正则进入封闭领域 DSL；
3. **巨型热点文件承载散弹式修改（高内聚低耦合违背）**——新增一个组件要改 12+ 处，30% 的提交都在改 `validate.ts`。

## 2. 多重真源清单（真元归一违背）

「状态」列标注"已漂移"表示两份定义已给出不同答案（实证），"无守护"表示无任何测试或机制保证一致。

| # | 概念 | 真源份数与位置 | 状态 |
|---|---|---|---|
| 1 | 页面协议版本 | `page/src/version.ts`=5.0；`Page.schemaVersion` 字面量重述；`docs/solution.md` 不变式#2 仍写 4.0；`mcp/src/index.ts` 工具文案称 v4（182/190/191/195/253 行），两份 Prompt 示例硬编码 `'5.0'`（62/96 行） | 已矛盾 |
| 2 | 页面 JSON Schema | `page/src/schema.ts`（Zod 生成）vs `page/tests/legacy-schema-snapshot.ts`（912 行手写副本，自称冻结却被改过） | 已漂移：缺 `rankingDetailCard`、`recordList`/`semanticHtml` |
| 3 | 修订/租约/幂等不变式 | page-lifecycle memory + postgres，template-library memory + postgres——同一套规则 4 份实现；`invariants.ts` 只抽出叶子纯函数 | 已漂移（见 4–6） |
| 4 | · listPages 分页游标 | Postgres 库排序 vs memory `localeCompare` 排序 + 码点过滤（自身不自洽） | 已漂移 |
| 5 | · 写路径并发保护 | Postgres 全部写路径咨询锁 + FOR UPDATE；memory 仅 `saveRevision` 加锁 | 已漂移 |
| 6 | · 保存错误优先级 | template-library memory 先查基线冲突、postgres 先查来源发布态，返回不同错误码 | 已漂移 |
| 7 | 发布状态机 | 7 态类型集中一处，转移规则散落 pg 侧 9+ 处、memory 侧 6+ 处；状态→审计动作映射两套；template 另有 2 态阉割版 | 结构性分叉 |
| 8 | 行类型 | `Row`（snapshot.ts）与 `DataRow`（field.ts）同一类型两个名字，data-gateway 用前者、runtime 用后者 | 并存 |
| 9 | 错误分类 | page `ErrorType` 7 码（4 码全仓无生产者）vs data-gateway `DqeGatewayError` 7 码，语义重叠无映射 | 两套词汇表 |
| 10 | 归一化 issue→文案 | 同一 9 分支 switch 在 `page/materialize.ts` 与 `data-gateway/dqe.ts` 各一遍 | 并存 |
| 11 | 运行时事件联合 | `runtime-ui` RuntimeViewEvent vs `embed` RuntimeEvent 逐字段重复 + README 第三份手抄（ADR-0025 已点名） | 靠结构兼容默契维系 |
| 12 | 数据上下文快照格式 | `docs/schema-metadata.schema.json` vs `mcp/data-context.ts` 手写 interface，无运行时校验，消费方双重 cast（`services.server.ts:87`） | 无守护 |
| 13 | 页面标题派生 | `page/page-list-entry.ts`（认 reportHeader）vs `mcp/index.ts:542` documentTitle（认 section.title） | 已漂移：同页两处显示不同标题 |
| 14 | 分区标题/面板外观 | RuntimeSection、ReportHeader、TextBlock(heading) 三处字节级相同 CSS；装饰 SVG 归 widgets 所有被 runtime-ui 反向 import | 三份 |
| 15 | 摘要块样式 | `AiSummaryView` 是 `TextBlock(insight)` 的字节级克隆 | 两份 |
| 16 | ECharts 色板 / 万单位压缩 | 七色板 bar/line options 各一份；"万"压缩两种实现、舍入不同（同图 label 与 tooltip 可现不同数字） | 已漂移 |
| 17 | 表格表头行高 | `Table.svelte` JS 写 40，CSS 写 42px | 已错位 2px |
| 18 | 领域类型 vs Zod schema | `filter.ts`/`data-source.ts`/`field.ts` 手写 interface 与 `schema/*.ts` z.infer 并存，注释断言一致但无守护，且一处注释已与事实不符 | 无守护 |

## 3. 变更热点：散弹式修改的实证

诊断基线时仓库共 78 次提交：

| 文件 | 触及提交数 |
|---|---|
| `page/src/validate.ts` | 23（≈30%） |
| `page/src/schema.ts` | 21 |
| `page/src/page.ts` | 20 |
| `mcp/src/index.ts` | 17 |
| `runtime-ui/src/RuntimeView.svelte` | 14 |
| `page/src/index.ts` | 14 |
| `widgets/src/index.ts` | 13 |
| `runtime/src/orchestrator.ts` | 12 |
| `widgets/.../Table.svelte` | 11 |
| `runtime-ui/src/RuntimeSection.svelte` | 10 |
| `page-lifecycle/src/index.ts` | 10 |

近 18 次触及 `validate.ts` 或 `RuntimeView.svelte` 的提交中 8 次两者同时改动——业务特性每次落地都同时穿透领域校验层与视图分发层。新增一个组件类型需改 `page` 包 7 处（schema/components 新文件、component.ts 两个清单、page.ts 类型与守卫、validate.ts switch、legacy snapshot 或其豁免）+ `RuntimeView` 分发链 5 处 + `widgets` 实现与导出。

## 4. 分层发现

严重度：高 / 中 / 低。定性：领域驱动违背 / 真元归一违背 / 高内聚低耦合违背 / 纯渲染违背 / 实现坏味道。

### 4.1 领域层 `packages/page`（38 文件 / 3,861 行）

| 严重度 | 定性 | 位置 | 问题 |
|---|---|---|---|
| 高 | 领域驱动 | `schema/components/*` | 报告专属 variant 字面量（`reportForecast`/`reportCompact`/`riskNotice`/`insight` 等）、像素宽度（`table.width`、`text.maxWidth`）、`tone`、`ringPercent`、`china/world` 地图枚举、万/亿格式预设进入封闭领域 DSL——一次性交付物的展示决策固化为协议词汇 |
| 高 | 领域驱动 | `bar-forecast-boundary.ts` | 柱图专用规则用正则解析中文 `"N月"` 类目标签；同一规则在 `validate.ts:498` 与 `RuntimeView.svelte:578` 两个执行点消费，运行期用过期 `initial.capturedAt` 对比实时行且无内嵌初始行时静默失效——潜在正确性 bug |
| 高 | 领域驱动 | `validate.ts:186,753` / `query.ts:14-30` | 领域校验器直接解析 DQE 线格式（`dsl_list`、`output_dims`、`output_metrics`、`alias`、`order.offset`）；`EffectiveQuery.body` 类型即 DQE wire format；ADR-0034 的 `language` 判别联合从未落地，4 处仍是 `'dqe'` 字面量 |
| 高 | 领域驱动 | `validate-cli.ts` / `file-name.ts` | 生产 CLI（`node:fs`、`process.exitCode`、顶层副作用）住在领域包；文件名规则自己的注释承认属 Git 存储形态 |
| 高 | 高内聚低耦合 | `validate.ts`（1,008 行） | 9 类职责 + 11 分支组件 switch 集于一文件；同一行 `actionErrors` 调用逐字重复 7 次；`rankingDetailCard` 单分支 95 行 |
| 高 | 真元归一 | `schema.ts` vs `schema/index.ts` | 双入口并存，`schema/index.ts` 全仓零引用死代码，且导出内部符号 |
| 中 | 领域驱动 | `snapshot.ts` / `materialize.ts:22` | `loading`/`error` 运行时编排状态定义在领域层；materialize 注释显式编码 Svelte Proxy 行为知识 |
| 中 | 高内聚低耦合 | `index.ts` | 13 行 `export *` 全量公开内部件；14+ 导出符号全仓零消费者；`canonical-json.ts` 唯一消费者在 page-lifecycle 包 |
| 中 | 真元归一 | `page.ts:28-47` / `schema/filter.ts:4-7` | 三处手工类型补丁使 z.infer 与校验 schema 不一致；`filter.ts` 手写 interface 与 `filterDeclarationZ` 双轨，注释断言"直接复用"与事实不符 |
| 低 | 实现坏味道 | `validate.ts:27` | ajv `strict: false` 使 `.meta()` 中的拼写错误静默忽略；模块加载期 `compile` + 组件目录 `.map` 内 throw，import 即有副作用可抛错 |

### 4.2 应用层 `packages/runtime`（5 文件 / 776 行）

| 严重度 | 定性 | 位置 | 问题 |
|---|---|---|---|
| 高 | 高内聚低耦合 | `orchestrator.ts`（435 行） | 并发信号量、结果缓存、竞态代次、筛选差分、分页纠偏、生效查询合成、错误映射等 9 个可独立演化的策略焊死在一个函数族 |
| 高 | 领域驱动 | `orchestrator.ts:103-117,375` | 直读 DQE 内部结构 `dsl_list[0].order` 推导分页 limit；生效查询合成硬编码 `language:'dqe'`——ADR-0034 明言运行时不应知道背后协议 |
| 中 | 高内聚低耦合 | `ports.ts:14-18` | `PageRepository` 端口定义在 runtime 但 runtime 自身零使用，实际只是 apps/canvas 两个适配器的共享类型，端口宿主错位 |
| 中 | 高内聚低耦合 | `filter-state.ts`（254 行） | 筛选值模型、发布订阅 store、URLSearchParams 编解码、相对时间预设解析、本地时区格式化五种关注点同居 |
| 中 | 实现坏味道 | `package.json` | svelte 声明为 peerDependency 但全包无一行 import——虚假框架耦合声明 |
| 中 | 实现坏味道 | `orchestrator.ts:401-406` | 数据网关 7 类结构化错误码降级为一条 message 字符串，UI 无法按类型分支 |
| 低 | 实现坏味道 | `orchestrator.ts:187-302` / `navigate.ts:19-33` | 为读一次当前值做"订阅-退订-重订"；构造完整 store 只为调一次 `toURL()`（缺纯函数序列化口） |

### 4.3 基础设施 `packages/data-gateway`（2 文件 / 478 行）

| 严重度 | 定性 | 位置 | 问题 |
|---|---|---|---|
| 高 | 高内聚低耦合 | `dqe.ts`（464 行） | 诊断环形缓冲、并发信号量、微任务批量合并、HTTP 传输、信封校验、DSL 筛选改写、行契约校验 7 类关注点共享一个闭包与一份可变状态 |
| 高 | 真元归一 | `dqe.ts:86-94` | 自建 7 码错误分类与 page `ErrorType` 语义重叠、无映射；page 侧 `DQE_*` 4 码全仓无生产者 |
| 中 | 实现坏味道 | `dqe.ts:298-300` | `fetchDimensionValues` 唯一生产实现恒返回 `[]`，而 runtime-ui 每个维度筛选器都调用它 |
| 低 | 死资产 | `fixtures/`（4 文件） | 全仓无代码引用（仅 ADR 文档提及）；`metric-base-info.json` 被 ADR-0031 待决项引用，处置前需确认 |

### 4.4 生命周期服务 `page-lifecycle`（2,426 行）与 `template-library`（1,054 行）

| 严重度 | 定性 | 位置 | 问题 |
|---|---|---|---|
| 高 | 领域驱动 | `page-lifecycle/index.ts`（1,416 行） | 端口、DTO、整套业务服务、建表 DDL、SQL 助手同居；乐观锁/租约状态机/幂等/发布授权写死在 `createPostgresPageLifecycle` 闭包内，业务不变式无独立于存储的宿主 |
| 高 | 真元归一 | `invariants.ts`（96 行） | 自称"两份实现共用的纯函数"，实际只抽 hash、limit 夹取等最不易漂移的叶子；核心不变式全部留在两份实现里 |
| 高 | 真元归一 | `template-library/index.ts` | 整体复制 page-lifecycle 模式：`hash`/`clone` 字节级相同、幂等表 DDL 与查询除表名外相同、咨询锁除前缀外相同、错误文案照抄改一词 |
| 高 | 实现坏味道 | `template-library/tests` | 无共享契约测试（对比 page-lifecycle 的 `contract.ts`）；默认 CI 只跑 2 个 memory 用例，双实现漂移无人看守且已实证漂移 |
| 中 | 高内聚低耦合 | 两包 Postgres 实现 | 同进程对同一 `DATABASE_URL` 开两个 `max:5` 连接池、各跑各的 CREATE TABLE；模板保存中读页面修订跨池跨事务，无事务一致性 |
| 中 | 实现坏味道 | `template-library/package.json` | 对 page-lifecycle 只有 `import type` 却声明为运行时依赖；`@metriccanvas/page` 类型泄漏进公开 API 却在 devDependencies，靠传递依赖侥幸解析 |
| 中 | 实现坏味道 | `ensureSchema` | 无迁移管理：`ADD COLUMN IF NOT EXISTS` 堆积即无版本号的手写迁移史；注释自认 visibility 列废弃不清理；`confirmed_by/at` 两列只写不读 |
| 中 | 实现坏味道 | 两包 SQL 边界 | `as unknown as` 断言 35 处集中在行→DTO 转换；`SELECT *` 后强转，列变更无任何提示 |
| 低 | 实现坏味道 | `page-lifecycle/index.ts:1374` | `sql.unsafe` 拼列名（闭集无注入风险，但破坏参数化风格） |

### 4.5 表现层 `runtime-ui`（2,977 行）与 `widgets`（4,577 行）

| 严重度 | 定性 | 位置 | 问题 |
|---|---|---|---|
| 高 | 真元归一 | 分区外观 × 3 | container-panel 的 padding/渐变/圆角 CSS 在 `RuntimeSection:399`、`ReportHeader:263`、`TextBlock:161` 字节级三份；装饰 SVG 归 widgets 所有被 runtime-ui 反向 import（`RuntimeSection.svelte:7`）——"分区容器是外观唯一真源"（ADR-0038）实际不成立 |
| 高 | 真元归一 | `AiSummaryView` vs `TextBlock` | AI 总结视图是 TextBlock insight 变体的字节级克隆（标题 margin、正文 padding、色值、圆角逐条相同），跨包手工同步 |
| 高 | 实现坏味道 | `Table.svelte`（1,063 行） | 粘性列偏移、列宽、排序、表头筛选、分页、rateBar、格式化、53% CSS 同居（ADR-0025 已记录拆分欠账）；表头高度 JS=40/CSS=42 双真源已错位 2px |
| 中 | 高内聚低耦合 | `RuntimeView.svelte`（1,008 行） | 组件类型分发散落 ≥5 处（渲染链 11 分支、hostSnapshot 特例、componentData、数据槽选择、RuntimeSection 单元格类）；`table` 被特判 6+ 处；`barChart` 在视图层调用领域校验 |
| 中 | 领域驱动 | `RuntimeSection.svelte:134-139,229-253` | 按 `component.type` 给单元格上背景/最小高度——分区外观从组件类型推断，违背 container 单一真源判据 |
| 中 | 高内聚低耦合 | `widgets/shared/row-alignment.ts:28-29` | 行对齐参与者注册表是模块级全局 Set：纯渲染包持有跨实例共享可变协调状态，任何组件挂载唤醒全部运行时实例重排 |
| 中 | 领域驱动 | `TextBlock.svelte:44-48,226-232` | `'AI 总结：'`文案与 AI 图标烧死在 reportInline 变体（非 AI 的同款样式不可得）；CSS 穿透 `SemanticHtml` 私有 `.semantic-html` 类（违背 ADR-0029 调用方不接触解析树的纪律） |
| 中 | 领域驱动 | `ReportHeader.svelte:41-47` | `'报告摘要'`文案硬编码；摘要区显隐由 `generatedBy && subtitle` 存在性推断——正是 ADR-0038 在分区层拒绝的模式；21 处魔法色值绕过 `--mc-color-*` token |
| 中 | 真元归一 | chart options | 七色 ECharts 色板 bar/line 各持一份；"万"压缩两种实现（`Intl en-US` vs `toLocaleString zh-CN + Math.round`） |
| 中 | 测试缺口 | 三大组件 + 行对齐 | `Table`(1063)/`RuntimeView`(1008)/`RuntimeSection`(494) 零组件级测试，126 行几何协调器零单测；唯一覆盖是 embed e2e 对装饰图标计数与 computed CSS 的脆断言 |
| 低 | 实现坏味道 | 多处 | `fieldName` 字段绑定解包 5 处各写各的；`pageSizeOptions` 硬编码；`TextBlockLink` 等死导出；`runtime-ui/tsconfig.json` include 伸进 widgets 源码路径 |

### 4.6 边缘 `mcp`（798 行 → 夜间合入后已扩）与 `embed`（193 行）

行号按当前 HEAD `7ec9bd3` 复核更新。

| 严重度 | 定性 | 位置 | 问题 |
|---|---|---|---|
| 高 | 真元归一 | `mcp/data-context.ts` | 快照格式两份定义（docs JSON Schema vs 手写 interface），mcp 不导出校验函数，platform 消费方双重 cast（`services.server.ts:87`）——对比 page 包对页面文档的守护，同级契约裸奔 |
| 高 | 真元归一 | `mcp/agent-protocol.ts:18-23` | `interaction` 字段嫁接在 MCP 结果类型上：SDK 通道从不产出，仅本地装饰器注入，platform 全链路依赖——MCP 之上并存自定义旁路协议，接标准 MCP 客户端会静默失效 |
| 高 | 真元归一 | `embed/types.ts:13-24` | `RuntimeEvent` 与 runtime-ui `RuntimeViewEvent` 逐字段重复，README 第三份手抄；embed 已依赖 runtime-ui，re-export 零成本（ADR-0025 已点名） |
| 中 | 真元归一 | `mcp/index.ts:62,96,182-253` | 工具描述/资源标题称 "v4"，Prompt 示例硬编码 `'5.0'` 绕过 `versionPolicy`；MCP server 版本 `0.2.0`（178/390 行）与 package.json `0.1.0` 各写各的 |
| 中 | 领域驱动 | `mcp/data-context.ts:58` | `sensitive` 字段在类型与 JSON Schema 是必填治理概念，实现零读取、原样返回给 Agent——已建模、零执行的安全约束 |
| 中 | 真元归一 | `mcp/index.ts:542` | `documentTitle` 重复实现 page 包 `pageListEntry` 已声明"统一派生"的标题逻辑且规则不同 |
| 中 | 实现坏味道 | `mcp` 检索与测试 | 检索纯子串匹配（中文多词查询几乎必然全灭），limit 施加在全局排序后；测试无一条守护 schema 真源同步 |
| 中 | 领域驱动 | `embed/README.md:56,98` | 同一文档一边写"端点不写入页面文档或静态 HTML"，一边示例写死真实形态的内部 DQE 服务路径 |
| 低 | 实现坏味道 | `embed/package.json` | svelte 放 dependencies `^5.56.6` 与全仓 peerDependencies `^5.0.0` 策略不一致（实测单实例，纯分类错误） |

### 4.7 横切：测试防线

| 严重度 | 定性 | 位置 | 问题 |
|---|---|---|---|
| 高 | 真元归一 | `page/tests/legacy-schema-snapshot.ts` | 912 行手写 Schema 副本自称"冻结"却被改过且已实质漂移；等价测试靠只识别 2/20 新特性的逃生舱勉强全绿 |
| 中 | 实现坏味道 | Postgres 契约测试 | page-lifecycle 与 template-library 的 Postgres 用例均被 `TEST_POSTGRES=1` 门控，默认 `pnpm test` 绿灯不覆盖生产存储实现 |
| 中 | 高内聚低耦合 | `page/tests/schema-equivalence.test.ts:36-53` | 领域包测试读仓库根生产 `pages/` 目录且为空即抛错——包测试结果依赖包外应用内容 |
| 中 | 测试缺口 | 表现层组件 | 单测集中在抽出的 .ts 纯函数；三个最大 .svelte 文件零测试 |

## 5. 守住的不变式（对照组）

以下检查为明确的否定结论——怀疑过、验证过、不成立：

| 检查点 | 结论 |
|---|---|
| 依赖结构 | 跨包 import 矩阵与 solution.md 完全一致，全指向 `page`，无循环依赖 |
| 纯渲染约束 | widgets 全包无 fetch/XHR/EventSource/localStorage/window 访问；唯一 DOM 测量是 ADR-0038 授权的自测量写回 |
| 页面 id 门禁 | 产品源码零 id 字面量、零按 id 分支；runtime-ui 无穿透 widgets 内部的 CSS 选择器（仅一处 box-sizing 通用 reset） |
| 端点与凭据注入 | DQE 端点、AI 总结 baseUrl、DATABASE_URL 全部由应用壳注入；embed 构建产物已 gitignore；examples 无硬编码端点 |
| 归一化单一真源 | `normalizeQueryRows` 被 page 与 data-gateway 共享调用而非复制 |
| mcp schema 导出 | 页面 Schema 与组件目录从 page 动态导出，无手抄副本 |
| 共享契约测试 | `page-lifecycle/tests/contract.ts`（559 行）同一批用例喂给两份实现——全仓对双实现漂移唯一的结构化防线（最佳实践，待推广） |
| 仓库卫生 | 全仓源码零 TODO/FIXME/HACK、零 `as any`（断言集中在 SQL/SDK 边界的 `as unknown as`） |

## 6. 结构性根因排序

按"一个问题锁死多少下游问题"排序：

1. **`language` 判别联合从未落地，DQE wire format 写进跨层共享类型**——锁死：领域层解析 `dsl_list`、runtime 反推 `order.limit`、生效查询硬编码 dqe、GraphQL/REST 适配器（ADR-0034）无处接入。
2. **业务不变式没有独立于存储/框架的宿主**——锁死：page-lifecycle 4 份实现漂移、template-library 整包复制、状态机散落 15+ 处、审计映射两份。
3. **组件模型没有注册表机制（能力目录只覆盖一半）**——锁死：新增组件改 12+ 处、`validate.ts` 与 `RuntimeView` 成为提交热点、table 特判 6 处。
4. **"副本 + 人工同步"被反复接受为交付捷径**——legacy snapshot、AiSummaryView 克隆、分区外观三份、事件联合两份、数据上下文双真源——17 处多重真源里至少 8 处已实证漂移。
5. **报告交付的视觉决策未被隔离在表现层，倒灌进协议**——领域 DSL 的像素/变体/中文月份正则、TextBlock 的 AI 语义、ReportHeader 的业务文案。

## 7. 修复追踪

修复按"杠杆优先 × 冲突规避"分三批 + 登记项，全部以 GitHub Issues 承载：

**第一批（速赢，`ready-for-agent`，与问数 V0 后续切片零文件重叠）**

- [#70](https://github.com/CCharlesMeng/MetricCanvas/issues/70) 架构修复1｜版本真源归一（docs + page 部分）
- [#71](https://github.com/CCharlesMeng/MetricCanvas/issues/71) 架构修复2｜小额真元归一打包（embed 事件 / 色板 / 万压缩 / 表头高度 / fieldName）
- [#72](https://github.com/CCharlesMeng/MetricCanvas/issues/72) 架构修复3｜barForecastBoundary 双执行点语义与运行期误报
- [#73](https://github.com/CCharlesMeng/MetricCanvas/issues/73) 架构修复4｜legacy-schema-snapshot 处置

**第二批（结构性根因，`ready-for-agent`）**

- [#74](https://github.com/CCharlesMeng/MetricCanvas/issues/74) 架构修复5｜page-lifecycle 业务不变式归一
- [#75](https://github.com/CCharlesMeng/MetricCanvas/issues/75) 架构修复6｜template-library 契约防线（blocked by #74）
- [#76](https://github.com/CCharlesMeng/MetricCanvas/issues/76) 架构修复7｜表现层克隆归一

**第三批（原冲突延后项；#61/#62/#64 已于夜间合入、阻塞解除并已挂溯源依赖，开工前与 #65/#66 协调 `packages/mcp` 与 `apps/platform` 改动窗口）**

- [#77](https://github.com/CCharlesMeng/MetricCanvas/issues/77) 架构修复8｜mcp 版本文案归一
- [#78](https://github.com/CCharlesMeng/MetricCanvas/issues/78) 架构修复9｜mcp documentTitle 复用 pageListEntry
- [#79](https://github.com/CCharlesMeng/MetricCanvas/issues/79) 架构修复10｜落地 ADR-0034 的 language 判别联合
- [#80](https://github.com/CCharlesMeng/MetricCanvas/issues/80) 架构修复11｜数据上下文快照契约守护

**登记不排期（`needs-triage`）**

- [#81](https://github.com/CCharlesMeng/MetricCanvas/issues/81) 架构登记｜组件注册表机制（待前三批完成后立项，与 #55/#56/#57 协调）
- [#82](https://github.com/CCharlesMeng/MetricCanvas/issues/82) 架构登记｜协议层清理（需先写 ADR-0039+）
- [#83](https://github.com/CCharlesMeng/MetricCanvas/issues/83) 架构登记｜中低严重度杂项汇总（顺带偿还制）

治理红线（沿用 ADR 基线）：不抽取页面/模板共享发布内核（ADR-0024 待决）；不改 widgets 包名（ADR-0025 待决）；协议层字段变更先 ADR 后代码。
