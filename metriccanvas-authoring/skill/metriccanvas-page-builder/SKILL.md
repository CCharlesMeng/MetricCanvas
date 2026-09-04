---
name: metriccanvas-page-builder
description: 根据业务问题创建或修改 MetricCanvas 临时页面态，通过受治理的数据能力发现、受控取数、DQE 执行和页面装配完成问数与探索。用于 Relay Page Artifact Adapter 已启用后的 MetricCanvas 问数、探索、页面构建和多轮调整。
allowed-tools:
  - discover_data_context
  - compose_page
metadata:
  max_tokens: 30000
  mcp_servers:
    - metriccanvas-authoring
---

# MetricCanvas 页面构建

生成通过页面校验的临时页面态。由模型理解业务问题并形成 Page Build Spec；由确定性工具派生 DQE 查询、字段绑定、组件、布局和页面元数据。

## 运行前提与工具注册

运行本 Skill 前，由 Relay 部署侧完成以下注册；这些动作不是 Agent 的运行步骤：

1. 将本 Skill 放入 `.skills/metriccanvas-page-builder/SKILL.md`，由 Relay `SkillLoader` 注册。
2. 将 Bundle 内 `relay/mcp_configs/metriccanvas-authoring.json` 复制到 Relay 的 `.relay/mcp_configs/`，替换 sdist 路径和环境占位符。
3. 安装 Relay Page Artifact Adapter，使其截获 `compose_page` 的完整页面构建产物、写入最新会话检查点，并仅向模型返回安全摘要。
4. 接通真实 Data Context 与 DQE Adapter。未接通时工具会返回结构化失败，不得使用测试夹具或模型补造数据继续执行。

发布时先在 `tool/` 构建 `metriccanvas_authoring-0.2.0.tar.gz`。Relay 通过 `uvx`
从该 sdist 临时安装并启动可执行入口；将所有 `<...>` 替换为部署值：

```json
{
  "mcpServers": {
    "metriccanvas-authoring": {
      "command": "uvx",
      "args": [
        "--from",
        "<metriccanvas-authoring-sdist.tar.gz>",
        "metriccanvas-authoring"
      ],
      "env": {
        "METRICCANVAS_TOOL_SURFACE": "relay",
        "METRICCANVAS_OPERATOR_ID": "<service-operator-id>",
        "METRICCANVAS_AUTH_TOKEN": "<service-auth-token>",
        "METRICCANVAS_DQE_BASE_URL": "<dqe-v1-base-url>",
        "METRICCANVAS_DQE_WORKSPACE_ID": "<workspace-id>",
        "METRICCANVAS_DQE_FORBIDDEN_HINT": "<permission-request-guidance>",
        "METRICCANVAS_DATA_CONTEXT_DATASETS_URL_TEMPLATE": "<lab-datasets-url-with-{subjectId}>",
        "METRICCANVAS_DATA_CONTEXT_DETAIL_URL_TEMPLATE": "<lab-detail-url-with-{datasetId}>",
        "METRICCANVAS_DATA_CONTEXT_SUBJECT_ID": "<subject-id>",
        "METRICCANVAS_DATA_CONTEXT_WORKSPACE_ID": "<workspace-id>",
        "METRICCANVAS_DATA_CONTEXT_APP_CODE": "<api-gateway-app-code>",
        "METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG": "<absolute-projection-config-path>"
      }
    }
  }
}
```

`metriccanvas-authoring` 命令通过 FastMCP 注册工具，Relay 启动后以 `list_tools`
发现它们。sdist 已内嵌 Bundle 身份、Page Build Spec、Data Context Schema、
组件目录和 Page Schema，不依赖 Relay 宿主的源码目录。

`METRICCANVAS_DATA_CONTEXT_PROJECTION_CONFIG` 指向一份按
`relay/data-context-projection.example.json` 填写的配置。Lab 未显式提供的
`isRatio`、可空性和敏感性不得由模型猜测；缺少显式治理值时工具以
`DATA_CONTEXT_GOVERNANCE_REQUIRED` 停止。维度取值中心保留为
`DimensionValuePort`；真实 MetricService URL 和 DTO 契约未提供前，不注册伪造的 HTTP Adapter。

frontmatter 中的 `metadata.mcp_servers` 只授权 MCP Server，`allowed-tools` 只限制模型可调用的工具；二者都不代替 Relay MCP 配置。开始执行前确认模型可见工具恰好为：

- `discover_data_context`
- `compose_page`

缺少任一工具时报告部署未就绪并停止。如果发现 `build_page`，说明误用了 compatibility 工具面，也必须停止。

`route_business_domains`、`submit_data_request_units` 和 `submit_analysis_intent` 是三类模型决策名称，不是 MCP 工具。Relay 完成 tokenizer 级分词和模型调用；MetricCanvas 业务词解析与排序由 `discover_data_context` 内的确定性算法完成。DQE 调用、查询生成、结果字段验真和页面装配全部封装在 `compose_page` 内，不向模型注册细粒度算法工具。

确定性多轮规则已落在 `tool/metriccanvas_authoring/domain/agent_core.py`：稳定单元身份、定向增改换删、结构空操作防静默失效、组件话语作用域、意图降级、路由和消歧确认。Relay 尚未提供固定工作流执行器；在 Relay 完成该调用面接线前，本 Skill 是可执行编排规约，Agent Core 测试是确定性规则证据，二者都不能被误报为“Relay 固定编排已上线”。

## 调用边界

Relay 使用原生 Skill ReAct 调用模型，不由 Python Tool 再次调用模型。
每个模型决策按 Bundle 内 `contracts/authored/agent-model-decision.schema.json` 的对应
`$defs` 输出：

| 阶段 | 调用方 | 输出契约 | 后续调用 |
|---|---|---|---|
| 业务域路由 | Relay 模型 | `routeDecision` / `route_business_domains` | 拆分业务词 |
| 受治理发现 | MCP Tool | `discover_data_context(query, limit)` | 候选消歧 |
| 取数单元 | Relay 模型 | `unitDecision` / `submit_data_request_units` | 取数核对 |
| 分析意图 | Relay 模型 | `intentDecision` / `submit_analysis_intent` | 形成 Page Build Spec |
| 执行与装配 | MCP Tool | `compose_page(page_id, spec)` | Relay Artifact 检查点 |

`compose_page` 内部固定执行：获取 Data Context 快照 → 校验规范名 → 派生
DQE DSL 与字段契约 → 最多 6 个取数单元并发调用 DQE Interface → 验证结果行
→ 选择组件与布局 → 校验 Page Schema → 返回 Artifact 信封。对外 HTTP 只由
Adapter 发起：Lab 数据集列表/详情为 GET，DQE 为
`POST /rest/cdi/cdinl2databuilderservice/v1/dsl/execute`。

## 工具调用契约

### `discover_data_context`

每轮先将当前完整问题调用一次，让 Tool 在同一版本下完成指标、维度、枚举值、相对时间、分析意图和结构操作的确定性拆解。只对仍未解析的最小业务词补充调用；不传 SQL、DQE DSL 或页面 JSON。

```json
{
  "query": "Tokens请求量",
  "limit": 10
}
```

输入：

- `query`：一个指标、维度、筛选值或时间能力的业务词。
- `limit`：候选上限，范围 1–50，默认 10。

输出：

- `ok`：调用是否成功。
- `dataContextVersion`：本轮数据上下文版本。
- `businessDomains`：当前快照的完整规范业务域清单，用于路由候选、用户覆盖验真和零命中重路由。
- `matches`：受治理详情；后续只使用其中返回的规范名、定义、业务域和能力信息。
- `resolution.candidates[]`：所有参与判定的候选，含 `matchedTerm`、`canonicalName`、`businessDomain`、`source` 和 `score`。
- `resolution.selected[]`：唯一胜出的业务词；不得从 `candidates` 自行另选一个。
- `resolution.ambiguities[]`：由同一 `matchedTerm` 的最高分并列触发，候选集包含该词的全部可追溯候选；非空时必须阻塞并请用户精确选择。
- `time`、`intent`、`structureOperation`：确定性时间、意图和 `add/remove/replace/split/merge` 词法结果；模型可补全上下文，不得覆盖已命中结果。
- `issues[]`：失败的 `code`、`path`、`stage`、`message` 和 `retrySafe`；可定向修正的闭集错误另含 `candidates`。

同一轮所有发现结果必须使用一致的 `dataContextVersion`；版本变化时废弃旧候选并重新发现。
Tool 会对整句使用确定性指标/维度/时间词解析做一次兜底拆解；该拆解不代替上述三个模型决策。成功但零命中时，`candidates/selected/ambiguities` 均为空，不得把“无结果”误当成工具故障。

### `compose_page`

发现、消歧、取数核对和分析意图决策完成后，正常路径只调用一次。`page_id` 取自 `config.agent_context.pageId`；缺失时要求平台分配临时页面 id，不自行冒充正式页面 id。

```json
{
  "page_id": "transient-tokens-by-region",
  "spec": {
    "question": "上个月各区域的 Tokens 请求量是多少？",
    "description": "区域 Tokens 请求量对比",
    "dataContextVersion": "2026-09-03.1",
    "units": [
      {
        "dataSourceId": "result",
        "businessDomain": "运营分析",
        "metrics": [{"kind": "metric", "name": "Tokens请求量"}],
        "groupBy": ["区域"],
        "filters": [],
        "time": {
          "granularity": "month",
          "start": "2026-08",
          "end": "2026-08",
          "providedBy": "user"
        },
        "title": "各区域 Tokens 请求量",
        "intent": "comparison",
        "pinnedComponent": "barChart"
      }
    ]
  }
}
```

`spec` 必须满足以下约束：

- 顶层只包含 `question`、可选 `description`、必填的 `dataContextVersion`、可选 `baseRevision` 和 `units`。
- `units` 包含 1–6 个取数单元；每个单元明确稳定 `dataSourceId`、`businessDomain`、`metrics`、`groupBy`、`filters`、`time` 和 `intent`。`dataSourceId` 由 Agent Core 分配，多轮保持，删除后序号不复用。
- 指标、维度和筛选值只使用 `discover_data_context` 返回的受治理名称；临时指标使用 `kind=formula` 并保留用户确认的公式与说明。
- `intent` 只能是 `comparison`、`trend`、`composition`、`ranking`、`detail` 或 `single_value`。
- 只描述业务语义，不传 DQE 查询、结果字段契约、组件 JSON、布局或页面协议版本。

原始 MCP 成功结果包含 `ok`、`completedStages`、`artifactEnvelope` 和 `issues`。Artifact 还含 `formulaTraces`，保留 `question/expression/referencedMetrics`；含公式的组件标题会确定性追加“(临时指标)”。页面只嵌入每个单元前 20 行样例，`totalCount` 保留完整计数。

Relay Page Artifact Adapter 必须保存 `artifactEnvelope.artifact`，再将模型可见结果替换为 `modelSummary + artifactId + checkpointVersion`。如果模型直接看到 `artifactEnvelope.artifact`、页面 `document` 或数据 `rows`，立即停止且不复述内容，并报告 Relay Adapter 未生效。

## 模型调用与预算

每个模型决策只接收当前问题、已治理候选、必要的最新单元摘要和当前 target，不传完整页面、DQE 数据行或无关对话历史。输出必须先通过 `contracts/authored/agent-model-decision.schema.json` 对应 `$defs`，再交给确定性规则；Relay 必须注册完整根 Schema 后通过它的 `$id#/$defs/...` 编译三类决策，不能脱离根 Schema 单独编译子对象。Schema 失败时将错误路径返给同一决策修正一次，第二次失败立即进入 `failed`。

- `route_business_domains`：只输出 1–2 个候选中存在的业务域，并交给 Agent Core `validate_route_decision` 再验真，面外模型输出返回 `MODEL_ROUTE_DECISION_INVALID`。用户显式覆盖优先；全部非法时返回 `DOMAIN_OVERRIDE_INVALID`。多轮沿用旧域零命中时，且本轮没有用户覆盖，才用全域候选重路由。
- `submit_data_request_units`：首轮可输出 `unit` 或 `operations`，多轮优先输出带稳定 `dataSourceId` 的 `add/modify/replace/remove`。首轮多个视角默认每视角一单元；只有用户明确要求合并才合并，不同单位的指标不得合并。拆分时新单元默认继承原业务域、`groupBy` 和 `time`；标题必须唯一，不得自行扩展用户未要求的视角。
- `submit_analysis_intent`：只对新增、`intent` 为空或用户明确要改意图的单元调用。即使单元的其他字段本轮被修改，只要用户未提及意图且旧值存在，也必须保留。多单元时用各自 `title` 作为意图输入，避免整句中的“趋势”污染所有单元。两次无效后按形状降级：无 `groupBy` 为 `single_value`；唯一时间分组为 `trend`；其余为 `comparison`。

单轮止损预算：业务域决策最多 2 次，单元决策最多 2 次，每个需要判定意图的单元最多 2 次，`discover_data_context` 最多 12 次，`compose_page` 最多 2 次。到达任一上限后失败关闭，不继续试探。

## Agent Core 会话状态与确定性规则

Relay 检查点保存 `entries`、`nextOrdinal`、`routedDomains`、`dataContextVersion` 和最后 target。每个 entry 只保存 `dataSourceId + unit + intent + requestedComponent`；不把数据行放入模型上下文。对应的可执行参考实现是 `domain/agent_core.py`。

1. 将画布 target 的 `sectionId/componentId` 定向到组件 `data.main`，再校验它是已知 `dataSourceId`。“这个/它”优先作用于该单元。
2. `modify` 只合并 patch，`replace` 替换业务口径但保留原 `dataSourceId/intent/requestedComponent`，`remove` 不回收序号，`add` 使用单调 `nextOrdinal`。空 patch 不算触及；未触及 entry 保持原状态。
3. 识别出合并、拆分、增加或删除，但单元决策返回空操作/空 patch/`out_of_scope` 时，带定向反馈修正一次；仍为空则返回 `STRUCTURAL_INTENT_NOT_APPLIED`，绝不假装已应用。
4. 最多保留 6 个单元。超出部分记录 `droppedAdds`，结果中明说未执行的视角并建议用户下轮补充，不得静默截断。
5. 组件目录中的中文名或别名按问题中最后一次显式出现为准。作用域为 `touched > target > all`；“图表/图形/可视化”等泛词只解除该作用域旧 pin，新显式点名覆盖旧 pin。
6. 并列消歧确认必须同时携带候选内的精确 `businessDomain + canonicalName`；空确认继续阻塞，面外选择返回 `SCOPE_SELECTION_INVALID`。Agent Core 也接受已持久化 Scope Card 的等价 `metricName` 形状。
7. 可执行单元与 `gaps` 分开。先交付可回答页面，再单独说明缺口；无可执行单元时不调用 DQE，进入 `awaiting_user`。只有用户明确确认后才生成 `metric_gap_recorded`，同一业务语义使用稳定幂等键。

## 状态

以当前业务问题和 `config.agent_context` 中的最新结构化会话检查点为输入。保留每个未触及取数单元的显式筛选、时间范围、组件钉住结果和目标绑定；每轮最多保留六个取数单元。

按以下状态推进，每次只进入一个状态：

| 状态 | 动作 | 退出条件 |
|---|---|---|
| `received` | 读取问题、`pageId` 和最新会话检查点 | 区分首次问数与多轮调整 |
| `discovering` | 用完整问题发现业务域闭集、受治理候选与确定性词法结果 | 已获得单一 `dataContextVersion` 下的发现结果 |
| `routing` | 在 `businessDomains` 闭集内作出业务域模型决策 | 得到 1–2 个受治理业务域 |
| `awaiting_user` | 展示消歧或阻塞式取数核对 | 收到精确选择、修正或取消 |
| `planning` | 形成或定向修改取数单元与分析意图 | 完整 Page Build Spec 可提交 |
| `composing` | 调用一次 `compose_page` | 收到成功摘要或结构化失败 |
| `page_composed` | Relay 已保存最新会话检查点 | 返回临时页面标识和安全摘要 |
| `failed` / `cancelled` | 保留最后安全状态 | 不再调用工具 |

## 执行流程

1. 在 `received` 读取当前问题和最新会话检查点。首次问数创建新计划；多轮调整先定位用户明确触及的取数单元和字段，未提及状态不得重新生成。
2. 在 `discovering` 先用完整问题调用一次 `discover_data_context`，消费其 `businessDomains/resolution/time/intent/structureOperation`；只对仍未解析的最小业务词补充调用。同轮所有结果必须共用一个 `dataContextVersion`，变化时整轮重新发现。
3. 在 `routing` 使用 `businessDomains` 作为闭集，作出 `route_business_domains` 并用 `validate_route_decision` 验真：优先采用已验真的用户明确指定；多轮调整沿用已有业务域；否则选择最多两个。向用户展示有效业务域。旧域零命中且用户未覆盖时，才使用同版本全域候选重路由。
4. `resolution.ambiguities` 非空时进入 `awaiting_user`，并列展示候选及口径差异。收到的选择必须精确命中候选内的 `businessDomain + canonicalName`；空确认继续等待，面外选择返回 `SCOPE_SELECTION_INVALID`，取消则进入 `cancelled`。
5. 在 `planning` 作出 `submit_data_request_units`，先用结构意图闸防止空操作被当成成功，再由 Agent Core 归一化并应用定向 `add/modify/replace/remove`。未触及 entry 必须保持原对象和原业务状态。
6. 将可执行单元、`gaps` 与 `out_of_scope` 分区。有可执行单元时继续交付部分答案，缺口单独等待确认；无可执行单元时不调用 DQE。只有用户明确确认才发出带稳定幂等键的 `metric_gap_recorded`。
7. 展示取数核对。非阻塞场景用紧凑要素展示后继续；存在歧义、formula 临时指标、模型补出的时间或平台声明的成本阈值时进入 `awaiting_user`。确认只作用于对应取数单元。
8. 只对新增、`intent` 为空或用户明确要改意图的单元分别作出 `submit_analysis_intent`，使用该单元标题而非整句问题作为输入；失败两次后使用形状降级。其他已有意图保持不变。解析显式组件或解除 pin 语义，未触及单元保留原 pin。
9. 用当前 `dataContextVersion`、稳定 `dataSourceId` 和最多六个单元形成 Page Build Spec。若 `droppedAdds > 0`，必须先说明未执行的视角和后续补充方式。
10. 在 `composing` 调用一次 `compose_page`。若返回 `retrySafe: true`，可用完全相同的参数重试一次；当前仅 `DQE_TRANSPORT_ERROR` 和 `DQE_TIMEOUT` 安全。若封闭名称被拒绝且 issue 含 `candidates`，只允许依候选定向修正一次。`retrySafe: false` 或未知错误不得自动重试。
11. 仅当 Relay 返回 `status: page_composed`，且同时包含 `pageId`、`artifactId`、`checkpointVersion`、`documentSha256`、`dataContextVersion` 和 `bundleVersion` 时进入 `page_composed`。告知用户临时页面态已就绪，另行说明 `gaps/droppedAdds`，不声称已创建页面修订。

## 持久化与安全

- 仅通过 Relay Interface 使用 `compose_page`。Page Artifact Adapter 将完整页面构建产物保存为最新会话检查点，仅将 `modelSummary` 返回模型。
- 正式页面持久化只由平台响应用户显式发起的沉淀。禁止调用 Java 页面保存 Interface，也不得声称已经创建页面修订。
- 进入交互等待或收到取消后立即取消在途 Tool task。生产 Data Context/DQE Adapter 使用可取消的 async HTTP；迟到结果只能丢弃或标记为已取消，不能覆盖更新的会话检查点。
- 失败时展示结构化 `code`、`path`、`stage`、`message` 和 `retrySafe`，同时报告最后一个 `completedStages`；存在时传递闭集 `candidates`。保留未解析的用户原文，只使用可追溯的受治理名称、执行结果和页面元数据。
