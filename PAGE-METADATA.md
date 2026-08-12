# 看板页面协议

看板页面是统一运行时直接消费的声明式文档。页面协议版本为 `5.0`。

实现依据：

1. `packages/page/src/schema.ts`：JSON 结构；
2. `packages/page/src/validate.ts`：引用、字段契约和能力约束；
3. `packages/page/src/page-document.ts` 与 `materialize.ts`：查询结果字段分组和纯解析接缝；
4. `packages/page/src/page.ts`：组件、数据槽和 action 类型；
5. `packages/page/src/query.ts`：DQE 查询定义。

页面文件使用 JSON。协议拒绝未定义属性。

## 顶层结构

```json
{
  "schemaVersion": "5.0",
  "id": "sales-overview",
  "meta": {
    "description": "销售概览"
  },
  "dataSources": {},
  "filters": [],
  "sections": []
}
```

| 字段 | 必填 | 说明 |
|---|---:|---|
| `schemaVersion` | 是 | 固定为 `"5.0"` |
| `id` | 是 | 页面稳定标识；正式文件名为 `<id>.json` |
| `meta` | 否 | 页面资产信息 |
| `dataSources` | 是 | 命名页面数据源 |
| `filters` | 否 | 页面级筛选状态声明 |
| `sections` | 是 | 页面内容分区，至少一项 |

`id` 只承载看板页面的同一性，用于文件命名、页面仓储加载和路由。统一运行时不得根据某个正式页面 `id` 切换样式、组件或开发工具；渲染差异必须来自本协议已声明的通用字段。

页面、页面数据源、筛选器、分区和组件的 id 使用：

```text
^[a-z0-9][a-z0-9-]*$
```

页面字段 id 使用：

```text
^[A-Za-z_][A-Za-z0-9_-]*$
```

同一页面内：

- 筛选器 id 唯一；
- 分区 id 唯一；
- 组件 id 全局唯一；
- 页面数据源 id 唯一。

## 页面数据模式

页面数据模式由 `dataSources` 中的数据源类型确定。

| 模式 | 组成 | 数据获取 |
|---|---|---|
| `inline` | 全部数据源为 `inline` | 页面文档直接提供数据行 |
| `query` | 全部数据源为 `query` | 使用内嵌初始行或由统一运行时调用数据网关 |
| `mixed` | 同时包含 `inline` 和 `query` | 两类数据源分别执行 |

`inline` 表示静态数据场景。`query` 表示动态查询场景。DQE 是当前支持的查询语言。

## 查询结果字段分组

`query` 页面数据源的 `fields` 可以按角色分组。分组只省略与组名重复的 `role`，其他结果字段契约与查询字段映射仍在当前页面数据源中显式声明：

```json
{
  "fields": {
    "dimensions": {
      "customer-name": {
        "queryField": "客户名称",
        "type": "string"
      }
    },
    "measures": {
      "customer-count": {
        "queryField": "客户数",
        "type": "number",
        "defaultFormat": "number-grouped"
      }
    }
  }
}
```

- `dimensions` 补全 `role: "dimension"`；`measures` 补全 `role: "measure"`；
- 字段 id 是对象键，每个字段都必须显式声明 `queryField` 和 `type`；
- 不根据同名、DQE 输出位置或默认值推断查询字段映射；
- `label` 与字段 id 相同时应省略；
- 页面元数据不提供 `definitions`、`include`、字段默认值继承或表格列集。

## 页面数据源

每个页面数据源包含：

- `fields`：完整结果字段契约，或只省略 `role` 的按角色分组声明；
- `source`：数据来源。

组件只引用页面字段 id，不直接引用外部响应字段。

### 字段契约

```json
{
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
    "nullable": false,
    "defaultFormat": "number-grouped"
  }
}
```

| 属性 | 必填 | 说明 |
|---|---:|---|
| `type` | 是 | 标量为 `string`、`number`、`boolean`、`date` 或 `datetime`；结构化明细为 `recordList`；语义 HTML 明细为 `semanticHtml` |
| `role` | 是 | 标量为 `dimension` 或 `measure`；两种明细字段均为 `detail` |
| `label` | 否 | 默认展示名称 |
| `unit` | 否 | 业务单位 |
| `nullable` | 否 | 是否允许 `null`；缺省为允许 |
| `defaultFormat` | 否 | 默认展示格式 |

`dimension` 用于类别、时间、分组、筛选和排序。`measure` 用于数值、计数、比例和其他可比较结果。`detail` 只用于受控的一层对象数组或语义 HTML，见下文专节。

`标量 type` 描述外部结果归一后的真实标量类型，不由 `role` 推断。外部查询若返回
`"41.67%"`，应声明为 `type: "string"`、`role: "measure"` 并使用 `text`
格式；此类字段只原样展示，不参与数值排序、图表计算或比例格式化。

允许的格式：

```text
text
number
number-1
number-2
number-grouped
compact-wan-0
compact-wan-1
compact-yi-1
percent-0
percent-1
percent-2
percent-2-signed
date
date-month-day
```

展示格式优先级：

1. 组件字段绑定的 `format`；
2. 字段契约的 `defaultFormat`；
3. 字段类型的基础格式。

### 静态数据源

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

静态数据源规则：

- `fields` 至少包含一个字段；
- `rows` 是数据行数组；
- 数据行的键集合与 `fields` 一致；
- 字段值只能是字符串、数字、布尔值或 `null`；
- `date` 使用 `YYYY-MM-DD`；
- `datetime` 使用 ISO 8601 日期时间；
- `nullable: false` 的字段不接受 `null`。

仅包含静态数据源的页面不声明筛选器和组件 action。

### DQE 查询数据源

```json
{
  "fields": {
    "region": {
      "queryField": "区域",
      "type": "string",
      "role": "dimension",
      "label": "区域",
      "nullable": false
    },
    "gmv": {
      "queryField": "成交总额",
      "type": "number",
      "role": "measure",
      "label": "成交额",
      "unit": "元",
      "nullable": false
    }
  },
  "source": {
    "type": "query",
    "initial": {
      "capturedAt": "2026-08-04T10:00:00+08:00",
      "rows": [
        {
          "区域": "华东",
          "成交总额": 128600
        }
      ],
      "totalCount": 1
    },
    "query": {
      "language": "dqe",
      "body": {
        "dsl_list": [
          {
            "output_dims": ["区域"],
            "output_metrics": ["成交总额"],
            "filter": {
              "dims": [],
              "metrics": []
            },
            "order": {
              "offset": 0,
              "limit": 10
            }
          }
        ]
      }
    }
  }
}
```

DQE 查询规则：

- `language` 固定为 `"dqe"`；
- `body.dsl_list` 恰好包含一个对象；
- DQE 请求体保持外部协议原文；
- 每个 DQE 输出字段具有一个 `queryField` 映射；
- 每个 `queryField` 只映射到一个页面字段；
- `output_dims` 对应 `role: "dimension"`；
- `output_metrics` 中的普通字段名或别名对应 `role: "measure"`；DQE 复合或 HTML 输出可以显式声明为 `role: "detail"`；
- `initial` 可选，存在时表示默认查询状态的已验证结果；`rows: []` 表示已确认的空结果；
- `initial.rows` 与查询定义一起保存，字段键使用 DQE 原始输出字段名，不使用页面字段 id；
- 页面文档解析时使用已有 `queryField` 把 `initial.rows` 归一化为稳定页面字段，组件仍只引用页面字段 id；
- 默认入口优先使用 `initial` 且不后台刷新；没有 `initial` 或入口筛选状态不同于默认状态时立即查询；
- 发生动态查询后不再回退到 `initial`，查询失败进入错误态。

### 嵌套明细字段

DQE 输出的一层对象数组用 `type: "recordList"` 和
`role: "detail"` 声明。外层与数组项字段都必须有显式查询字段映射：

```json
{
  "attribution-details": {
    "type": "recordList",
    "role": "detail",
    "label": "云服务流水归因明细",
    "queryField": "云服务流水归因明细",
    "items": {
      "fields": {
        "cloud-service": {
          "type": "string",
          "role": "dimension",
          "queryField": "云服务"
        },
        "attribution-delta": {
          "type": "number",
          "role": "measure",
          "queryField": "云服务归因波动金额"
        },
        "reason": {
          "type": "string",
          "role": "dimension",
          "queryField": "云服务波动原因"
        }
      }
    }
  }
}
```

- 数组项属性只允许标量，不允许继续嵌套；
- 每个结果行的单个嵌套明细字段最多 100 项；
- `[]` 表示已确认没有明细；`null` 是否合法由 `nullable` 决定；
- 内嵌初始行与动态响应都递归归一化为稳定页面字段 id；
- 普通字段绑定不能消费 `detail`，组件必须通过它明示支持的嵌套明细属性绑定。

### 语义 HTML 明细字段

DQE 已经完成文案组合、但需要由前端控制红绿等视觉表现的明细，可用
`type: "semanticHtml"` 和 `role: "detail"` 声明：

```json
{
  "attribution-details": {
    "type": "semanticHtml",
    "role": "detail",
    "label": "云服务流水归因明细",
    "queryField": "云服务流水归因明细"
  }
}
```

DQE 字段值示例：

```html
<span class="detail-title">ModelArts</span>：<span class="detail-description">到期未续订</span><span class="detail-value tone-negative">（-12.0万）</span>
```

- 允许标签：`div`、`span`、`strong`、`p`、`br`；该能力用于一段说明，不接受列表标签；
- 允许结构类：`detail-title`、`detail-value`、`detail-description`、`detail-meta`；
- 允许状态类：`tone-positive`、`tone-negative`、`tone-neutral`；类名表达业务方向，不表达具体颜色；
- 只允许 `class` 属性，禁止 `style`、事件属性、链接、脚本和未知标签或类；
- 单个字段值最多 64000 字符，空字符串表示没有可展示明细；
- 数据网关只校验字符串类型和长度，不解释 HTML；显式消费者解析为受控节点后渲染，不使用原始 HTML 注入；
- `rankingDetailCard.props.semanticDescriptionField` 明示把该字段直接渲染在普通说明位置，不生成列表、折叠入口或明细计数；它与 `text.props.bodyFormat: "semanticHtml"` 共用安全解析和语义颜色映射，具体 CSS 由前端组件拥有。

页面数据源表示一个命名结果集。数据网关可以在传输层合并多个页面数据源的查询，不改变页面中的逻辑查询边界。

## 筛选状态

筛选器在页面顶层声明。组件 action 和查询数据源通过筛选器 id 共享状态。

### 维度筛选器

```json
{
  "id": "region-filter",
  "type": "dimension",
  "dimension": "region",
  "label": "区域",
  "display": "select",
  "visible": true,
  "default": ["华东"]
}
```

`display` 允许：

- `select`
- `tabs`
- `tree`
- `search`

`visible: false` 表示筛选状态不显示控件，可由组件交互写入。

维度候选值由数据网关提供，不写入 Schema 元数据。

### 时间范围筛选器

```json
{
  "id": "time-filter",
  "type": "timeRange",
  "label": "时间",
  "precision": "date",
  "default": {
    "from": "2026-01-01",
    "to": "2026-12-31"
  }
}
```

`precision` 允许 `date` 和 `datetime`。相对时间预设允许：

```text
today
last7d
last30d
last90d
```

绝对时间范围是闭区间。`from` 不晚于 `to`，两端使用相同精度。

### DQE 筛选绑定

```json
{
  "filterBindings": {
    "region-filter": {
      "target": "dimension",
      "queryField": "region"
    },
    "time-filter": {
      "target": "time"
    }
  }
}
```

绑定规则：

- 键引用页面筛选器 id；
- `target: "dimension"` 绑定维度筛选器并声明外部 `queryField`；
- `target: "time"` 绑定时间范围筛选器；
- 未绑定的筛选器变化不触发该数据源重新查询；
- 页面字段 id、DQE 字段名和筛选目标之间不存在隐式同名映射。

## 内容分区

```json
{
  "id": "overview",
  "title": "概览",
  "container": "panel",
  "components": []
}
```

分区使用 12 列网格；列数是统一运行时不变量，不进入页面文档。`components` 至少包含一个组件。组件顺序决定自动流布局顺序。

`container` 是分区外观的唯一真源，可选，封闭三档且命名表现中性：

| 值 | 外观 |
|---|---|
| `plain` | 无容器，组件完全自带外观（报告头、摘要指标卡行、`variant: "heading"` 的分隔标题） |
| `panel` | 渐变章节面板 + 居中图标标题 + 内层白底承载网格 |
| `card` | 白色小节卡片 + 左对齐小标题 |

缺省保持通用看板外观：白色分区 + 带边框的组件单元格。统一运行时不根据组件组合或子组件 `props.variant` 推断分区外观；三档容器下组件单元格一律无镶边，表面由组件自带。

同一视觉行内相邻的同类型、同 `props.variant` 组件若具备行对齐能力（当前为 `rankingDetailCard`），统一运行时自动按行轨对齐高度；这是运行时不变量，页面文档不声明。

组件布局：

```json
{
  "layout": {
    "span": 6,
    "connectPrevious": true
  }
}
```

`span` 是 1 至 12 的整数。

`connectPrevious: true` 表示当前组件与 `components` 中紧邻前一组件形成同一视觉组。统一运行时使用连续背景填充两者的网格间隙，在间隙中绘制连接符，并移除相邻边的圆角。该声明不建立页面数据源依赖；第一个组件的无效声明由统一运行时安全忽略。

## 组件与数据槽

支持的组件类型：

| 类型 | 用途 | 数据槽 |
|---|---|---|
| `reportHeader` | 报告标题与时间信息 | 无 |
| `metricCard` | 指标值、变化和进度 | `main`，可选 `compare`、`target` |
| `barChart` | 柱状图 | `main` |
| `lineChart` | 折线图 | `main` |
| `pieChart` | 饼图或环图 | `main` |
| `table` | 表格 | `main` |
| `mapChart` | 地图 | `main` |
| `rankingCard` | 排名列表 | `main` |
| `text` | 说明文本、后端返回的摘要与页面链接 | 无 |
| `aiSummary` | 仅在需求明确声明时，基于关联数据通过 SSE 生成流式 AI 总结 | 无；使用 `props.relatedData` |

组件自身的可见标题统一使用 `props.title`。组件能力目录声明标题是必填、可选或不支持；`text.props.heading` 已从 4.0 删除。

`metricCard` 使用 `variant: "dualSummary"` 时，可通过 `panelLayout` 声明两块摘要面板的排列方式：
`"stacked"`（默认）为上下排列，`"twoColumn"` 为两列排列；窄屏下两列布局会自动回落为单列。

`text.props.body` 默认按纯文本渲染。摘要需要表达正向、负向或中性分色时，
显式声明 `bodyFormat: "semanticHtml"`，正文使用与语义 HTML 明细相同的受控标签和语义类：

```json
{
  "id": "customer-summary",
  "type": "text",
  "layout": { "span": 12 },
  "props": {
    "body": "<span>1、<span class=\"detail-title tone-positive\">增长客户：</span><span class=\"detail-description\">头部增长客户贡献集中。</span> 2、<span class=\"detail-title tone-negative\">下降客户：</span><span class=\"detail-description\">需要逐项制定恢复动作。</span></span>",
    "bodyFormat": "semanticHtml",
    "variant": "reportInline"
  }
}
```

`variant: "reportInline"` 用于分析报告摘要：组件默认在正文前显示小图标与“AI 总结：”，
metadata 不需要声明 `title`。`body` 是单个受控 HTML 字符串；需要连续摘要时用一个根 `span`
包住全部语义片段，与排行明细的 `semanticHtml` 字符串使用同一渲染入口。前缀和正文共用同一个浅蓝色行内容器，长文本自然增高。
前缀与正文是连续的行内文本流，正文换行时从容器左侧自然开始，不保留一列统一缩进。
如果 metadata 显式声明 `title`，它只会覆盖默认的“AI 总结”文案；图标和冒号仍由组件统一渲染。
`bodyFormat: "semanticHtml"` 仍由共用的安全语义 HTML 渲染模块处理分色内容。

省略 `bodyFormat` 时，即使 `body` 含有标签形状的文本也不会解释为 HTML。两种消费者共用
同一个安全解析与节点渲染 Module；未知标签、属性、类名或错误闭合都失败关闭，原始正文不进入 HTML 注入。

数据组件通过 `data` 把本地槽名映射到页面数据源：

```json
{
  "id": "region-chart",
  "type": "barChart",
  "layout": { "span": 12 },
  "data": {
    "main": "sales-by-region"
  },
  "props": {
    "categoryField": "region",
    "series": [
      {
        "field": "gmv",
        "label": "成交额"
      }
    ]
  }
}
```

每个槽引用一个存在的页面数据源。

### AI 总结组件

摘要默认使用 `text`，由后端在页面文档的 `props.body`
中直接返回正文。只有需求明确声明“运行时通过 SSE
动态生成”时才选择 `aiSummary`；标题中出现“AI”、页面已有相关数据，
或文案曾由 AI 生成，都不构成运行时 SSE 声明。

需要分色的后端摘要仍然使用 `text`，并显式声明
`props.bodyFormat: "semanticHtml"`；这只改变受控正文的渲染方式，不会触发请求或 SSE。

`aiSummary` 是内化执行的生成组件，不是第三种页面数据源，也不声明 `data`：

```json
{
  "id": "inspection-risk-summary",
  "type": "aiSummary",
  "layout": { "span": 12 },
  "props": {
    "title": "风险总结",
    "promptTemplate": "只能使用输入的前端原始数据，输出三个编号段落。",
    "relatedData": {
      "risk": {
        "source": "inspection-progress",
        "description": "各代表处公司考察风险数据",
        "fields": [
          { "field": "representative-office", "term": "代表处" },
          { "field": "inspection-na-missing", "term": "无公司考察NA客户数" }
        ]
      }
    }
  }
}
```

规则：

- 组件选择必须有明确的运行时 SSE 需求，未声明时使用 `text`；
- `title` 可选；`promptTemplate` 和 `relatedData` 必填且非空；
- `promptTemplate` 是纯文本，不支持插值或表达式；
- `source` 必须引用页面数据源，`field` 必须存在于该数据源结果字段契约；
- 运行时只向 AI 服务发送 `fields` 明示的字段；
- 仅被 `relatedData` 引用的数据源也会执行；
- 禁止 `data`、`scene`、`body`、`variant` 和外部协议参数。

## 字段绑定

字符串简写引用 `main` 数据槽：

```json
"gmv"
```

完整绑定显式指定数据槽和字段：

```json
{
  "data": "compare",
  "field": "gmv",
  "format": "compact-wan-1"
}
```

按维度值选择行：

```json
{
  "data": "main",
  "field": "gmv",
  "match": {
    "field": "region",
    "equals": "华东"
  }
}
```

规则：

- 数据槽必须由组件 `data` 声明；
- 字段必须存在于数据槽对应的数据源；
- `match.field` 的角色为 `dimension`；
- `match.equals` 的类型与匹配字段一致；
- 图表类别字段和地图名称字段使用 `dimension`；
- 图表数值字段、指标卡数值和进度字段使用 `measure`；
- 表格可绑定两种角色。

### 指标卡展示配置

- `rows[].unit` 是主值单位；`rows[].changes[].unit` 是变化值单位，二者都只影响展示；
- `progress.valueField` 决定中心显示的实际完成率；
- `progress.ringPercent` 可选，范围为 `0` 至 `100`，决定可见轨道占整圆的比例；蓝色部分再按 `valueField` 的实际完成率填充该轨道。

## 表格行为

本地分页表格支持：

- 字段列和嵌套列组；
- 次级字段和徽标字段；
- 固定列、宽度和对齐；
- 使用 `emphasis: "strong"` 强调指定列的数据单元格；
- 本地排序；
- 维度选择筛选；
- 日期范围筛选；
- 单元格选择写入页面筛选状态；
- 本地分页。

`props.fit` 控制列宽策略：`content` 保留配置的像素宽度并允许横向滚动；`container` 把列宽作为比例压缩到容器内，适合简报和窄画布。

`columns[].emphasis` 是列级展示 metadata；当前仅支持 `strong`，只加粗该列的数据单元格，不依赖字段名或列标题。

同一张表需要并排展示两个独立查询页面数据源时，可以声明多个组件数据槽，并用
`rowKey` 按稳定页面字段对齐：

```json
{
  "data": {
    "main": "inspection-progress",
    "top100": "inspection-progress-top100"
  },
  "props": {
    "rowKey": "representative-office",
    "columns": [
      { "field": "inspection-na-total" },
      {
        "field": {
          "data": "top100",
          "field": "inspection-top-total"
        }
      }
    ]
  }
}
```

- `main` 数据槽决定行集合、顺序和分页；
- 其他数据槽按 `rowKey` 查找对应行，不依赖响应行顺序；
- 多数据槽表格必须声明 `rowKey`，且每个数据源都必须声明同类型的维度字段；
- 其他数据槽不存在匹配行时展示空值，不把缺失伪造为 `0`；
- 每个查询页面数据源仍只保存一个 DQE 查询项，数据网关可以透明批量发送。

本地分页示例：

```json
{
  "pagination": {
    "mode": "local",
    "pageSize": 10
  }
}
```

查询分页示例：

```json
{
  "pagination": {
    "mode": "query"
  }
}
```

- `mode: "none"` 不分页；
- `mode: "local"` 只允许绑定 `inline` 数据源，`pageSize` 在组件中声明，排序、表头筛选和分页只作用于数据快照；
- `mode: "query"` 只允许绑定独占的 `query` 数据源，页大小以 DQE `order.limit` 为唯一真值，初始 `order.offset` 为 `0`；
- 查询分页改变页码时更新克隆请求的 `order.offset`，页面筛选变化时先把 `offset` 重置为 `0`；
- DQE 成功结果的 `results[i].total_count` 归一为数据快照的 `totalCount`，用于总条数、数字页码和上下页；错误结果的计数无效；
- `totalCount` 小于等于当前页大小时仅展示总条数，不展示页大小、页码和上下页控件；
- 查询分页存在 `initial` 时必须声明 `initial.totalCount`，并满足 `initial.rows.length = min(order.limit, initial.totalCount)`；
- 查询分页暂不支持排序和表头筛选；数据变化导致当前页越界时，运行时查询最后一个有效页。

## 组件 action

action 只用于绑定查询数据源的组件。

### 写入筛选器

```json
{
  "on": "click",
  "writeFilter": "region-filter",
  "field": "region"
}
```

目标是已声明的维度筛选器，来源字段角色为 `dimension`。

### 页面跳转

```json
{
  "on": "click",
  "navigate": {
    "page": "sales-detail",
    "carryFilters": ["time-filter"],
    "setFilters": {
      "region-filter": "region"
    }
  }
}
```

`carryFilters` 携带当前筛选状态。`setFilters` 使用点击行中的维度字段设置目标页面筛选器。

文本组件使用 `links` 提供固定页面链接：

```json
{
  "links": [
    {
      "label": "查看销售明细",
      "page": "sales-detail",
      "carryFilters": ["time-filter"]
    }
  ]
}
```

## 数据快照

统一运行时按页面数据源 id 形成唯一数据快照。普通组件数据槽与 AI 总结关联数据在渲染时读取同一份快照；AI 总结生成结果另存为按组件 id 隔离的 AI 总结快照。

| 状态 | 含义 |
|---|---|
| `loading` | 查询正在执行 |
| `ready` | 存在可渲染数据行；查询分页可携带 `totalCount` |
| `empty` | 查询成功且结果为空；查询分页携带 `totalCount: 0` |
| `error` | 查询或映射失败 |

静态数据源同步产生 `ready` 或 `empty`。查询数据源存在适用的 `initial` 时同步产生结果态，否则从 `loading` 进入终态。

## 校验

```bash
pnpm validate
```

对单个文件：

```bash
pnpm validate pages/demo.json
```

错误包含类型、JSON Pointer 路径和消息。

| 类型 | 含义 |
|---|---|
| `SCHEMA_ERROR` | JSON 结构、引用或组件能力不符合页面协议 |
| `FIELD_CONTRACT_ERROR` | 结果数据不符合字段契约 |
| `QUERY_MAPPING_ERROR` | DQE 输出与页面字段映射不完整或冲突 |
| `FILTER_BINDING_ERROR` | 筛选声明与查询绑定不一致 |
| `DQE_PROTOCOL_ERROR` | DQE 请求或响应不符合接入协议 |
| `DQE_EXECUTION_ERROR` | DQE 执行失败 |
| `DATA_CONTEXT_ERROR` | 页面创作所需的数据上下文不足 |

## 完整示例

- 静态页面：[`pages/tokens-report.json`](./pages/tokens-report.json)
- DQE 页面：[`pages/demo.json`](./pages/demo.json)
- 混合数据源契约：[`packages/page/fixtures/contract-valid/mixed-page.json`](./packages/page/fixtures/contract-valid/mixed-page.json)
- 客户活动 DQE 页面：[`pages/customer-activity-risk-briefing.json`](./pages/customer-activity-risk-briefing.json)
