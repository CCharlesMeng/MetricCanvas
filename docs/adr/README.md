# ADR 基线：按主题聚合的当前生效结论

多份后出 ADR 部分或全部取代了早前 ADR 的前提,单独读任意一份都无法确认它在今天是否仍然生效。本目录的入口就是这一页:**速查表**给出每份 ADR 今天的状态,**主题页**按问题域聚合当前生效结论。两者都不是新决策,也不改写或删除任何原文。

**怎么用:** 先在速查表按编号定位状态,再进对应主题页读现行结论;需要背景、权衡或被否决的选项时,才打开 ADR 原文。

**状态真源是每份 ADR 自己的 frontmatter**(`status` / `superseded-by` / `revised-by` / `note`)。速查表与主题索引由 `tools/scripts/adr-index.py` 从 frontmatter 和主题页生成,`pnpm adr:index:check` 守门,**两块生成区之间不要手改**。主题页正文是人写的,它做的补充判断(例如"实际已被后续 ADR 取代但原文未标注")会在原地说明理由和依据。

**新决策怎么落:** 新增一份编号 ADR(当前下一编号 `0084`,落盘前须重新扫描目录),在它自己的 frontmatter 写清状态与关系,跑 `pnpm adr:index` 刷新两张表,再把结论**并进对应主题页**。不要在任何地方追加「某某 ADR」单独一段——文末附录段正是 0075/0080/0082/0083 漂成孤岛的成因,已于 2026-09-21 清理并入主题页。

**术语演进:** 聚合根已由「看板页面」改称**页面**,「看板」与「报表」降为它的两种布局形态([ADR-0052](./0052-dashboard-layout-form-backdrop-and-safe-area.md))。**0052 以前的 ADR 正文里出现的「看板页面」,指的就是现在的「页面」**;历史正文不改写。本文件转述现行结论时使用新称呼,引用 ADR 标题与原文措辞时保留原词。同理,「静态页面」一词已退休为**仅内联页面**([ADR-0022](./0022-page-data-sources.md) 正文已按新不变量改写)。[ADR-0056](./0056-metric-centric-terminology.md) 把问数术语围绕指标谱系规整:「临时口径」改称**临时指标**、「派生度量模板」改称**派生指标模板**、「口径卡」改称**取数核对**;0056 以前的 ADR 正文里出现的旧词按此映射理解,历史正文不改写,治理边界(临时指标不进语义面、须视觉标注)不随改名松动。

## 速查表

<!-- adr-index:start 由 tools/scripts/adr-index.py 生成，不要手改 -->

共 84 份 ADR（0001–0084）：现行 76、提议中 5、已取代 3。状态真源是每份 ADR 自己的 frontmatter，本表由 `tools/scripts/adr-index.py` 生成。

| 编号 | 标题 | 现状 |
|---|---|---|
| [0001](./0001-domain-dsl-over-a2ui.md) | 页面规格采用自研领域 DSL,不以 A2UI 为资产格式 | 现行；部分由 [0014](./0014-query-artifacts-replace-metrics.md) 修订 |
| [0002](./0002-svelte-runtime.md) | 统一运行时采用 Svelte + shadcn-svelte | 现行；部分由 [0066](./0066-self-contained-rendering-engine-host-boundary.md) 修订；shadcn-svelte 选型未落地，当前自建组件是实现事实 |
| [0003](./0003-strict-declarative-spec.md) | 页面规格采用严格声明式,禁止表达式与脚本 | 现行；部分由 [0014](./0014-query-artifacts-replace-metrics.md) 修订 |
| [0004](./0004-git-storage-first-platform-later.md) | 一期规格存 Git,平台后端与可视化管理延后 | 现行；作为二期平台之外的离线/静态实现，与 0009 并存 |
| [0005](./0005-build-over-open-source-bi.md) | 自研看板运行时,不采用/魔改 Grafana、Superset、Rill 等开源 BI | 现行；部分由 [0014](./0014-query-artifacts-replace-metrics.md) 修订；“数据服务唯一入口”前提已失效，其余理由不变 |
| [0006](./0006-metadomain-layering-and-naming.md) | 领域层建模为规格语言(元领域),包按 DDD 分层围绕聚合根"看板页面"命名 | 现行；部分由 [0014](./0014-query-artifacts-replace-metrics.md)、[0017](./0017-page-schema-v3-hard-cutover.md) 修订；取数边界与第 3 条“包名 widgets 取自规格字段”的前提均已失效，欠账记于 0025 待决 |
| [0007](./0007-demote-spec-to-document-form.md) | "页面规格"降级为文档形态,领域词汇只保留聚合根"看板页面" | 现行 |
| [0008](./0008-immutable-page-revisions-and-publish-leases.md) | 看板页面使用不可变线性修订与限时发布租约 | 现行；部分由 [0080](./0080-java-assets-single-attempt-save-and-status-publication.md) 修订；当前 Java 保存与发布范围已被部分替代 |
| [0009](./0009-node-postgres-platform-beside-runtime.md) | 平台采用独立 SvelteKit Node + PostgreSQL,统一运行时保持独立 | 已取代，见 [0060](./0060-static-svelte-java-page-governance-relay-python-authoring.md)；仍描述当前待迁移实现 |
| [0010](./0010-page-templates-reference-published-revisions.md) | 页面模板引用已发布页面修订而不复制页面文档 | 现行 |
| [0011](./0011-derive-query-fields-from-catalog.md) | query 字段契约由结构化查询与元数据快照解析 | 已取代，见 [0014](./0014-query-artifacts-replace-metrics.md) |
| [0012](./0012-query-dp-and-verify-data-service-for-metric-fulfillment.md) | 指标履约只查询 DP 并以数据服务目录验真 | 已取代，见 [0014](./0014-query-artifacts-replace-metrics.md) |
| [0013](./0013-format-belongs-to-component-field-binding.md) | 展示格式属于组件字段绑定 | 现行 |
| [0014](./0014-query-artifacts-replace-metrics.md) | 查询产物取代指标成为页面的数据基础 | 现行；部分由 [0016](./0016-send-embedded-query-definitions.md) 修订；“仅提交查询执行引用、禁止提交查询原文”的边界已被推翻，其余结论有效 |
| [0015](./0015-defer-cascading-data-source-input-semantics.md) | 挂起级联页面数据源的输入绑定语义 | 提议中；未实现，暂不接受相关 schema 改动 |
| [0016](./0016-send-embedded-query-definitions.md) | 看板页面内嵌并直接提交查询定义 | 现行 |
| [0017](./0017-page-schema-v3-hard-cutover.md) | 页面 Schema v3 一次性删除旧结构化查询 | 现行；交付时的版本号是 v3，versionPolicy.current 此后持续演进 |
| [0018](./0018-keep-page-metadata-locally-explicit.md) | 页面元数据保持局部显式 | 现行 |
| [0019](./0019-internalize-ai-summary-generation.md) | AI 总结采用垂直组件 Module 内化生成 | 现行 |
| [0020](./0020-embedded-initial-rows-and-query-pagination.md) | 查询数据源以内嵌初始行启动并支持查询分页 | 现行 |
| [0021](./0021-page-id-is-not-a-rendering-switch.md) | 页面 id 不作为渲染分支条件 | 现行 |
| [0022](./0022-page-data-sources.md) | 公开页面采用命名数据源,统一 inline 与 query 取数 | 现行；部分由 [0014](./0014-query-artifacts-replace-metrics.md)、[0016](./0016-send-embedded-query-definitions.md)、[0017](./0017-page-schema-v3-hard-cutover.md)、[0020](./0020-embedded-initial-rows-and-query-pagination.md) 修订；结构性基线；query 的字段模型与内嵌初始行细节已被修订，“静态页面”约束已于 2026-08-25 改写为仅内联页面的不变量，原文首部有说明 |
| [0023](./0023-remove-metric-fulfillment-and-catalog-packages.md) | 删除指标履约与目录发现的空壳包,完成 ADR-0014 迁移 | 现行；历史记录，清理已完成 |
| [0024](./0024-converge-authoring-time-packages.md) | 创作期包边界按领域收敛，agent-runner 与 data-context 不再是一级包 | 现行；模板发布治理强度留有待决事项 |
| [0025](./0025-converge-runtime-presentation-packages.md) | 表现层包边界按纯渲染职责收敛，widgets 只留页面组件 | 现行；包名与 WidgetHost 术语、Table.svelte 拆分留有待决与遗留 |
| [0026](./0026-controlled-nested-detail-fields.md) | 结果字段契约支持受控的一层嵌套明细 | 现行 |
| [0027](./0027-default-summary-to-text-unless-sse-explicit.md) | 摘要默认由页面文档返回，SSE 生成必须明确声明 | 现行 |
| [0028](./0028-controlled-semantic-html-detail-fields.md) | DQE 明细支持受控语义 HTML，样式仍由前端拥有 | 现行 |
| [0029](./0029-share-controlled-semantic-html-rendering.md) | 摘要与排行详情共用受控语义 HTML 渲染 Module | 现行 |
| [0030](./0030-transient-page-state-for-ask-and-explore.md) | 问数与探索使用临时页面态与轻量会话，沉淀才产生页面修订 | 现行；部分由 [0058](./0058-latest-session-checkpoint-restores-transient-page-state.md) 修订；会话从只存事件扩展为最新检查点 |
| [0031](./0031-metrics-as-data-context-discovery-anchor.md) | 指标作为数据上下文的发现锚点，不回到页面协议 | 现行 |
| [0032](./0032-authoring-time-query-verification.md) | 创作期查询必须经清单校验与真实执行验真 | 现行；名称层闭集，formula 为有意保留的开放面 |
| [0033](./0033-suspend-dataset-runtime.md) | 挂起服务端计算数据集，问数期计算由 DQE formula 承担 | 提议中；未实现，恢复条件见原文 |
| [0034](./0034-graphql-rest-as-data-gateway-adapters.md) | GraphQL 与数据接口以数据网关适配器接入，不由组件直连 | 现行 |
| [0035](./0035-structured-relative-time-expressions.md) | 页面时间范围支持结构化相对时间表达 | 现行 |
| [0036](./0036-metric-gap-non-blocking-exit.md) | 指标缺口不阻塞问数，临时口径可见、计数并在沉淀处设闸 | 现行 |
| [0037](./0037-ask-orchestration-and-interaction-contract.md) | 问数编排与交互契约 | 现行；部分由 [0077](./0077-pangu-dialogue-in-existing-workbench-and-ask-turn-outcomes.md) 修订；首版实时分步暂未实现，确认仍保留 |
| [0038](./0038-section-container-and-row-alignment-invariant.md) | 分区容器单一真源与行对齐运行时不变量 | 现行；部分由 [0054](./0054-section-weighted-column-tracks.md) 修订 |
| [0039](./0039-derived-measure-templates-as-company-definitions.md) | 派生度量模板视同公司口径 | 现行 |
| [0040](./0040-scope-card-as-control-panel.md) | 口径卡升级为控制面板：token 行呈现、要素就地修改与已验证查询快路径 | 现行 |
| [0041](./0041-governance-inbox-unified-growth-loop.md) | 治理收件箱：语义面成长回路的统一呈现与评审回执 | 现行 |
| [0042](./0042-money-fields-and-semantic-embedded-values.md) | 人民币金额使用专用结果字段语义，受控语义 HTML 用 data 标记内嵌值 | 现行 |
| [0043](./0043-attribution-diagnosis-as-a-sibling-analysis-form.md) | 归因诊断作为与问数并列的分析形态 | 提议中；未实现，设计基线见原文 |
| [0044](./0044-first-class-metric-entries.md) | 指标条目一等化,Schema 元数据升到 1.1 | 现行 |
| [0045](./0045-graphql-query-branch-with-structured-predicates.md) | GraphQL 查询分支以结构化谓词表达，不透传 WHERE 模板 | 提议中；5.1 批次，未落地 |
| [0046](./0046-controlled-computation-with-named-operators.md) | 受控计算以封闭具名算子分两批进入页面数据源 | 现行；第一批算子；第二批 joinAggregate 形状未定 |
| [0047](./0047-first-class-page-parameters.md) | 页面参数一等化，与筛选器按可变性分界 | 现行 |
| [0048](./0048-navigation-intent-and-host-routing.md) | 跨页下钻由宿主路由，统一运行时只上抛导航意图 | 现行；部分由 [0067](./0067-url-navigation-with-explicit-parameter-bindings.md)、[0068](./0068-plain-url-navigation-protocol.md) 修订；导航目标与强制宿主接管已完成 #109 迁移；导航栈与回跳所有权仍有效 |
| [0049](./0049-table-server-side-and-presentation-capabilities.md) | 表格的服务端能力按数据源模式整体下推，呈现能力只识别不计算 | 提议中；呈现已落地，服务端排序筛选未解除 |
| [0050](./0050-filter-type-closure-and-hierarchical-dimensions.md) | 筛选器类型闭集扩展，层级维度成为地图下钻的声明式来源 | 现行 |
| [0051](./0051-additive-minor-versions-for-page-schema.md) | 页面协议改为增量次版本演进，主版本递增须论证无法增量表达 | 现行；2026-08-25 补了“零使用开放面可按次版本收紧”的例外 |
| [0052](./0052-dashboard-layout-form-backdrop-and-safe-area.md) | 看板形态的满幅布局、铺底层与安全区通道 | 现行；协议与运行时安全区通道已实现 |
| [0053](./0053-composite-card-component-level-grouping-container.md) | 组件级分组容器「组合卡」,与分区容器按层次分工 | 现行；协议、widget 与统一运行时已实现；同批附带叶子组件「分类明细」 |
| [0054](./0054-section-weighted-column-tracks.md) | 内容分区可声明受控权重列轨 | 现行；Schema 5.3，部分修订 0038 的恒定等权列前提 |
| [0055](./0055-scope-groups-as-section-boundaries-in-ask-answers.md) | 口径组作为问数答案的分区边界 | 现行；首轮多单元、口径组分区、三处可见、按单元意图与单元数上限均已实现；2026-08-27 补记对话轨呈现：选用指标改集合、按单元重复的步骤折叠；跨口径月报改作空态默认入口 |
| [0056](./0056-metric-centric-terminology.md) | 术语围绕指标谱系规整：临时指标、派生指标模板、取数核对 | 现行；词汇表已切换，代码与 UI 文案批量替换进行中 |
| [0057](./0057-proportional-row-packing-and-page-header-in-assembly.md) | 装配期按比例装箱铺满行宽,并产出页面级页头 | 现行；装箱纯函数与页头均已实现；defaultSpan 重新表述为比例基线 |
| [0058](./0058-latest-session-checkpoint-restores-transient-page-state.md) | 分析会话保存最新检查点以恢复临时页面态 | 现行；部分修订 0030 的会话内容边界；不产生页面修订 |
| [0059](./0059-direct-component-box-responsive-ownership.md) | 响应式布局按统一运行时、直接组件布局盒与组件内部三层拥有 | 现行；不改页面协议；17 种组件与 53 个 variant 已纳入响应契约门禁 |
| [0060](./0060-static-svelte-java-page-governance-relay-python-authoring.md) | 静态 Svelte、Java 页面治理与 Relay/Python 创作期取代 Node 平台 | 现行；部分由 [0064](./0064-agent-returns-page-artifact-relay-and-java-own-persistence.md) 修订；目标架构，尚未完成迁移；Python 直接保存修订已退出 |
| [0061](./0061-self-contained-authoring-bundle-and-neutral-contract-export.md) | 自包含创作 Bundle 与中立契约单向导出 | 现行；部分由 [0064](./0064-agent-returns-page-artifact-relay-and-java-own-persistence.md) 修订；迁移实施基线；build_page 保存职责已退出 |
| [0062](./0062-first-party-java-page-assets-module.md) | 第一方 Java 页面资产 Module 的工程、Interface 与持久化边界 | 现行；部分由 [0070](./0070-consume-host-java-page-assets-api.md) 修订；J1–J4 已完成：校验器、四个 Interface、内存与 MySQL 仓储、Python / platform Java Adapter 与一键纵切 pnpm slice:page-assets；CloudBuild Testcontainers 探针与并入宿主时机待用户；目标宿主 CDINL2DataBuilderService |
| [0063](./0063-relay-dqe-facts-revise-authoring-boundaries.md) | Relay 与 DQE 真实接口对创作期边界的修正 | 现行；部分由 [0064](./0064-agent-returns-page-artifact-relay-and-java-own-persistence.md) 修订；身份、DQE 与打包事实继续生效；Python 保存幂等与取消后修订语义已退出 |
| [0064](./0064-agent-returns-page-artifact-relay-and-java-own-persistence.md) | Agent 返回页面构建产物，Relay 会话与 Java 页面资产分别持久化 | 现行；现行目标；Agent 不保存页面，Relay 需新增模型摘要/完整 artifact 双通道 |
| [0065](./0065-separate-metric-canvas-authoring-package.md) | 独立创作包提供 MetricCanvas，RuntimeView 保持正式渲染 | 现行；#56 已实现并完成专项回归；不再等待 #55；发布策略由 #100 裁决 |
| [0066](./0066-self-contained-rendering-engine-host-boundary.md) | 渲染引擎提供固定呈现与 JS 挂载入口，应用集成归宿主 | 现行；已裁决宿主边界；#100 发布门禁、#103 真实集成、#101 身份接线分别落实 |
| [0067](./0067-url-navigation-with-explicit-parameter-bindings.md) | 页面声明 URL 与显式参数绑定，跨页链接无需宿主地址解析 | 现行；目标裁决，尚未实现；#109 承接协议/运行时迁移，部分取代 0048 |
| [0068](./0068-plain-url-navigation-protocol.md) | URL 导航使用普通查询参数，页面协议切到 6.0 | 现行；#109 的后续裁决；实现与验收状态由 #109 记录 |
| [0069](./0069-local-boundary-substitutes-and-host-owned-credentials.md) | 本地首版在存储与 HTTP 边界替代外部依赖，请求凭据归宿主 | 现行；#99 已裁决；#101/#102/#104/#105 分别落实接线、删除、验收与接口对账 |
| [0070](./0070-consume-host-java-page-assets-api.md) | Java 页面资产由宿主提供，本仓负责接口消费 | 现行；用户修正 #105 范围；部分取代 0062 的第一方 Java 建设前提 |
| [0071](./0071-four-release-artifacts-with-standalone-page-protocol.md) | 渲染引擎按四个交付物发布，页面协议独立成包 | 现行；#100 已裁决；发布门禁与目录重组待执行票 |
| [0072](./0072-integrating-application-rename-and-authoring-render-time-split.md) | 「宿主」改称集成应用，创作期与渲染期确立为一对对立时段 | 现行；词汇表已补齐；ADR 正文与 docs/plan/ 保留「宿主」原措辞 |
| [0073](./0073-static-platform-direct-access-with-injected-runtime-config.md) | 静态平台以自包含 SPA 直连外部服务，运行配置由集成应用注入 | 现行；#101 已裁决；接线与静态化归 #104，应用外壳归 #110 |
| [0074](./0074-browser-component-building-and-isolated-legacy-baseline.md) | 人工组件切换在浏览器完成，旧服务链隔离为可复现历史基线 | 现行；#122–#125 已建立基线并完成主体解耦清理；新页面资产消费验证后退出旧适配器 |
| [0075](./0075-page-playground-as-development-tool.md) | 页面试验场作为按需使用的开发工具保留 | 现行；原 canvas 改名；退出默认产品启动、构建和产物上传，保留测试与类型检查 |
| [0076](./0076-formal-architecture-contract-scope-and-enforcement.md) | 以概念、关系和约束形式化架构，并对照代码与交付事实 | 现行；#95 主干范围及 CI 约束方向已确认；模型草案待收口，校验器尚未实现 |
| [0077](./0077-pangu-dialogue-in-existing-workbench-and-ask-turn-outcomes.md) | 盘古接管现有左侧对话，每轮 ask 返回结果并保留已有页面 | 现行；已确认布局与首版反馈边界；接口及页面交付仍待 #106–#108 实证 |
| [0078](./0078-dimension-values-templates-and-page-instances.md) | 创作草稿经维度取值提取发布为模板，执行产生页面实例 | 现行；部分由 [0080](./0080-java-assets-single-attempt-save-and-status-publication.md) 修订；后续设计；当前 Java 发布不以模板/参数提取为前置 |
| [0079](./0079-trusted-authoring-turns-gate-content-tools.md) | 可信创作轮次约束内容工具，最新页面与模型上下文分通道 | 现行；部分由 [0080](./0080-java-assets-single-attempt-save-and-status-publication.md) 修订；本轮身份与固定基线现行；强 latest/精确回读前置已调整 |
| [0080](./0080-java-assets-single-attempt-save-and-status-publication.md) | 按外部 Java 契约单次保存，发布更新页面状态 | 现行；当前 Java 接入依据；本仓实现已落地，真实联调另验 |
| [0081](./0081-read-schema-5-x-with-6-x-runtime.md) | 6.x 运行时兼容读取 Schema 5.x | 现行；平台与页面试验场读取 5.0—5.4 后规范化为 6.x |
| [0082](./0082-explicit-business-sections-in-platform-authoring.md) | 完整页面创作以业务章节组织，口径组不强制决定分区 | 现行；计划不进入渲染协议；首期不含自动分析结论 |
| [0083](./0083-platform-evidence-work-and-internal-draft-save.md) | 平台创作先取证据，维护单份工作稿并在内容工具内保存草稿 | 现行；部分替代 0064/0079 的平台不保存与候选选择；单份工作稿加工具内保存草稿 |
| [0084](./0084-hierarchical-filter-bindings-declare-a-query-field-per-level.md) | 层级维度筛选绑定逐级声明谓词字段 | 现行；补齐 ADR-0050 层级维度筛选器在查询侧的绑定形状；6.7 新增分支，6.8 按 ADR-0051 例外收紧 |

<!-- adr-index:end -->

## 主题索引

<!-- adr-topics:start 由 tools/scripts/adr-index.py 生成，不要手改 -->

主题页是**人写的现行结论**；「覆盖的 ADR」由 `tools/scripts/adr-index.py` 从主题页正文实际引用的编号推出，不是手写的。编号点开见上面的速查表。

| 主题 | 讲什么 | 覆盖的 ADR |
|---|---|---|
| [IOC 作战地图批次（0045–0053）](./topics/ioc-operation-map-batch.md) | 一个多页 GraphQL 数据应用触发的九份决策：哪些已生效、哪些仍是提议、以及驱动它们的三条业务裁决。 | 0045 0046 0047 0048 0049 0050 0051 0052 0053 |
| [技术栈与建设策略](./topics/tech-stack-and-strategy.md) | 为什么自研封闭领域 DSL 与 Svelte 运行时，而不是 A2UI 或开源 BI；严格声明式的边界在哪。 | 0001 0002 0003 0005 0035 0046 |
| [领域建模、包边界与部署形态](./topics/domain-modeling-and-package-boundaries.md) | 聚合根只有「页面」；包按 DDD 分层命名；从 Node 平台迁到静态 Svelte + Java 页面资产 + Relay/Python 的目标形态。 | 0004 0006 0007 0009 0023 0024 0025 0029 0060 0061 0062 0063 0064 0065 0066 0067 0069 0070 0071 0072 0073 0074 0075 0076 0077 |
| [页面文档结构与书写原则](./topics/page-document-structure.md) | 局部显式、就地声明；格式归组件字段绑定；分区容器、权重列轨、响应式宽度与布局形态的所有权划分。 | 0013 0017 0018 0021 0026 0028 0035 0036 0038 0042 0047 0048 0049 0050 0052 0053 0054 0057 0059 |
| [数据获取与查询模型](./topics/data-fetching-and-query-model.md) | 演进链条最长、最容易读错现状的一组：从预定义指标到内嵌 DQE 查询定义，当前实际生效模型与版本策略。 | 0008 0010 0011 0012 0014 0015 0016 0017 0019 0020 0022 0026 0028 0030 0031 0032 0033 0034 0038 0044 0045 0046 0047 0051 0053 0054 0068 0081 |
| [产品形态谱系与两速生命周期](./topics/product-forms-and-lifecycle.md) | 问数、探索、报告、Data App 共用一份页面文档；临时页面态与资产态的两速生命周期，以及分析会话的归属。 | 0009 0020 0021 0022 0030 0035 0036 0058 0060 0064 0079 0083 |
| [问数编排与口径治理](./topics/ask-orchestration-and-scope-governance.md) | 创作期编排的固定顺序、临时指标的非阻塞边界、口径组与业务章节如何决定分区、盘古接入的第一版边界。 | 0030 0031 0032 0035 0036 0037 0039 0040 0041 0043 0055 0057 0077 0082 |
| [页面生命周期与发布治理](./topics/page-lifecycle-and-publish-governance.md) | 资产态的保存与发布：当前 Java 接入按单次保存与回执确认，哪些治理能力明确不作为本期前置。 | 0008 0010 0078 0079 0080 |
| [AI 总结组件](./topics/ai-summary-component.md) | 摘要默认走 `text`，只有明确声明 SSE 动态生成才用 `aiSummary`；它是垂直组件而不是第三种数据源。 | 0019 0025 0027 0029 |
| [未决事项](./topics/open-questions.md) | 已登记但尚未裁决的问题，以及在裁决前不得做的事。**这里记的是没定的事，不要当成结论读。** | 0015 0024 0025 0030 0032 0033 0034 0037 0043 0044 0045 0046 0048 0060 0063 |
| [编号与历史记录说明](./topics/numbering-and-history.md) | 编号冲突重编、纯清理类 ADR、已被替换的历史实现描述，以及本基线自身的整理记录。 | 0068 |

**结论尚未落进任何主题页：** [0084](./0084-hierarchical-filter-bindings-declare-a-query-field-per-level.md)。新 ADR 落盘后要把结论并进对应主题页，这一行才会消失。

<!-- adr-topics:end -->
