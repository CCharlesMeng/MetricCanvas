# ADR 基线:59 份决策记录的当前生效结论

`docs/adr/` 现有 59 份 ADR(0001–0059)。多份后出 ADR 部分或全部取代了早前 ADR 的前提,单独阅读任意一份都无法确认它在今天是否仍然生效。本文件按主题聚合这些 ADR 追踪到的**当前生效结论**,不是新决策,也不改写或删除任何原文。

**怎么用这份文件:** 遇到具体问题,先在下方按主题定位现行结论和它引用的 ADR 编号;需要背景、权衡或被否决的选项时,再打开对应 ADR 原文。反过来,新决策仍然是新增一份编号 ADR(当前应为 `0060-*.md`),再回来更新本文件对应主题段落的引用——本文件本身不承载决策,只承载"当前哪份 ADR 说了算"。

**关于 0045–0053:** 这九份是 IOC 作战地图多页应用批次的决策。其中 [ADR-0046](./0046-controlled-computation-with-named-operators.md)(具名算子第一批)、[ADR-0047](./0047-first-class-page-parameters.md)(页面参数与文本取值)、[ADR-0048](./0048-navigation-intent-and-host-routing.md)(导航意图与宿主路由)、[ADR-0050](./0050-filter-type-closure-and-hierarchical-dimensions.md)(筛选闭集与层级维度)、[ADR-0051](./0051-additive-minor-versions-for-page-schema.md)(增量次版本)、[ADR-0052](./0052-dashboard-layout-form-backdrop-and-safe-area.md)(布局形态、铺底层与运行时安全区)和 [ADR-0053](./0053-composite-card-component-level-grouping-container.md)(组合卡与分类明细)已 accepted,进入当前实现。仍为 `proposed` 的两份:[ADR-0045](./0045-graphql-query-branch-with-structured-predicates.md) GraphQL 谓词未做;[ADR-0049](./0049-table-server-side-and-presentation-capabilities.md) 行类别/合并/新组件已落地,查询分页下排序与表头筛选的拒绝仍在。页面协议变更全部为纯增量:5.1 交付 IOC 基础能力,5.2 交付组合卡、分类明细、地图分档图例与提示扩展、`ratio.scale` 和单列键值面板。评审与落地记录见 [`docs/plan/ioc-operation-map.md`](../plan/ioc-operation-map.md) 与 [`docs/plan/ioc-project-map-wip-closeout.md`](../plan/ioc-project-map-wip-closeout.md)。

当前状态说明(current/superseded/proposed)以 ADR 正文和 frontmatter 为准;本文件的补充判断(例如"实际已被后续 ADR 取代但原文未标注")会明确说明理由和依据。

**术语演进:** 聚合根已由「看板页面」改称**页面**,「看板」与「报表」降为它的两种布局形态([ADR-0052](./0052-dashboard-layout-form-backdrop-and-safe-area.md))。**0052 以前的 ADR 正文里出现的「看板页面」,指的就是现在的「页面」**;历史正文不改写。本文件转述现行结论时使用新称呼,引用 ADR 标题与原文措辞时保留原词。同理,「静态页面」一词已退休为**仅内联页面**([ADR-0022](./0022-page-data-sources.md) 正文已按新不变量改写)。[ADR-0056](./0056-metric-centric-terminology.md) 把问数术语围绕指标谱系规整:「临时口径」改称**临时指标**、「派生度量模板」改称**派生指标模板**、「口径卡」改称**取数核对**;0056 以前的 ADR 正文里出现的旧词按此映射理解,历史正文不改写,治理边界(临时指标不进语义面、须视觉标注)不随改名松动。

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
| [0022](./0022-page-data-sources.md) | 公开页面用命名数据源,统一 inline 与 query 取数 | 现行(结构性基线;query 的字段模型与内嵌初始行细节已由 0014/0016/0017/0020 修订,"静态页面"约束已于 2026-08-25 改写为仅内联页面的不变量,原文首部有说明) |
| [0023](./0023-remove-metric-fulfillment-and-catalog-packages.md) | 删除指标履约与目录发现的空壳包 | 历史记录,清理已完成 |
| [0024](./0024-converge-authoring-time-packages.md) | 创作期包边界收敛,agent-runner/data-context 不再是一级包 | 现行(模板发布治理强度留有待决事项,见下文) |
| [0025](./0025-converge-runtime-presentation-packages.md) | 表现层包边界按纯渲染职责收敛,widgets 只留页面组件 | 现行(包名与 `WidgetHost` 术语、`Table.svelte` 拆分留有待决与遗留,见下文) |
| [0026](./0026-controlled-nested-detail-fields.md) | 结果字段契约支持受控的一层嵌套明细 | 现行 |
| [0027](./0027-default-summary-to-text-unless-sse-explicit.md) | 摘要默认由页面文档返回，SSE 必须明确声明 | 现行 |
| [0028](./0028-controlled-semantic-html-detail-fields.md) | DQE 明细支持受控语义 HTML，样式仍由前端拥有 | 现行 |
| [0029](./0029-share-controlled-semantic-html-rendering.md) | 摘要与排行详情共用受控语义 HTML 渲染 Module | 现行 |
| [0030](./0030-transient-page-state-for-ask-and-explore.md) | 问数与探索用临时页面态与轻量会话,沉淀才产生页面修订 | 现行(会话从只存事件扩展为最新检查点已由 0058 部分修订) |
| [0031](./0031-metrics-as-data-context-discovery-anchor.md) | 指标作为数据上下文发现锚点,不回页面协议 | 现行 |
| [0032](./0032-authoring-time-query-verification.md) | 创作期查询必须经清单校验与真实执行验真 | 现行(名称层闭集,formula 为有意保留的开放面) |
| [0033](./0033-suspend-dataset-runtime.md) | 挂起服务端计算数据集,派生计算交给 DQE formula | 提议中,未实现,恢复条件见原文 |
| [0034](./0034-graphql-rest-as-data-gateway-adapters.md) | GraphQL/数据接口以数据网关适配器接入,组件不直连 | 现行 |
| [0035](./0035-structured-relative-time-expressions.md) | 页面时间范围支持结构化相对时间表达 | 现行 |
| [0036](./0036-metric-gap-non-blocking-exit.md) | 指标缺口不阻塞问数,临时口径可见、计数并在沉淀处设闸 | 现行 |
| [0037](./0037-ask-orchestration-and-interaction-contract.md) | 问数编排顺序与人机分工:域回显、候选消歧、条件确认、分步流式 | 现行 |
| [0038](./0038-section-container-and-row-alignment-invariant.md) | 分区容器 `container` 单一真源,行对齐为运行时不变量,Schema 5.0 硬切换 | 现行 |
| [0039](./0039-derived-measure-templates-as-company-definitions.md) | 派生度量模板(环比/同比/占比)视同公司口径,本地确定性计算 | 现行 |
| [0040](./0040-scope-card-as-control-panel.md) | 口径卡升级为控制面板:token 行、要素就地修改落事件、已验证查询快路径、消歧预选 | 现行 |
| [0041](./0041-governance-inbox-unified-growth-loop.md) | 治理收件箱统一三条候选流,采纳不自动写回;评审回执走会话事件 | 现行 |
| [0042](./0042-money-fields-and-semantic-embedded-values.md) | 人民币金额专用结果字段、五档自适应格式与语义内嵌值 | 现行 |
| [0043](./0043-attribution-diagnosis-as-a-sibling-analysis-form.md) | 归因诊断作为与问数并列的分析形态 | 提议中,未实现,设计基线见原文 |
| [0044](./0044-first-class-metric-entries.md) | 指标条目一等化,Schema 元数据 1.1 | 现行 |
| [0045](./0045-graphql-query-branch-with-structured-predicates.md) | GraphQL 查询分支以结构化谓词表达,不透传 WHERE 模板 | 提议中(5.1 批次,未落地) |
| [0046](./0046-controlled-computation-with-named-operators.md) | 受控计算以封闭具名算子分两批进入页面数据源 | 现行(第一批算子;第二批 `joinAggregate` 形状未定) |
| [0047](./0047-first-class-page-parameters.md) | 页面参数一等化,与筛选器按可变性分界 | 现行 |
| [0048](./0048-navigation-intent-and-host-routing.md) | 跨页下钻由宿主路由,运行时只上抛导航意图 | 现行 |
| [0049](./0049-table-server-side-and-presentation-capabilities.md) | 表格服务端能力按数据源模式整体下推 | 提议中(呈现已落地,服务端排序筛选未解除) |
| [0050](./0050-filter-type-closure-and-hierarchical-dimensions.md) | 筛选器类型闭集扩展,层级维度承载地图下钻 | 现行 |
| [0051](./0051-additive-minor-versions-for-page-schema.md) | 页面协议改为增量次版本演进,主版本递增须论证 | 现行(2026-08-25 补了"零使用开放面可按次版本收紧"的例外) |
| [0052](./0052-dashboard-layout-form-backdrop-and-safe-area.md) | 看板形态的满幅布局、铺底层与安全区通道 | 现行(协议与运行时安全区通道已实现) |
| [0053](./0053-composite-card-component-level-grouping-container.md) | 组件级分组容器「组合卡」,与分区容器按层次分工 | 现行(协议、widget 与统一运行时已实现;同批附带叶子组件「分类明细」) |
| [0054](./0054-section-weighted-column-tracks.md) | 内容分区可声明受控权重列轨 | 现行(Schema 5.3，部分修订 0038 的恒定等权列前提) |
| [0055](./0055-scope-groups-as-section-boundaries-in-ask-answers.md) | 口径组作为问数答案的分区边界 | 现行(首轮多单元、口径组分区、三处可见、按单元意图与单元数上限均已实现;2026-08-27 补记对话轨呈现:选用指标改集合、按单元重复的步骤折叠;跨口径月报改作空态默认入口) |
| [0056](./0056-metric-centric-terminology.md) | 术语围绕指标谱系规整:临时指标、派生指标模板、取数核对 | 现行(词汇表已切换,代码与 UI 文案批量替换进行中) |
| [0057](./0057-proportional-row-packing-and-page-header-in-assembly.md) | 装配期按比例装箱铺满行宽,并产出页面级页头 | 现行(装箱纯函数与页头均已实现;`defaultSpan` 重新表述为比例基线) |
| [0058](./0058-latest-session-checkpoint-restores-transient-page-state.md) | 分析会话保存最新检查点,恢复临时页面态 | 现行(部分修订 0030 的会话内容边界;不产生页面修订) |
| [0059](./0059-direct-component-box-responsive-ownership.md) | 响应式布局按统一运行时、直接组件布局盒与组件内部三层拥有 | 现行(不改页面协议；17 种组件与 53 个 variant 已纳入响应契约门禁) |

## IOC 作战地图批次(0045–0051)

触发这一批的是一个与既有场景形状不同的需求:一个多页数据应用,包含"概览 → 清单 → 详情"三级下钻,取数协议全部是 GraphQL 而非 DQE,应用外壳由已有门户提供。

**已生效:** [ADR-0046](./0046-controlled-computation-with-named-operators.md) 在页面数据源上引入封闭具名算子(第一批),**这是对 ADR-0003 措辞的一次修订与对 ADR-0033 的部分恢复**,但不恢复计算数据集聚合根;[ADR-0047](./0047-first-class-page-parameters.md) 新增顶层 `params`,按"页面打开后还能不能变"把 URL 输入与筛选器分开;[ADR-0048](./0048-navigation-intent-and-host-routing.md) 把跨页路由交给宿主,运行时只上抛导航意图,Canvas 用 sessionStorage 记来源并画返回;[ADR-0050](./0050-filter-type-closure-and-hierarchical-dimensions.md) 把筛选器闭集从两类扩到六类并引入层级维度,顺带偿还 ADR-0035 的落地欠账;[ADR-0051](./0051-additive-minor-versions-for-page-schema.md) 把版本演进定为增量次版本,本批交付 5.1。

**仍为提议:** [ADR-0045](./0045-graphql-query-branch-with-structured-predicates.md) 补齐 ADR-0034 留白的 GraphQL 分支形状,关键是把来源实现里的 WHERE 字符串模板换成结构化谓词,守住 ADR-0003——**本批未落地,`QUERY_LANGUAGES` 仍只有 `dqe`**;[ADR-0049](./0049-table-server-side-and-presentation-capabilities.md) 解除查询分页下的排序与列头筛选限制、改为按数据源模式整体下推(呈现已落地,拒绝规则未删)。

**驱动这批决策的三条业务裁决**(见 [`docs/plan/ioc-operation-map.md`](../plan/ioc-operation-map.md) §1):取数协议全部走 GraphQL,因此 DQE 的 `formula` 与 `total_count` 都不可用;前端计算进页面协议而非下推数据侧,因为改表要走完整数据开发链路、周期不可控;应用外壳归已有门户,因此本批**没有**引入"多页应用"一等概念——[ADR-0048](./0048-navigation-intent-and-host-routing.md) 明确把它留给第二个多页应用出现时再裁决。

## 技术栈与建设策略

**现行结论:** 页面协议是自研的封闭领域 DSL,不采用 A2UI 或其他通用 agent→UI 协议;统一运行时基于 Svelte + shadcn-svelte 自建,不采用或魔改 Grafana/Superset/Rill 等开源 BI;页面规格保持严格声明式,禁止表达式、脚本和自定义样式,复杂计算不进入页面层。

这四份决策的共同前提是"页面协议的可控性是核心诉求":只有封闭、紧凑、可被 JSON Schema 完整校验的领域 DSL,才能让 AI 生成结果可控、可自动修复。0005 论证自建运行时的理由中,"数据服务是唯一数据入口"这一条已被 0014 的查询产物模型修订(现在的数据入口是数据网关,按查询产物分发到 SQL/DQE/组合执行适配器),但"规格可控性""避免长期跟随开源上游演进""内网部署与身份整合成本"等其余理由不变。

**已生效的修订:** [ADR-0046](./0046-controlled-computation-with-named-operators.md) 把 ADR-0003 的"复杂计算不进入页面层"修订为"计算只以封闭算子表达,开放语法面不进入页面层"。它不推翻 ADR-0003 的判据——禁的仍是可任意求值、语法面开放、无法被 JSON Schema 完整校验的东西——但承认封闭具名算子与 [ADR-0035](./0035-structured-relative-time-expressions.md) 的结构化相对时间同类,是声明式数据而非表达式。第一批算子(`ratio` / `delta` / `groupSubtotal` / `grandTotal` / `pivot`)已进入页面协议 5.1;第二批 `joinAggregate` 形状未定。

来源:[ADR-0001](./0001-domain-dsl-over-a2ui.md)、[ADR-0002](./0002-svelte-runtime.md)、[ADR-0003](./0003-strict-declarative-spec.md)、[ADR-0005](./0005-build-over-open-source-bi.md)。

## 领域建模、包边界与部署形态

**现行结论:** 领域层不建模传统业务实体,只有聚合根**页面**(0052 以前称"看板页面");包按 DDD 分层围绕这个聚合根命名(领域包 `page`、应用层 `runtime`、基础设施适配器 `data-gateway` 等),端口按意图命名、适配器按系统命名,依赖方向全部指向 `page`。词汇表历史上出现过的"页面规格"一等术语已降级为普通词"页面文档",序列化形态不占领域词汇位置。

部署形态上,一期把页面文档存 Git、经 `PageRepository` 端口加载,统一运行时对存储方式无感知;二期新增独立的 SvelteKit Node + PostgreSQL 平台应用,承载页面搭建工作台、Agent Runner、MCP、发布确认和管理入口,通过同一个 `PageRepository` 端口向统一运行时提供已发布/精确修订两条读取通道。这两份决策并非替代关系:`apps/canvas` 当前同时保留基于 `pages/` 目录的静态文件实现(离线/开发场景)和基于平台 API 的实现(生产场景),二者是同一端口的两个适配器。

包边界方面,治理对象从"预定义指标"整体转为"可执行查询"后(见下节),配套的指标履约与目录发现包已确认为空壳并物理删除;创作期一侧(`agent-runner`、`data-context`)按同一套 DDD 标准做了进一步收敛,`agent-runner` 解散进 `apps/platform`,`data-context` 并入 `packages/mcp`,并修正了一处因两个包各自定义同名 `DataContextProvider` 而产生的真元归一违规。`agent-runner` 解散不改变 ADR-0009 "Agent Runner 只依赖模型提供方与 MCP 客户端接口"的约束,只是把实现这份约束的边界从独立包收窄为平台内的模块边界。

表现层一侧随后按同一套判据做了包内收敛:`widgets` 的职责收紧为"页面组件的纯渲染实现",三组在包内零消费者、只服务包外的文件迁入 `runtime-ui`——快照态外壳 `WidgetHost`、筛选控件(职责表本就把"筛选控件"判给 `runtime-ui`,此前是实现与文档漂移)、以及只服务 AI 总结正文的 `SafeMarkdown`(迁入后 ADR-0019 的垂直组件目录首次完整)。`widgets/src` 同时从平铺改为按组件类型分目录,与 `page/src/schema/components/` 对齐;受控语义 HTML 在 `rankingDetailCard` 与 `text` 出现两个真实消费者后提升为共享 Module,Interface 只接收原始字符串,安全解析、失败关闭、节点渲染和颜色映射全部由其 Implementation 独占。**`aiSummary` 刻意不进 `widgets`**:它是生成型垂直组件,搬入会给纯渲染包引入 `runtime` 依赖与网络代码,`components/` 的完整性由"纯渲染"而非"schema 组件类型全集"定义。

来源:[ADR-0006](./0006-metadomain-layering-and-naming.md)、[ADR-0007](./0007-demote-spec-to-document-form.md)、[ADR-0004](./0004-git-storage-first-platform-later.md)、[ADR-0009](./0009-node-postgres-platform-beside-runtime.md)、[ADR-0023](./0023-remove-metric-fulfillment-and-catalog-packages.md)、[ADR-0024](./0024-converge-authoring-time-packages.md)、[ADR-0025](./0025-converge-runtime-presentation-packages.md)、[ADR-0029](./0029-share-controlled-semantic-html-rendering.md)。

## 页面文档结构与书写原则

**现行结论:** 页面文档局部、顺序地自描述:每个页面数据源在当前位置声明完整的结果字段契约,每个表格在当前组件中声明完整列;不提供 `fieldDefaults`、`fieldSets`、`columnSets` 或顶层 `definitions` 这类需要跳转才能理解含义的机制。`query` 数据源的标量字段可按 `dimensions`/`measures` 分组作为角色简写,结构化明细字段使用 `recordList/detail` 并就地声明项字段契约,DQE 已完成内容组合的受控富内容使用 `semanticHtml/detail`;查询字段须就地声明 `queryField`、`type` 等完整信息,具名算子产出字段就地声明类型与角色但不声明 `queryField`,不引入默认值、模板插值或表达式。

展示格式(`format`)始终归属组件字段绑定,不归属数据源;数据源和元数据快照只提供可被组件覆盖的 `defaultFormat` 展示建议。这样同一字段在指标卡、表格、图表中可以有不同格式,格式化实现仍集中在统一运行时。人民币金额以 `money/CNY` 表达结果字段语义、以 `cny-adaptive` 表达可覆盖的展示策略；受控语义 HTML 中无属性 `<data>` 标记的规范数字也由当前组件字段绑定格式化，Table 只作为显式消费者处理该能力。

页面 `id` 只用于文件命名、页面仓储加载、路由和修订归属,统一运行时不得按某个正式页面 `id` 选择样式、组件或交互;两份除 `id` 外相同的页面元数据必须产生相同的 DOM 结构和计算样式。正式页面 `id` 不得以字面量出现在产品源码中,由自动化门禁校验。

内容分区的外观自 Schema 5.0 起由可选的 `section.container` 单一声明(封闭三档:`plain`/`panel`/`card`,缺省为通用看板外观);`section.variant` 与 `section.layout` 已删除。内容分区缺省是 12 列等权 Grid；Schema 5.3 起，真实结构无法表达时可声明最多 12 条受控正整数权重轨，不开放 CSS、坐标或像素宽高([ADR-0054](./0054-section-weighted-column-tracks.md))。统一运行时不得按组件组合或子组件 `props.variant` 推断分区外观。同一视觉行内同类型、同 `props.variant` 且具备行对齐能力的组件由统一运行时自动对齐行轨高度,这是运行时不变量而非页面声明;对齐通过显式契约协作,统一运行时不出现组件内部选择器。新增 `container` 档位必须证明"结构上不可区分且视觉上必须不同"。

**响应式宽度所有权([ADR-0059](./0059-direct-component-box-responsive-ownership.md)):** `RuntimeView` 的 `mc-runtime` 只负责页面级与跨组件排布；`RuntimeSection` 顶层单元、组合卡 slot 与 Tab 活动面板以 `mc-component-box` 给直接 Page Component 提供可用 inline-size；组件内部只使用最近的直接布局盒或匿名 self container。旧 viewport 数值不得机械迁移为容器阈值，优先用流式 CSS；组件根填满直接盒，固有内容尺寸必须有收缩或内部 overflow owner。该边界不进入 Page Metadata，不新增响应字段或生产态断点注册表。

**组件能力目录的 `defaultSpan` 是相对比例,不是绝对宽度([ADR-0057](./0057-proportional-row-packing-and-page-header-in-assembly.md))。** 依据是人工搭的看板对它的用法:33 个分区里 14 个覆盖了 `defaultSpan`,但覆盖后的宽度几乎都保持了默认值之间的比例(指标卡 3 配柱状图 6 写成 4 + 8,三张指标卡各 3 写成 4 + 4 + 4)。创作期装配据此在**每个分区内**按比例贪心分行、每行缩放到恰好占满整行,因此视觉行的 span 之和恒等于分区列数;装箱不跨分区搬动组件,ADR-0055 的一组一分区不动。装箱是装配期的确定性纯函数(`packages/mcp/src/authoring/section-layout.ts`),模型不参与 span 决策——span 是纯几何,模型只会带来方差。分行判断只在比例空间里做,受控权重列轨只改变最终整数分配。手写页面继续显式声明 `span`,不受影响;目录没有「宽度上限」概念,装配因此会把独占分区的饼图与排行卡拉到通栏,该现象留待有真实产物证据后单独裁决。

**页面外框与分区内层次([ADR-0052](./0052-dashboard-layout-form-backdrop-and-safe-area.md)):** 顶层可选 `layoutForm` 封闭两档 `report`(缺省)/`dashboard`,是页面外框几何与画布外观的唯一真源,`dashboard` 要求宿主交出全部宽度(见 [`docs/host-contract.md`](../host-contract.md));组件 `layout.layer: "backdrop"` 让组件铺满分区并置于同分区其余组件之下,其余组件仍走该分区当前列轨的自动流(缺省为 12 列),页面不写坐标、宽高或 z-index。三个声明各管一层:`layoutForm` 管页面外框、`container` 管分区外壳、`layer` 管分区内层次,唯一硬冲突是 `backdrop` 要求 `container: "plain"`。铺底组件的未遮挡矩形(**安全区**)由 `RuntimeSection` 计算并经 CSS 自定义属性下发,**明确不进页面 schema**——那会把布局结果写进页面元数据；该通道已经实现并覆盖加载、字体变化、窗口缩放与窄屏回流。`dashboard` + `panel` 与 `report` + `backdrop` 两个组合合法但没有设计过观感,决定不禁、以测试钉住现状。同一份 ADR 把聚合根改称**页面**,「看板」与「报表」降为布局形态。

**组件级分组容器([ADR-0053](./0053-composite-card-component-level-grouping-container.md)):** 新增组件类型 `compositeCard`(**组合卡**)——一张卡框住若干组件,自身不承载数据,子组件是五种的白名单(`metricCard`、`pieChart`、`gauge`、`keyValuePanel`、`categoryBreakdown`)、禁止递归、卡内复用同一条 12 列自动流,分隔线是容器上的一位布尔信息且位置由结构派生。同批附带一个叶子组件 `categoryBreakdown`(**分类明细**,按类别逐行、按度量逐列的紧凑明细)——按仓里先例新增叶子组件不单写 ADR,因此它登记在这份 ADR 的白名单里;它与并排饼图之间有一条硬约束:**颜色按类别取值决定,不按行序决定**,该约束不进页面文档,只能由测试钉住。它与 `section.container: "card"` 的判据是层次而不是功能:`container` 是**分区级**、卡与卡只能纵向堆叠;组合卡是**组件级**、进 12 列栅格、可以横向并排若干张。`container` 仍是分区外观的唯一真源,组合卡不改变也不推断分区外观,因此 ADR-0038 那条「新增 `container` 档位必须证明结构上不可区分且视觉上必须不同」不被触发。该 ADR **推翻了 ADR-0038 否决「`group` 层级」时的前提**——「当前没有需要独立 DOM 所有权的场景」已不成立——但只放开一层非递归的组件级容器,不引入 `rows`/`stack` 递归布局语言。按 ADR-0051 是纯增量,登记为 **5.2**;协议、widget 与统一运行时已经实现,概览页已迁移为三张并排组合卡。编辑器仍原子化处理组合卡,嵌套子组件创作明确延期。

`timeRange` 筛选器的 `default` 除既有天级预设与绝对区间外,新增**结构化相对时间**分支(粒度单位 + 区间描述 + 锚点,并显式承载是否包含当前未完成周期);它是声明式数据而不是表达式字符串,求值发生在服务端取数编排期且一次页面加载内共享同一求值时刻,0003 的"禁表达式与脚本"原样成立。页面另需一处可表达"本页面含 N 个临时指标"及其已被显式接受的声明(ADR-0036),使这一风险在后续查看与审计中始终可见。

**已生效的 5.1 增量:** [ADR-0047](./0047-first-class-page-parameters.md) 顶层新增可选的 `params`,文本属性取值从 `string` 放宽为「字面量或页面参数引用」;物化后领域类型仍是 `string`。[ADR-0048](./0048-navigation-intent-and-host-routing.md) 跨页下钻只上抛导航意图,路由与回跳属宿主。[ADR-0050](./0050-filter-type-closure-and-hierarchical-dimensions.md) 筛选器闭集从两类扩到六类并支持层级与级联,**ADR-0035 的结构化相对时间欠账已随 0050 偿还**。[ADR-0052](./0052-dashboard-layout-form-backdrop-and-safe-area.md) 新增顶层 `layoutForm` 与组件 `layout.layer`(见上一段)。**仍为提议的 5.1 增量:** [ADR-0049](./0049-table-server-side-and-presentation-capabilities.md)——表格的排序与列头筛选按数据源模式整体下推或整体本地化,查询分页下的拒绝规则尚未解除。全部为纯增量,存量页面不迁移。

ADR-0018 的局部显式在这批中被反复援引为边界依据,但守法方式是**限制间接的形态而不是限制它出现的位置**:页面参数引用只允许整值替换、不允许模板插值,取值只能是标量,格式复用 ADR-0013 的既有闭集;计算产出字段必须就地声明在结果字段契约里;层级到谓词字段的映射写在查询里而不是网关配置里。按组件类型限制参数消费面的方案已被 ADR-0047 否决——那会让页面为了显示一个值而被迫引入某个组件。

来源:[ADR-0017](./0017-page-schema-v3-hard-cutover.md)、[ADR-0018](./0018-keep-page-metadata-locally-explicit.md)、[ADR-0013](./0013-format-belongs-to-component-field-binding.md)、[ADR-0021](./0021-page-id-is-not-a-rendering-switch.md)、[ADR-0026](./0026-controlled-nested-detail-fields.md)、[ADR-0028](./0028-controlled-semantic-html-detail-fields.md)、[ADR-0035](./0035-structured-relative-time-expressions.md)、[ADR-0036](./0036-metric-gap-non-blocking-exit.md)、[ADR-0038](./0038-section-container-and-row-alignment-invariant.md)、[ADR-0042](./0042-money-fields-and-semantic-embedded-values.md)、[ADR-0052](./0052-dashboard-layout-form-backdrop-and-safe-area.md)、[ADR-0053](./0053-composite-card-component-level-grouping-container.md)、[ADR-0054](./0054-section-weighted-column-tracks.md)、[ADR-0059](./0059-direct-component-box-responsive-ownership.md)。

## 数据获取与查询模型

这是 37 份 ADR 里演进链条最长、也最容易读错现状的一组决策,按时间顺序梳理如下,**只有最后给出的"当前实际生效模型"可直接采信**:

1. `schemaVersion 2.0`([ADR-0011](./0011-derive-query-fields-from-catalog.md)、[ADR-0012](./0012-query-dp-and-verify-data-service-for-metric-fulfillment.md)):页面引用预定义指标/维度,`query` 字段由结构化查询 + 元数据目录解析,指标履约需要查 DP 并向数据服务验真。**已被 0014 完全取代。**
2. [ADR-0014](./0014-query-artifacts-replace-metrics.md):治理对象从"预定义指标"改为"可执行且可复现的查询"。此时的模型是页面只持有精确**查询执行引用**,不提交 SQL/DQE 原文,原文由服务端解析已验真的"查询产物"修订。
3. [ADR-0015](./0015-defer-cascading-data-source-input-semantics.md)(status: proposed):在"只提交查询执行引用"的前提下设计级联数据源语义,因找不到能覆盖实际后端能力的输入绑定方式,**保持提议状态,未实现**。
4. [ADR-0016](./0016-send-embedded-query-definitions.md):**推翻 0014 和 0015 "只提交查询执行引用,不得提交查询原文"的边界**,改为页面直接内嵌 DQE 查询定义(`{ language: "dqe", body }`),浏览器直接提交原文,服务端每次执行时校验权限与安全边界。"查询产物"作为独立修订资产的模型至此不再是当前实现。
5. [ADR-0017](./0017-page-schema-v3-hard-cutover.md):把 0016 的内嵌查询定义落地为 `schemaVersion: "3.0"`,一次性删除旧结构化查询、指标目录和指标履约的全部代码路径,字段角色改为 `dimension`/`measure`,新增 `queryField` 显式映射和 `filterBindings` 显式筛选绑定。
6. [ADR-0020](./0020-embedded-initial-rows-and-query-pagination.md):在 0017 的 `query` 数据源上补充可选的内嵌初始行(`source.initial`,字段键用 DQE 原始输出名)用于首屏免查询呈现,以及基于 DQE `order.offset/limit` 和 `total_count` 的查询分页。
7. [ADR-0026](./0026-controlled-nested-detail-fields.md):在不放开任意 JSON 的前提下,以 `recordList/detail` 支持项字段契约与查询字段映射均就地显式的一层嵌套明细。
8. [ADR-0028](./0028-controlled-semantic-html-detail-fields.md):对 DQE 已完成内容组合的明细,以 `semanticHtml/detail` 传递受控标签、文本和语义类;数据网关保持字符串不透明,显式前端消费者负责白名单解析、节点渲染和样式映射。
9. [ADR-0031](./0031-metrics-as-data-context-discovery-anchor.md) 与 [ADR-0032](./0032-authoring-time-query-verification.md):补齐查询**怎么被形成**这一段。指标以发现条目与口径锚点身份进入数据上下文快照(Schema 元数据升到 `1.1`,条目含业务名、别名、口径说明、单位、是否比率、**可加性与时间聚合方式**、可用维度与所属业务域),但不回到页面协议、不作为建页或问数的强制前置,0014 拒绝预定义指标的结论未被推翻;业务域只是路由标签,各域共用同一个数仓与同一个 DQE 执行环境,不产生第二套端点或凭据;发现层描述的是 DQE 语义面(中文指标名、维度名、维度取值域、时间粒度能力、指标维度可组合性)而非 ADS 物理表与字段,检索按名称/别名精确匹配加口径说明向量匹配的混合方式进行。创作期的操作对象是**取数单元**(业务语言描述的指标 × 维度 × 时间 × 筛选,暂命名),查询定义与结果字段契约是它经真实执行后的派生物;取数单元是随分析会话存在的创作期状态,不产生独立 id、修订与发布治理,因此不构成 ADR-0033 拒绝的第二个聚合根。任何进入页面文档的 `query` 数据源,其查询定义必须先经清单校验 → 真实执行 → 结果字段契约物化;闭集是**分层**的:指标名、维度名、维度取值与时间粒度必须取自数据上下文闭集,而 `output_metrics` 内嵌 `formula` 是**有意保留的开放面**,允许模型自由生成,代价由留痕、可加性校验与沉淀设闸承担而非事前禁止。契约的字段名来自真实执行输出,类型与语义来自数据上下文,不以样例值推断,`origin.md` 的"不从查询返回样例推断字段契约"继续成立。
10. [ADR-0033](./0033-suspend-dataset-runtime.md)(status: proposed):曾设计服务端**计算数据集**(Transform 层 join/lookup/group/timeAlign/rank + Compute 层 `ratio`/`pctChange`/`cagr` 等具名算子)来补齐 DQE 表达不了的 30%–40% 派生计算,**挂起**。挂起理由是它要求领域层出现第二个聚合根(实质修订 0006/0007)、它的 Transform 边界语义正是 0015 挂起的那一批、且其正确性依赖尚未在真实数据侧补齐的可加性与时间聚合方式。派生计算改由 DQE formula 承担;结论"不提供通用 `arithmetic`,只提供具名算子"被保留以备恢复。
11. [ADR-0034](./0034-graphql-rest-as-data-gateway-adapters.md):DQE 表达不了的取数场景经 GraphQL/REST **数据网关适配器**接入,组件与浏览器不得直连,0014 的"新增执行环境必须接入数据网关"原样适用。`query.language` 从字面量 `'dqe'` 升级为判别联合,`dqe` 分支形状不变、存量页面无需迁移;端点与凭据不进页面文档;响应到行集的摊平路径必须显式声明,不按样例推断。这些路径的发现面是操作名、参数与响应字段,需另备一份发现描述,缺失时只能人工建页。

12. [ADR-0044](./0044-first-class-metric-entries.md):补齐 0031 从未落地的那一半。指标条目成为**业务域级一等结构**(`schema.metrics`),不再是 `roleHints: ['measure']` 的字段,`roleHints` 闭集收窄为 `dimension | time`;可加性与时间聚合方式由 `description` 里的受控中文散文变为结构化闭集,`formatVersion` 一次性切到 `1.1`。可加性维持三档,但 `不可加` 的含义明确为"不得折叠已返回的数据行,可在目标粒度重新查询"(本仓的粒度变化在架构上永远是一次重新查询,不存在客户端折叠)。语义面投影 `SemanticSurfaceMetric` 的既有字段一个未动,故问数链路未受影响;可加性的**消费**留给 ADR-0039 的实现批次。

**当前实际生效模型:** `query` 页面数据源直接内嵌 DQE 查询定义并可选内嵌首屏初始行,标量字段角色为 `dimension`/`measure`,受控的一层对象数组使用 `recordList/detail`,受控语义 HTML 使用 `semanticHtml/detail`,通过外层、必要时项级 `queryField` 以及 `filterBindings` 显式声明与外部协议的对应关系;页面数据源可另有封闭具名算子阶段,算子产出字段就地声明在同一份结果字段契约里但不带 `queryField`。不存在需要提前注册的预定义指标或独立版本化的"查询产物"资产;数据网关按查询定义分发执行并归一化返回,算子在归一化之后作用于行集。[ADR-0022](./0022-page-data-sources.md)(原编号 0008)记录的是这条演进链之前的"命名数据源 + `inline`/`query` 判别式取数"结构性基线,这部分结构仍然有效,但其正文对 `query` 字段模型和首查语义的具体描述已经过时,读它时必须结合本节时间线,不要单独采信。该 ADR 原先把"仅含 inline 数据源的页面"称为静态页面并禁止其 `filters` 与 action,**这条约束已按新不变量改写**:不变量是**交互必须在页面自己能观察到的状态上产生可见效果**,而不是"inline 页面不许有交互"。因此**仅内联页面**可以声明筛选器(含驱动地图下钻的层级维度筛选器)与 `navigate`,被拒的只有 `writeFilter`(没有生效查询可以响应它)与远程分页。

级联数据源输入语义(上游查询结果作为下游查询受控输入)仍是[ADR-0015](./0015-defer-cascading-data-source-input-semantics.md)记录的未决问题,当前页面 schema、校验器和数据网关不支持这类依赖。IOC 作战地图的项目详情页曾是这类依赖的一个真实实例(客户活动查询依赖项目详情返回的 `party_number`),但 [ADR-0047](./0047-first-class-page-parameters.md) 改由上游页面下钻时以页面参数传入绕开,**ADR-0015 因此没有被这个需求推动解冻**。

**已生效的扩展:** [ADR-0046](./0046-controlled-computation-with-named-operators.md) 在数据源上引入计算阶段,第一批是单数据源内的 `ratio`/`delta`/`groupSubtotal`/`grandTotal`/`pivot`;query 字段契约放宽为「查询字段或算子产出字段」。0046 对 ADR-0033 是部分恢复:采纳其"不提供通用 arithmetic,只提供具名算子"的保留结论,不恢复其计算数据集聚合根与 Transform/Compute 分层,**因此 ADR-0033 的三条恢复条件仍然未满足,挂起未解除**。第二批的跨数据源 `joinAggregate` **本轮不定形状**。

**仍为提议的扩展:** [ADR-0045](./0045-graphql-query-branch-with-structured-predicates.md) 落地 ADR-0034 留白的 GraphQL 分支,筛选条件以结构化谓词(封闭算子 + 绑定筛选器或页面参数 + 空值省略)表达,排序以排序绑定表达,总条数由计数声明复用主查询谓词。**本批未落地,`QUERY_LANGUAGES` 仍只有 `dqe`。**

当前 `versionPolicy.current` 是 `5.3`(见 `packages/page/src/version.ts`)。主版本 5 由 [ADR-0038](./0038-section-container-and-row-alignment-invariant.md) 记录(分区容器 `container` 取代 `section.variant`/`section.layout` 的硬切换);5.1 是 [ADR-0051](./0051-additive-minor-versions-for-page-schema.md) 策略下的第一次次版本递增。历史上 3.0→4.0 的切换没有专门 ADR——4.0 版本内新增的能力(AI 总结组件、内嵌初始行与查询分页等)由 [ADR-0019](./0019-internalize-ai-summary-generation.md)、[ADR-0020](./0020-embedded-initial-rows-and-query-pagination.md) 分别承载,未触发新的整版本切换记录。那是 ADR 记录里的一处已知空白,不是本文件的误读。**5.3 已发布**(`supportedVersions()` 返回 5.0 / 5.1 / 5.2 / 5.3):[ADR-0053](./0053-composite-card-component-level-grouping-container.md) 的 `compositeCard` 与 `categoryBreakdown` 是 5.2 能力,同批还有地图分档图例与 tooltip 扩展字段、`ratio.scale` 与 `keyValuePanel.columns: 1`;[ADR-0054](./0054-section-weighted-column-tracks.md) 的受控权重列轨，以及同批的筛选 `emptyLabel`、紧凑/嵌入式呈现闭集、指标短上下文、键值单位与地域固定摘要是 5.3 增量能力。存量页面继续声明满足其能力下限的已发布版本,不做强制迁移。

**已生效的版本策略:** [ADR-0051](./0051-additive-minor-versions-for-page-schema.md) 把版本演进规则正式化——次版本递增只用于纯增量变更(新增可选字段、判别联合新增分支、闭集新增成员、放宽既有约束),主版本递增用于破坏性变更且**必须单独写 ADR 论证为什么无法以增量表达**。理由是硬切换与本仓自己的生命周期模型冲突:页面修订不可变([ADR-0008](./0008-immutable-page-revisions-and-publish-leases.md))、模板引用精确的已发布修订([ADR-0010](./0010-page-templates-reference-published-revisions.md))、报告冻结在采集时点([ADR-0030](./0030-transient-page-state-for-ask-and-explore.md)),三者都要求旧文档长期可读,而「迁移一份不可变修订」的产物是一个新修订,模板与报告指向的仍是旧那个。ADR-0017 与 ADR-0038 在各自时点可行,是因为当时没有生产内容;该策略不追溯改写它们。上一段记为「已知空白」的 3.0→4.0 版本内增长,事后看正是这条策略描述的行为。当前 `versionPolicy` 已按此策略承载主版本、次版本与能力表,接受 5.0、5.1、5.2 与 5.3。

该策略有**一条例外**(2026-08-25 补入 ADR-0051):**从未被任何存量文档行使的开放面,可以按次版本收紧。** 判据是零使用、可证(测试或脚本随收紧一并落地)、并承认形式超集让位于真实文档集合上的超集。它被刻意限定得很死——"很少使用"不是判据,只有"零使用且可证"才是——否则它就是绕过版本策略的后门。第一个适用对象是组件 `layout` 对象补 `.strict()`(每个组件的 `props` 都是 strict,`layout` 不是,写错键名会静默通过),该收紧已随 5.2 行使,零使用证明是 `packages/page/tests/layout-strict-zero-usage.test.ts`。

## 产品形态谱系与两速生命周期

**现行结论:** 产品形态不只有看板。问数(Ask)、探索(Explore)、报告(Report)、Data App(App)与未来的监测(Monitor)共用**同一份页面文档表达**,页面文档同时是 Data Agent 与 Data App 的**汇合点**(0033 挂起计算数据集后,汇合点从计算数据集回落到页面文档)。生命周期分两速:问数与探索产生**临时页面态**——一份通过页面校验、由现有统一运行时直接渲染的页面文档,不进入页面仓储、不产生页面修订、不占页面目录、不参与发布治理,并使用临时页面 id;只有用户显式要求沉淀时才进入资产态。

沉淀分两个方向,时间语义相反:沉淀为 App 走 `saveRevision`,页面时间必须是结构化相对时间(ADR-0035)才会随周期滚动,且若含临时指标需过 ADR-0036 的门槛;沉淀为 Report 则**保留查询定义与内嵌初始行、不声明筛选绑定**——按 ADR-0020,默认状态下存在内嵌初始行且无筛选变化时统一运行时不重新查询,报告因此天然冻结在采集时点,同时保住口径溯源。Report 不新增数据源类型或渲染路径。

问数的 NL2DQE 发生在 Platform 创作期,统一运行时收到的始终是已经确定的页面文档,因此"统一运行时不执行 NL2DQE"这条不变式原样成立,并未因新增形态而放宽。**分析会话已裁决为服务端一等概念:** 保存 `sessionId`、追加式步骤事件流与一份最新**会话检查点**;步骤事件解释过程,检查点恢复已校验临时页面态、结构化续跑状态、组件钉住结果与待确认交互。它不是页面修订,不进页面仓储或发布治理;不保存完整对话文本、模型 prompt 或原始 `outcome.messages`。会话按 90 天保留,仅平台管理员与本人可见;身份当前允许 mock,但 mock 必须提供多个可切换用户且按 `actorId` 的可见性过滤必须真实执行,接入真实身份是上生产的前置条件。Monitor 当前不建设,其依赖(调度、基线、稳定指标口径)已记录,其中稳定口径由 ADR-0031 承载、每期重算由 ADR-0035 承载。

来源:[ADR-0030](./0030-transient-page-state-for-ask-and-explore.md)、[ADR-0058](./0058-latest-session-checkpoint-restores-transient-page-state.md)、[ADR-0009](./0009-node-postgres-platform-beside-runtime.md)、[ADR-0021](./0021-page-id-is-not-a-rendering-switch.md)、[ADR-0020](./0020-embedded-initial-rows-and-query-pagination.md)、[ADR-0022](./0022-page-data-sources.md)、[ADR-0035](./0035-structured-relative-time-expressions.md)、[ADR-0036](./0036-metric-gap-non-blocking-exit.md)。

## 问数编排与口径治理

**现行结论:** 编排顺序固定为域路由 → 指标与维度检索 → 候选消歧 → 口径成形 → 清单校验 → 真实执行 → 意图判定与组件选择 → 呈现,全部发生在 Platform 创作期。域路由由模型分类但**结果必须可见且可改**(静默路由错域会产出看起来完全正常的错数);检索返回排序候选与口径差异说明,取数核对是一次**消歧**而不是一次确认;执行前展示完整生效范围卡,但只在候选歧义、使用自由 formula、命中临时指标、时间口径由模型补全或预估成本超阈值时阻塞等待确认;每步中间结果分步流式呈现,既处理延迟也充当纠错锚点。Answer 允许由多个组件组成,就是一份完整的临时页面文档。组件选择以能力目录、字段角色、维度基数与时间粒度为**硬闸**,在允许范围内按分析意图排序,意图回显且用户可钉住,不把可视化决策外包给提问者。多轮修改是定向增量 patch,允许一轮同时改多层,原则是**用户未提及的显式设置保持不变**。

口径治理承认一处开放面:指标检索不到时**尽力回答而不阻塞**(不恢复 0012 的 `METRIC_GAP` 状态),但临时指标必须在界面上与公司口径视觉可区分、缺口落库为带出现次数的指标需求条目、且沉淀为长期 App 时必须显式接受"本页面含无人负责的口径"并把该事实**持久化在页面上**。冷启动依赖人工构造的 30–50 条黄金问题集(存量页面可反向抽取的真实 DQE 查询体只有 4 个),配额为直答 60%、需澄清 20%、无指标缺口 10%、跨域近义易混 10%,且 few-shot 样本与评测样本必须切开。

问数增强批次(2026-08,PRD #85)在上述框架内补三笔:**派生指标模板**(环比/同比/占比)的公式预先声明在数据上下文层,派生指标视同公司口径,收窄 0036 的临时指标边界(模板外仍走临时指标);**取数核对升级为控制面板**——非阻塞轮次 token 行呈现,时间与筛选要素就地修改为不经模型的数据校准并落步骤事件,已验证查询词面高度命中时跳过口径成形(验真不可跳),消歧候选按用户本人历史默认预选但永远阻塞确认;**治理收件箱**统一别名候选、指标需求候选与已验证查询提名为单列待办,采纳不自动写回,评审回执走会话事件流。问数的口语时间(「上个月」)由**相对时间词表**(数据上下文层闭集)映射为 0035 的结构化相对时间表达,词表外如实拒答——0035「不允许模型直接写死日期」的要求由此落实。

**一句问题铺开整页,跨口径也允许,但差异必须一直可见。** ADR-0037 的「Answer 允许由多个组件组成」此前被首轮提示词收窄为单个取数单元,现已放开:首轮识别出多个视角时口径成形直接输出多个新增操作,一个视角一个单元、一个单元一个组件(实测一句「Tokens 运营月报」得 6 个单元 6 个组件),多单元缺省标题按各单元指标派生。这些单元的口径往往并不相同(分组维度分别是无、统计周期、区域、模型),这不是模型跑偏而是报表的本来形状。[ADR-0055](./0055-scope-groups-as-section-boundaries-in-ask-answers.md)裁决:**允许跨口径页面且不为它新增阻塞**——跨口径不是会算出错数的口径风险,而是数都对但比不了的**对照风险**,按 ADR-0036 处理临时指标的同一套办法处理(不阻塞、但必须一直可见);差异靠**口径组**(取数单元按域 + 分组维度 + 时间窗口与粒度 + 维度筛选取的等价类)一组一个内容分区来承载,分区标题只写各组之间真正不同的那几项,并同时在取数核对(补分组维度)与助手回复(按组汇总并明说不能横向对照)上可见。装配出口形状改变但页面协议不动,**不触发 ADR-0051 的版本递增**。同批两条配套约束:分析意图按单元判定且输入收窄到该单元自己的口径(否则整句里的「走势」会把按行业切分的单元也判成趋势),一轮至多 6 个取数单元且由编排侧确定性拒绝超出部分(成本与延迟随单元数线性增长,而成本预估能力至今不存在)。该 ADR 同时给尚未建设的「问数结果页交互式筛选条」预设了硬约束:筛选器只能作用于共享该维度的口径组。

**同一条判据接着推出两笔布局与页头决策([ADR-0057](./0057-proportional-row-packing-and-page-header-in-assembly.md))。** 组件形态多样之后产物仍摆不成一页,因为装配无条件取目录 `defaultSpan` 当绝对宽度,而多数口径组只有一个组件,于是每个分区各留一段空白、右边缘参差。修法是按比例装箱铺满行宽(见「页面元数据与布局」段)。同时,装配开始产出**页面级页头**:独立首个分区、`container: "plain"`,标题取各单元业务域的去重拼接,全页共用同一时间窗口时以 `asOf` 写出该窗口,任一单元缺口径时不产页头。理由正是 ADR-0055 自己那条——页面会被沉淀、被分享、在别的宿主里打开,只有写在文档里的事实才跟着走;而此前「这一页覆盖哪个业务域与时间窗口」在页面文档里一个字都没有(问题原文进了 `meta.description` 却没有页面内渲染消费者,时间窗口被分区标题按「全页共用即为噪声」剔掉)。**页头不用问题原文当标题**:部分可答时问句里含缺口指标,拿它作标题等于让页面承诺自己没有的数字,与 ADR-0036 的边界冲突。页头不承载取数单元,因此不经 `auto-visualize` 的硬闸、也不放宽硬闸对 `bindsData: false` 的拒绝;`text` 与 `aiSummary` 不产出(前者内容无可信来源,后者在手写看板里出现 0 次)。出口形状变化同样不触发 ADR-0051 的版本递增,但消费装配产物的代码从此不能假定每个组件都有 `data.main`。

**归因诊断([ADR-0043](./0043-attribution-diagnosis-as-a-sibling-analysis-form.md),proposed)不改变上述编排,而是与它并列。** 本节描述的固定顺序状态机回答"是多少";"为什么变了"是结果驱动的多阶段过程,由 `AgentRunner` 的第二个实现承担,与问数共享步骤事件落库、SSE、临时页面态与页面校验准入,**不共享编排状态机**。归因逻辑只面向分析证据 Port 编程,生产侧适配器复用 ADR-0032 的验真链路,因此 0032 与 0037 的全部约束原样适用于归因取到的每一份证据。该 ADR 目前是设计基线,未实现;读本节时不要把它当作已生效的编排分支。

来源:[ADR-0037](./0037-ask-orchestration-and-interaction-contract.md)、[ADR-0031](./0031-metrics-as-data-context-discovery-anchor.md)、[ADR-0032](./0032-authoring-time-query-verification.md)、[ADR-0036](./0036-metric-gap-non-blocking-exit.md)、[ADR-0030](./0030-transient-page-state-for-ask-and-explore.md)、[ADR-0035](./0035-structured-relative-time-expressions.md)、[ADR-0039](./0039-derived-measure-templates-as-company-definitions.md)、[ADR-0040](./0040-scope-card-as-control-panel.md)、[ADR-0041](./0041-governance-inbox-unified-growth-loop.md)、[ADR-0043](./0043-attribution-diagnosis-as-a-sibling-analysis-form.md)、[ADR-0055](./0055-scope-groups-as-section-boundaries-in-ask-answers.md)、[ADR-0057](./0057-proportional-row-packing-and-page-header-in-assembly.md)。

## 页面生命周期与发布治理

**现行结论:** 本节描述的是**资产态**;问数与探索的临时页面态不进入这套治理(见上一节)。页面保持稳定身份,每次成功保存产生不可变页面修订,修订历史只能以前一最新修订为基线线性前进;发布只能针对当前最新修订发起并原子取得 15 分钟页面级发布租约,人工确认时按最新元数据复验,批准/拒绝/取消/超时均释放租约;所有写入口自首次提供起支持幂等重试。页面模板的模板修订只保存发现元数据和精确的已发布页面修订引用,不复制页面文档,来源页面后续的新修订不影响既有模板修订。

来源:[ADR-0008](./0008-immutable-page-revisions-and-publish-leases.md)、[ADR-0010](./0010-page-templates-reference-published-revisions.md)。

## AI 总结组件

**现行结论:** 页面摘要默认使用 `text`,由后端随页面文档在 `props.body` 中返回正文;正文默认按纯文本渲染,需要分色时显式声明 `bodyFormat: "semanticHtml"`,并与排行详情共用受控语义 HTML Module。只有需求明确声明运行时 SSE 动态生成时才选择 `aiSummary`,不得根据标题、已有数据或 AI 文案自动推断。显式声明的 AI 总结是内化执行的生成型垂直组件 Module,不是第三种页面数据源。`aiSummary` 组件只声明可选标题、纯文本 `promptTemplate` 和必填的 `relatedData`(对既有页面数据源字段的显式只读引用),不声明 `data`,不暴露端点、Header 或 SSE 协议参数。Host、请求组装、私有 SSE Adapter、会话管理与纯渲染 View 在组件目录内高内聚地分工;数据网关不为此新增 AI/Prompt/SSE 方法。只有出现真实的多组件共享生成能力时,才从当前的单一垂直组件中提取公共 Module。正文的受限 Markdown 渲染此前隔在 `widgets` 包,已由 0025 迁入同一组件目录,该垂直模块至此完整;同一份决策也说明了为什么 `aiSummary` 不该有 `widgets` 侧实现。

来源:[ADR-0019](./0019-internalize-ai-summary-generation.md)、[ADR-0025](./0025-converge-runtime-presentation-packages.md)、[ADR-0027](./0027-default-summary-to-text-unless-sse-explicit.md)、[ADR-0029](./0029-share-controlled-semantic-html-rendering.md)。

## 未决事项

- **GraphQL 路径的发现描述**([ADR-0034](./0034-graphql-rest-as-data-gateway-adapters.md) 决策节、[ADR-0045](./0045-graphql-query-branch-with-structured-predicates.md) Consequences):ADR-0034 要求 GraphQL/REST 路径补一份以操作名、参数与响应字段为可枚举面的发现描述,并明确"缺少这层描述时该路径只能由人工构造查询,不进入问数的自动生成范围"。ADR-0045 本批不交付它。当时的假设是 GraphQL 只承载 DQE 表达不了的少数场景,而 IOC 作战地图让 GraphQL 成为某个完整应用的**唯一**取数协议,这条下限的实际代价随之放大。**在补齐之前,不得宣称该类应用可由 AI 生成。**
- **跨数据源聚合算子的形状**([ADR-0046](./0046-controlled-computation-with-named-operators.md) 决策节):`joinAggregate`(按组合键把另一个数据源聚合后并入)被推迟到第二批,形状未定。它要回答的正是 [ADR-0015](./0015-defer-cascading-data-source-input-semantics.md) 列为"恢复设计前需依次确定"的五项——空集与失败传播、输入集合上限、循环依赖校验、缓存键、取消语义。推迟是为了用第一批算子的实战经验去定它;代价是概览页的核心指标(管道支撑率)在此之前无法实现。
- **多页应用是否需要成为一等概念**([ADR-0048](./0048-navigation-intent-and-host-routing.md) Considered Options):IOC 作战地图的应用外壳归已有门户,因此本批只定义了导航意图与宿主路由契约,没有引入导航树、页面成员或面包屑规则。第二个多页应用出现时需要重新裁决;届时要注意,面包屑的真正难点(回跳要恢复来源页的筛选、搜索、分页与排序状态)本就不是静态导航树能表达的。
- **级联页面数据源输入语义**([ADR-0015](./0015-defer-cascading-data-source-input-semantics.md),proposed):恢复设计前需要依次确定空集与失败传播、输入集合上限、循环依赖校验、缓存键和取消语义;在明确 SQL 与 DQE 共同支持的受控参数模型之前,不得向页面 schema 加入临时 `inputs`、表达式或任意结果转换能力。
- **模板发布的治理强度**([ADR-0024](./0024-converge-authoring-time-packages.md) 待决节):`template-library` 当前的发布流程没有租约过期、审计事件或拒绝/取消/强制释放,治理强度明显弱于页面发布(ADR-0008 的 7 态 + 全量审计),但没有 ADR 说明这是刻意的产品裁决还是实现漂移。在这一点被显式裁决(写新 ADR)之前,不应该以此为由抽取页面/模板共享的发布内核。
- **真实身份接入是上生产的前置条件**([ADR-0030](./0030-transient-page-state-for-ask-and-explore.md) 决策节):会话内容含问题原文(客户名、代表处、业务黑话),按身份可见性过滤是首版能力,但当前身份仍是 mock。mock 阶段的隐私承诺结构上成立、来源不可信,因此在接入真实身份之前不得把会话数据用于跨用户的推荐、评测或对外分享。**数据权限本身(行级与指标级过滤由 DQE 承担还是由本平台承担)尚未裁决**,这一点未定之前,`actorId` 过滤只保证会话可见性,不保证数据行可见性。**归因诊断(ADR-0043)把这条未决事项的代价放大:** 自动下钻会主动查询用户未提及的维度,因此在权限归属裁决前,0043 把下钻候选集限制为"用户已明确出现在筛选条件里的维度及其声明过的下级",不做自主探索;这是一条显式的、待裁决后可放开的约束,不要当作实现不完整。
- **查询成本、配额与成本预估**([ADR-0032](./0032-authoring-time-query-verification.md) Consequences、[ADR-0037](./0037-ask-orchestration-and-interaction-contract.md) Consequences):创作期真实执行与每轮问数都产生真实数仓成本,按身份的次数与资源限制策略尚未确定;ADR-0037 取数核对的"预估成本超阈值才阻塞确认"依赖尚不存在的成本预估能力,在其具备之前该条件退化为按域或按粒度的粗略阈值。
- **计算数据集的恢复条件**([ADR-0033](./0033-suspend-dataset-runtime.md),proposed):需同时满足指标条目的可加性与时间聚合方式在目标域真实可用、ADR-0015 的五项级联语义有确定答案、且 formula 的口径复制成本已实际发生(同一口径在多个页面各持副本并已漂移)。第一条的**契约侧已由 [ADR-0044](./0044-first-class-metric-entries.md) 打通,数据侧未补齐**,因此该条件仍未满足;后两条未动。在此之前不得以任何名义在服务端或页面协议中引入 Transform/Compute 层,也不得提供通用 `arithmetic`。三个条件与外部 Dataset Runtime 提案的逐条对账见 [`docs/dataset-reconciliation.md`](../dataset-reconciliation.md)。
- **Explore 是否需要独立于 Ask 的构造能力**([ADR-0030](./0030-transient-page-state-for-ask-and-explore.md) 决策节):当前 Explore 被视为 Ask 的多轮延续,共用同一份临时页面态与同一套编排。若出现并排对比、分叉比较或跨会话拼装这类 Ask 编排无法表达的需求,才需单独裁决;在此之前不要为 Explore 建立第二套状态模型。
- **首个落地域与黄金问题集的业务输入**([ADR-0037](./0037-ask-orchestration-and-interaction-contract.md) Consequences):黄金问题集需要域清单与一句话描述、每域高频指标 top 20 与常见口头说法、时间口径的默认约定("本月"是否到昨天、"同比"比同月还是同期累计)、以及哪些指标是存量哪些是流量。后两项无法从数据推断,必须由业务侧给出;在拿到之前,问数的准确率数字不具备可比较的基线。
- **英文 `metric_code` 与 DQE 中文指标名的关系**([ADR-0031](./0031-metrics-as-data-context-discovery-anchor.md) Consequences):`packages/data-gateway/fixtures/metric-base-info.json` 记录的是英文指标 code,而两个存量页面的 DQE 查询体使用中文指标名,二者是否指向同一实体尚未确认。指标条目允许同时携带两者,但不得假设映射,也不得据此推断名称转换规则。
- **Monitor 的调度与通知归属**([ADR-0030](./0030-transient-page-state-for-ask-and-explore.md) 决策节):主动洞察需要调度、基线与通知,当前都在系统边界之外,且尚未确定由本平台承担还是由数据侧承担。在这一点被裁决前,不要为此在统一运行时或平台内引入定时任务、订阅或消息通道。
- **指标条目的可加性仍需数据侧逐个声明**([ADR-0044](./0044-first-class-metric-entries.md) Consequences):Schema 元数据 `1.1` 与一等指标条目的**工程欠账已偿还**(指标迁出字段、`roleHints` 收窄为 `dimension | time`、可加性与时间聚合方式成为结构化闭集),但 0044 只让这些语义变得**可表达**,没有让它们变得**可用**——真实业务域里每个指标取什么可加性,是必须由数据侧给出的业务输入。在目标域真实补齐之前,不得认为 ADR-0033 的恢复条件一已满足。另需注意 0044 只交付了承载结构:ADR-0039 的派生指标模板、ADR-0035 的相对时间词表与 ADR-0043 的指标归因定义仍未挂上去,它们各自的字段形状尚未设计,落地时仍需继续递增 `formatVersion`(但届时是往指标条目上追加字段,而不是重建概念)。
- **归因诊断的受控业务规则与第一期落地输入**([ADR-0043](./0043-attribution-diagnosis-as-a-sibling-analysis-form.md),proposed):承载归因规则的概念已定名为**指标归因定义**并进入 `CONTEXT.md`,但它的字段集、与派生指标模板的关系,以及是否需要独立版本化仍未定,留给后续 ADR;它挂载的位置已由 [ADR-0044](./0044-first-class-metric-entries.md) 的指标条目提供。首个真实切片为公有云流水,阻塞于两项必须由数据侧给出的输入——指标条目所需的可加性与**维度层级关系**(当前快照里每个业务域只有 2 个非时间维度、零层级,下钻深度在数据里表达不出来),以及一个业务认可的黄金案例。此外分析会话当前是进程内存储(Postgres 等 #52),不足以支撑 0043 要求的诊断复跑与事后审计。
- **表现层包名与 `WidgetHost` 的术语归属**([ADR-0025](./0025-converge-runtime-presentation-packages.md) 待决节):ADR-0006 第 3 条把包名 `widgets` 的理由写为"取自规格字段",但该字段自 ADR-0017 硬切换后已是 `sections[].components`,根级 `widgets` 现被校验器作为旧版遗留字段拒绝,`CONTEXT.md` 亦无 `widget` 词条。ADR-0006 的 Consequences 要求"词汇表术语变更需评估包/端口命名级联",故这是一笔由 0006 自己规定要偿还的欠账;改名波及 `package.json`、跨包 import 与公开符号,应作为独立的命名决策处理,在此之前不要以"顺手"为由局部改名。

## 编号与历史记录说明

- **ADR-0022 曾编号为 ADR-0008**,与"不可变页面修订与发布租约"的 ADR-0008 编号冲突,已于 2026-08-05 重编号,标题与正文未改动;外部文档若引用旧编号"ADR-0008(命名数据源)",指的是当前的 ADR-0022。
- **ADR-0023** 记录的是一次纯粹的仓库清理(删除已经零源文件、零消费者的空壳包目录),不引入新的架构决策,列在此处仅为完整性。
