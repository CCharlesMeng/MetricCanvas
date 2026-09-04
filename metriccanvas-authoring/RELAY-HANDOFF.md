# MetricCanvas Authoring → Relay 对接 Handoff

> 交接日期：2026-09-04
> Bundle 基线：`0.2.0`，代码至少包含提交 `390b2bc`
> 当前状态：**Relay-ready，不是 Relay-integrated**

本文是 Relay 接手实施入口。具体业务规则以
[`SKILL.md`](./skill/metriccanvas-page-builder/SKILL.md)为准，Module 定位以
[`ARCHITECTURE.md`](./ARCHITECTURE.md)为准，迁移门禁以
[完整迁移计划](../docs/plan/metriccanvas-agent-full-migration.md)为准。
本文只保留 Relay 实施必需的顺序、Interface、风险和完成判据。

## 0. 先看五个阻断事实

> [!WARNING]
> `Page Artifact Adapter` 未安装前，不得向真实模型开放
> `METRICCANVAS_TOOL_SURFACE=relay`。当前 Relay 会把 MCP 完整结果送回模型，
> `compose_page` 成功产物含 Page Metadata 和 DQE 样例行。

1. **Agent Core 尚无跨进程 Interface。**
   [`agent_core.py`](./tool/metriccanvas_authoring/domain/agent_core.py)
   已实现稳定 ID、多轮 reducer、target、结构 guard、组件话语和
   Metric Gap，但模型可见 MCP 面只有 `discover_data_context` 与
   `compose_page`。Relay 不能直接从一次性 `uvx` 子进程调这些函数。
2. **`compose_page` 是原子调用。** Relay 可在调用前后发进度，但现在
   不能诚实地实时发送“DQE 已开始/行已就绪”。这些步骤事件在 M3A
   只能事后投影；真实 F12 进度需要 Authoring 再增加非敏感 progress seam。
3. **sdist 不是完整交付物。** tar.gz 足以启动 Python Tool，但未包含
   Relay 需要的模型决策、步骤事件和 Artifact 信封契约。Relay 必须锁定并
   vendor **整个 Bundle**，再从其中构建 sdist。
4. **当前身份只是共享服务态。** `EnvIdentityPort` 同时被 Lab 元数据和 DQE
   使用。生产目标是“Lab 元数据使用服务身份，DQE 使用当前用户身份”；
   在身份 Port 拆分且 Relay 提供受保护的单次调用注入前，只能做联调，
   不能宣称已按用户鉴权。
5. **意图的物理顺序与 ADR-0037 尚有冲突。** 0.2.0 的
   `compose_page` 已将 DQE 封装为原子调用，且 Spec 必填 `intent`，
   因此只能先判定意图再 compose；ADR-0037 仍写真实执行后判定。
   M3A 可按当前物理顺序烟测，M3B/生产前必须用 ADR 裁决。

## 1. 最短安全对接路径

严格按以下顺序实施。每步后的“完成”是进入下一步的门禁。

### 1.1 锁定完整 Bundle

1. 将 `metriccanvas-authoring/` 作为一个不可变发布单元 vendor 到 Relay
   发布物，不要单独拷贝 tar.gz。
2. 校验 [`bundle.lock.json`](./bundle.lock.json) 与
   [`contract-lock.json`](./contract-lock.json)。
3. 在 Bundle 目录构建 Tool：

```bash
python3 scripts/check_bundle.py
uv build --sdist --out-dir dist tool
```

**完成：** `bundle 0.2.0 verified`，且产生
`dist/metriccanvas_authoring-0.2.0.tar.gz`。

### 1.2 先实现 Relay Session 检查点和 Artifact Adapter

保持 MetricCanvas feature flag 关闭，先实现：

- `loadMetricCanvasCheckpoint(sessionId, relayVersionId, actor)`；
- `saveMetricCanvasCheckpoint(sessionId, expectedRelayVersionId, expectedCheckpointVersion, invocationId, state, artifact)`；
- `getMetricCanvasArtifact(sessionId, relayVersionId, artifactId, actor)`；
- MCPToolProxy/observer seam 中的 `PageArtifactAdapter`。

**完成：** Artifact Adapter 所有失败分支都失败关闭；单测递归断言模型消息、
`tool-execution.result_summary`、追加事件和请求日志不含
`artifact/document/rows/initial`。

### 1.3 注册 Skill 和 MCP

1. 复制 [`SKILL.md`](./skill/metriccanvas-page-builder/SKILL.md) 到 Relay：
   `.skills/metriccanvas-page-builder/SKILL.md`。
2. 复制 [`metriccanvas-authoring.json`](./relay/mcp_configs/metriccanvas-authoring.json)
   到 Relay：`.relay/mcp_configs/metriccanvas-authoring.json`。
3. 替换绝对 sdist 路径、服务地址、workspace、投影配置和凭据占位符。
4. 将 [`data-context-projection.example.json`](./relay/data-context-projection.example.json)
   复制为部署环境的受管配置。

`METRICCANVAS_TOOL_SURFACE` 必须是 `relay`。启动后：

- `list_tools` 必须恰好返回 `discover_data_context` 和 `compose_page`；
- 出现 `build_page` 表示误用 compatibility 面，立即停止；
- 读取 `metriccanvas://bundle-info`，核对 `bundleVersion=0.2.0`、
  `pageSchemaVersion=5.4`、`authoringContractVersion=0.2.0`。历史 Relay
  调查未证明它支持 MCP Resource；若目标提交没有 `read_resource`
  管理面，先用 MCP SDK 独立烟测读取，并将增加 Relay 管理面列为
  启用门禁；不得假定 Tool 调用面可以直接读 Resource。

**完成：** 两个工具可在没有真实模型参与时通过 Relay 调用，工具集合和
Bundle 身份精确一致。

### 1.4 先做 M3A 安全烟测

用 scripted model 走通：

```text
discover_data_context
  → 三类模型决策
  → Page Build Spec
  → compose_page
  → PageArtifactAdapter
  → latest checkpoint
  → safe model result
```

M3A 允许 Skill ReAct 指导模型，但只能称为“安全接通”。它不能证明固定顺序、
多轮 reducer、调用预算和恢复语义已受强制。

**完成：** checkpoint 中有完整 Artifact，模型只看到安全收据，问数过程
Java 页面资产 Interface 零调用。

### 1.5 再做 M3B 固定 Workflow

先解决 [Agent Core 跨进程 Seam](#5-agent-core-跨进程-seam)，并裁决
[ADR-0037 的意图顺序冲突](#61-bundle-020-的可执行调用顺序)，然后实现
`executeMetricCanvasTurn(command, checkpoint) -> ordered events + interaction | outcome`。
Workflow 必须自己强制状态机、模型决策 Schema、调用预算、确认恢复和取消；
不依赖 Planner 自觉遵循 Markdown。

**完成：** scripted model 可重放 F01–F12，并且所有跨轮确定性规则从同一
Agent Core Interface 执行。

### 1.6 最后接生产能力

1. 按用户身份注入 DQE，保留 Lab 元数据服务身份。
2. 将 Relay `interrupt` 传播到 MCP oneshot 进程组，并以 CAS 拒绝迟到产物。
3. Svelte 以当前用户从 Relay Session 读取 Artifact，渲染临时页面态。
4. 用户显式点击“沉淀”时，平台才调 Java `savePageRevision`。
5. 真实 Relay/内网模型/Lab/DQE 验证、40 条黄金问题、影子流量、灰度和回滚。

**完成：** 第 9 节所有门禁通过，才能开启生产 feature flag。

## 2. Module、Interface 与 Seam

| Module | 对外 Interface | Seam / Adapter | 负责 | 不属于它 |
|---|---|---|---|---|
| Relay Chat | `/ws/{client_id}` + `user-message` | `role_name` + `config.agent_context` | 问题、pageId、session、target、确认回复 | Skill 正文、工具权限、鉴权 token |
| Relay Workflow | `executeMetricCanvasTurn(...)` | 固定 Workflow 扩展 | 状态机、模型调用、预算、等待/恢复 | DQE/Page JSON 派生，第二份 reducer |
| 模型 Adapter | 三类结构化决策 | LiteLLM/Provider | 业务语义分类与补全 | 确定性检索、消歧、查询、组件和布局 |
| Python Agent Core | 待冻结单一 transition Interface | 内部 MCP 或版本化 Python Adapter | ID/reducer/target/guard/presentation/gap | 模型、HTTP、会话持久化 |
| MCPToolProxy | 调用两个模型可见 Tool | stdio oneshot Adapter | 调用、取消、受保护上下文 | 业务 reducer |
| Python Authoring MCP | `discover_data_context` / `compose_page` | FastMCP 入站 Adapter | 受治理发现、DQE、字段、组件、布局、页面预检 | 会话和页面修订持久化 |
| PageArtifactAdapter | 原始信封 → 安全收据 | MCPToolProxy/observer 前 | Schema 校验、CAS 保存、数据最小化 | 模型决策 |
| Relay Session | append/load/save/get | durable-state Adapter | 事件、最新检查点、90 天保留、ACL、CAS | Page Revision |
| Svelte / 平台 | Artifact 读取、显式沉淀 | Relay WS/Session + Java HTTP | 临时态渲染与用户命令 | Agent 自动保存修订 |
| Java Page Assets | `savePageRevision` | Java HTTP Adapter | 不可变修订、复验、幂等、审计 | Relay Session |

## 3. Relay 注册与运行契约

### 3.1 必须使用的工具面

```text
server: metriccanvas-authoring
tools : discover_data_context, compose_page
resource: metriccanvas://bundle-info
```

`discover_data_context` 输入：

```json
{"query":"上个月各区域 Tokens请求量趋势","limit":10}
```

它固定返回：

```text
ok, dataContextVersion, businessDomains, matches,
resolution { formatVersion, question, candidates, selected, ambiguities },
time, intent, structureOperation, issues
```

成功但零命中不是故障：`candidates/selected/ambiguities` 均为空。

`compose_page` 的 `spec` 必须满足
[`page-build-spec.schema.json`](./contracts/authored/page-build-spec.schema.json)。可用
[`page-build-spec.json`](./test-harness/fixtures/page-build-spec.json)作为搭配同一测试
Data Context 的首个调用夹具。实际环境不得照抄其版本或业务名；
`dataContextVersion` 和所有规范名必须来自紧邻的当前轮 discovery。

成功的原始 MCP 结果是：

```json
{
  "ok": true,
  "completedStages": ["discovery", "generation", "execution", "presentation"],
  "artifactEnvelope": {
    "kind": "metriccanvas.page-build-artifact",
    "formatVersion": "1.0",
    "artifact": {
      "formatVersion": "1.0",
      "document": {},
      "documentSha256": "<64-hex>",
      "dataContextVersion": "<version>",
      "bundleVersion": "0.2.0",
      "formulaTraces": []
    },
    "modelSummary": {
      "status": "page_composed",
      "pageId": "<page-id>",
      "unitCount": 1,
      "topLevelComponentCount": 1,
      "dataContextVersion": "<version>",
      "bundleVersion": "0.2.0",
      "documentSha256": "<64-hex>"
    }
  },
  "issues": []
}
```

原始失败是 **MCP 协议成功、业务失败**：

```json
{
  "ok": false,
  "completedStages": ["discovery"],
  "artifactEnvelope": null,
  "issues": [{
    "code": "<stable-code>",
    "path": "<json-pointer>",
    "stage": "generation",
    "message": "<safe-message>",
    "retrySafe": false,
    "candidates": ["<optional-closed-set-value>"]
  }]
}
```

Relay 必须读 `ok`，不能只依赖 MCP `isError`。

### 3.2 契约加载

Relay 必须从同一 Bundle 加载：

- [`agent-model-decision.schema.json`](./contracts/authored/agent-model-decision.schema.json)；
- [`agent-step-event.schema.json`](./contracts/authored/agent-step-event.schema.json)；
- [`page-build-spec.schema.json`](./contracts/authored/page-build-spec.schema.json)；
- [`page-build-artifact.schema.json`](./contracts/authored/page-build-artifact.schema.json)；
- [`relay-page-artifact-envelope.schema.json`](./contracts/authored/relay-page-artifact-envelope.schema.json)。

Envelope Schema 通过 `$id` 引用 Artifact Schema，校验器必须同时注册两份资源。
可参考 [`test_stdio.py`](./test-harness/tests/test_stdio.py) 中的 JSON Schema Registry 用法。

### 3.3 运行配置与下游 HTTP

以 [`metriccanvas-authoring.json`](./relay/mcp_configs/metriccanvas-authoring.json)
为唯一模板，由 Relay 部署层注入：

| 环境变量 | 要求 |
|---|---|
| `METRICCANVAS_TOOL_SURFACE` | 必须为 `relay` |
| `METRICCANVAS_OPERATOR_ID` | 联调阶段为服务操作人；生产 DQE 必须换成当前用户的受保护注入 |
| `METRICCANVAS_AUTH_TOKEN` | 不可出现在 Tool arguments、模型上下文或日志 |
| `METRICCANVAS_DQE_BASE_URL` | 必须包含 `/rest/cdi/cdinl2databuilderservice/v1`；Tool 再拼 `/dsl/execute` |
| `METRICCANVAS_DQE_WORKSPACE_ID` | DQE `X-Workspace-Id` |
| `METRICCANVAS_DQE_FORBIDDEN_HINT` | 可选，无权限时的申请指引 |
| `METRICCANVAS_DATA_CONTEXT_DATASETS_URL_TEMPLATE` | 必须含 `{subjectId}` |
| `METRICCANVAS_DATA_CONTEXT_DETAIL_URL_TEMPLATE` | 必须含 `{datasetId}` |
| `METRICCANVAS_DATA_CONTEXT_SUBJECT_ID` | Lab 主题 ID |
| `METRICCANVAS_DATA_CONTEXT_WORKSPACE_ID` | Lab `X-Workspace-Id` |
| `METRICCANVAS_DATA_CONTEXT_APP_CODE` | Lab `apiGw-app-code` |
| `METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG` | 受管绝对路径，形状见投影样例 |

Data Context 先 GET 数据集列表，再并发 GET 详情，默认超时
20s；header 为 `Accept` / `X-Auth-Token` / `X-Workspace-Id` /
`apiGw-app-code`。DQE 只 POST
`{METRICCANVAS_DQE_BASE_URL}/dsl/execute`，默认超时 25s；header 为
`Content-Type` / `Accept` / `X-Auth-Token` / `X-Operator-Id` /
`X-Workspace-Id`。

`LabDataContextHttpPort` 当前会在进程内长期缓存快照。一次性 stdio
没有跨调用污染；若 Relay 改为常驻 `streamable_http`，先增加 TTL
或显式失效契约。

## 4. Page Artifact Adapter

Artifact Adapter 位于 MCP 结果进入模型消息、`result_summary` 和广播之前。
对历史 Relay 代码，最窄插入点是 `MCPToolProxy._process_result` 之前，
并需让 oneshot worker 保留 MCP `structuredContent` 而不是只拍平为文本。

```python
async def intercept_metriccanvas_compose(invocation, raw_result):
    if invocation.server != "metriccanvas-authoring":
        return raw_result
    if invocation.tool != "compose_page":
        return raw_result

    result = parse_structured_compose_result(raw_result)
    if not result["ok"]:
        return safe_failure_without_artifact(result)

    envelope = validate_envelope_and_artifact(result["artifactEnvelope"])
    artifact = envelope["artifact"]
    document = validate_locked_page_schema_and_cross_references(artifact["document"])
    document_sha256 = sha256(
        canonical_json(document).encode("utf-8")
    ).hexdigest()
    safe_summary = validate_and_derive_safe_summary(
        envelope["modelSummary"], artifact, document_sha256
    )
    require_server_bound_session(invocation)
    require_expected_relay_version_id(invocation)
    require_expected_checkpoint_version(invocation)
    require_active_invocation(invocation)

    stored = await checkpoint_store.compare_and_set_with_event_factory(
        session_id=invocation.session_id,
        actor=invocation.actor,
        expected_relay_version_id=invocation.expected_relay_version_id,
        expected_checkpoint_version=invocation.expected_checkpoint_version,
        invocation_id=invocation.invocation_id,
        cancellation_epoch=invocation.cancellation_epoch,
        artifact=artifact,
        agent_state=invocation.next_agent_state,
        # 事务内先分配 artifactId/checkpointVersion，再构造并校验事件。
        event_factory=lambda allocated: validated_document_ready_event(
            artifact=artifact,
            agent_state=invocation.next_agent_state,
            artifact_id=allocated.artifact_id,
            checkpoint_version=allocated.checkpoint_version,
            document_sha256=document_sha256,
        ),
    )

    return {
        "ok": True,
        "completedStages": result["completedStages"],
        **safe_summary,
        "artifactId": stored.artifact_id,
        "checkpointVersion": stored.checkpoint_version,
    }
```

`validated_document_ready_event` 必须从已验页面与 Agent State 派生
`components` 和 `transientPageId`，并携带事务内分配的 `artifactId`、
`checkpointVersion` 及重算的 `documentSha256`。事件构造后须通过
[`agent-step-event.schema.json`](./contracts/authored/agent-step-event.schema.json)；
不能在事务外用尚未分配的 ID 预先构造。

必须覆盖以下失败分支：

- 非法 JSON / 缺失 `artifactEnvelope`；
- Envelope 或 Artifact Schema 不符；
- 页面不通过该 Bundle 锁定的 Page Schema 或跨引用校验；
- 按 Authoring 规则（key 排序、无空白、Unicode 不转 ASCII 转义，
  然后 UTF-8 编码）重算 SHA-256 后，
  `artifact.documentSha256` 或 `modelSummary.documentSha256` 不符；
- `modelSummary.pageId` 与 `artifact.document.id` 不符，或 summary 与
  artifact 的 Bundle/Data Context 版本、单元数、顶层组件数不符；
- 缺失受保护的 session/actor/Relay version/checkpoint version；
- 调用已取消；
- checkpoint CAS 冲突；
- 存储或事件写入失败。

任一失败都返回 Relay 结构化失败，**不得退化为原始 Artifact 透传**。
Page Schema 与跨引用校验应复用同一 Bundle 版本的现有验证实现，
或由 Authoring 提供一个非模型可见的粗粒度校验 Interface；不要在 Relay
手写第三份页面校验器。

### 4.1 检查点最小语义

Relay 拥有检查点 Schema，但至少必须版本化以下信息：

```text
formatVersion
checkpointVersion
basedOnRelayVersionId
invocationId / cancellationEpoch
workflowState: received | discovering | routing | awaiting_user | planning | composing | page_composed | failed | cancelled
outcomeStatus: pending | interaction_required | completed | failed | cancelled
artifactId + PageBuildArtifact
documentSha256 + bundleVersion
entries[] { dataSourceId, unit, intent, requestedComponent }
nextOrdinal
routedDomains
dataContextVersion
lastTarget
pendingInteraction
lastStepEventSequence
```

- 完整 Artifact 只保存在 latest-checkpoint sidecar，不进聊天 JSONL 或追加事件。
- checkpoint 更新与 `document_ready` 事件必须使用同一事务或可幂等重放的
  outbox，避免只存了其中一个。
- 相同 `sessionId + basedOnRelayVersionId + invocationId` 幂等返回已有结果。
- CAS 必须同时比较当前 Relay `version_id`、checkpoint version 和
  cancellation epoch；任一较旧都不得覆盖新状态。
- 只允许归属用户写入；归属用户和平台管理员可读；不存在与无权返回同样结果。
- 保留期自最后一次有效写入起 90 天，纯读取不延长。
- Artifact 读取 Interface 返回 `Cache-Control: no-store`。

Relay-owned checkpoint 尚无共享 JSON Schema。这是 Relay 首批实现必须冻结的契约，
不要直接复制旧 TypeScript `AskConversationState`当最终形状。

## 5. Agent Core 跨进程 Seam

目前这个 Seam 未完成，必须二选一并记录 ADR：

### 选项 A：内部 MCP transition Interface（推荐）

在 Authoring Bundle 中增加一个粗粒度、非模型可见的深 Interface，例如：

```text
advance_agent_state(state, input)
  -> nextState + actions[] + events[] + interaction? + pageBuildSpec? + failure?
```

Relay 仅对固定 Workflow 开放该 Interface，不将它注册到模型 Toolkit。
建议用独立内部 MCP 配置/工具面，使模型 `list_tools` 仍恰好只有两个工具。
该选项保持语言无关的进程 Seam，但需修订“内部算法不是 MCP tool”的文字为
“内部算法不是**模型可见** Tool”。

### 选项 B：Relay Python 直接导入

将 Agent Core 抽成独立、版本锁定的 Python library，Relay Plugin 与 MCP Tool
使用同一发布版本。这需修订“Skill 与 Tool 只经 MCP 协作”的 ADR 约束，并增加
Bundle/Plugin 版本不符时的启动拒绝。

两个选项都不允许：

- 把 `agent_core.py` 的十几个函数注册成模型 Tool；
- 在 Relay 重写第二份 reducer；
- 由模型直接构造 checkpoint 或 Page JSON。

Relay 还需要锁定 entry 到 Page Build Spec 的唯一映射：

```text
spec.question             = currentQuestion
spec.description          = optionalDescription
spec.dataContextVersion   = checkpoint.dataContextVersion
spec.baseRevision         = optionalBaseRevision
spec.units[]               = {
  dataSourceId,
  ...entry.unit,
  intent: entry.intent,
  pinnedComponent: entry.requestedComponent  # 仅非 null 时
}
```

这个映射应归 transition Interface 所有，不应散落在 WebSocket handler 和 prompt 中。

## 6. 固定 Workflow

### 6.1 Bundle 0.2.0 的可执行调用顺序

```text
received
  → 用完整问题调 discover_data_context
  → 用户域覆盖验真，否则 route_business_domains + 闭集验真
  → 仅对未解析的最小业务词补充 discovery
  → ambiguities / 阻塞式取数核对时等待用户
  → submit_data_request_units
  → normalize_display_only_decision
  → guard_structural_response
  → normalize_unit_operations + apply_unit_operations
  → 部分可答 / Metric Gap 分区与确认
  → 仅对新增、intent 为空或用户明确要改意图的单元 submit_analysis_intent + fallback
  → 保留其他已有 intent，包括本轮修改了其他字段的单元
  → apply_presentation_request
  → 映射完整 Page Build Spec
  → compose_page
  → PageArtifactAdapter CAS 保存
  → page_composed
```

`compose_page` 内部已包含整个 DQE 执行，且 Page Build Spec 要求
`intent`，因此 0.2.0 的物理调用必须先完成意图决策。这与
[ADR-0037](../docs/adr/0037-ask-orchestration-and-interaction-contract.md)尚保留的
“真实执行 → 意图判定”语义顺序冲突。M3A 按上述物理顺序接通，
但 M3B 必须先通过 ADR 明确二选一：接受“基于声明形状的执行前意图”，
或将 compose 拆成 plan/execute 两个非模型可见阶段以继续执行后判定。
在该决策前不能宣称 ADR-0037 的顺序已等价迁移。

### 6.2 三类模型决策

三类决策不是 MCP Tool。Relay 先以 `$id` 注册完整
[`agent-model-decision.schema.json`](./contracts/authored/agent-model-decision.schema.json)
根 Schema，再分别编译
`<root-$id>#/$defs/routeDecision`、`<root-$id>#/$defs/unitDecision` 和
`<root-$id>#/$defs/intentDecision`做本地校验。不得抽出某个 `$defs`
子对象单独编译，否则其根级 `#/$defs/...` 引用会失效。

| 决策 | 作用 | 额外语义闸 |
|---|---|---|
| `route_business_domains` | 从 `businessDomains` 选 1–2 个域 | `validate_route_decision` 拒绝面外域 |
| `submit_data_request_units` | 初次单元或 `add/modify/replace/remove` | reducer、target、结构 guard、6 单元上限 |
| `submit_analysis_intent` | 仅为新增、缺 intent 或用户明确改意图的单元生成六类意图 | 两次失败后按形状确定性降级；其他已有 intent 保持不变 |

每次决策先校验 Schema，失败时将精确 JSON path 返给同一决策修正一次；
第二次仍失败即失败关闭。

固定预算：

| 操作 | 单轮上限 |
|---|---:|
| 业务域决策 | 2 |
| 取数单元决策 | 2 |
| 每个需要判定意图的 unit | 2 |
| `discover_data_context` | 12 |
| `compose_page` | 2 |

Skill `metadata.max_tokens=30000` 是上下文限制，不是上表的调用预算。
Relay 历史 Planner 的 10 次重试不能覆盖这里的限额。

### 6.3 等待、恢复与事件

持久化步骤事件只使用
[`agent-step-event.schema.json`](./contracts/authored/agent-step-event.schema.json)的八类：

```text
domain_routed
candidates_retrieved
scope_card_presented
execution_started
rows_ready
document_ready
metric_gap_recorded
step_failed
```

- 检查点保存 `pendingInteraction`，等待期间不保持内存中的长运行。
- 用户确认后发起新轮，从最新检查点结构化恢复。
- 消歧必须精确命中候选的 `businessDomain + canonicalName`。
- 只有明确确认后才产生 `metric_gap_recorded`。
- 未触及 entry 保持不变；删除后 `nextOrdinal` 不回收。
- `droppedAdds > 0` 必须对用户说明未执行视角。

M3A 可在 `compose_page` 返回后事后投影 `execution_started/rows_ready`，但不得在 UI
冒充实时进度。若验收要求真实阶段流，先在 `compose_page` 与 Relay 之间增加
observer/progress seam，其 payload 必须先通过当前步骤事件 Schema：
`execution_started` 现在必填由 Authoring 派生的 `effectiveQuery`，
`rows_ready` 携带行数、总数和字段名，两者都不传数据行。若安全规则
禁止持久化 `effectiveQuery`，必须先修订事件契约，不得发少字段的伪合法事件。

## 7. 身份、取消和迟到结果

### 7.1 身份

`userId/token` 不得放入 `config.agent_context` 或模型可填的 Tool arguments。
它们必须从 Relay 已鉴权上下文解析，通过受保护 invocation context 传到
MCPToolProxy。

对历史的每调用 oneshot 实现，可在启动子进程时为该次调用单独叠加
`METRICCANVAS_OPERATOR_ID` 和 `METRICCANVAS_AUTH_TOKEN`。若改为常驻 MCP，必须改为
request-scoped IdentityPort，不得使用跨用户共享的进程 env。

在进生产前，Authoring 与 Relay 还要联合完成身份 Port 拆分：

- Lab Data Context 使用服务身份取全量受治理元数据；
- DQE 使用当前用户 `operator/token` 注入行级权限。

### 7.2 取消

Relay 现有 `interrupt` 会取消 Agent task，但 2026-09-02 的调查显示 MCP oneshot
进程未登记到 `InterruptManager`。需要：

1. 启动 worker 时按 session/invocation 登记整个进程组。
2. `interrupt` 执行 `TERM → 短宽限期 → KILL`。
3. worker `finally` 清理它拉起的 MCP server 子进程。
4. Artifact 保存前再检查 cancellation epoch 与 expected checkpoint version。
5. 迟到产物只能丢弃或标记为 cancelled，不能覆盖新检查点。

Python Data Context/DQE Adapter 已使用可取消的 async `httpx`，但这只是最底层；
Relay 不终止子进程时，不能宣称端到端取消已完成。

## 8. 失败和重试

- 业务失败从 `issues[]` 投影为
  `step_failed {stage, code, message, path?, retrySafe?, candidates?, completedStages?}`。
- 未知错误一律 `retrySafe=false`。
- 只有 `DQE_TRANSPORT_ERROR` 和 `DQE_TIMEOUT` 可用完全相同的
  `page_id + spec` 重试一次。
- `DATA_CONTEXT_VERSION_CHANGED` 不做原参重试；废弃本轮候选并从 discovery 重来。
- 含 `candidates` 的闭集失败只允许根据返回候选定向修正一次。
- 401/403、query rejected、信封/行契约、Schema/组件失败都不自动重试。
- Artifact 解析、CAS 或持久化失败不保存任何产物，不透传原始结果。

Relay 自身的 schema-invalid/checkpoint-conflict/artifact-save-failed/cancelled 错误码
尚无共享契约。在实现第一批测试前先冻结它们。

## 9. 生产验收门禁

### 9.1 Bundle 侧基线

在 DataDashboard 根目录执行：

```bash
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm authoring:contracts:check
PYTHONDONTWRITEBYTECODE=1 \
  metriccanvas-authoring/tool/.venv/bin/python -m unittest discover \
  -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'
pnpm exec vitest run packages/mcp/tests
pnpm --filter @metriccanvas/mcp check
```

当前基线证据：Python Harness `152/152`，TypeScript MCP `154/154`，
Bundle `432` 项摘要校验通过，契约无漂移。

### 9.2 Relay 最小 E2E

| 场景 | 必须断言 |
|---|---|
| Happy path | 顺序事件正确；checkpoint 有 Artifact；模型/事件/日志无页面和数据行；UI 可恢复；Java 零调用 |
| Ambiguity | `客户数` 跨域并列后等待；刷新仍可选；选择前 compose/DQE 零调用；面外选择拒绝 |
| Retry | 首次 DQE timeout 后同参只重试一次并仅有一个 checkpoint；forbidden 不重试 |
| Cancel/race | compose 在途中断后新一轮成功；旧产物不能覆盖新 checkpoint |
| Identity/ACL | A/B 的 DQE header 与行级结果隔离；B 不可读 A Artifact；管理员可读；模型不能改身份 |
| Partial/gap | 可答单元先交付；缺口单独确认；只在确认后有 `metric_gap_recorded`；幂等键稳定 |
| Multi-turn | stable ID、target、未触及单元、pin、结构 guard、6 单元上限和 droppedAdds 均正确 |
| Explicit persistence | 临时态不进 Java；只有 UI “沉淀”时以当前用户创建不可变修订 |

可从 [`agent-conformance.json`](./contracts/exported/agent-conformance.json) 中的
`step-events-success`、`step-events-out-of-scope`、
`step-events-execution-retry-failed` 起步。它们只是首批向量，不能替代
40 条黄金问题和 F01–F14 反例。

生产门禁：

- 工具面恰好两个，Bundle/契约摘要一致；
- ADR-0037 的“执行前或执行后意图判定”已裁决，契约、Workflow
  和差分测试使用同一顺序；
- 数据最小化负向测试 100% 通过；
- scripted model 的 F01–F12 重放通过；
- 40 条黄金问题无未解释差异；
- 断线、等待、取消、CAS 冲突和 90 天保留正反例通过；
- 多用户 DQE 与 Artifact ACL 负向测试通过；
- 真实 Relay/模型/Lab/DQE 完整纵切通过；
- p95 ≤ 30s；否则评估常驻 `streamable_http`，并先为 Data Context cache 增加
  TTL/失效语义；
- 影子流量、灰度、回滚脚本和观测指标已验证。

## 10. Relay 建议提交顺序

每个提交都自带对应契约测试，不在最后一次性补验收：

1. `test(metriccanvas): vendor 0.2.0 contracts and add disabled fixtures`
2. `feat(session): add versioned MetricCanvas checkpoint ACL retention and CAS`
3. `feat(mcp): split compose artifact from model-visible result`
4. `docs(adr): decide pre-execution intent or split compose plan and execute`
5. `feat(agent): add private MetricCanvas Agent Core transition seam`
6. `feat(agent): enforce decision schemas budgets reducer and interactions`
7. `feat(agent): persist step events and resume or cancel safely`
8. `feat(auth): inject request-scoped identity into MCP execution`
9. `feat(ui): restore transient artifact and persist explicitly to Java`
10. `test(ops): verify real services shadow rollout and rollback`

## 11. 常见误接

- 只挂 Skill，然后把 Markdown 当固定 Workflow。
- 在 Artifact Adapter 前开启 `relay` 工具面。
- 开放 compatibility `build_page`，让问数自动创建 Java 修订。
- 把 Agent Core 拆成一堆模型 Tool，或在 Relay 重写 reducer。
- 把完整 Artifact 放入模型消息、`result_summary`、追加事件或请求日志。
- 把 latest checkpoint 当成 Page Revision，或由 Agent 自动“沉淀”。
- 把静态高权服务 token 当作生产用户身份。
- 将 `userId/token/sessionId` 添加为模型可填的 Tool 参数。
- 只取消 Agent task，却不终止 MCP 子进程或拒绝迟到保存。
- 对所有失败自动重试，或沿用 Planner 10 次重试。
- 跨调用混用 `dataContextVersion`，或遇到版本变更仍原参重试。
- 让模型写 DQE DSL、字段契约、组件 JSON、布局或 Page JSON。
- 为取数直连 Lab，绕过 DQE 的行级权限。
- 只部署 sdist，遗漏 Relay 必需的 authored contracts。
- 将 `compose_page` 事后结果冒充实时执行进度。
- 将一次性进程 env 的用户 token 复用到常驻跨用户进程。

## 12. Relay 历史定位索引

当前 workspace 不含 `CDIRelayAgentService` 源码。以下是
[调查报告](../调查报告/relay.md)在 2026-09-02 对当时 Relay 代码的定位；
**实施前必须在 Relay 目标提交复核路径和语义**。

| 能力 | 历史 Relay 位置 | 对接动作 |
|---|---|---|
| Skill 加载 | `skill_loader.py:146-185,271-322,687,702-712` | 扫描 `.skills/`，校验 frontmatter |
| 工具白名单 | `agent_factory.py:653-681,1044`、`agent_builder.py:881-932` | 确认 allowed-tools 真实强制 |
| MCP config | `mcp_loader.py:288-348` | 扫描 `.relay/mcp_configs/*.json` |
| oneshot 调用 | `mcp_tool_proxy.py:222-286,364-430`、`mcp_oneshot_worker.py:562-605` | Artifact 截获、身份与取消插入点 |
| Tool Schema | `mcp_tool_proxy.py:910-962` | 验证 inputSchema 对真实模型可用 |
| WebSocket | `web_server.py:1045-1046`、`message_router.py:159-234` | `/ws/{client_id}` + `role_name` |
| 事件/POBM | `event_protocol.py:30-100,170-176`、`web_relay_observer.py:177-211` | Adapter 必须在持久化/广播前运行 |
| 增量恢复 | `message_handlers.py:488-602` | 沿用 `session_id + version_id`，另加 latest checkpoint |
| 取消 | `message_router.py:68-80`、`relay_application.py:294-351` | 将 MCP 进程组纳入 interrupt |
| 身份 | `session_context.py:542-551`、`process_owner_service.py:62-154` | 从服务端上下文注入，不信任 agent_context |

该调查报告附录中的 `build_page` 对接示例已被 ADR-0064 取代。
当前权威工具面始终是 `discover_data_context + compose_page`。
