---
status: accepted
date: 2026-09-07
---

# 渲染引擎按四个交付物发布，页面协议独立成包

渲染引擎要被多个集成应用装载，需要正式包名、发布形态与公开面门禁。本决策来自地图 [#95](https://github.com/CCharlesMeng/MetricCanvas/issues/95) 的 [#100](https://github.com/CCharlesMeng/MetricCanvas/issues/100)，与 ADR-0065（独立创作包）、ADR-0066（自包含渲染引擎与宿主边界）、ADR-0068（6.0 导航协议）配套。

四个交付物，锁步同版发布，引擎 SemVer 与页面协议版本各自独立：

| 交付物 | 内容 | 形态 |
|---|---|---|
| `@metriccanvas/page` | 页面协议、类型、校验、版本策略、错误闭集 | 无 Svelte 依赖 |
| `@metriccanvas/engine` | 渲染引擎：`runtime` + `widgets` + `runtime-ui` + `data-gateway` 四份源码收入同一个包，主入口外另给 `./widgets` / `./ui` / `./dqe` 子路径 | Svelte 预处理组件 + JS + 类型声明 |
| `@metriccanvas/metric-canvas` | 创作组件 `MetricCanvas` | 同上 |
| `@metriccanvas/embed` | JS 地址挂载 | 自包含产物，ESM 与 script/IIFE 两种格式 |

**页面协议必须独立成包，理由是依赖图而非隔离要求。** `mcp`、`page-lifecycle`、`template-library`、`persistence-mysql`、`persistence-postgres`、`page-assets-java` 六个包依赖 `page`，且不依赖任何渲染包。若 `page` 并入渲染交付物，这六个包只能整体依赖它（于是持久化与 MCP 包装上 ECharts 与 Svelte），或继续依赖一个 private 的 `page`（同一份协议代码存在两处，且已发布包不能依赖 private 包）。

**`page` 的主入口收窄为协议契约面并上公开面快照门禁**：`validate`、`parsePage`、`PageDocument`、`Page`、`TypedError`、`versionPolicy`、`supportedVersions`、`pageSchema`、`componentCatalog`、`canonicalizeJson`。这批恰是服务端六包实际导入的集合，也是外部宿主自行校验页面所需的集合。组件属性类型与组件类型移到 `./internal` 子路径，明示仅供引擎自用、不承诺稳定。当前 `src/index.ts` 的 19 个 `export *` 使公开面等于 19 个模块的全部内容，任何新增符号都自动成为对外承诺，发包前必须先分层。

**2026-09-08 公开入口细化（#113，用户确认）：** `ERROR_TYPES` 不作为主入口的稳定运行时数组导出，保留在 `./internal`。集成应用需要错误类型时使用 `TypedError['type']`；数组仍是协议类型推导与跨语言契约导出的真源，并有内部回归消费者，不是无用代码。这一项修正原公开清单，不改变错误闭集内容、单向契约生成或版本失败通道。

**组件属性类型留在 `page`，不迁往 `widgets`。** 它们是 `z.infer<typeof xComponentZ>['props']` 形式的 Zod schema 投影，而那些 schema 定义的是「一份合法页面文档里该组件长什么样」，属于协议本身；导出的 `contracts/metriccanvas/page/schema.json` 包含全部组件属性定义，Java 与 Python 照它做平行复验（ADR-0062）。若定义迁入 `widgets`，`page` 生成 schema 就要反向依赖 `widgets` 形成环，且三语言共享的契约会变成必须由 Svelte 组件包参与生成才能产出。可以归 `widgets` 的是组件实现与渲染细节，不能归它的是「页面文档里该组件允许出现哪些字段」。

**目录按交付物分组**：`packages/page/`、`packages/engine/{runtime,widgets,runtime-ui,data-gateway}/`、`packages/metric-canvas/`、`packages/embed/`，不发布的服务端六包单独成组。目的是让「哪些有对外承诺」从目录结构就能看出，而不是只存在于文档里。

**命名**：`engine` 是词汇表词条「渲染引擎」（ADR-0066/#98 已统一此称法）的缩写形式，词条须注明对应关系。创作包保留 `@metriccanvas/metric-canvas`，与导出组件名 `MetricCanvas` 一致——ADR-0065 曾声明组件名不裁决包名，此处裁决为一致，字面重复是已知代价。`engine` 直接对应词汇表已有词条「统一运行时（Runtime，又称渲染引擎）」，命名依据在裁决时即已就位，不是发包前置。同批清理的词汇表欠账（创作期、渲染期、页面搭建、搭建画布、页面搭建工作台、平台、集成应用）不改变本决策的任何包名。

## 取舍

- **不采用七包各自发布**：外部宿主要面对七个版本号，七个公开面各自需要快照门禁与兼容承诺，与「减轻宿主版本对齐负担」的目的相反。
- **不采用收成三个交付物**（Svelte 渲染 / Svelte 创作 / JS 挂载）：那需要把 `page` 并入渲染交付物，撞上上面的依赖图约束。
- **不采用四包各自发布加一个 façade**：外部实际安装五个包，四个公开面仍各自需要门禁，façade 不减少包数也不消除类型依赖。
- **不采用单入口无子路径的 engine**：宿主只需要图表或只需要 DQE 适配器时没有取用粒度。子路径的代价是四个分区各自成为跨包 Interface，须一并纳入兼容检查——`runtime-ui/composition` 已经是这样一个接缝，不能因未写入教程就称为技术私有。
- **`data-gateway` 并入 engine 而非独立可选**：它有四层职责，查询翻译与结果归一化绑定 DQE 方言，错误分类与诊断记录是通用的，宿主自带数据通路时仍需后两者（`runtime` 的端口期望结构化 `QueryError`，否则渲染层收到的错误形状不一致）。并入的已知代价是变化率耦合：DQE 方言变化会拖动 engine 发新版，即使渲染未变。`DEFAULT_DQE_ENDPOINT` 是相对路径，不含内网主机名，并入不构成端点泄露。
- **`metric-canvas` 发布而非保持 private**：当前唯一消费者是 `apps/platform`，但创作是首版要交付的能力，且发布才能把 `runtime-ui/composition` 这个跨包接缝约束住。

## 实施与行为约束

- **`schemaVersion` 超出引擎支持区间不进 `TypedError`。** 那是引擎能力失败而非文档错误——文档没错，错在引擎太旧。走独立的引擎级失败关闭通道，提示须给出所需版本与当前版本。`ERROR_TYPES` 是三语言共享的契约真源，而 Java 与 Python 不存在「引擎版本」这个概念，往闭集里加码会污染跨语言契约。协议已收敛为单一受支持版本（ADR-0068 后 `supportedVersions()` 返回 `['6.0']`），因此这条路径是常态而非边缘情况。
- **开发期查询明细通道不得随包发出。** `DqeDevDetail` 接口（仅 `record`）留在 `data-gateway`，实现移入 `apps/platform`。它当前从 `data-gateway` 顶层导出，唯一守卫是 `apps/canvas` 的 app 级隔离测试，保护不了外部宿主；按现状发包会把脱敏明细能力对外暴露，违反「正式渲染通道不得注入或消费」。
- **契约导出面与 npm 公开面须同版。** `contract-lock.json` 的 `productContractVersion` 跟随 `page` 的发布版本，`tools/scripts/export-authoring-contracts.ts` 的现有漂移检查增加版本一致校验。跨语言消费者不走 npm：按 ADR-0061，产品中立契约由 `contracts/metriccanvas/` 单向生成，Bundle 在 `contract-snapshot/` 携带摘要锁定的只读快照，Python 运行时不加载 Node。
- **Svelte 支持区间统一为 `>=5.29.0 <6`。** 当前 `runtime` 与 `widgets` 声明 `^5.0.0`、`runtime-ui` 与 `metric-canvas` 声明 `^5.29.0`，实装 `^5.56.6`；发版前须以最低版本真实验证，不得只声明不验证。`runtime` 的 Svelte peer 是虚假声明（该包零 Svelte 引用），一并删除；它是框架无关的端口与编排层，但本版不因此拆包——没有非 Svelte 渲染宿主这个需求，为假想需求拆包是提前投资。
- 公开面快照、仓外安装与构建、Svelte 最低版本验证、两种 JS 加载验证、创作依赖隔离与现有 CI 检查是首发门禁；影响这些检查的真实导出、依赖与类型问题必须修复，已有失败不得记为全绿。首个稳定版为 `1.0.0`，联调可用 `1.0.0-rc.N`。首版支持 Chrome 与 Edge 并记录验证版本。
- 公开面须按 ADR-0068 的结果冻结，不得把 5.x 与旧 pageId 导航形态写入对外契约。
