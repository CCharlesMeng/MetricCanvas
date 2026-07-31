# 看板页面文档说明

> 当前协议：领域 DSL `schemaVersion: "3.0"`
> 兼容策略：1.0/2.0 已退出，不提供运行时兼容

本文是统一运行时直接消费的**看板页面**说明。日常交流中的“页面元数据”指整份声明式页面文档，不是创作期的数据上下文或 Schema 元数据。

实现真源依次是：

1. `packages/page/src/schema.ts`：JSON Schema 结构契约；
2. `packages/page/src/validate.ts`：引用、字段契约和能力不变式；
3. `packages/page/src/page.ts`：组件、数据槽和 action 类型；
4. 本文：面向页面作者和 Agent 的规则与示例。

若说明与实现不一致，以前三项和 `pnpm validate` 的结果为准。

## 顶层结构

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

| 字段 | 必填 | 职责 |
|---|---|---|
| `schemaVersion` | 是 | 页面文档契约版本，固定为 `"3.0"` |
| `id` | 是 | 看板页面的稳定身份；正式文件名必须为 `<id>.json` |
| `meta` | 否 | 页面资产说明，当前只允许 `description` |
| `dataSources` | 是 | 命名页面数据源 |
| `filters` | 否 | 页面级筛选状态 |
| `sections` | 是 | 按顺序组织的内容分区 |

页面、分区、组件和页面数据源 id 使用小写字母、数字和连字符。字段 id 可使用大小写字母、数字、下划线和连字符，但首字符必须为字母或下划线。

协议默认拒绝未定义属性。拼写错误不会被静默忽略。

## 三种数据模式

| 模式 | 页面数据源组成 | 运行行为 |
|---|---|---|
| `inline` | 全部为静态页面数据源 | 数据随页面固化，不调用数据网关 |
| `query` | 全部为动态页面数据源 | 当前通过 DQE 动态执行 |
| `mixed` | 同时包含两类页面数据源 | 各组件按实际绑定来源获得能力 |

DQE 只是当前 `query` 页面数据源已实现的执行场景。保留 `inline` 并不表示兼容旧模型，而是保留正式的静态数据场景。

## 结果字段契约

所有页面数据源都完整声明结果字段契约。组件、筛选状态和数据快照只引用稳定页面字段 id。

### 通用字段

```json
{
  "revenue": {
    "type": "number",
    "role": "measure",
    "label": "收入",
    "unit": "元",
    "nullable": false,
    "defaultFormat": "number-grouped"
  }
}
```

| 字段 | 必填 | 含义 | 允许值或约束 |
|---|---|---|---|
| `type` | 是 | 原始标量类型 | `string` / `number` / `boolean` / `date` / `datetime` |
| `role` | 是 | 分析语义角色 | `dimension` / `measure` |
| `label` | 否 | 默认展示名称 | 非空字符串 |
| `unit` | 否 | 业务单位 | 非空字符串，不参与计算 |
| `nullable` | 否 | 是否允许 `null` | 布尔值；省略时按 `true` |
| `defaultFormat` | 否 | 默认展示建议 | 平台登记的格式预设 |

`dimension` 用于类别、时间、分组、筛选或排序；`measure` 用于数值、比例、计数和其他可比较结果。v3 不再允许 `role: "metric"`。

### 展示格式优先级

1. 组件字段绑定的 `format`；
2. 结果字段契约的 `defaultFormat`；
3. 字段类型的基础格式。

展示格式不改变字段值、查询语义或业务单位。

## `inline` 页面数据源

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
      {
        "region": "华东",
        "revenue": 128600
      }
    ]
  }
}
```

规则：

- `fields` 至少包含一个字段；
- `source.type` 固定为 `"inline"`；
- `source.rows` 必须是数组；
- 每行键集合必须与 `fields` 完全一致；
- 每个值必须符合字段 `type`；
- `nullable: false` 的字段不得为 `null`；
- 复杂对象和数组不是合法字段值；
- 纯 `inline` 页面不得声明 `filters`、组件 action 或远程分页。

`inline` 适用于固定时点报告、离线交付、说明性数据和确定性视觉验收。更新数据需要形成新的页面修订。

## DQE `query` 页面数据源

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
            "output_dims": [
              "客户级别"
            ],
            "output_metrics": [
              "NA客户数"
            ],
            "filter": {
              "dims": [],
              "metrics": []
            },
            "order": {}
          }
        ]
      }
    }
  }
}
```

### 外层字段

| 字段 | 必填 | 规则 |
|---|---|---|
| `fields` | 是 | 完整结果字段契约；每项额外声明 `queryField` |
| `source.type` | 是 | 固定为 `"query"` |
| `source.query.language` | 是 | 当前固定为 `"dqe"` |
| `source.query.body` | 是 | 外部 DQE 协议原始请求体 |
| `source.query.filterBindings` | 否 | 页面筛选器到 DQE 语义位置的显式映射 |

### 查询字段映射

`queryField` 把页面字段 id 显式映射到 DQE 响应键：

```text
页面字段 customer-count
  ← queryField: "NA客户数"
  ← DQE 响应 { "NA客户数": 15 }
```

规则：

- 每个 `query` 字段必须声明非空 `queryField`；
- 同一页面数据源内 `queryField` 唯一；
- DQE 的 `output_dims`、`output_metrics` 和公式 `alias` 必须被一一覆盖；
- 页面字段 id 与 `queryField` 即使文本相同，也必须显式声明；
- 多余映射、遗漏映射和重复映射都属于 `QUERY_MAPPING_ERROR`；
- 组件永远只引用页面字段 id，不直接引用 DQE 字段名。

### 查询定义

- 一个页面数据源表示一个命名数据集，因此 `body.dsl_list` 恰好包含一个查询项；
- `body` 保留外部 DQE 协议形态，页面协议不重命名内部字段；
- 统一运行时不执行 NL2DQE，也不根据数据行改写查询；
- 数据网关可以把同一调度窗口内的多个逻辑查询透明合并为一次 DQE 批量请求；
- 批量响应必须保持 `dsl_list[i]` 与 `results[i]` 的位置对应；
- 返回项数量不一致时拒绝整批结果，不猜测对应关系。

当前页面 Schema 不声明 SQL 请求体。将来只有在 SQL 端点和请求协议得到确认后，才通过新的 `language` 分支扩展。

## 筛选状态与筛选绑定

页面筛选器写入共享筛选状态。DQE 查询只有声明 `filterBindings` 才响应对应筛选器。

### 维度筛选

```json
{
  "filters": [
    {
      "id": "region-filter",
      "type": "dimension",
      "dimension": "region",
      "label": "区域",
      "display": "select",
      "default": [
        "中国地区部"
      ]
    }
  ],
  "dataSources": {
    "overview": {
      "fields": {
        "region": {
          "queryField": "地区部",
          "type": "string",
          "role": "dimension"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "language": "dqe",
          "body": {
            "dsl_list": [
              {
                "output_dims": [
                  "地区部"
                ],
                "output_metrics": [],
                "filter": {
                  "dims": [],
                  "metrics": []
                },
                "order": {}
              }
            ]
          },
          "filterBindings": {
            "region-filter": {
              "target": "dimension",
              "queryField": "地区部"
            }
          }
        }
      }
    }
  }
}
```

维度绑定：

```json
{
  "target": "dimension",
  "queryField": "地区部"
}
```

时间绑定：

```json
{
  "target": "time"
}
```

规则：

- `filterBindings` 的键必须引用页面已声明筛选器；
- `dimension` 目标必须声明 DQE `queryField`；
- 页面筛选器类型必须与绑定目标兼容；
- 没有绑定的页面数据源不会因该筛选状态改变而重新执行；
- 禁止 JSONPath、字符串模板、表达式和字段同名推断；
- 筛选绑定不改变结果字段契约。

## 内容分区、组件与数据槽

内容位于 `sections[].components`。分区使用固定 12 列自动流网格：

```json
{
  "id": "overview",
  "title": "经营概览",
  "layout": {
    "type": "grid",
    "columns": 12
  },
  "components": []
}
```

组件通用骨架：

```json
{
  "id": "revenue-chart",
  "type": "barChart",
  "layout": {
    "span": 12
  },
  "data": {
    "main": "by-region"
  },
  "props": {}
}
```

| 字段 | 必填 | 规则 |
|---|---|---|
| `id` | 是 | 全页唯一 |
| `type` | 是 | 受治理组件目录中的类型 |
| `layout.span` | 是 | 1–12 的整数 |
| `data` | 数据组件必填 | 命名数据槽到页面数据源的绑定 |
| `props` | 是 | 由组件类型决定，拒绝未知属性 |

组件类型包括：

- `reportHeader`
- `metricCard`
- `barChart`
- `lineChart`
- `pieChart`
- `table`
- `mapChart`
- `rankingCard`
- `text`

`metricCard` 是组件技术标识。字段角色仍使用 `measure`，不要据此恢复指标目录。

## 组件字段绑定

字符串简写引用 `main` 数据槽：

```json
{
  "categoryField": "region"
}
```

对象形式可指定数据槽、展示格式和标量行匹配：

```json
{
  "valueField": {
    "data": "main",
    "field": "customer-count",
    "format": "number-grouped",
    "match": {
      "field": "customer-level",
      "equals": "卓越NA"
    }
  }
}
```

规则：

- `data` 必须是组件已绑定的数据槽；
- `field` 和 `match.field` 必须存在于对应页面数据源；
- 图表类别轴通常绑定 `dimension`；
- 图表数值系列和值字段通常绑定 `measure`；
- `format` 只影响当前视图；
- 组件不得携带查询定义、数据行、网络请求或任意代码。

## action 与跨页下钻

页内联动通过 `writeFilter` 回写筛选状态：

```json
{
  "on": "click",
  "writeFilter": "region-filter",
  "field": {
    "data": "main",
    "field": "region"
  }
}
```

跨页下钻通过 `navigate`：

```json
{
  "on": "click",
  "navigate": {
    "page": "sales-detail",
    "carryFilters": [
      "date-filter"
    ],
    "setFilters": {
      "region-filter": {
        "data": "main",
        "field": "region"
      }
    }
  }
}
```

action 只允许绑定动态 `query` 页面数据源的组件。纯 `inline` 页面不提供看似可交互但数据不会变化的假联动。

## `mixed` 页面

`mixed` 页面同时包含 `inline` 和 `query` 页面数据源：

- `inline` 组件同步得到终态数据快照；
- `query` 组件经数据网关取得动态数据；
- 能力按组件实际绑定的数据源推导；
- 只绑定 `inline` 的组件不会因为同页存在 DQE 查询而获得筛选或 action 能力；
- 组件复用同一字段绑定模型，不感知来源。

## Schema 元数据的边界

Schema 元数据属于创作期的数据上下文，描述数据源、对象、字段、关系、权限、执行约束和已验证查询。它帮助 Agent 生成 DQE 查询定义，但：

- 不进入看板页面；
- 不提供业务数据行；
- 不替代结果字段契约；
- 不参与统一运行时渲染；
- 不允许组件直接查询。

详细规则和完整示例见 [docs/schema-metadata.md](./docs/schema-metadata.md)。

## 校验与错误

保存前运行：

```bash
pnpm validate
```

主要错误类别：

| code | 含义 |
|---|---|
| `SCHEMA_ERROR` | JSON Schema、版本或未知属性错误 |
| `FIELD_CONTRACT_ERROR` | 数据行、字段类型、空值或字段引用错误 |
| `QUERY_MAPPING_ERROR` | DQE 输出与查询字段映射错误 |
| `FILTER_BINDING_ERROR` | 筛选引用或目标语义错误 |
| `DQE_PROTOCOL_ERROR` | DQE 请求/响应位置或形态错误 |
| `DATA_CONTEXT_ERROR` | 创作期 Schema 元数据不足或不一致 |

v3 不再产生 `METRIC_GAP`。

## 从旧页面迁移

迁移是一次性破坏性升级，不提供长期兼容：

| 旧结构 | v3 |
|---|---|
| `schemaVersion: "1.0"` / `"2.0"` | `"3.0"` |
| `query.metrics` | DQE `body` + 显式结果字段契约 |
| `query.dimensions` | DQE `body` + `fields[].role: "dimension"` |
| `aggregation` / `granularity` | DQE 查询定义自身表达 |
| `fieldOverrides` | 完整 `fields` |
| `role: "metric"` | `role: "measure"` |
| 目录推导字段类型与名称 | 页面显式结果字段契约 |
| 元数据快照运行时依赖 | 创作期数据上下文 |
| `METRIC_GAP` | `DATA_CONTEXT_ERROR` 或查询校验/执行错误 |

不要用适配器、默认值或隐式同名继续接受旧文档。仓库内页面必须完整迁移后再进入 v3 基线。

## 关键不变式

1. 看板页面只描述页面结构、查询定义、结果字段契约和有限交互；
2. `inline` 与 DQE `query` 都显式声明结果字段契约；
3. 统一运行时不执行 NL2DQE；
4. 组件只通过数据槽消费数据快照；
5. 页面字段 id 与 DQE 响应字段只通过 `queryField` 显式映射；
6. 筛选状态只通过 `filterBindings` 影响查询；
7. 页面不携带脚本、HTML、CSS、表达式或页面层计算；
8. DQE 批量传输是数据网关优化，不是页面概念；
9. Schema 元数据只属于创作期；
10. 页面修订和查询定义发生变化时必须重新校验、预览和发布。
