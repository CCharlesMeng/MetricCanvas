# 看板页面元数据描述

> 当前可执行基线：领域 DSL `schemaVersion: "1.0"`

本文描述统一运行时直接消费的**看板页面**文档，并用三个递进维度说明从固定内容到动态联动的元数据如何声明。

这里的“页面元数据”指声明式页面文档整体，不是 `catalog/snapshot.json` 中的**元数据快照**。顶层 `meta` 也只是看板页面的资产说明，不参与渲染；可见标题应由 `reportHeader` 组件声明。

实现的唯一真源依次是：

- [`packages/page/src/schema.ts`](./packages/page/src/schema.ts)：JSON Schema 结构契约。
- [`packages/page/src/validate.ts`](./packages/page/src/validate.ts)：引用、能力和元数据语义不变式。
- [`packages/page/src/page.ts`](./packages/page/src/page.ts)：组件、数据槽和 action 类型。
- 本文：面向页面作者和 AI 的当前协议说明与递进示例。若本文滞后，以前三项及 `pnpm validate` 的结果为准。

## 1. 统一文档骨架

下面是结构示意，不是完整可渲染页面：

```jsonc
{
  "schemaVersion": "1.0",
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
| --- | --- | --- |
| `schemaVersion` | 是 | 页面文档契约版本，当前只支持 `"1.0"` |
| `id` | 是 | 看板页面的稳定身份；保存到 `pages/` 时文件名必须为 `<id>.json` |
| `meta` | 否 | 页面资产说明，当前仅支持 `description`，不参与渲染 |
| `dataSources` | 是 | 命名**页面数据源**；每项包含字段输出契约与 `inline` / `query` 取数声明 |
| `filters` | 否 | 声明页面级**筛选状态**；仅有 `query` 页面数据源时才有数据语义 |
| `sections` | 是 | 按顺序组织的内容分区；每个分区是固定 12 列自动流网格 |

页面、分区、组件和页面数据源 id 使用小写字母、数字和连字符，且不得重复。字段 code 可使用大小写字母、数字、下划线和连字符，但首字符必须是字母或下划线。协议默认拒绝未定义字段，因此拼写错误不会被静默忽略。

## 2. 页面数据源与字段契约

页面数据源是组件之前的数据边界：

```json
{
  "fields": {
    "gmv": {
      "type": "number",
      "role": "metric",
      "label": "成交总额",
      "format": "number-grouped"
    }
  },
  "source": {
    "type": "inline",
    "rows": [{ "gmv": 128600 }]
  }
}
```

### 2.1 `fields`

每个页面数据源至少声明一个输出字段。

| 字段 | 必填 | 允许值 |
| --- | --- | --- |
| `type` | 是 | `string` / `number` / `boolean` / `date` / `datetime` |
| `role` | 是 | `dimension` / `metric` |
| `label` | 否 | 人类可读标签 |
| `format` | 否 | `text`、`number`、`number-1`、`number-2`、`number-grouped`、`compact-wan-0`、`compact-wan-1`、`compact-yi-1`、`percent-0`、`percent-1`、`percent-2`、`percent-2-signed`、`date`、`date-month-day` |

字段契约与取数方式解耦：在字段不变的前提下，页面数据源可在 `inline` 和 `query` 之间切换，组件数据槽和字段绑定无需改动。

### 2.2 `source.type: "inline"`

- `rows` 随页面文档固化，不经数据网关，不自动刷新。
- 每行都必须与 `fields` 完整对应：不得少字段、多字段或类型不匹配；值可为 `null`。
- 只含 `inline` 页面数据源的页面是静态页面，不得声明 `filters`、组件 actions 或远程分页。

### 2.3 `source.type: "query"`

```json
{
  "type": "query",
  "query": {
    "metrics": ["gmv"],
    "dimensions": ["region"],
    "aggregation": "sum",
    "filters": { "subscribe": ["f-region"] },
    "orderBy": [{ "field": "gmv", "direction": "desc" }],
    "limit": 10
  }
}
```

| `query` 字段 | 必填 | 语义 |
| --- | --- | --- |
| `metrics` | 是 | 至少一个数据服务**指标** code |
| `dimensions` | 否 | 数据服务**维度** code |
| `aggregation` | 否 | 对本查询全部指标的聚合方式，必须受元数据快照支持 |
| `granularity` | 否 | 查询粒度 |
| `filters.subscribe` | 否 | 该页面数据源订阅的页面筛选器 id |
| `time` | 否 | 基于已订阅 `timeRange` 筛选器的 `selected` / `point` / `lookback` 时间窗口 |
| `orderBy` | 否 | 基于查询输出字段的静态排序，方向为 `asc` / `desc` |
| `limit` | 否 | 大于等于 1 的返回行数上限 |

`fields` 必须与 `query.metrics + query.dimensions` 的输出集合精确一致，且指标字段的 `role` 必须是 `metric`，维度字段的 `role` 必须是 `dimension`。指标、维度和聚合能力由元数据快照进一步做语义校验。

## 3. 内容分区、组件与数据槽

内容位于 `sections[].components`。分区只支持 `{ "type": "grid", "columns": 12 }`，组件顺序决定自动流排布，`layout.span` 声明 1–12 列的跨度。页面文档不声明 `x/y`、任意样式、HTML 或脚本。

数据组件通过 `data` 绑定命名页面数据源：

```json
{
  "data": {
    "main": "actual-source",
    "compare": "compare-source",
    "target": "target-source"
  }
}
```

- 字符串字段绑定，如 `"valueField": "gmv"`，默认引用 `main` 数据槽。
- 多源字段绑定使用 `{ "data": "target", "field": "gmv" }`。
- 结构化查询和数据行都只存在于页面数据源，不进入组件 `props`。

当前封闭组件集：

| `type` | 用途 | 主要必填 `props` |
| --- | --- | --- |
| `reportHeader` | 可见页头 | `title` |
| `metricCard` | 核心指标值 | `rows[].label`、`rows[].valueField` |
| `barChart` | 离散类别比较 | `categoryField`、`series[].field` |
| `lineChart` | 趋势 | `xField`、`series[].field` |
| `pieChart` | 占比或构成 | `categoryField`、`valueField` |
| `table` | 明细、排序、表头筛选和远程分页 | `columns[].field` |
| `mapChart` | 中国或世界地域分布 | `nameField`、`valueField`、`map` |
| `rankingCard` | Top N 排行 | `nameField`、`valueField` |
| `text` | 说明、口径提示或已确认结论 | 无 |

完整组件 props 以 [`packages/page/src/schema.ts`](./packages/page/src/schema.ts) 为准。组件是**纯渲染组件**：它们接收统一运行时解析后的数据行、字段契约和展示属性，不直接取数、不访问全局状态。

## 4. 三个递进维度

| 维度 | 页面数据源 | 筛选状态 | action | 数据网关 | 适合场景 |
| --- | --- | --- | --- | --- | --- |
| 1. 静态页面 | 全部 `inline` | 禁止 | 禁止 | 不经过 | 固定时点报告、离线交付、视觉验收 |
| 2. 动态页面 | 至少一个 `query` | 可不声明 | 可不声明 | 经过 | 打开页面时按当前数据取数 |
| 3. 有交互关联的动态页面 | `query` 订阅筛选器 | 必要 | `writeFilter` 或 `navigate` | 经过且随状态变化重查 | 筛选联动、页内下钻、跨页下钻 |

三档使用同一份页面协议，进阶点是数据来源和状态协作能力，不是切换渲染通道。

### 4.1 维度一：静态页面

静态页面把数据行固化在 `inline` 页面数据源中。统一运行时校验通过后同步产生终态**数据快照**并渲染。

```json
{
  "schemaVersion": "1.0",
  "id": "static-overview",
  "meta": {
    "description": "固定时点的成交总额报告"
  },
  "dataSources": {
    "overview": {
      "fields": {
        "gmv": {
          "type": "number",
          "role": "metric",
          "label": "成交总额",
          "format": "number-grouped"
        }
      },
      "source": {
        "type": "inline",
        "rows": [{ "gmv": 128600 }]
      }
    }
  },
  "sections": [
    {
      "id": "overview",
      "layout": { "type": "grid", "columns": 12 },
      "components": [
        {
          "id": "page-header",
          "type": "reportHeader",
          "layout": { "span": 12 },
          "props": { "title": "经营概览" }
        },
        {
          "id": "gmv-card",
          "type": "metricCard",
          "layout": { "span": 4 },
          "data": { "main": "overview" },
          "props": {
            "rows": [{ "label": "成交总额", "valueField": "gmv" }]
          }
        }
      ]
    }
  ]
}
```

关键不变式：

- 所有页面数据源都是 `inline` 时，页面才是静态页面。
- 不声明 `filters`，也不在组件 `props` 中声明 `actions`。
- 数据不会因用户操作而更新；需要更新时修改页面文档中的 `rows`。

现有完整资产可参考 [`pages/tokens-report.json`](./pages/tokens-report.json)。

### 4.2 维度二：动态页面（动态数据源）

第二档只把 `source` 升级为 `query`：统一运行时将**结构化查询**交给数据网关，并把 loading / ready / empty / error 数据快照分发给组件。此时数据是动态的，但页面可以没有筛选或 action。

```json
{
  "schemaVersion": "1.0",
  "id": "dynamic-region",
  "meta": {
    "description": "打开页面时动态查询区域成交总额"
  },
  "dataSources": {
    "by-region": {
      "fields": {
        "region": {
          "type": "string",
          "role": "dimension",
          "label": "区域",
          "format": "text"
        },
        "gmv": {
          "type": "number",
          "role": "metric",
          "label": "成交总额",
          "format": "number-grouped"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "metrics": ["gmv"],
          "dimensions": ["region"],
          "aggregation": "sum",
          "orderBy": [{ "field": "gmv", "direction": "desc" }]
        }
      }
    }
  },
  "sections": [
    {
      "id": "overview",
      "layout": { "type": "grid", "columns": 12 },
      "components": [
        {
          "id": "page-header",
          "type": "reportHeader",
          "layout": { "span": 12 },
          "props": { "title": "区域成交总额" }
        },
        {
          "id": "region-chart",
          "type": "barChart",
          "layout": { "span": 12 },
          "data": { "main": "by-region" },
          "props": {
            "title": "各区域成交总额",
            "categoryField": "region",
            "series": [{ "field": "gmv" }]
          }
        }
      ]
    }
  ]
}
```

动态链路：

```text
query 页面数据源
  → 统一运行时生成生效查询
  → 数据网关
  → 数据服务
  → 数据行
  → 数据快照
  → 组件数据槽
  → 纯渲染组件
```

### 4.3 维度三：有交互关联的动态页面

第三档在动态页面上增加页面级筛选状态。组件不直连：交互组件通过 `writeFilter` 回写筛选状态，相关的 `query` 页面数据源通过 `filters.subscribe` 订阅；统一运行时将它们合成新的**生效查询**。

```json
{
  "schemaVersion": "1.0",
  "id": "interactive-region",
  "meta": {
    "description": "点击区域柱条后联动查询所选区域成交总额"
  },
  "dataSources": {
    "by-region": {
      "fields": {
        "region": {
          "type": "string",
          "role": "dimension",
          "label": "区域",
          "format": "text"
        },
        "gmv": {
          "type": "number",
          "role": "metric",
          "label": "成交总额",
          "format": "number-grouped"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "metrics": ["gmv"],
          "dimensions": ["region"],
          "aggregation": "sum"
        }
      }
    },
    "selected-gmv": {
      "fields": {
        "gmv": {
          "type": "number",
          "role": "metric",
          "label": "成交总额",
          "format": "number-grouped"
        }
      },
      "source": {
        "type": "query",
        "query": {
          "metrics": ["gmv"],
          "aggregation": "sum",
          "filters": { "subscribe": ["f-region"] }
        }
      }
    }
  },
  "filters": [
    {
      "id": "f-region",
      "type": "dimension",
      "dimension": "region",
      "label": "区域",
      "display": "select"
    }
  ],
  "sections": [
    {
      "id": "overview",
      "layout": { "type": "grid", "columns": 12 },
      "components": [
        {
          "id": "page-header",
          "type": "reportHeader",
          "layout": { "span": 12 },
          "props": { "title": "区域联动看板" }
        },
        {
          "id": "region-chart",
          "type": "barChart",
          "layout": { "span": 8 },
          "data": { "main": "by-region" },
          "props": {
            "title": "点击柱条选择区域",
            "categoryField": "region",
            "series": [{ "field": "gmv" }],
            "actions": [
              {
                "on": "click",
                "writeFilter": "f-region",
                "field": "region"
              }
            ]
          }
        },
        {
          "id": "selected-gmv-card",
          "type": "metricCard",
          "layout": { "span": 4 },
          "data": { "main": "selected-gmv" },
          "props": {
            "title": "所选区域",
            "rows": [{ "label": "成交总额", "valueField": "gmv" }]
          }
        }
      ]
    }
  ]
}
```

页内联动时序：

```text
用户点击 region-chart 的某个区域
  → action 读取点击行的 region 字段
  → writeFilter("f-region")
  → 页面级筛选状态更新，并同步到 URL
  → selected-gmv 因订阅 f-region 而生成新的生效查询
  → 统一运行时仅重查相关页面数据源
  → selected-gmv-card 接收新数据快照并重新渲染
```

这个示例特意不让 `by-region` 订阅 `f-region`，因此选择柱条后它仍保留全部区域作为交互入口；只有 `selected-gmv` 被联动。订阅关系决定哪些页面数据源响应某个筛选器。

#### 筛选器

| `type` | 核心字段 | 说明 |
| --- | --- | --- |
| `dimension` | `dimension`、可选 `display`、可选 `default` | `display` 为 `select` / `tabs` / `tree` / `search`，`default` 为字符串数组 |
| `timeRange` | 可选 `precision`、可选 `default` | `precision` 为 `date` / `datetime`；`default` 可为 `today` / `last7d` / `last30d` / `last90d` 或绝对 `from` / `to` 闭区间 |

#### 两类 action

1. 页内下钻：从点击行读取一个维度字段并回写筛选状态。

```json
{
  "on": "click",
  "writeFilter": "f-region",
  "field": "region"
}
```

2. **跨页下钻**：跳转到另一个看板页面，携带当前筛选状态，并可用点击行字段设置目标页筛选器。

```json
{
  "on": "click",
  "navigate": {
    "page": "sales-detail",
    "carryFilters": ["f-time"],
    "setFilters": {
      "f-region": "region"
    }
  }
}
```

`carryFilters` 的 id 必须在当前页和目标页都存在；`setFilters` 的目标必须是目标页的 `dimension` 筛选器。跨页筛选值使用 URL 传递，目标页的统一运行时从 URL 恢复筛选状态。完整配对参考 [`pages/demo.json`](./pages/demo.json) 和 [`pages/sales-detail.json`](./pages/sales-detail.json)。

## 5. `mixed` 不是第四个维度

同一页同时包含 `inline` 和 `query` 页面数据源时，页面数据形态为 `mixed`。它是取数组合，不是新的交互等级。

能力按组件实际绑定的页面数据源推导：

- 只绑定 `inline` 的组件仍然是静态的，不能声明 action 或远程分页。
- 绑定 `query` 的组件可以使用动态数据、action 和远程分页。
- 页面上存在一个 `query` 页面数据源，不会让其他 `inline` 组件自动获得动态能力。

## 6. 从文档到渲染

统一运行时的执行顺序是：

1. `PageRepository` 按页面 id 加载页面文档。
2. 领域层校验 JSON Schema、字段/数据槽/筛选器引用、能力不变式和元数据快照语义。
3. 统一运行时从页面 `filters` 初始化筛选状态，并优先恢复 URL 中的筛选值。
4. `inline` 页面数据源同步产生终态数据快照；`query` 页面数据源的结构化查询与所订阅的筛选状态合成生效查询。
5. 数据网关执行生效查询，统一运行时管理 loading / ready / empty / error、并发和竞态。
6. 统一运行时按组件 `data` 槽分发数据快照，纯渲染组件根据 `props` 呈现。
7. 用户交互由组件上抛事件；统一运行时执行 `writeFilter` 或 `navigate`，然后进入新的状态/查询循环。

## 7. 校验与落库

新增或修改看板页面时：

1. 将完整 JSON 保存到 `pages/<page-id>.json`，文件名与 `id` 一致。
2. 运行 `pnpm validate`，校验结构、引用、能力、元数据快照语义、文件名和跨页链接。
3. 运行 `pnpm dev`，打开 `/pages/<page-id>` 检查数据状态、布局、筛选、页内联动和跨页下钻。

校验错误分为：

- `SCHEMA_ERROR`：页面文档的结构、引用、能力或元数据语义错误，必须修正。
- `METRIC_GAP`：看板页面要求的指标不在元数据快照中，属于需求与数据服务供给的缺口，不应在页面中伪造计算逻辑绕过。
