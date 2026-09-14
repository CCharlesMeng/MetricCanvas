# MetricCanvas Authoring Bundle

维护者先读 [`ARCHITECTURE.md`](./ARCHITECTURE.md)：它按入口、执行链、Agent Core、Port/Adapter、契约和验收证据给出代码定位。将 Bundle 对接到 Relay 时直接执行 [`RELAY-HANDOFF.md`](./RELAY-HANDOFF.md)。本文只说明 Bundle 的交付形态和当前边界。

## Bundle 边界

这是一个可整体复制、锁步发布的创作期 Bundle，内部仍保持分层：

- `skill/`：Relay/Agent 读取的流程、模型决策和交互约束；不导入 Python。
- `tool/`：Python 3.12+ 的确定性 Agent Core 与 Authoring Tool；不读取 Skill。
- `contracts/`：Skill、Relay 和 Tool 之间的 Authoring Interface 契约。
- `contract-snapshot/`：从仓根产品契约单向导出的只读快照，不是第二份真源。
- `test-harness/`：从外部调用 Tool 的契约测试、向量和 Fake Adapter；不进入生产运行时。
- `relay/`：Relay stdio MCP 注册与 Data Context 投影配置样例。

Skill 与 Tool 只通过 MCP Tool Interface 协作。FastMCP 是入站 Adapter；业务词解析、多轮 reducer、查询派生、验真、组件选择、布局和页面预检不拆成更多模型可见 Tool。

## 当前已具备的可执行能力

- `discover_data_context` 保留受治理 `matches`，同时返回全量规范业务域闭集 `businessDomains`、`resolution {candidates, selected, ambiguities}`、`time`、`intent`、`structureOperation` 和 `dataContextVersion`。Relay 应先发现完整问题，再从这个闭集做业务域路由。
- [`domain/agent_core.py`](./tool/metriccanvas_authoring/domain/agent_core.py) 已实现稳定 `dataSourceId`、单调序号、`add/modify/replace/remove` 多轮 reducer、target 定向、结构 guard、组件话语、基于 `businessDomains` 闭集的用户覆盖与模型路由验真/零命中重路由/消歧、按取数单元意图降级，以及部分可答与 Metric Gap 确认。Scope Card 选择同时接受 discovery `canonicalName` 与事件 `metricName` 形状；Metric Gap 只投影 metric 候选，忽略 resolution 中的 time/intent/structure 候选。
- 结构 guard 可直接消费 discovery 的 `structureOperation`，并以问句解析兜底；模型首次静默忽略结构操作时要求修正，第二次仍忽略则拒绝。
- Page Build Spec 必须携带发现阶段的 `dataContextVersion` 和每个取数单元的 `dataSourceId`，ID 格式满足 Page key 约束；`compose_page` 在 DQE 之前拒绝过期版本或重复 ID。
- `compose_page` 对最多 6 个取数单元有序并发执行 DQE，按单元序号稳定装配或归因失败，无保存副作用。
- `PageBuildArtifact` 包含已校验页面、`documentSha256`、Data Context/Bundle 版本和 `formulaTraces {question, expression, referencedMetrics}`；formula 组件可见标记 `(临时指标)`。Relay 信封另外生成不含页面和数据行的 `modelSummary`。
- 页面数据源最多内嵌前 20 行样例，`totalCount` 保留完整数量；问数内容分区保留 `title=问数结果`和 `container=panel`。组件选型候选面与产品目录全量一致，确定性装配已覆盖 `metricCard/barChart/lineChart/pieChart/table/gauge/keyValuePanel/categoryBreakdown/rankingCard/rankingDetailCard`；这 10 类组件长度 1–4 的所有布局组合都满足逐视觉行填满 12 列且 span 合法。
- 组件能力闸问题聚合返回，Page Build Spec 和组装阶段可修正的闭集失败附 `candidates`；每个工具问题都带 `retrySafe`，仅 DQE 超时和传输失败可安全重试。`step_failed` 事件契约可承载 `path/retrySafe/candidates/completedStages`。
- Lab Data Context 与 DQE 默认生产传输使用可取消的 `httpx.AsyncClient`；同步 transport 仅为契约测试兼容。
- Python 创作期页面预检已通过全部 10/10 条合法向量，并精确对齐 154/154 条反例的 `type/path`；`pendingValid=[]`、`pending=[]`。

## MCP 工具面

Platform 内容编辑使用独立入口 `metriccanvas-content`（或源码 `python -m metriccanvas_authoring.content_server`），提供 `discover_data_context`、`compose_page`、`create_content_page`、`edit_page`，没有保存/发布工具。既有下列 compatibility/relay 工具面继续服务原调用方。

`create_content_page` 用 `page_id/title/layout` 与 `request.operations` 创建新页。允许 `add_text/add_field_text/add_map_chart/add_tab_container/add_composite_card/add_ai_summary`，目标分区为 `main`（panel）；静态正文直接声明，字段长文本与地图仅从可信 `source_token` 对应完整页面复用数据源。创建产物 `metriccanvas.content-page-artifact` 包含新 document/hash、可空 sourceRef 和 Bundle 版本，不包含保存结果，也不将创建冒充既有页修改。

这些追加操作也可用于 `edit_page`；`remove_component` 删除这三类顶层组件，后继组件仍以 connectPrevious 依赖它时拒绝删除。原有查询、样例行、无关组件不重建。fieldText 要求一行非空 string/semanticHtml 正文；mapChart 要求地域 dimension、数值 measure、可验证行证据和 china/world 明确底图，名称必须匹配随包地名契约或通过 nameMap 显式映射。缺少 initial 的查询、未物化 compute、空/未知地域均明确失败。plain/card 分区无法提供普通地图所需高度，追加时返回 MAP_SECTION_REQUIRES_CHART_HEIGHT；选已有 panel 或缺省分区。此限制来自真实运行时验真，不会暗改既有分区。完整数据只留程序通道；新操作不接收原文、rows 或 query。

容器操作用非空 child recipes（componentId/componentType/dataSourceId 与可选 title/span）复用既有字段与构造器。`add_tab_container.tabs[].children` 仅接受 table；`add_composite_card.children` 仅接受 metricCard/pieChart/gauge/keyValuePanel/categoryBreakdown。子组件、容器 id 一起判重，defaultTab、数据源和字段引用均经整页校验；`remove_component` 可删除完整容器或 aiSummary，连接依赖仍受保护，不删除共享数据源。

`add_ai_summary` 必须声明 `generation: runtime_sse`、非空 promptTemplate 和 relatedData 字段白名单。可信组合根通过 `summary_config` 传入运行时现有的 AiSummaryConfig；源码/安装入口从 `METRICCANVAS_CONTENT_AI_SUMMARY_CONFIG` 读取 JSON，支持 conversationBaseUrl（完整 HTTP(S) 基址）及可选 env。配置由当前集成应用的可信部署方提供并与渲染端保持一致，工具不猜端点、不中途探测或调用总结服务，也不把配置写入页面或模型摘要。配置缺失/格式错误时本操作明确失败；模型不能在操作里提供端点。此检查证明配置可表达，不能证明服务可达或用户拥有调用权限，真实联调另验。标题包含“AI 总结”的普通文本不会升级为 aiSummary。

交互编辑复用现行 filters/filterBindings 与 href/query：`add_dimension_filter` 同时声明维度筛选器和至少一个显式 query 绑定；`update_dimension_filter` 的 bindings 是该筛选器完整的目标绑定集合，允许显式空数组仅解除绑定，未列入的新旧其他筛选绑定保持不变。绑定 queryField 必须是既有 query 数据源已映射的 dimension，不能凭空发明查询字段。`remove_dimension_filter` 同步移除该筛选器的查询绑定；仍被导航、级联、动作或参数关系引用时整项失败。query body/initial/paramBindings 不重写，initialParam 等已有声明保留并接受产品校验。

`set_table_link` 以 componentId/fieldId（可选 slot）定位一列，同时设置 link 与表格级 navigate；navigate 必须提供 href 和显式 query 绑定，支持现行 row/param/filter 三种来源。不声明新页面参数。目标列有 selection 时拒绝，其他链接列共享不同导航目标时拒绝，避免暗改既有交互。`remove_table_link` 只清目标列入口，最后一个入口移除时一并清导航动作，其他动作保留。分组列和 Tab 内表格沿同一组件/列遍历处理。查询分页、排序和表头筛选不能经这些操作或普通属性编辑开启。

`edit_page` 只接收 `baseline_token` 和受控 `request.operations`，操作请求规范见 [`page-edit-request.schema.json`](./contracts/authored/page-edit-request.schema.json)。可信程序通过 `ContentBaselinePort` 注入完整精确基线；自带只读适配器从 `METRICCANVAS_CONTENT_BASELINES_DIR/<token>.json` 读取 `{ref:{pageId,revisionId,resourceId},document,documentSha256}`。目录按身份和工作区隔离，由外部可信适配器填充，token 必须不可变关联同一基线；没有配置或基线时明确失败，不读取“最新页”或重建整页。此摘要为本工具规范 JSON 的 SHA-256，不冒充 Java 已确认的 hash 算法。

内容工具先核验原文引用与摘要，再规范化、逐操作整页校验；独立失败回滚、依赖跳过。`changed/partial` 返回程序产物，`unchanged/failed/invalid_request/invalid_baseline` 不返回可保存产物。文本内容只含操作摘要，完整 `structuredContent.artifactEnvelope` 仍须由 Relay 可信适配器截取，模型只接收 `modelSummary`。该适配器、按用户身份和生命周期保存接线仍待真实外部集成；本仓 stdio 通过不代表生产已接通。

既有 FastMCP 入口提供两个互斥工具面：

- 默认 `METRICCANVAS_TOOL_SURFACE=compatibility`：`discover_data_context + build_page`。`build_page` 是 compose 后继续调 Java 保存的兼容包装。
- `METRICCANVAS_TOOL_SURFACE=relay`：`discover_data_context + compose_page`。成功结果是 `kind=metriccanvas.page-build-artifact` 信封。

Relay 工具面的完整 `artifact` 含页面文档和 DQE 初始行，不能作为普通 MCP 结果回流到模型。外部 Relay Page Artifact Adapter 完成“完整产物写会话检查点、仅 `modelSummary + artifactId + checkpointVersion` 回模型”前，生产不得启用 Relay 工具面。

## 生产组合与分发

`metriccanvas_authoring.server` 是可安装包的生产组合根，`tool/server.py` 是源码检出兼容入口。组合根按环境变量装配 Lab Data Context HTTP Adapter、DQE HTTP Adapter 和兼容 Java 页面资产 Adapter。

Relay 配置见 [`relay/mcp_configs/metriccanvas-authoring.json`](./relay/mcp_configs/metriccanvas-authoring.json)：

```text
uvx --from <metriccanvas-authoring-sdist.tar.gz> metriccanvas-authoring
```

sdist 内嵌运行时契约，不依赖宿主 Bundle 源码目录。Data Context 治理配置样例见 [`relay/data-context-projection.example.json`](./relay/data-context-projection.example.json)。DQE Adapter 只调用 `POST .../v1/dsl/execute`，不直连 Lab 执行查询。

当前 Data Context、DQE 和兼容 Java Adapter 共用 [`EnvIdentityPort`](./tool/metriccanvas_authoring/adapters/outbound/env_identity.py) 从 Relay MCP config 读取的服务态 `operator/token`。这不是按用户身份，不能当作生产权限证据。

## 还未在本仓闭环的内容

本仓已有 Agent Core API，但外部 Relay 还没有固定 Workflow 把它与三类模型决策、调用预算、等待/取消和步骤事件串起来。Relay Page Artifact Adapter、Session 检查点、Svelte/UI 接线、按用户身份注入、真实 Lab/DQE/Relay 联调和 MetricService `DimensionValuePort` Adapter 也仍是外部待办。

最终架构中，Agent/Python 不保存临时页面、会话检查点或正式页面修订。Relay Session 保存步骤事件和最新临时页面检查点；用户显式沉淀时，Svelte/平台以当前用户身份调用 Java 页面资产 Interface。

## 独立验收

```bash
python3 -m pip install --require-hashes -r tool/requirements.lock
python3 scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test-harness/tests -p 'test_*.py'
```

根仓另提供 `pnpm authoring:contracts:check`，检查产品契约、Bundle 快照、Authoring manifest 与锁文件是否漂移。页面预检的全量证据位于 [`test_page_validation.py`](./test-harness/tests/test_page_validation.py) 和 [`page-conformance-pending.json`](./test-harness/fixtures/page-conformance-pending.json)；Agent Core、目录级组件选型和布局性质证据分别位于 [`test_agent_core.py`](./test-harness/tests/test_agent_core.py)、[`test_component_selection.py`](./test-harness/tests/test_component_selection.py) 与 [`test_section_layout.py`](./test-harness/tests/test_section_layout.py)。

构建并验证 Relay 可安装包：

```bash
uv build --sdist --out-dir dist tool
METRICCANVAS_TOOL_SURFACE=relay \
  uvx --from dist/metriccanvas_authoring-0.2.0.tar.gz metriccanvas-authoring
```

完整迁移状态、F01–F14 等价矩阵与硬切换门禁见 [`docs/plan/metriccanvas-agent-full-migration.md`](../docs/plan/metriccanvas-agent-full-migration.md)。

## Platform 创建与修改 Skill、布局基线

Platform 使用 `metriccanvas-platform-create` 与 `metriccanvas-platform-edit` 两个 Skill，共用独立 `metriccanvas-content`。旧 `metriccanvas-page-builder` 继续服务普通问数临时页面态。创建、修改的路由由 Relay 部署方落实，目录/frontmatter 不是已接通证明；内容工具始终不保存或发布。

新 Skill 安装时复制完整目录及生成的 `references/`。公共作者真源为 `skill-shared/platform-authoring.md` 与 `skill-shared/layouts/{report,dashboard}.md`，由统一分发投影；不要单独复制 SKILL.md 或手改投影。创建显式选择 layout；已有页新增仍属于修改，缺可信精确基线时等待读取，不退回整页重建。

Platform 内容入口新建报告沿用章节布局；看板页头采用 plain，未分组模块用缺省分区和组件标题，需独立分组标题的非图表内容使用 card。带图表的有标题分组保留 panel，避免 card 清除图表高度。这里只改变新建默认，旧问数 compose 应用不变；合法 dashboard+panel、report+backdrop 继续支持。

修改默认继承布局。显式 `set_page_layout` 保留原标题、容器、轨道/span、数据与手工设置，报告可用宽度、工具栏、标题归属和铺底窄屏回流影响；沿用整页校验拒绝非法候选，不重套创建模板或静默丢弃设置。

四组合公开 stdio 与宽窄浏览器证据由 `test-harness/tests/test_platform_authoring_flows.py`、`test-harness/platform_layout_browser.mjs` 提供。`test-harness/model-evals/` 单独提供14个真实模型评测用例与运行约定；当前全部未运行，缺真实 Relay/模型环境、身份与预算，不能将工具测试视为模型准确度成绩。
