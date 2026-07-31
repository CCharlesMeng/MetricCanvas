# 看板页面 Schema v3 全面迁移设计

> 日期：2026-07-31
> 状态：已确认
> 范围：一次性破坏性升级，不保留旧结构化查询兼容层

## 1. 目标

把当前同时存在的两套动态页面数据模型收敛为 `schemaVersion: "3.0"`：

- 保留 `inline` 页面数据源，继续承载随看板页面固化的静态数据；
- `query` 页面数据源显式内嵌查询定义、结果字段契约和查询字段映射；
- 当前只实现已经确认外部协议的 DQE 动态查询；
- 删除以 `metrics`、`dimensions`、`aggregation` 和元数据快照为基础的旧结构化查询；
- 删除指标目录、`METRIC_GAP`、指标履约及其页面搭建流程；
- Schema 元数据进入创作期的数据上下文，不成为统一运行时依赖；
- 同步迁移正式页面、页面搭建工作台、MCP、数据网关、示例、规则说明和测试。

本次不保留 1.0 或 2.0 页面运行时兼容。仓库内受治理页面全部迁移到 3.0 后，校验器直接拒绝旧版本。

## 2. 范围边界

### 2.1 本次包含

1. 页面 TypeScript 类型、JSON Schema、校验器和版本策略；
2. `inline`、DQE `query`、`mixed` 三种页面数据模式；
3. 统一运行时的字段解析、筛选绑定、查询编排和数据快照；
4. 数据网关的 DQE 执行、批量传输、响应归一化和协议错误；
5. 正式页面、内置预览、嵌入示例和仿真数据；
6. 页面搭建工作台、MCP Prompt、Resources 和工具集合；
7. 页面修订中数据上下文溯源字段；
8. README、`PAGE-METADATA.md`、架构文档和规则说明；
9. 全量自动化测试和旧术语/旧结构清理。

### 2.2 本次不包含

- SQL 查询执行器。页面协议保留 `language` 判别接缝，但在端点和请求体得到外部确认前只允许 `"dqe"`；
- 数据源依赖。集合式级联仍按 ADR-0015 挂起；
- 页面内计算表达式、脚本、JSONPath 或查询文本模板；
- 从外部生产系统同步数据上下文的连接器。首版提供正式契约、仓库示例和进程内读取能力；
- 组件视觉体系重做。此次只迁移数据契约和受影响的组件字段绑定。

## 3. 页面协议

### 3.1 版本与顶层结构

页面顶层仍只允许：

```jsonc
{
  "schemaVersion": "3.0",
  "id": "page-id",
  "meta": {
    "description": "资产说明，不参与渲染"
  },
  "dataSources": {},
  "filters": [],
  "sections": []
}
```

`schemaVersion` 只接受 `"3.0"`。不提供运行时迁移或 N-1 读取；旧资产通过一次性仓库迁移完成升级。

### 3.2 统一结果字段契约

`inline` 和 `query` 都显式声明结果字段契约。字段角色统一使用领域词汇表中的 `dimension` 和 `measure`，删除旧的 `metric` 角色。

每个字段包含：

| 字段 | 必填 | 规则 |
|---|---|---|
| `type` | 是 | `string` / `number` / `boolean` / `date` / `datetime` |
| `role` | 是 | `dimension` / `measure` |
| `label` | 否 | 面向使用者的默认名称，必须为非空字符串 |
| `unit` | 否 | 业务单位，不参与计算 |
| `nullable` | 否 | 是否允许空值；省略时按 `true` 处理 |
| `defaultFormat` | 否 | 受治理的展示建议；组件字段绑定中的 `format` 始终优先 |

`query` 字段还必须声明：

| 字段 | 必填 | 规则 |
|---|---|---|
| `queryField` | 是 | 外部查询响应中的字段名；同一页面数据源内唯一 |

页面字段 id 是组件、筛选状态和数据快照使用的稳定名称；`queryField` 只用于数据网关的外部响应归一化。两者不得隐式同名匹配。

### 3.3 `inline` 页面数据源

```json
{
  "fields": {
    "region": {
      "type": "string",
      "role": "dimension",
      "label": "区域",
      "nullable": false
    },
    "revenue": {
      "type": "number",
      "role": "measure",
      "label": "收入",
      "unit": "元",
      "defaultFormat": "number-grouped",
      "nullable": false
    }
  },
  "source": {
    "type": "inline",
    "rows": [
      { "region": "华东", "revenue": 128600 }
    ]
  }
}
```

规则：

- 至少声明一个字段；
- 每行键集合必须与 `fields` 完全一致；
- 非空字段不得接收 `null`；
- 值必须符合声明的标量类型；
- 纯 `inline` 页面禁止筛选状态、组件 action 和远程分页；
- `mixed` 页面中，只绑定 `inline` 页面数据源的组件仍保持静态能力。

### 3.4 DQE `query` 页面数据源

```json
{
  "fields": {
    "customer-level": {
      "queryField": "客户级别",
      "type": "string",
      "role": "dimension",
      "label": "客户级别",
      "nullable": false
    },
    "customer-count": {
      "queryField": "NA客户数",
      "type": "number",
      "role": "measure",
      "label": "NA客户数",
      "unit": "个",
      "defaultFormat": "number-grouped",
      "nullable": false
    }
  },
  "source": {
    "type": "query",
    "query": {
      "language": "dqe",
      "body": {
        "dsl_list": [
          {
            "output_dims": ["客户级别"],
            "output_metrics": ["NA客户数"],
            "filter": {
              "dims": [],
              "metrics": []
            },
            "order": {}
          }
        ]
      },
      "filterBindings": {
        "customer-level-filter": {
          "target": "dimension",
          "queryField": "客户级别"
        }
      }
    }
  }
}
```

规则：

- 一个页面数据源表示一个命名数据集，因此 `body.dsl_list` 恰好包含一个查询项；
- `language` 当前只允许 `"dqe"`；
- `body` 保存外部 DQE 协议的原始请求体，页面协议不改写其字段名称；
- `fields[].queryField` 必须一一覆盖 DQE 输出维度、输出度量字段及公式别名；
- 多个页面字段不得映射到同一个 `queryField`；
- DQE 输出不得依靠某次返回行推断字段契约；
- 页面筛选状态只有通过 `filterBindings` 才能影响查询；
- `filterBindings` 的键必须引用页面已声明筛选器，值只能指向受支持的 DQE 维度或时间语义位置；
- 禁止 JSONPath、字符串模板、自动同名绑定和表达式；
- DQE 传输可在数据网关内部批量合并，但页面不声明批次；
- `dsl_list[i]` 与 `results[i]` 必须保持稳定位置对应；返回项数不一致时拒绝整批结果。

### 3.5 组件字段绑定

组件继续只通过命名数据槽引用页面数据源，并只使用稳定页面字段 id：

```json
{
  "data": { "main": "customer-overview" },
  "props": {
    "rows": [
      {
        "label": "NA客户数",
        "valueField": {
          "data": "main",
          "field": "customer-count",
          "format": "number-grouped"
        }
      }
    ]
  }
}
```

字段展示格式优先级为：

1. 组件字段绑定的 `format`；
2. 结果字段契约的 `defaultFormat`；
3. 字段类型的基础格式。

组件类型 `metricCard` 暂时保留为既有技术标识；它不表示旧模型中的指标资产。字段角色和领域说明统一使用“度量字段”。

## 4. Schema 元数据与数据上下文

Schema 元数据是数据上下文快照的一部分，只在 NL2SQL/NL2DQE 创作期使用。它不进入页面文档，不参与统一运行时渲染，也不包含业务数据行。

首版数据上下文契约包含：

- 快照 id、格式版本、生成时间和来源；
- 可访问执行环境；
- Schema、实体或 DQE 对象；
- 字段名称、类型、说明、别名、单位、是否可空和可用角色；
- 关系、连接约束、时间字段和粒度；
- 权限、安全与资源限制；
- 已验证问题—查询示例及其结果字段契约。

仓库提供：

1. 可机器校验的数据上下文 JSON Schema；
2. 不含业务数据行的 DQE Schema 元数据示例；
3. 面向页面作者和 Agent 的字段规则说明；
4. 进程内搜索接口，按名称、说明和别名检索数据源、对象、字段及已验证查询。

该接口取代 `search_catalog`。命名使用领域术语“数据上下文”，不再使用“指标目录”或旧的“元数据快照”。

## 5. 模块迁移

### 5.1 `packages/page`

- `versionPolicy.current` 改为 `3.0`，支持版本只保留 `3.0`；
- `PageQuery` 收敛为 DQE 查询定义；
- 删除 `StructuredQuery`、`EffectiveQuery.metrics`、`dimensions`、`aggregation`、`granularity`、`orderBy` 和旧时间窗口；
- 删除 `CatalogSnapshot`、`CatalogMetric`、`CatalogDimension`、`fieldOverrides` 和旧字段 `format`；
- 字段角色由 `metric` 改为 `measure`；
- `resolveDataSourceFields` 只解析页面显式字段，不接收目录参数；
- 校验器删除目录语义校验，新增结果字段契约、DQE 输出覆盖和筛选绑定校验；
- 迁移 CLI 不再作为运行时兼容机制；如保留，只用于此次仓库内一次性迁移并在完成后删除。

### 5.2 统一运行时

- `inline` 页面数据源同步形成终态数据快照；
- DQE `query` 页面数据源由查询定义、结果字段契约和当前筛选状态形成生效查询；
- 生效查询不再包含指标、维度或聚合概念；
- 能力推导继续区分 `inline`、`query` 和 `mixed`；
- 只让绑定相关筛选器的 DQE 页面数据源重新执行；
- 组件仍不感知查询来源。

### 5.3 数据网关与仿真

- 数据网关端口接收判别式查询执行请求，当前实现 DQE 分支；
- 删除基于指标目录的 mock 和 GraphQL 数据服务结构化查询适配器；
- DQE 适配器保留原始 `body` 提交、批量合并、逐项错误和显式字段归一化；
- 离线开发改用 DQE 场景 fixture gateway；静态页面不需要 gateway；
- DQE 仿真继续提供真实 HTTP 端点，扩充 fixture 以覆盖迁移后的正式动态页面；
- 删除 `sync-catalog`、仓库 `catalog/snapshot.json` 及其脚本入口。

### 5.4 页面搭建工作台与 MCP

删除：

- `search_catalog`；
- `search_metric_candidates`；
- `get_metric_status`；
- `record_metric_gap`；
- 指标选择、聚合选择、指标候选确认和指标缺口续接 UI；
- 依赖 `CatalogSnapshot` 的页面插入、编辑与预览逻辑。

新增或改造：

- `search_data_context`：检索 Schema、字段、关系、执行约束和已验证查询；
- 页面 Schema Resource；
- `inline` 最小示例 Resource；
- DQE `query` 最小示例 Resource；
- 页面规则 Resource；
- 数据上下文 Schema 与示例 Resource；
- 页面生成 Prompt 改为“确认需求 → 检索数据上下文或选择 inline → 生成查询定义和结果字段契约 → 校验 → 保存 → 精确修订预览 → 人工发布”；
- `validate_page` 不再返回 `metadataVersion`，改为返回当前 `schemaVersion` 和结构化错误；
- 页面修订把旧 `metadataVersion` 改为可空 `dataContextVersion`。纯 `inline` 页面为 `null`，DQE 页面记录创作时使用的数据上下文快照版本。

### 5.5 正式资产

- `pages/tokens-report.json` 保持 `inline`，升级到 v3 字段契约；
- 已使用 raw DQE 的页面数据源升级字段角色和字段契约；
- 其余旧动态页面数据源改写为 DQE，并为离线/仿真链路补齐对应 fixture；
- 所有页面、模板来源修订、内置预览和嵌入示例只使用 v3；
- 不通过把动态页面静默改成静态页面来规避查询迁移。

## 6. 数据流

### 6.1 静态页面

```text
v3 看板页面
  → inline 页面数据源
  → 字段与数据行校验
  → 终态数据快照
  → 组件数据槽
  → 纯渲染组件
```

### 6.2 DQE 动态页面

```text
创作期数据上下文
  → DQE 查询定义 + 结果字段契约
  → v3 看板页面
  → 筛选状态按 filterBindings 形成生效查询
  → 数据网关 DQE 适配器
  → DQE 服务 / DQE 仿真
  → results 按位置分发
  → queryField 显式归一为页面字段 id
  → 数据快照
  → 纯渲染组件
```

Schema 元数据只出现在第一段创作期，不进入运行态链路。

## 7. 错误处理

所有错误继续使用结构化路径和稳定错误 code：

| 错误类别 | 典型情形 | 处理 |
|---|---|---|
| `SCHEMA_ERROR` | 旧版本、旧查询字段、字段角色错误、未知属性 | 拒绝校验和保存 |
| `FIELD_CONTRACT_ERROR` | 行值类型错误、非空字段为空、组件引用不存在 | 修正页面字段契约或绑定 |
| `QUERY_MAPPING_ERROR` | DQE 输出未覆盖、重复 `queryField`、公式别名缺失 | 修正结果字段契约 |
| `FILTER_BINDING_ERROR` | 筛选器不存在、目标不受支持、字段映射悬空 | 修正显式筛选绑定 |
| `DQE_PROTOCOL_ERROR` | 批量响应数量不一致、响应项形态错误 | 拒绝整批并保留逐项上下文 |
| `DQE_EXECUTION_ERROR` | 外部执行失败或单项错误 | 对受影响页面数据源产生错误数据快照 |
| `DATA_CONTEXT_ERROR` | 创作期 Schema 元数据不足或不一致 | 阻断查询生成，不创建指标缺口 |

不再产生 `METRIC_GAP`。

## 8. 验收与测试

### 8.1 契约测试

- v3 `inline`、DQE `query` 和 `mixed` 合法示例通过；
- v1/v2、`metrics`、`dimensions`、`aggregation`、`fieldOverrides`、`role: "metric"` 被拒绝；
- `nullable`、标量类型、未知字段和额外属性得到精确 JSON Pointer；
- DQE 输出字段、公式别名、唯一映射和筛选绑定均有正反用例。

### 8.2 运行时与数据网关测试

- `inline` 不调用数据网关；
- DQE 查询原始请求体保持不变；
- 筛选绑定只修改受控 DQE 语义位置；
- 多个页面数据源可透明批量合并并稳定拆分；
- 部分失败、批次错位、空结果和取消竞态行为确定；
- 结果键只通过 `queryField` 显式归一。

### 8.3 产品链路测试

- 正式页面全量 `pnpm validate` 通过；
- 页面搭建 Agent 只发现新工具和新 Resources；
- 最小 `inline` 与 DQE 页面可校验、保存、预览和形成页面修订；
- `dataContextVersion` 在 DQE 页面修订中可追溯，纯静态页面为 `null`；
- DQE 仿真覆盖正式动态页面；
- Canvas、嵌入式统一运行时和平台工作台均可构建。

### 8.4 仓库清理检查

在非历史 ADR 和明确迁移说明中，不再出现：

- `StructuredQuery`；
- `CatalogSnapshot`；
- `search_catalog`；
- `METRIC_GAP`；
- `fieldOverrides`；
- `query.metrics` / `query.dimensions`；
- 页面字段 `role: "metric"`；
- `schemaVersion: "1.0"` 或 `"2.0"`。

历史 ADR 保持不可改写，只通过新 ADR 说明被取代关系。

### 8.5 完成命令

至少运行：

```bash
pnpm validate
pnpm test
pnpm typecheck
pnpm check
pnpm build
```

DQE 场景另运行仿真链路和相关端到端/浏览器测试。

## 9. 实施顺序

1. 建立 v3 字段、页面数据源、查询和数据上下文契约；
2. 重写校验器与核心测试，使旧结构立即变红；
3. 迁移统一运行时和数据网关；
4. 迁移正式页面、fixture、DQE 仿真和嵌入示例；
5. 迁移页面生命周期溯源字段；
6. 替换页面搭建工作台和 MCP 旧指标流程；
7. 删除旧目录、指标履约、同步脚本与无引用代码；
8. 更新 README、`PAGE-METADATA.md`、架构文档和 MCP Resources；
9. 执行全量验证与旧结构扫描。

每一步都以可运行的纵向链路为验收点，不在主分支留下同时可创作两套查询模型的中间状态。

## 10. 决策摘要

- 页面协议升级为 3.0，旧版本不兼容；
- 静态 `inline` 场景完整保留；
- 动态 `query` 当前只实现 DQE，但协议保留语言判别接缝；
- 结果字段契约由页面显式声明，字段角色使用 `dimension` / `measure`；
- Schema 元数据属于创作期数据上下文，不属于运行时目录；
- 指标目录、元数据快照、指标缺口和指标履约链路全部删除；
- 所有正式资产和工具一次性迁移，不保留适配器或隐藏兼容层。
