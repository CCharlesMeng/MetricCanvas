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

FastMCP 提供两个互斥工具面，避免迁移期同时出现三个模型可见工具：

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
