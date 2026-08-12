# ADR 基线:29 份决策记录的当前生效结论

`docs/adr/` 现有 29 份 ADR(0001–0029)。多份后出 ADR 部分或全部取代了早前 ADR 的前提,单独阅读任意一份都无法确认它在今天是否仍然生效。本文件按主题聚合这 29 份 ADR 追踪到的**当前生效结论**,不是新决策,也不改写或删除任何原文。

**怎么用这份文件:** 遇到具体问题,先在下方按主题定位现行结论和它引用的 ADR 编号;需要背景、权衡或被否决的选项时,再打开对应 ADR 原文。反过来,新决策仍然是新增一份编号 ADR(当前应为 `0030-*.md`),再回来更新本文件对应主题段落的引用——本文件本身不承载决策,只承载"当前哪份 ADR 说了算"。

当前状态说明(current/superseded/proposed)以 ADR 正文和 frontmatter 为准;本文件的补充判断(例如"实际已被后续 ADR 取代但原文未标注")会明确说明理由和依据。

## 速查表

| 编号 | 标题 | 现状 |
|---|---|---|
| [0001](./0001-domain-dsl-over-a2ui.md) | 自研领域 DSL,不用 A2UI | 现行 |
| [0002](./0002-svelte-runtime.md) | 统一运行时用 Svelte + shadcn-svelte | 现行 |
| [0003](./0003-strict-declarative-spec.md) | 页面规格严格声明式,禁表达式与脚本 | 现行(数据语义前提已由 0014 修订) |
| [0004](./0004-git-storage-first-platform-later.md) | 一期规格存 Git,`PageRepository` 端口先行 | 现行(作为二期平台之外的离线/静态实现,与 0009 并存) |
| [0005](./0005-build-over-open-source-bi.md) | 自研运行时,不魔改开源 BI | 现行(“数据服务唯一入口”前提已由 0014 修订,其余理由不变) |
| [0006](./0006-metadomain-layering-and-naming.md) | 包按 DDD 分层围绕聚合根“看板页面”命名 | 现行(取数边界已由 0014 修订;第 3 条“包名 `widgets` 取自规格字段”的前提已被 0017 推翻,欠账记于 0025 待决) |
| [0007](./0007-demote-spec-to-document-form.md) | 领域词汇只保留聚合根“看板页面”,“规格”降级为文档形态 | 现行 |
| [0008](./0008-immutable-page-revisions-and-publish-leases.md) | 不可变线性修订 + 15 分钟发布租约 | 现行 |
| [0009](./0009-node-postgres-platform-beside-runtime.md) | 平台用独立 SvelteKit Node + PostgreSQL,运行时保持独立 | 现行(Agent Runner 的落地位置已由 0024 细化) |
| [0010](./0010-page-templates-reference-published-revisions.md) | 页面模板引用已发布修订,不复制文档 | 现行 |
| [0011](./0011-derive-query-fields-from-catalog.md) | query 字段由结构化查询与元数据快照解析 | 已被 0014 取代 |
| [0012](./0012-query-dp-and-verify-data-service-for-metric-fulfillment.md) | 指标履约查 DP 并向数据服务验真 | 已被 0014 取代 |
| [0013](./0013-format-belongs-to-component-field-binding.md) | 展示格式属于组件字段绑定,不属于数据源 | 现行 |
| [0014](./0014-query-artifacts-replace-metrics.md) | 查询产物取代预定义指标 | 现行(“仅提交查询执行引用、禁止提交查询原文”的边界已被 0016 推翻,其余结论有效) |
| [0015](./0015-defer-cascading-data-source-input-semantics.md) | 级联页面数据源输入语义 | 提议中,未实现,暂不接受相关 schema 改动 |
| [0016](./0016-send-embedded-query-definitions.md) | 看板页面内嵌并直接提交查询定义 | 现行 |
| [0017](./0017-page-schema-v3-hard-cutover.md) | 页面 Schema v3 一次性删除旧结构化查询 | 现行(交付时的具体版本号是 v3,当前 `versionPolicy.current` 已演进到 4.0,见下文说明) |
| [0018](./0018-keep-page-metadata-locally-explicit.md) | 页面元数据保持局部显式,不做跨引用默认值/字段集 | 现行 |
| [0019](./0019-internalize-ai-summary-generation.md) | AI 总结内化为垂直组件 Module | 现行 |
| [0020](./0020-embedded-initial-rows-and-query-pagination.md) | 查询数据源内嵌初始行 + 查询分页 | 现行 |
| [0021](./0021-page-id-is-not-a-rendering-switch.md) | 页面 id 不作为渲染分支条件 | 现行 |
| [0022](./0022-page-data-sources.md) | 公开页面用命名数据源,统一 inline 与 query 取数 | 现行(结构性基线;query 的字段模型与内嵌初始行细节已由 0014/0016/0017/0020 修订,原文首部有说明) |
| [0023](./0023-remove-metric-fulfillment-and-catalog-packages.md) | 删除指标履约与目录发现的空壳包 | 历史记录,清理已完成 |
| [0024](./0024-converge-authoring-time-packages.md) | 创作期包边界收敛,agent-runner/data-context 不再是一级包 | 现行(模板发布治理强度留有待决事项,见下文) |
| [0025](./0025-converge-runtime-presentation-packages.md) | 表现层包边界按纯渲染职责收敛,widgets 只留页面组件 | 现行(包名与 `WidgetHost` 术语、`Table.svelte` 拆分留有待决与遗留,见下文) |
| [0026](./0026-controlled-nested-detail-fields.md) | 结果字段契约支持受控的一层嵌套明细 | 现行 |
| [0027](./0027-default-summary-to-text-unless-sse-explicit.md) | 摘要默认由页面文档返回，SSE 必须明确声明 | 现行 |
| [0028](./0028-controlled-semantic-html-detail-fields.md) | DQE 明细支持受控语义 HTML，样式仍由前端拥有 | 现行 |
| [0029](./0029-share-controlled-semantic-html-rendering.md) | 摘要与排行详情共用受控语义 HTML 渲染 Module | 现行 |

## 技术栈与建设策略

**现行结论:** 页面协议是自研的封闭领域 DSL,不采用 A2UI 或其他通用 agent→UI 协议;统一运行时基于 Svelte + shadcn-svelte 自建,不采用或魔改 Grafana/Superset/Rill 等开源 BI;页面规格保持严格声明式,禁止表达式、脚本和自定义样式,复杂计算不进入页面层。

这四份决策的共同前提是"页面协议的可控性是核心诉求":只有封闭、紧凑、可被 JSON Schema 完整校验的领域 DSL,才能让 AI 生成结果可控、可自动修复。0005 论证自建运行时的理由中,"数据服务是唯一数据入口"这一条已被 0014 的查询产物模型修订(现在的数据入口是数据网关,按查询产物分发到 SQL/DQE/组合执行适配器),但"规格可控性""避免长期跟随开源上游演进""内网部署与身份整合成本"等其余理由不变。

来源:[ADR-0001](./0001-domain-dsl-over-a2ui.md)、[ADR-0002](./0002-svelte-runtime.md)、[ADR-0003](./0003-strict-declarative-spec.md)、[ADR-0005](./0005-build-over-open-source-bi.md)。

## 领域建模、包边界与部署形态

**现行结论:** 领域层不建模传统业务实体,只有聚合根**看板页面**;包按 DDD 分层围绕这个聚合根命名(领域包 `page`、应用层 `runtime`、基础设施适配器 `data-gateway` 等),端口按意图命名、适配器按系统命名,依赖方向全部指向 `page`。词汇表历史上出现过的"页面规格"一等术语已降级为普通词"页面文档",序列化形态不占领域词汇位置。

部署形态上,一期把页面文档存 Git、经 `PageRepository` 端口加载,统一运行时对存储方式无感知;二期新增独立的 SvelteKit Node + PostgreSQL 平台应用,承载页面搭建工作台、Agent Runner、MCP、发布确认和管理入口,通过同一个 `PageRepository` 端口向统一运行时提供已发布/精确修订两条读取通道。这两份决策并非替代关系:`apps/canvas` 当前同时保留基于 `pages/` 目录的静态文件实现(离线/开发场景)和基于平台 API 的实现(生产场景),二者是同一端口的两个适配器。

包边界方面,治理对象从"预定义指标"整体转为"可执行查询"后(见下节),配套的指标履约与目录发现包已确认为空壳并物理删除;创作期一侧(`agent-runner`、`data-context`)按同一套 DDD 标准做了进一步收敛,`agent-runner` 解散进 `apps/platform`,`data-context` 并入 `packages/mcp`,并修正了一处因两个包各自定义同名 `DataContextProvider` 而产生的真元归一违规。`agent-runner` 解散不改变 ADR-0009 "Agent Runner 只依赖模型提供方与 MCP 客户端接口"的约束,只是把实现这份约束的边界从独立包收窄为平台内的模块边界。

表现层一侧随后按同一套判据做了包内收敛:`widgets` 的职责收紧为"页面组件的纯渲染实现",三组在包内零消费者、只服务包外的文件迁入 `runtime-ui`——快照态外壳 `WidgetHost`、筛选控件(职责表本就把"筛选控件"判给 `runtime-ui`,此前是实现与文档漂移)、以及只服务 AI 总结正文的 `SafeMarkdown`(迁入后 ADR-0019 的垂直组件目录首次完整)。`widgets/src` 同时从平铺改为按组件类型分目录,与 `page/src/schema/components/` 对齐;受控语义 HTML 在 `rankingDetailCard` 与 `text` 出现两个真实消费者后提升为共享 Module,Interface 只接收原始字符串,安全解析、失败关闭、节点渲染和颜色映射全部由其 Implementation 独占。**`aiSummary` 刻意不进 `widgets`**:它是生成型垂直组件,搬入会给纯渲染包引入 `runtime` 依赖与网络代码,`components/` 的完整性由"纯渲染"而非"schema 组件类型全集"定义。

来源:[ADR-0006](./0006-metadomain-layering-and-naming.md)、[ADR-0007](./0007-demote-spec-to-document-form.md)、[ADR-0004](./0004-git-storage-first-platform-later.md)、[ADR-0009](./0009-node-postgres-platform-beside-runtime.md)、[ADR-0023](./0023-remove-metric-fulfillment-and-catalog-packages.md)、[ADR-0024](./0024-converge-authoring-time-packages.md)、[ADR-0025](./0025-converge-runtime-presentation-packages.md)、[ADR-0029](./0029-share-controlled-semantic-html-rendering.md)。

## 页面文档结构与书写原则

**现行结论:** 页面文档局部、顺序地自描述:每个页面数据源在当前位置声明完整的结果字段契约,每个表格在当前组件中声明完整列;不提供 `fieldDefaults`、`fieldSets`、`columnSets` 或顶层 `definitions` 这类需要跳转才能理解含义的机制。`query` 数据源的标量字段可按 `dimensions`/`measures` 分组作为角色简写,结构化明细字段使用 `recordList/detail` 并就地声明项字段契约,DQE 已完成内容组合的受控富内容使用 `semanticHtml/detail`;每个字段仍须就地声明 `queryField`、`type` 等完整信息,不引入默认值、引用或表达式。

展示格式(`format`)始终归属组件字段绑定,不归属数据源;数据源和元数据快照只提供可被组件覆盖的 `defaultFormat` 展示建议。这样同一字段在指标卡、表格、图表中可以有不同格式,格式化实现仍集中在统一运行时。

页面 `id` 只用于文件命名、页面仓储加载、路由和修订归属,统一运行时不得按某个正式页面 `id` 选择样式、组件或交互;两份除 `id` 外相同的页面元数据必须产生相同的 DOM 结构和计算样式。正式页面 `id` 不得以字面量出现在产品源码中,由自动化门禁校验。

来源:[ADR-0017](./0017-page-schema-v3-hard-cutover.md)、[ADR-0018](./0018-keep-page-metadata-locally-explicit.md)、[ADR-0013](./0013-format-belongs-to-component-field-binding.md)、[ADR-0021](./0021-page-id-is-not-a-rendering-switch.md)、[ADR-0026](./0026-controlled-nested-detail-fields.md)、[ADR-0028](./0028-controlled-semantic-html-detail-fields.md)。

## 数据获取与查询模型

这是 29 份 ADR 里演进链条最长、也最容易读错现状的一组决策,按时间顺序梳理如下,**只有最后给出的"当前实际生效模型"可直接采信**:

1. `schemaVersion 2.0`([ADR-0011](./0011-derive-query-fields-from-catalog.md)、[ADR-0012](./0012-query-dp-and-verify-data-service-for-metric-fulfillment.md)):页面引用预定义指标/维度,`query` 字段由结构化查询 + 元数据目录解析,指标履约需要查 DP 并向数据服务验真。**已被 0014 完全取代。**
2. [ADR-0014](./0014-query-artifacts-replace-metrics.md):治理对象从"预定义指标"改为"可执行且可复现的查询"。此时的模型是页面只持有精确**查询执行引用**,不提交 SQL/DQE 原文,原文由服务端解析已验真的"查询产物"修订。
3. [ADR-0015](./0015-defer-cascading-data-source-input-semantics.md)(status: proposed):在"只提交查询执行引用"的前提下设计级联数据源语义,因找不到能覆盖实际后端能力的输入绑定方式,**保持提议状态,未实现**。
4. [ADR-0016](./0016-send-embedded-query-definitions.md):**推翻 0014 和 0015 "只提交查询执行引用,不得提交查询原文"的边界**,改为页面直接内嵌 DQE 查询定义(`{ language: "dqe", body }`),浏览器直接提交原文,服务端每次执行时校验权限与安全边界。"查询产物"作为独立修订资产的模型至此不再是当前实现。
5. [ADR-0017](./0017-page-schema-v3-hard-cutover.md):把 0016 的内嵌查询定义落地为 `schemaVersion: "3.0"`,一次性删除旧结构化查询、指标目录和指标履约的全部代码路径,字段角色改为 `dimension`/`measure`,新增 `queryField` 显式映射和 `filterBindings` 显式筛选绑定。
6. [ADR-0020](./0020-embedded-initial-rows-and-query-pagination.md):在 0017 的 `query` 数据源上补充可选的内嵌初始行(`source.initial`,字段键用 DQE 原始输出名)用于首屏免查询呈现,以及基于 DQE `order.offset/limit` 和 `total_count` 的查询分页。
7. [ADR-0026](./0026-controlled-nested-detail-fields.md):在不放开任意 JSON 的前提下,以 `recordList/detail` 支持项字段契约与查询字段映射均就地显式的一层嵌套明细。
8. [ADR-0028](./0028-controlled-semantic-html-detail-fields.md):对 DQE 已完成内容组合的明细,以 `semanticHtml/detail` 传递受控标签、文本和语义类;数据网关保持字符串不透明,显式前端消费者负责白名单解析、节点渲染和样式映射。

**当前实际生效模型:** `query` 页面数据源直接内嵌 DQE 查询定义并可选内嵌首屏初始行,标量字段角色为 `dimension`/`measure`,受控的一层对象数组使用 `recordList/detail`,受控语义 HTML 使用 `semanticHtml/detail`,通过外层、必要时项级 `queryField` 以及 `filterBindings` 显式声明与外部协议的对应关系,不存在需要提前注册的预定义指标或独立版本化的"查询产物"资产;数据网关按查询定义分发执行并归一化返回。[ADR-0022](./0022-page-data-sources.md)(原编号 0008)记录的是这条演进链之前的"命名数据源 + `inline`/`query` 判别式取数"结构性基线,这部分结构仍然有效,但其正文对 `query` 字段模型和首查语义的具体描述已经过时,读它时必须结合本节时间线,不要单独采信。

级联数据源输入语义(上游查询结果作为下游查询受控输入)仍是[ADR-0015](./0015-defer-cascading-data-source-input-semantics.md)记录的未决问题,当前页面 schema、校验器和数据网关不支持这类依赖。

当前 `versionPolicy.current` 已经是 `4.0`(见 `packages/page/src/version.ts`),但仓库里没有一份专门记录 3.0→4.0 破坏性切换的 ADR——4.0 版本内新增的能力(AI 总结组件、内嵌初始行与查询分页等)由 [ADR-0019](./0019-internalize-ai-summary-generation.md)、[ADR-0020](./0020-embedded-initial-rows-and-query-pagination.md) 分别承载,未触发新的整版本切换记录。这是当前 ADR 记录里的一处已知空白,不是本文件的误读。

## 页面生命周期与发布治理

**现行结论:** 看板页面保持稳定身份,每次成功保存产生不可变页面修订,修订历史只能以前一最新修订为基线线性前进;发布只能针对当前最新修订发起并原子取得 15 分钟页面级发布租约,人工确认时按最新元数据复验,批准/拒绝/取消/超时均释放租约;所有写入口自首次提供起支持幂等重试。页面模板的模板修订只保存发现元数据和精确的已发布页面修订引用,不复制页面文档,来源页面后续的新修订不影响既有模板修订。

来源:[ADR-0008](./0008-immutable-page-revisions-and-publish-leases.md)、[ADR-0010](./0010-page-templates-reference-published-revisions.md)。

## AI 总结组件

**现行结论:** 看板页面摘要默认使用 `text`,由后端随页面文档在 `props.body` 中返回正文;正文默认按纯文本渲染,需要分色时显式声明 `bodyFormat: "semanticHtml"`,并与排行详情共用受控语义 HTML Module。只有需求明确声明运行时 SSE 动态生成时才选择 `aiSummary`,不得根据标题、已有数据或 AI 文案自动推断。显式声明的 AI 总结是内化执行的生成型垂直组件 Module,不是第三种页面数据源。`aiSummary` 组件只声明可选标题、纯文本 `promptTemplate` 和必填的 `relatedData`(对既有页面数据源字段的显式只读引用),不声明 `data`,不暴露端点、Header 或 SSE 协议参数。Host、请求组装、私有 SSE Adapter、会话管理与纯渲染 View 在组件目录内高内聚地分工;数据网关不为此新增 AI/Prompt/SSE 方法。只有出现真实的多组件共享生成能力时,才从当前的单一垂直组件中提取公共 Module。正文的受限 Markdown 渲染此前隔在 `widgets` 包,已由 0025 迁入同一组件目录,该垂直模块至此完整;同一份决策也说明了为什么 `aiSummary` 不该有 `widgets` 侧实现。

来源:[ADR-0019](./0019-internalize-ai-summary-generation.md)、[ADR-0025](./0025-converge-runtime-presentation-packages.md)、[ADR-0027](./0027-default-summary-to-text-unless-sse-explicit.md)、[ADR-0029](./0029-share-controlled-semantic-html-rendering.md)。

## 未决事项

- **级联页面数据源输入语义**([ADR-0015](./0015-defer-cascading-data-source-input-semantics.md),proposed):恢复设计前需要依次确定空集与失败传播、输入集合上限、循环依赖校验、缓存键和取消语义;在明确 SQL 与 DQE 共同支持的受控参数模型之前,不得向页面 schema 加入临时 `inputs`、表达式或任意结果转换能力。
- **模板发布的治理强度**([ADR-0024](./0024-converge-authoring-time-packages.md) 待决节):`template-library` 当前的发布流程没有租约过期、审计事件或拒绝/取消/强制释放,治理强度明显弱于页面发布(ADR-0008 的 7 态 + 全量审计),但没有 ADR 说明这是刻意的产品裁决还是实现漂移。在这一点被显式裁决(写新 ADR)之前,不应该以此为由抽取页面/模板共享的发布内核。
- **表现层包名与 `WidgetHost` 的术语归属**([ADR-0025](./0025-converge-runtime-presentation-packages.md) 待决节):ADR-0006 第 3 条把包名 `widgets` 的理由写为"取自规格字段",但该字段自 ADR-0017 硬切换后已是 `sections[].components`,根级 `widgets` 现被校验器作为旧版遗留字段拒绝,`CONTEXT.md` 亦无 `widget` 词条。ADR-0006 的 Consequences 要求"词汇表术语变更需评估包/端口命名级联",故这是一笔由 0006 自己规定要偿还的欠账;改名波及 `package.json`、跨包 import 与公开符号,应作为独立的命名决策处理,在此之前不要以"顺手"为由局部改名。

## 编号与历史记录说明

- **ADR-0022 曾编号为 ADR-0008**,与"不可变页面修订与发布租约"的 ADR-0008 编号冲突,已于 2026-08-05 重编号,标题与正文未改动;外部文档若引用旧编号"ADR-0008(命名数据源)",指的是当前的 ADR-0022。
- **ADR-0023** 记录的是一次纯粹的仓库清理(删除已经零源文件、零消费者的空壳包目录),不引入新的架构决策,列在此处仅为完整性。
