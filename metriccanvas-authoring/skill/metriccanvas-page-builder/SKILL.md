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

`route_business_domains`、`submit_data_request_units` 和 `submit_analysis_intent` 是三类模型决策名称，不是 MCP 工具。Relay 完成分词与模型调用；模型从用户问题提取待检索业务词并形成这些结构化决策。DQE 调用、查询生成、结果字段验真和页面装配全部封装在 `compose_page` 内，不向模型注册独立工具。

当前 M3A 由 Skill ReAct 驱动以下状态机，Relay 尚未提供固定工作流执行器；三类模型决策 Schema 用于迁移差分和结构约束，运行时硬闸集中在最终 Page Build Spec、数据上下文、DQE 结果和页面校验。M3B 完成前，不得把“遵循了 Markdown 步骤”当作固定编排已经兑现。

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

对每个尚未解析的业务词分别调用；不要把整段问题重复传入，也不要传 SQL、DQE DSL 或页面 JSON。

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
- `matches`：受治理候选；后续只使用其中返回的规范名、定义、业务域和能力信息。
- `issues[]`：失败的 `code`、`path`、`stage` 和 `message`。

同一轮所有发现结果必须使用一致的 `dataContextVersion`；版本变化时废弃旧候选并重新发现。
如果误将整句问题传入，Tool 会使用确定性指标/维度/时间词解析做一次兜底拆解；
该兜底只返回受治理候选，不代替上述三个模型决策。

### `compose_page`

发现、消歧、取数核对和分析意图决策完成后，正常路径只调用一次。`page_id` 取自 `config.agent_context.pageId`；缺失时要求平台分配临时页面 id，不自行冒充正式页面 id。

```json
{
  "page_id": "transient-tokens-by-region",
  "spec": {
    "question": "上个月各区域的 Tokens 请求量是多少？",
    "description": "区域 Tokens 请求量对比",
    "units": [
      {
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

- 顶层只包含 `question`、可选 `description`、可选 `baseRevision` 和 `units`。
- `units` 包含 1–6 个取数单元；每个单元明确 `businessDomain`、`metrics`、`groupBy`、`filters`、`time` 和 `intent`。
- 指标、维度和筛选值只使用 `discover_data_context` 返回的受治理名称；临时指标使用 `kind=formula` 并保留用户确认的公式与说明。
- `intent` 只能是 `comparison`、`trend`、`composition`、`ranking`、`detail` 或 `single_value`。
- 只描述业务语义，不传 DQE 查询、结果字段契约、组件 JSON、布局或页面协议版本。

原始 MCP 成功结果包含 `ok`、`completedStages`、`artifactEnvelope` 和 `issues`。Relay Page Artifact Adapter 必须保存 `artifactEnvelope.artifact`，再将模型可见结果替换为 `modelSummary + artifactId + checkpointVersion`。如果模型直接看到 `artifactEnvelope.artifact`、页面 `document` 或数据 `rows`，立即停止且不复述内容，并报告 Relay Adapter 未生效。

## 状态

以当前业务问题和 `config.agent_context` 中的最新结构化会话检查点为输入。保留每个未触及取数单元的显式筛选、时间范围、组件钉住结果和目标绑定；每轮最多保留六个取数单元。

按以下状态推进，每次只进入一个状态：

| 状态 | 动作 | 退出条件 |
|---|---|---|
| `received` | 读取问题、`pageId` 和最新会话检查点 | 区分首次问数与多轮调整 |
| `routing` | 作出业务域模型决策 | 得到 1–2 个受治理业务域 |
| `discovering` | 拆分业务词并调用发现工具 | 每个业务词已解析、歧义或确认不可用 |
| `awaiting_user` | 展示消歧或阻塞式取数核对 | 收到精确选择、修正或取消 |
| `planning` | 形成或定向修改取数单元与分析意图 | 完整 Page Build Spec 可提交 |
| `composing` | 调用一次 `compose_page` | 收到成功摘要或结构化失败 |
| `page_composed` | Relay 已保存最新会话检查点 | 返回临时页面标识和安全摘要 |
| `failed` / `cancelled` | 保留最后安全状态 | 不再调用工具 |

## 执行流程

1. 在 `received` 读取当前问题和最新会话检查点。首次问数创建新计划；多轮调整先定位用户明确触及的取数单元和字段，未提及状态不得重新生成。
2. 在 `routing` 作出 `route_business_domains`：优先采用用户明确指定的业务域；多轮调整沿用已有业务域；否则从平台提供的业务域中选择最多两个。向用户展示有效业务域。
3. 在 `discovering` 将问题拆成指标、维度、筛选值和时间能力等最小业务词，对每个未解析词调用 `discover_data_context`。记录规范名、定义、业务域和 `dataContextVersion`。
4. 对同分候选进入 `awaiting_user`，并列展示候选及口径差异。收到选择后只替换对应业务词；收到取消后进入 `cancelled`。
5. 在 `planning` 作出 `submit_data_request_units`：首次创建取数单元，多轮调整输出定向 `add`、`modify`、`replace` 或 `remove`。分别表达可执行单元、部分可回答内容与不可用概念。
6. 展示取数核对。非阻塞场景用紧凑要素展示后继续；存在歧义、临时指标、模型补出的时间或平台声明的成本阈值时进入 `awaiting_user`。确认只作用于对应取数单元。
7. 对每个被触及的取数单元分别作出 `submit_analysis_intent`；未触及单元保留原分析意图与组件钉住结果。合并得到完整 Page Build Spec。
8. 在 `composing` 调用一次 `compose_page`。仅对 `DQE_TRANSPORT_ERROR` 使用完全相同的参数重试一次；若封闭名称被拒绝，只依据返回候选修正一次后重新提交。其他失败进入 `failed`。
9. 仅当 Relay 返回 `status: page_composed`，且同时包含 `pageId`、`artifactId`、`checkpointVersion`、`documentSha256`、`dataContextVersion` 和 `bundleVersion` 时进入 `page_composed`。告知用户临时页面态已就绪，不声称已创建页面修订。

## 持久化与安全

- 仅通过 Relay Interface 使用 `compose_page`。Page Artifact Adapter 将完整页面构建产物保存为最新会话检查点，仅将 `modelSummary` 返回模型。
- 正式页面持久化只由平台响应用户显式发起的沉淀。禁止调用 Java 页面保存 Interface，也不得声称已经创建页面修订。
- 进入交互等待或收到取消后立即停止。迟到结果只能丢弃或标记为已取消，不能覆盖更新的会话检查点。
- 失败时展示结构化 `code`、`path`、`stage` 和 `message`，同时报告最后一个 `completedStages`。保留未解析的用户原文，只使用可追溯的受治理名称、执行结果和页面元数据。
