# MetricCanvas Authoring Bundle

代码阅读从 [tool/README.md](tool/README.md) 开始，按一次标题修改跟踪入口、基线、编辑、保存和交付，再按功能分支查阅。

维护者先读 [`ARCHITECTURE.md`](./ARCHITECTURE.md)：它按入口、执行链、Agent Core、Port/Adapter、契约和验收证据给出代码定位。将 Bundle 对接到 Relay 时直接执行 [`RELAY-HANDOFF.md`](./RELAY-HANDOFF.md)。本文只说明 Bundle 的交付形态和当前边界。

## Bundle 边界

这是一个可整体复制、锁步发布的创作期 Bundle，内部仍保持分层：

- `skill/`：Relay/Agent 读取的流程、模型决策和交互约束；不导入 Python。
- `tool/`：Python 3.12+ 的确定性 Agent Core 与 Authoring Tool；不读取 Skill。
- `contracts/`：Skill、Relay 和 Tool 之间的 Authoring Interface 契约。
- `contract-snapshot/`：从仓根产品契约单向导出的只读快照，不是第二份真源。
- `test-harness/`：从外部调用 Tool 的契约测试、向量和 Fake Adapter；不进入生产运行时。
- `relay/`：Relay stdio MCP 注册与 Data Context 投影配置样例。

Skill 与 Tool 只通过 MCP Tool Interface 协作。FastMCP 是入站接入点；业务词解析、多轮 reducer、查询派生、验真、组件选择、布局和页面预检不拆成更多模型可见 Tool。

## 现行入口与已退役行为

普通问数的 `metriccanvas-authoring` 默认只注册 discover_data_context 和 compose_page，返回临时产物，不具备保存依赖。原 METRICCANVAS_TOOL_SURFACE=relay 配置继续有效；显式 compatibility 配置会报旧保存入口已退役。build_page、旧 `/pages/{pageId}/revisions` Java 保存适配器、强保存指纹与专属端口已删除。

平台 `metriccanvas-platform-content` 仍使用可信轮次和内部单次草稿保存。旧 unified/structure 编排及 structureRevision、add_data_component 契约已删除；指标关系随现行 query_data 结果记录保存，compose/edit 消费精确结果引用。结构表现验收通过现行平台路径，不再调用旧编排。普通问数规则 ask/rules.py、公开平台入口委托、页面 Schema 兼容和明确独立的生命周期接口继续保留。

## 当前已具备的可执行能力

- `discover_data_context` 保留受治理 `matches`，同时返回全量规范业务域闭集 `businessDomains`、`resolution {candidates, selected, ambiguities}`、`time`、`intent`、`structureOperation` 和 `dataContextVersion`。Relay 应先发现完整问题，再从这个闭集做业务域路由。
- [`ask/rules.py`](./tool/metriccanvas_authoring/ask/rules.py) 已实现稳定 `dataSourceId`、单调序号、`add/modify/replace/remove` 多轮 reducer、target 定向、结构 guard、组件话语、基于 `businessDomains` 闭集的用户覆盖与模型路由验真/零命中重路由/消歧、按取数单元意图降级，以及部分可答与 Metric Gap 确认。Scope Card 选择同时接受 discovery `canonicalName` 与事件 `metricName` 形状；Metric Gap 只投影 metric 候选，忽略 resolution 中的 time/intent/structure 候选。
- 结构 guard 可直接消费 discovery 的 `structureOperation`，并以问句解析兜底；模型首次静默忽略结构操作时要求修正，第二次仍忽略则拒绝。
- Page Build Spec 必须携带发现阶段的 `dataContextVersion` 和每个取数单元的 `dataSourceId`，ID 格式满足 Page key 约束；`compose_page` 在 DQE 之前拒绝过期版本或重复 ID。
- `compose_page` 对最多 6 个取数单元有序并发执行 DQE，按单元序号稳定装配或归因失败，无保存副作用。
- `PageBuildArtifact` 包含已校验页面、`documentSha256`、Data Context/Bundle 版本和 `formulaTraces {question, expression, referencedMetrics}`；formula 组件可见标记 `(临时指标)`。Relay 信封另外生成不含页面和数据行的 `modelSummary`。
- 页面数据源最多内嵌前 20 行样例，`totalCount` 保留完整数量；问数内容分区保留 `title=问数结果`和 `container=panel`。组件选型候选面与产品目录全量一致，确定性装配已覆盖 `metricCard/barChart/lineChart/pieChart/table/gauge/keyValuePanel/categoryBreakdown/rankingCard/rankingDetailCard`；这 10 类组件长度 1–4 的所有布局组合都满足逐视觉行填满 12 列且 span 合法。
- 组件能力闸问题聚合返回，Page Build Spec 和组装阶段可修正的闭集失败附 `candidates`；每个工具问题都带 `retrySafe`，仅 DQE 超时和传输失败可安全重试。`step_failed` 事件契约可承载 `path/retrySafe/candidates/completedStages`。
- Lab Data Context 与 DQE 默认生产传输使用可取消的 `httpx.AsyncClient`；同步 transport 仅为契约测试兼容。
- Python 创作期页面预检已通过全部 10/10 条合法向量，并精确对齐 154/154 条反例的 `type/path`；`pendingValid=[]`、`pending=[]`。

## MCP 工具面

平台创作只注册 `metriccanvas-platform-content`，使用 [Platform Skill](skill/metriccanvas-platform-authoring/SKILL.md) 的九个任务工具。`read_page_context` 读取经 Java 当前资源核对的配置；`query_data` 执行授权计划并返回有界证据；`compose_page`/`edit_page` 对合法变化内部保存草稿；`page_metadata_emit_preview` 交付精确产物；参数工具生成临时模板或实例。

`edit_page(context_ref, page_id, request, expected_version)` 明确声明目标页。身份与创作基线由可信程序建立，工具核对 page_id、Java 当前修订和页面定义，再竞争本轮工作版本。保存携带基线修订，由 Java 拒绝竞争写入。缺当前读取能力、过期基线、未知保存均停止，不用缓存或其他入口绕过。

新建输出当前页面 Schema 6.11；局部修改保留未授权的原页面内容。完整页面、查询体与凭据留在程序通道；模型只读摘要和已授权证据。详细参数与验收步骤见 [工具契约](skill/metriccanvas-platform-authoring/references/tools.md) 和 [执行检查点](skill/metriccanvas-platform-authoring/references/execution.md)。

普通问数使用 `metriccanvas-authoring` 的 discover_data_context/compose_page 两工具和独立 Skill，结果为临时页面，不自动保存。它不是平台创作缺依赖时的回退。

## 生产组合与分发

生产通过 Relay 注册的 MCP stdio server 受控启动；CLI 只是进程启动方式，不是模型可见的通用 shell。装配住在 `bootstrap/`，组合根按环境变量装配 Lab Data Context HTTP Adapter、DQE HTTP Adapter 和页面资产 Adapter。

Relay 配置见 [`relay/mcp_configs/metriccanvas-authoring.json`](./relay/mcp_configs/metriccanvas-authoring.json)：

```text
uvx --from <metriccanvas-authoring-sdist.tar.gz> metriccanvas-authoring
```

sdist 内嵌运行时契约，不依赖宿主 Bundle 源码目录。Data Context 治理配置样例见 [`relay/data-context-projection.example.json`](./relay/data-context-projection.example.json)。DQE Adapter 只调用 `POST .../v1/dsl/execute`，不直连 Lab 执行查询。

当前 Data Context、DQE 和兼容 Java Adapter 共用 [`EnvIdentityPort`](./tool/metriccanvas_authoring/adapters/relay/env_identity.py) 从 Relay MCP config 读取的服务态 `operator/token`。这不是按用户身份，不能当作生产权限证据。

## 还未在本仓闭环的内容

本仓已有 Agent Core API，但外部 Relay 还没有固定 Workflow 把它与三类模型决策、调用预算、等待/取消和步骤事件串起来。Relay Page Artifact Adapter、Session 检查点、Svelte/UI 接线、按用户身份注入、真实 Lab/DQE/Relay 联调和 MetricService `DimensionValuePort` Adapter 也仍是外部待办。

平台创作中，内容工具可以提交平台草稿；Java 页面资产服务负责页面定义持久化、权限裁决和发布状态。Relay Session 保存步骤事件和最新临时页面检查点；草稿保存、会话检查点和正式页面发布是不同状态。普通问数/探索仍不自动落库，用户明确沉淀时由平台以当前用户身份调用 Java 页面资产 Interface。

## 独立验收

```bash
python3 -m pip install --require-hashes -r tool/requirements.lock
python3 scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test-harness/tests -p 'test_*.py'
```

根仓另提供 `pnpm authoring:contracts:check`，检查产品契约、Bundle 快照、Authoring manifest 与锁文件是否漂移。页面预检的全量证据位于 [`test_page_validation.py`](./test-harness/tests/test_page_validation.py) 和 [`page-conformance-pending.json`](./test-harness/fixtures/page-conformance-pending.json)；Ask/Explore 确定性规则、目录级组件选型和布局性质证据分别位于 [`test_ask_rules.py`](./test-harness/tests/test_ask_rules.py)、[`test_component_selection.py`](./test-harness/tests/test_component_selection.py) 与 [`test_section_layout.py`](./test-harness/tests/test_section_layout.py)。

构建并验证 Relay 可安装包：

```bash
uv build --sdist --out-dir dist tool
METRICCANVAS_TOOL_SURFACE=relay \
  uvx --from dist/metriccanvas_authoring-0.3.1.tar.gz metriccanvas-authoring
```

完整迁移状态、F01–F14 等价矩阵与硬切换门禁见 [`docs/archive/metriccanvas-agent-migration/metriccanvas-agent-full-migration.md`](../docs/archive/metriccanvas-agent-migration/metriccanvas-agent-full-migration.md)。

## 独立生命周期 MCP（#138）

`metriccanvas-lifecycle`（或 `python -m metriccanvas_authoring.entrypoints.compat.lifecycle_server`）独立装载，四项草稿工具为 `save_draft`、`get_save_result`、`read_revision`、`list_revisions`，各只接受 `request_token`。不初始化内容 MCP、DQE、旧 `/pages` 保存适配器，也不执行页面编辑或参数提取。公共程序组合入口为 `create_lifecycle_mcp_server(service, programs, identities)`；应用端口位于 `assets/lifecycle_ports.py`，自有输入契约 `contracts/authored/lifecycle-request.schema.json` 沿内部 `authoring-lifecycle-proposal/1`，不是线上 API。

受信任 Relay 适配器在调用之前把完整请求写到独立用户/工作区进程的 `METRICCANVAS_LIFECYCLE_INPUTS_DIR/<token>.json`。目录权限须 0700、文件 0600，令牌为 16–128 位字母/数字/下划线/连字符；文件内容 `{actorId,workspaceId,request}`，request 按该 schema 的 save/read/history 分支。目录不可由模型写入；调用方必须保证同一逻辑操作的请求文件不可变并持久保留，禁止在重试时换 operationId 或修改原载荷。token 只定位受信任请求，不代替服务鉴权；保存指纹、基线原子比较、去重期限与授权仍由服务裁决。

身份只从程序注入：`METRICCANVAS_OPERATOR_ID`、`METRICCANVAS_WORKSPACE_ID`、`METRICCANVAS_AUTH_TOKEN`，凭据只在进程内存和请求头中；不写 spool 或工具输出。当前环境适配器不是登录/身份验证实现，真实 Relay 按用户注入与 Java token/actor 校验仍待 #105/#106。自有 spool 只是本仓可用的程序接缝，不声称真实 Relay 已会写这些文件。输入命令显式固定 origin、base、description、retainDimensionValues 与 operationId；模型不可传这些字段或完整 document。

完整精确读取结果与历史写入 `METRICCANVAS_LIFECYCLE_OUTPUTS_DIR`，权限同上；模型和 MCP structuredContent 均仅见引用、状态、程序令牌及完整性摘要。保存结果的程序输出保留 receipt/context/base，供可信编排核对原轮次；缺失 sessionId/runId 不代表已验证轮归属。Relay 必须直接读取程序输出并转交内容基线/前端读取边界，不能经模型转抄。输出令牌不是 draftId，不生成 `metriccanvas:draft-saved` 事件，不推断三个修订标识与通知标识相等。输出清理由拥有该进程的集成方按使用期限执行。

保存先查询原请求：权威 `not-applied` 且 `retrySafe:true` 才提交原命令；saved 返回原修订，pending/unknown/过期去重结果均不重发。回执丢失返回 unknown，可用相同保存 token 调 `get_save_result`。此模块没有本地幂等数据库，不把生成令牌或客户端 UUID 当成强幂等。精确读取验证完整 ref 与持久化原文 hash，再校验页面；不规范化原始修订、不回退 latest。跨语言 canonicalization 必须由接入适配器明确协商并实现 `verify_document`；测试中的 Python 排序 JSON 算法仅是外部边界替身的算法，生产没有默认 hash 算法。

生产组合默认使用 #105 已知 HTTP 消费适配器。`METRICCANVAS_LIFECYCLE_COLLECTION_URL` 由部署传入真实 `.../user-page-metadata` 集合地址；适配器仅提供当前资源匹配 GET，响应必须同时 HTTP 200、`retCode:"0"`、三元引用与页面文档匹配。它不是强 exactRead，因此不会通过上述精确工具暴露。stableSave/exactRead/history/operationLookup 默认关闭，工具明确返回 CAPABILITY_UNAVAILABLE，不调用拟新增端点。强端口只能通过受信任程序组合显式实现，不能设置环境开关把未知能力变成可用。当前匹配读取的成功回执仍仅 assurance=provider-response，不升级为强 Saved。

## 发布工具（#145）

生命周期 MCP 另注册 `prepare_candidate`、`read_candidate`、`revise_candidate`、`confirm_publish`、`get_publish_operation_result`，共九项工具，每项只接受 `request_token`。受信任程序通过可选关键字 `publication=PublicationDependencies(service, confirmations)` 接入；原三参数调用兼容。生产默认发布依赖明确不可用，返回 `CAPABILITY_UNAVAILABLE`，没有拟定 HTTP 地址或环境开关。

`contracts/authored/publish-request.schema.json` 仅引用共同 `publication/1` 的 Request；包内 `contract-snapshot/authoring/publication.schema.json` 包含闭合 Page 定义。完整候选、差异、参数摘要及操作回执只通过同一受保护程序输出交付，模型仅见状态、引用、摘要和令牌。调整只允许保留维度值选择及服务给定参数 ID 的选择，不接受任意页面补丁。

人工确认令牌必须由独立 `HumanConfirmationPort` 读取可信人工事件，绑定身份、精确候选、源修订、内容与审阅摘要、保留选择和租约；模型工具不能创建证明。内容 hash 与包含十一字段的审阅 hash 分别验证，算法身份由适配器固定。所有候选接收均要求可信精确源读取及原文完整性验证，并核对非维度参数完整保留；null 分类还要求原维度声明与绑定保持。最终权限、候选有效期、源头版本、证明撤销和租约消费必须在服务发布事务中原子检查。

三类写操作均先查询完整原请求，只在权威 `not-applied/retrySafe:true` 时提交。确认丢失、异常回执或程序交付失败保持 unknown，使用原令牌查询恢复；已完成重放返回原结果，不再次消费租约或要求重新人工确认，但仍需当前读取权限。测试替身与人工事件模拟仅位于 `test-harness/publish_stdio_server.py`，不进入生产分发；这些测试不能证明真实 Java/Relay 已接通。

## Platform 创建与修改 Skill、布局基线

Platform 注册唯一 `metriccanvas-platform-authoring`，普通问数继续使用 `metriccanvas-page-builder`。统一作者目录包含 SKILL.md、workflows/create.md、workflows/edit.md、workflows/parameters.md 与按需参考；安装完整目录即可引用闭合。统一服务 metriccanvas-platform-content 有九个实际工具，全部消费 context_ref；registry 与 CLI 校验拒绝路由到旧兼容服务。三个参数工具为 `extract_page_parameters`、`apply_page_parameter_selection`、`resolve_page_parameters`。参数能力须注入 `ParameterDependencies`（程序、持久记录、提取验真提供方），缺能力明确不可用。部署须核实可信 current-turn、摘要/完整产物分流、临时实例只读交付及 latest 保证；真实 Relay 路由和提供方仍需实证。见[参数接入交付](../docs/plan/page-parameter-inlining/external-integration.md)。

Bundle registry 的 referenceProjection 声明生成器所有权：普通问数仅 references/page-metadata 为生成子树，统一作者使用 none，生成器不覆盖任何作者参考。完整产品 Schema、正反例仍保留在 contract-snapshot；旧共享文本的基线副本和哈希见 docs/plan 的 S0 记录，不参与部署。参考注入/文件补读方式按统一 Skill 的 references/tools.md 声明。

Platform 内容入口新建报告沿用章节布局；看板页头采用 plain，未分组模块用缺省分区和组件标题，需独立分组标题的非图表内容使用 card。带图表的有标题分组保留 panel，避免 card 清除图表高度。这里只改变新建默认，旧问数 compose 应用不变；合法 dashboard+panel、report+backdrop 继续支持。

修改默认继承布局。显式 `set_page_layout` 保留原标题、容器、轨道/span、数据与手工设置，报告可用宽度、工具栏、标题归属和铺底窄屏回流影响；沿用整页校验拒绝非法候选，不重套创建模板或静默丢弃设置。

四组合公开 stdio 与宽窄浏览器证据由 `test-harness/tests/test_platform_authoring_flows.py`、`test-harness/platform_layout_browser.mjs` 提供。模型运行记录按批次维护：历史评测须标注其对应的流程和结构计划版本，不能将旧 v2 结果归给现行实现。当前结构计划迁移、离线回归和外部验收缺口见[实施记录](../docs/plan/scenario-guided-authoring/refinement/architecture-implementation-results.md)。

### 现行页面结构计划与范式维护

新建完整页面使用现行页面结构计划；旧平台入口、候选存储/提交/恢复链和结构计划 1/2 解析均已删除；参数工具使用现行工作稿与 artifact_ref。结构计划版本、页面 Schema 版本、Bundle 版本和外部 API 版本是不同序列，必须在文档和契约中分别标注，不能互换。完整决策见 [ADR-0090](../docs/adr/0090-authoring-flow-hard-cutover-and-version-vocabulary.md)。

Skill 负责业务问题、阅读层级与组件选型；工具负责能力检查、可信数据绑定和确定性装配；统一运行时负责实际呈现。创建与修订共用呈现规则，仍使用原五工具入口，不增加模型编排阶段。架构依据见[调整方案](../docs/plan/scenario-guided-authoring/refinement/authoring-architecture-proposal.md)。

| 要维护的内容 | 修改真源 | 配套验证 |
| --- | --- | --- |
| 阅读顺序、选型、场景适用条件 | [reading-design.md](skill/metriccanvas-platform-authoring/references/reading-design.md) 与场景参考 | 差异场景前向检查，不以固定卡数或图数评分 |
| 创作输入与版本 | `contracts/authored/page-structure-plan.schema.json`、`pages/referenced.py` 的结果引用输入 | 现行版本、query→compose/edit、可信关系与工作稿版本验收 |
| 默认占位、受控呈现、说明 | `contracts/authored/section-patterns.json`、`tool/metriccanvas_authoring/pages/components/` 下的 section_presentation、structure_presentation 与 `pages/composition/structure_scope.py` | 公开 create/edit 回归；保护人工设置和查询复用 |
| 页面协议、组件与响应式 | 仓库 `packages/page/src/schema/` 与统一运行时/组件实现 | 页面 Schema、组件及呈现测试，不由 Skill 覆盖 CSS |

pattern 是默认组合占位，不是整页模板或自动选型算法。结构分区仍为平面组合；新能力须同时有合法输入和可执行装配路径，再进入 structureCapabilities。

报表反馈修订：现行结构计划不自动生成查询范围正文，structure_scope 只清理旧版保留 ID 的自动说明；查询事实仍留在数据源与审计中，必要业务边界由显式标题/副标题表达。report 指标组与图表章节优先用 panel 的白色内容区，表格小节可用 card，不能把所有章节默认设为透明 plain。见[修订结果](../docs/plan/scenario-guided-authoring/refinement/report-surface-feedback-results.md)。

维护顺序：先更新所属真源及回归用例，再同步 Skill 说明和部署加载路径，最后从仓库根运行 `pnpm authoring:contracts` 与 `pnpm authoring:contracts:check`，并在 Bundle 目录运行 `python3 scripts/check_bundle.py`。生成副本和锁文件不手改；只改参考也需要更新 Bundle 摘要。

完整创建必须能够读取或被注入工作流、布局参考、scenarios.md、reading-design.md 及适用场景。局部编辑不例行加载新建参考；整体重组时再加载阅读设计。独立分发链接闭合不等于外部宿主已完成注入，部署状态仍需单独验证。

当前证据：历史结构计划实现曾有一次 480 项本地离线回归记录，A/B/C 分别覆盖经营阅读、用量监控、宽表局部核对；该数字不代表现行硬切换已经完成。工具直接生成的 JSON 通过结构校验；模型自主设计稳定性与新产物视觉验收仍待 C5/C6。

维护源与派生副本见 [SOURCES.md](SOURCES.md)；按验证层运行测试见 [test-harness/README.md](test-harness/README.md)。
