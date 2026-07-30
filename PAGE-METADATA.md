# 看板页面文档说明

> 当前可执行基线：领域 DSL `schemaVersion: "2.0"`；统一运行时兼容 N-1 `1.0`

本文描述统一运行时直接消费的**看板页面**文档，并用三个递进维度说明从固定内容到动态联动的页面如何声明。

日常交流中的“页面元数据”在本文统一指声明式页面文档整体，不是
`catalog/snapshot.json` 中的**元数据快照**。顶层 `meta` 也只是看板页面的资产说明，
不参与渲染；可见标题应由 `reportHeader` 组件声明。

实现的唯一真源依次是：

- [`packages/page/src/schema.ts`](./packages/page/src/schema.ts)：JSON Schema 结构契约。
- [`packages/page/src/validate.ts`](./packages/page/src/validate.ts)：引用、能力和元数据语义不变式。
- [`packages/page/src/page.ts`](./packages/page/src/page.ts)：组件、数据槽和 action 类型。
- 本文：面向页面作者和 AI 的当前协议说明与递进示例。若本文滞后，以前三项及 `pnpm validate` 的结果为准。

## 1. 统一文档骨架

下面是结构示意，不是完整可渲染页面：

```jsonc
{
  "schemaVersion": "2.0",
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
| `schemaVersion` | 是 | 页面文档契约版本，当前为 `"2.0"`，兼容 N-1 `"1.0"` |
| `id` | 是 | 看板页面的稳定身份；保存到 `pages/` 时文件名必须为 `<id>.json` |
| `meta` | 否 | 页面资产说明，当前仅支持 `description`，不参与渲染 |
| `meta.description` | 否 | 面向页面目录、评审者和创作工具的资产说明；不是页面可见副标题 |
| `dataSources` | 是 | 命名**页面数据源**；inline 完整声明字段契约，query 从结构化查询与元数据快照解析字段契约 |
| `filters` | 否 | 声明页面级**筛选状态**；仅有 `query` 页面数据源时才有数据语义 |
| `sections` | 是 | 按顺序组织的内容分区；每个分区是固定 12 列自动流网格 |

页面、分区、组件和页面数据源 id 使用小写字母、数字和连字符，且不得重复。字段 code 可使用大小写字母、数字、下划线和连字符，但首字符必须是字母或下划线。协议默认拒绝未定义字段，因此拼写错误不会被静默忽略。

### 1.1 六块心智模型

页面作者只需要记住六块，且真正需要反复编写的是后三块：

1. `schemaVersion`：用哪个版本的语言。
2. `id`：这是哪个看板页面。
3. `meta`：这个资产的非可见说明。
4. `dataSources`：页面需要哪些命名数据集。
5. `filters`：哪些页面级筛选状态会影响查询。
6. `sections`：用哪些标准组件、按什么顺序和跨度呈现。

组件自身也保持固定骨架：

```jsonc
{
  "id": "component-id",
  "type": "table",
  "layout": { "span": 12 },
  "data": { "main": "source-id" },
  "props": {}
}
```

其中 `data` 只负责把命名页面数据源接入组件数据槽，`props` 只表达组件的业务展示语义。
CSS、SVG、绘制算法、网络请求和任意脚本都不进入页面文档。

### 1.2 当前复杂页面的组成占比

以下统计以 `/preview` 默认的
[`customerRiskPreviewPage`](./apps/canvas/src/lib/customer-risk-preview.ts) 为样本。
样本包含 9 个分区、21 个页面数据源、8 个筛选器和 31 个组件。统计口径为
`JSON.stringify` 后各顶层键值对的字符数，忽略根对象的 7 个括号/逗号字符；
因此能反映页面文档的相对体积，而不是运行时性能。

| 组成 | 占比 | 结论 |
| --- | ---: | --- |
| 页面身份与资产说明：`schemaVersion` + `id` + `meta` | 0.4% | 已足够小，不是简化重点 |
| 筛选状态：`filters` | 3.7% | 隐藏联动筛选器也在这里，结构仍然简单 |
| 页面数据源：`dataSources` | 22.3% | 主要是指标、维度与筛选订阅；2.0 已删除 query 的重复字段契约 |
| 内容与组件：`sections` | 73.6% | 当前最大部分，复杂度主要来自表格列声明 |

`sections` 内部再拆分：

| `sections` 内部组成 | 占 `sections` | 说明 |
| --- | ---: | --- |
| 分区骨架：id、标题、12 列布局 | 3.6% | 很小且稳定 |
| 组件骨架：id、type、跨度、数据槽 | 15.8% | 固定五字段心智模型 |
| 组件 `props` | 80.6% | 真正的业务展示描述 |

31 个组件中，表格 16 个（51.6%）、指标卡 9 个（29.0%）、文本 5 个（16.1%）、
报告头 1 个（3.2%）。表格 `props` 占全部组件 `props` 的 81.1%，约占整份页面文档
的 47.0%。因此下一步若要继续减小作者负担，应优先减少重复表格列的手写，而不是
增加新的顶层抽象。

## 2. 页面数据源与字段契约

页面数据源是组件之前的数据边界。inline 来源在页面中完整声明字段契约：

```json
{
  "fields": {
    "gmv": {
      "type": "number",
      "role": "metric",
      "label": "成交总额"
    }
  },
  "source": {
    "type": "inline",
    "rows": [{ "gmv": 128600 }]
  }
}
```

### 2.1 inline 的 `fields`

每个 inline 页面数据源至少声明一个输出字段。

| 字段 | 必填 | 含义 | 允许值 |
| --- | --- | --- | --- |
| `type` | 是 | 字段原始值的标量类型；统一运行时据此校验 inline 数据行，并选择日期、数值或文本的基础处理方式 | `string` / `number` / `boolean` / `date` / `datetime` |
| `role` | 是 | 字段在分析中的语义角色；`dimension` 用于分组、筛选或类别，`metric` 用于度量、聚合和数值展示 | `dimension` / `metric` |
| `label` | 否 | 面向用户展示的字段名称；未声明时，组件可使用字段 code 或自身显式标题 | 任意非空字符串 |

query 页面数据源不重复保存这些完整字段定义。统一运行时会把两种来源归一成相同的运行时字段契约，因此组件数据槽和字段绑定不依赖来源形态。

### 2.2 `source.type: "inline"`

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `fields` | 是 | 该页面数据源输出的完整字段契约；字段名同时是 `rows` 中的键和组件字段绑定使用的 code | 至少一个字段，每个字段符合 2.1 |
| `source.type` | 是 | 页面数据源来源判别值；`inline` 表示数据行随页面文档固化 | 固定为 `"inline"` |
| `source.rows` | 是 | 固定数据行；统一运行时直接把它们转换为终态数据快照，不经过数据网关 | 数组；每行必须与 `fields` 完整对应，值可为 `null` |

只含 `inline` 页面数据源的页面是静态页面，不得声明 `filters`、组件 actions 或远程分页。

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

query 页面数据源外层字段：

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `source.type` | 是 | 页面数据源来源判别值；`query` 表示数据由统一运行时经数据网关动态取得 | 固定为 `"query"` |
| `source.query` | 是 | 声明页面需要的指标、维度、筛选订阅和查询视图 | 符合下方结构化查询字段说明 |
| `fieldOverrides` | 否 | 对 query 推导出的字段展示名称做当前页面局部覆盖 | 键必须是 query 输出字段，只能包含 `label`；旧 `format` 仅兼容读取 |

| `query` 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `metrics` | 是 | 本次查询需要返回的业务度量；数组中的每个 code 都会成为 query 输出字段 | 至少一个数据服务**指标** code，不得重复 |
| `dimensions` | 否 | 查询的分析切分角度；决定指标按哪些类别分组，并成为 query 输出字段 | 数据服务**维度** code 数组，不得重复 |
| `aggregation` | 否 | 对本查询全部指标采用的聚合方式，例如 `sum` / `avg` / `count` | 必须同时受所选指标及维度组合支持 |
| `granularity` | 否 | 数据服务定义的查询粒度，用于区分日、月或其他供给侧粒度 | 非空字符串；具体允许值由数据服务定义 |
| `filters.subscribe` | 否 | 声明该页面数据源响应哪些页面级筛选状态；值变化时统一运行时重新生成生效查询 | 已在页面 `filters` 中声明的筛选器 id，不得重复 |
| `time` | 否 | 以某个已订阅的时间范围筛选器为锚点，选择整个范围、终点或向前回看窗口 | 见下方 `time` 字段说明 |
| `orderBy` | 否 | 查询的初始静态排序；数组顺序就是多列排序优先级 | `field` 必须是本查询输出字段，`direction` 为 `asc` / `desc` |
| `limit` | 否 | 限制查询最多返回多少行，常用于 Top N；不是总条数 | 大于等于 1 的整数 |

`time` 对象：

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `time.filter` | 是 | 作为报告时间锚点的页面筛选器 id | 必须是本查询已经订阅的 `timeRange` 筛选器 |
| `time.window` | 是 | 从筛选器当前范围中取哪一段时间 | `selected` / `point` / `lookback` 三种结构之一 |
| `window.kind: "selected"` | — | 使用用户选中的完整时间闭区间 | 不再声明其他字段 |
| `window.kind: "point"` | — | 只使用所选范围的终点 | 同时声明 `anchor: "to"` |
| `window.kind: "lookback"` | — | 从所选范围终点向前回看 | `anchor: "to"`，并声明非负整数 `previous` 和 `day` / `week` / `month` 单位 |
| `window.anchor` | `point` / `lookback` 时必填 | 指定回看或取点所锚定的筛选范围端点 | 当前固定为 `"to"`，即范围终点 |
| `window.previous` | `lookback` 时必填 | 从锚点向前回看的单位数量 | 大于等于 0 的整数 |
| `window.unit` | `lookback` 时必填 | 回看数量使用的时间单位 | `day` / `week` / `month` |

`orderBy[]` 每一项：

| 字段 | 必填 | 含义 | 允许值 |
| --- | --- | --- | --- |
| `field` | 是 | 参与排序的指标或维度输出字段 code | 当前 query 的 `metrics` 或 `dimensions` 成员 |
| `direction` | 是 | 排序方向 | `asc` 升序 / `desc` 降序 |

`query.metrics + query.dimensions` 是 query 的完整输出集合。指标、维度和聚合能力由元数据快照做语义校验。

schemaVersion 2.0 中，query 的完整字段契约不再持久化在页面文档中：

- `role` 由 `query.metrics` / `query.dimensions` 推导。
- 标量类型、默认标签和 `defaultFormat` 展示建议来自元数据快照。
- 页面只有确实需要改变默认标签时才声明 `fieldOverrides`；最终展示格式写在组件字段绑定。

```json
{
  "fieldOverrides": {
    "gmv": {
      "label": "GMV"
    }
  },
  "source": {
    "type": "query",
    "query": {
      "metrics": ["gmv"],
      "dimensions": ["region"]
    }
  }
}
```

`fieldOverrides` 只能引用 query 输出字段，并且只覆盖 `label`；字段角色、类型和数据语义仍由数据服务治理。1.0 query 中的完整 `fields` 仅为 N-1 兼容形态，可用 `pnpm migrate` 升级。

| `fieldOverrides.<field>` 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `label` | 否 | 只在当前页面覆盖元数据快照提供的默认展示名称 | 非空字符串 |

兼容说明：schemaVersion 2.0 早期页面写在 inline `fields[].format` 或
`fieldOverrides[].format` 中的格式仍可读取，统一运行时会将其归一为默认展示建议。
新页面不要继续使用这两种旧写法。

## 3. 内容分区、组件与数据槽

内容位于 `sections[].components`。分区只支持 `{ "type": "grid", "columns": 12 }`，组件顺序决定自动流排布，`layout.span` 声明 1–12 列的跨度。页面文档不声明 `x/y`、任意样式、HTML 或脚本。

分区字段：

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `id` | 是 | 分区在页面内的稳定标识 | 页面内唯一，使用小写字母、数字和连字符 |
| `title` | 否 | 分区上方显示的可见标题 | 非空字符串 |
| `layout.type` | 是 | 分区布局算法 | 当前固定为 `"grid"` |
| `layout.columns` | 是 | 自动流网格的总列数 | 当前固定为 `12` |
| `components` | 是 | 按渲染顺序排列的组件列表；顺序同时决定自动流排布顺序 | 至少一个组件 |

组件通用字段：

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `id` | 是 | 组件实例在整页中的稳定标识，用于状态、错误定位和创作工具选择 | 整个页面内唯一 |
| `type` | 是 | 选择哪个受治理的标准组件及其 props 契约 | 当前封闭组件集中的类型 |
| `layout.span` | 是 | 组件在所属 12 列网格中占几列 | 1–12 的整数 |
| `data` | 数据组件必填 | 将组件的命名数据槽绑定到页面数据源；无数据组件不得声明 | 槽位值必须是 `dataSources` 中存在的 id |
| `props` | 是 | 该组件的业务展示语义和有限交互声明 | 由组件 `type` 决定，拒绝未定义属性 |

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

常用数据槽：

| 槽位 | 含义 | 使用组件 |
| --- | --- | --- |
| `main` | 组件的主数据集；字符串字段绑定默认从这里读取 | 所有数据组件必填 |
| `compare` | 与主值进行比较的可选数据集 | 当前由 `metricCard` 契约支持 |
| `target` | 目标值或计划值的可选数据集 | 当前由 `metricCard` 契约支持 |

字段绑定有三种形态：

| 形态 | 含义 | 示例 |
| --- | --- | --- |
| 字符串简写 | 从组件的 `main` 数据槽读取指定字段 | `"valueField": "gmv"` |
| 显式数据槽 | 从指定数据槽读取字段，供 `compare` / `target` 等多源组件使用 | `"valueField": { "data": "target", "field": "gmv" }` |
| 显式展示格式 | 只改变当前组件中这一次字段引用的呈现方式 | `"valueField": { "data": "main", "field": "gmv", "format": "compact-wan-1" }` |

对象形式字段绑定的字段说明：

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `data` | 是 | 从组件的哪个命名数据槽读取字段 | 必须是组件 `data` 已声明的槽名 |
| `field` | 是 | 数据槽所绑定页面数据源中的字段 code | 必须存在且满足当前 props 要求的字段角色 |
| `format` | 否 | 当前字段绑定的最终展示格式，不改变页面数据源或指标口径 | 下方内置展示预设；仅展示字段绑定允许，action 和筛选写入使用的字段引用不允许 |

最终展示格式按以下优先级解析：

1. 当前组件字段绑定的 `format`。
2. 元数据快照的 `defaultFormat` 展示建议；旧页面数据源 `format` 会兼容归一到这里。
3. 未声明格式时按原值直观显示；空值统一显示为 `—`。

#### `format` 如何选择

`format` 是当前组件字段绑定引用的展示预设 ID。页面作者应先确定希望用户看到什么，再选择预设。大多数页面只需要下面 6 种：

| 希望展示成 | 推荐写法 | 输入 → 输出 | 典型用途 |
| --- | --- | --- | --- |
| 原始文本 | `text` | `128600` → `128600` | 名称、状态、已拼好的展示文本 |
| 易读数字 | `number-grouped` | `128600` → `128,600` | 客户数、次数、金额等常规指标 |
| 百分比 | `percent-1` | `4.24` → `4.2%` | 占比、完成率 |
| 带方向的百分比 | `percent-2-signed` | `4.24` → `+4.24%` | 环比、同比等变化率 |
| 完整日期 | `date` | `2026-07-29T10:30` → `2026-07-29` | 表格日期、筛选结果 |
| 月日 | `date-month-day` | `2026-07-29` → `07-29` | 趋势图横轴 |

只有上述常用写法无法满足展示要求时，才需要选择以下精确预设：

| 展示要求 | 可选写法 | 输入 → 输出 |
| --- | --- | --- |
| 数字保持原有小数位，不加千分位 | `number` | `128600.5` → `128600.5` |
| 数字固定保留 1 位小数 | `number-1` | `12` → `12.0` |
| 数字固定保留 2 位小数 | `number-2` | `12` → `12.00` |
| 以“万”为单位，保留 0 位小数 | `compact-wan-0` | `128600` → `13万` |
| 以“万”为单位，保留 1 位小数 | `compact-wan-1` | `128600` → `12.9万` |
| 以“亿”为单位，保留 1 位小数 | `compact-yi-1` | `128600000` → `1.3亿` |
| 百分比保留 0 / 1 / 2 位小数 | `percent-0` / `percent-1` / `percent-2` | `4.24` → `4%` / `4.2%` / `4.24%` |

预设名中的数字只表示**小数位数**，不是新的分类。例如 `percent-2-signed` 表示“百分比、2 位小数、正数显示 `+`”。`wan` / `yi` 表示缩放单位，`grouped` 表示千分位，`signed` 表示显式展示正负方向。

页面只能使用已有预设，不要自行拼接新的预设名。若同一种新格式在多个页面反复出现，应由平台统一增加预设，而不是让各页面各自实现格式化逻辑。

结构化查询和数据行都只存在于页面数据源，不进入组件 `props`。

当前封闭组件集：

| `type` | 用途与当前语义能力 | 主要必填 `props` |
| --- | --- | --- |
| `reportHeader` | 可见页头；可选生成方、数据时点、徽标、标签和标准装饰 | `title` |
| `metricCard` | 核心指标值；可选单位、变化值语义色和圆形完成率 | `rows[].label`、`rows[].valueField` |
| `barChart` | 离散类别比较 | `categoryField`、`series[].field` |
| `lineChart` | 趋势 | `xField`、`series[].field` |
| `pieChart` | 占比或构成 | `categoryField`、`valueField` |
| `table` | 多级表头、主/次字段、徽标、危险值、单元格选择、排序、筛选和远程分页 | `columns[].field` |
| `mapChart` | 中国或世界地域分布 | `nameField`、`valueField`、`map` |
| `rankingCard` | Top N 排行 | `nameField`、`valueField` |
| `text` | 说明、口径提示或已确认结论 | 无 |

### 3.1 组件 `props` 字段说明

`reportHeader`：

| 字段 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `title` | 是 | 页面可见主标题 | 非空字符串 |
| `subtitle` | 否 | 主标题下方的补充说明 | 字符串 |
| `generatedBy` | 否 | 报告生成方说明 | 字符串 |
| `badge` | 否 | 页头强调徽标 | 字符串 |
| `asOf.label` | 与 `asOf` 同时必填 | 数据时点的标签，例如“数据统计时间截至” | 非空字符串 |
| `asOf.value` | 与 `asOf` 同时必填 | 数据时点的展示值 | 非空字符串 |
| `tags` | 否 | 页头标签集合 | 非空字符串数组 |
| `decoration` | 否 | 平台内置的页头装饰样式 | 当前仅 `"shortBar"` |

`metricCard`：

| 字段 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `title` | 否 | 指标卡标题 | 字符串 |
| `variant` | 否 | 指标卡的标准语义布局 | `summary` / `activityProgress` |
| `rows` | 是 | 要展示的一组指标行 | 至少一项 |
| `rows[].label` | 是 | 指标行名称 | 非空字符串 |
| `rows[].valueField` | 是 | 指标主值来源 | 字段绑定，必须是 metric |
| `rows[].unit` | 否 | 指标值展示单位 | 字符串 |
| `rows[].changes` | 否 | 主值下方的一组变化值 | 数组 |
| `changes[].label` | 是 | 变化值说明，例如“较上月” | 非空字符串 |
| `changes[].field` | 是 | 变化值来源 | 字段绑定，必须是 metric |
| `changes[].tone` | 否 | 变化值语义色；`auto` 根据正负判断 | `auto` / `neutral` / `positive` / `danger` |
| `progress.valueField` | 与 `progress` 同时必填 | 圆形完成率使用的数值 | metric 字段绑定，按 0–100 解释 |
| `progress.label` | 否 | 圆形完成率说明 | 字符串，缺省为“完成率” |
| `actions` | 否 | 指标卡 action 契约字段 | 当前统一运行时尚未提供指标卡字段点击上下文，不应在正式页面中使用 |

图表组件：

| 字段 | 适用组件 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- | --- |
| `title` | 全部图表 | 否 | 图表标题 | 字符串 |
| `categoryField` | `barChart` / `pieChart` | 是 | 离散类别或扇区名称来源 | dimension 字段绑定 |
| `xField` | `lineChart` | 是 | 折线图横轴来源 | date / datetime / dimension 字段绑定 |
| `valueField` | `pieChart` | 是 | 扇区数值来源 | metric 字段绑定 |
| `series` | `barChart` / `lineChart` | 是 | 要绘制的一组指标系列 | 至少一项 |
| `series[].field` | `barChart` / `lineChart` | 是 | 当前系列的数据来源 | metric 字段绑定 |
| `series[].label` | `barChart` / `lineChart` | 否 | 当前系列在图例中的名称 | 字符串 |
| `stacked` | `barChart` / `lineChart` | 否 | 是否将多个系列堆叠 | 布尔值 |
| `rounded` | `barChart` | 否 | 是否使用圆角柱条 | 布尔值 |
| `horizontal` | `barChart` | 否 | 是否切换为横向柱状图 | 布尔值 |
| `smooth` | `lineChart` | 否 | 是否使用平滑折线 | 布尔值 |
| `areaGradient` | `lineChart` | 否 | 是否显示折线下方的渐变面积 | 布尔值 |
| `dualAxis` | `barChart` / `lineChart` | 否 | 是否启用双数值轴布局 | 布尔值 |
| `showPointLabels` | `lineChart` | 否 | 是否显示数据点数值标签 | 布尔值 |
| `hideYAxis` | `lineChart` | 否 | 是否隐藏 Y 轴 | 布尔值 |
| `ring` | `pieChart` | 否 | 将饼图切换为环图，并声明内圈直径比例 | 1–2 位数字百分比字符串，例如 `"60%"` |
| `labelLine` | `pieChart` | 否 | 是否显示扇区标签引导线 | 布尔值 |
| `actions` | 全部图表 | 否 | 点击图形后执行的有限交互 | 4.3 中定义的 action 数组 |

`table` 顶层 props：

| 字段 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `title` | 否 | 表格标题 | 字符串 |
| `subtitle` | 否 | 表格标题下方的补充说明 | 字符串 |
| `columns` | 是 | 表格列或列组定义，顺序就是呈现顺序 | 至少一项 |
| `pagination` | 否 | 表格分页展示方式 | 见下方分页字段 |
| `actions` | 否 | 表格通用 action 契约字段 | 当前表格联动应使用列级 `selection`；运行时尚未提供通用行点击 action |

普通表格列：

| 字段 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `kind` | 否 | 列节点类型判别值；普通列可省略 | 省略或 `"field"` |
| `field` | 是 | 单元格主值来源 | 字段绑定 |
| `secondaryField` | 否 | 在主值下方展示的次级字段 | 字段绑定 |
| `badgeField` | 否 | 在主值下方以标准徽标展示的字段 | 字段绑定 |
| `dangerValues` | 否 | 命中指定文本时使用危险语义色 | 不重复的字符串数组 |
| `selection` | 否 | 点击该列单元格后原子写入筛选状态 | 见 4.3“表格单元格选择” |
| `title` | 否 | 列表头；省略时使用字段标签 | 字符串 |
| `width` | 否 | 期望列宽 | 大于等于 1 的整数，单位为像素 |
| `fixed` | 否 | 将列固定在横向滚动区域一侧 | `left` / `right` |
| `sortable` | 否 | 是否允许用户点击表头排序 | 布尔值 |
| `filterable.mode` | 否 | 是否显示表头筛选及筛选形态 | `select` / `dateRange` |
| `align` | 否 | 单元格与表头对齐方式 | `left` / `right` |
| `visual` | 否 | 单元格内置视觉表达 | `plain` 普通文本 / `rateBar` 比例条 / `signed` 正负语义色 |

表格列组：

| 字段 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `kind` | 是 | 列组节点类型判别值 | 固定为 `"group"` |
| `id` | 是 | 列组在当前表格中的稳定标识 | 小写字母、数字和连字符 |
| `title` | 是 | 跨列表头名称 | 非空字符串 |
| `children` | 是 | 当前组包含的普通列或嵌套列组 | 至少一项 |

表格分页：

| 字段 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `mode` | 是 | 是否启用分页；`paged` 只允许绑定 query 页面数据源 | `none` / `paged` |
| `pageSize` | `paged` 时可选 | 每页请求并展示的行数 | 大于等于 1 的整数，缺省为 10 |
| `totalCount` | 否 | 在数据服务没有总数槽时受控展示的总条数 | 大于等于 0 的整数 |
| `numbered` | 否 | 是否显示数字页码；否则只显示当前页及前后翻页 | 布尔值 |

其他组件：

| 字段 | 适用组件 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- | --- |
| `title` | `mapChart` / `rankingCard` | 否 | 组件标题 | 字符串 |
| `nameField` | `mapChart` | 是 | 地图区域名称来源 | dimension 字段绑定 |
| `valueField` | `mapChart` | 是 | 地图区域数值来源 | metric 字段绑定 |
| `map` | `mapChart` | 是 | 使用的平台内置地图 | `china` / `world` |
| `scatter` | `mapChart` | 否 | 地图上的点标记形式 | `point` / `effect` |
| `nameMap` | `mapChart` | 否 | 将数据中的地域名称映射为地图名称 | 字符串到字符串的对象 |
| `nameField` | `rankingCard` | 是 | 排行对象名称来源 | dimension 字段绑定 |
| `valueField` | `rankingCard` | 是 | 排行主值来源 | metric 字段绑定 |
| `changeField` | `rankingCard` | 否 | 排行变化值来源 | metric 字段绑定 |
| `actions` | `mapChart` | 否 | 点击地域后执行的有限交互 | 4.3 中定义的 action 数组 |
| `actions` | `rankingCard` | 否 | 排行卡 action 契约字段 | 当前统一运行时尚未提供排行项点击上下文，不应在正式页面中使用 |
| `heading` | `text` | 否 | 文本块标题 | 字符串 |
| `body` | `text` | 否 | 文本正文，保留换行 | 字符串 |
| `variant` | `text` | 否 | 文本块的标准语义样式 | `plain` / `insight` |
| `links` | `text` | 否 | 一组跨页文本链接 | 链接对象数组 |
| `links[].label` | `text` | 与链接同时必填 | 链接可见文本 | 非空字符串 |
| `links[].page` | `text` | 与链接同时必填 | 目标看板页面 id | 必须是可发现页面 |
| `links[].carryFilters` | `text` | 否 | 跳转时携带的同名筛选状态 | 当前页和目标页都存在的筛选器 id 数组 |

完整组件 props 以 [`packages/page/src/schema.ts`](./packages/page/src/schema.ts) 为准。组件是**纯渲染组件**：它们接收统一运行时解析后的数据行、字段契约和展示属性，不直接取数、不访问全局状态。

> 当前可执行 action 范围：`barChart`、`lineChart`、`pieChart` 和 `mapChart` 可以产生带字段上下文的点击事件；表格使用 `columns[].selection`。`metricCard`、`table.actions` 和 `rankingCard.actions` 虽仍在契约中保留，但当前统一运行时没有对应点击事件，正式页面不应声明。这个差异属于待收紧的契约缺口。

### 3.2 schemaVersion 2.0 报告表达增量

当前新增能力仍然遵循“语义属性，不暴露 CSS”：

| 字段 | 所属组件 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `generatedBy` | `reportHeader` | 报告生成方说明 | 字符串 |
| `decoration` | `reportHeader` | 选择平台内置的页头装饰，不接受 CSS | 当前仅 `"shortBar"` |
| `variant` | `metricCard` | 选择指标卡的标准语义布局 | `summary` / `activityProgress` |
| `rows[].unit` | `metricCard` | 指标值旁展示的单位 | 字符串，例如“个”“次” |
| `rows[].changes[].tone` | `metricCard` | 变化值的语义色；`auto` 按正负判断 | `auto` / `neutral` / `positive` / `danger` |
| `progress.valueField` | `metricCard` | 圆形完成率使用的数值字段 | 字段绑定，数值按 0–100 解释 |
| `progress.label` | `metricCard` | 完成率图形下方的说明文字 | 字符串，缺省为“完成率” |
| `columns[].secondaryField` | `table` | 在主值下方展示的次级字段 | 字段绑定 |
| `columns[].badgeField` | `table` | 在主值下方以标准蓝色徽标展示的字段 | 字段绑定 |
| `columns[].dangerValues` | `table` | 命中这些展示值时使用危险语义色 | 不重复的字符串数组 |
| `columns[].selection` | `table` | 点击当前列单元格时原子更新一组筛选状态 | 见 4.3“表格单元格选择” |
| `pagination.totalCount` | `table` | 在数据服务尚无总数槽时用于受控展示“总条数” | 大于等于 0 的整数 |
| `pagination.numbered` | `table` | 是否显示数字页码 | 布尔值 |
| `visible` | 页面筛选器 | 是否在筛选器区域显示控件；不影响其作为筛选状态参与联动 | 布尔值，缺省视为显示 |

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
  "schemaVersion": "2.0",
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
          "label": "成交总额"
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
            "rows": [
              {
                "label": "成交总额",
                "valueField": {
                  "data": "main",
                  "field": "gmv",
                  "format": "number-grouped"
                }
              }
            ]
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
  "schemaVersion": "2.0",
  "id": "dynamic-region",
  "meta": {
    "description": "打开页面时动态查询区域成交总额"
  },
  "dataSources": {
    "by-region": {
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
  "schemaVersion": "2.0",
  "id": "interactive-region",
  "meta": {
    "description": "点击区域柱条后联动查询所选区域成交总额"
  },
  "dataSources": {
    "by-region": {
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

`dimension` 筛选器字段：

| 字段 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `id` | 是 | 筛选状态的稳定标识；query 订阅和组件写入都引用这个 id | 页面内唯一 |
| `type` | 是 | 筛选器类型判别值 | 固定为 `"dimension"` |
| `dimension` | 是 | 该筛选状态约束的数据服务维度 code | 元数据快照中存在的维度 |
| `label` | 否 | 筛选控件面向用户显示的名称 | 字符串 |
| `display` | 否 | 筛选控件的标准展示形态，不改变筛选状态语义 | `select` / `tabs` / `tree` / `search`，缺省为 `select` |
| `visible` | 否 | 是否显示筛选控件；设为 `false` 后仍可被 query 订阅、被组件写入 | 布尔值，缺省视为 `true` |
| `default` | 否 | 页面首次打开且 URL 未提供该状态时的默认维度值 | 字符串数组；空数组等同不筛选 |

`timeRange` 筛选器字段：

| 字段 | 必填 | 含义 | 允许值或约束 |
| --- | --- | --- | --- |
| `id` | 是 | 时间筛选状态的稳定标识 | 页面内唯一 |
| `type` | 是 | 筛选器类型判别值 | 固定为 `"timeRange"` |
| `label` | 否 | 时间筛选控件面向用户显示的名称 | 字符串 |
| `precision` | 否 | 时间值精度，同时决定控件和绝对默认值的格式 | `date` / `datetime`，缺省为 `date` |
| `visible` | 否 | 是否显示时间筛选控件；隐藏后仍可作为 query 时间锚点 | 布尔值，缺省视为 `true` |
| `default` | 否 | 页面首次打开且 URL 未提供该状态时的默认时间范围 | `today` / `last7d` / `last30d` / `last90d`，或 `{ "from": "...", "to": "..." }` 闭区间 |
| `default.from` | 使用绝对范围时必填 | 时间闭区间起点 | `date` 精度为 `YYYY-MM-DD`；`datetime` 精度为 `YYYY-MM-DDTHH:mm` |
| `default.to` | 使用绝对范围时必填 | 时间闭区间终点 | 与 `from` 使用相同精度，且不得早于 `from` |

#### 两类 action

1. 页内下钻：从点击行读取一个维度字段并回写筛选状态。

```json
{
  "on": "click",
  "writeFilter": "f-region",
  "field": "region"
}
```

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `on` | 是 | 触发 action 的组件事件 | 当前固定为 `"click"` |
| `writeFilter` | 是 | 接收点击值的当前页筛选器 id | 必须引用当前页已声明的 `dimension` 筛选器 |
| `field` | 是 | 从点击数据行读取哪个字段作为新的筛选值 | 字段引用，不允许 `format`，且字段必须属于组件已绑定的数据槽 |

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

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `on` | 是 | 触发导航的组件事件 | 当前固定为 `"click"` |
| `navigate.page` | 是 | 目标看板页面 id | 必须是可发现的页面 |
| `navigate.carryFilters` | 否 | 将当前页哪些筛选状态按同名 id 携带到目标页 | id 必须同时存在于当前页和目标页，不得重复 |
| `navigate.setFilters` | 否 | 用点击行字段设置目标页筛选器；对象键是目标筛选器 id，值是来源字段引用 | 目标必须是 `dimension` 筛选器；来源字段必须可由当前组件读取且不允许 `format` |

`carryFilters` 的 id 必须在当前页和目标页都存在；`setFilters` 的目标必须是目标页的 `dimension` 筛选器。跨页筛选值使用 URL 传递，目标页的统一运行时从 URL 恢复筛选状态。完整配对参考 [`pages/demo.json`](./pages/demo.json) 和 [`pages/sales-detail.json`](./pages/sales-detail.json)。

#### 表格单元格选择

表格列可通过 `selection.writes` 在一次点击中原子写入多个筛选器。字段写入从当前行取值，
常量写入用于表达 NA / TOP100 等固定范围：

```json
{
  "field": "inspection-na-missing",
  "title": "无公司考察客户数",
  "selection": {
    "writes": {
      "inspection-office": { "field": "representative-office" },
      "inspection-scope": { "value": "NA" }
    }
  }
}
```

| 字段 | 必填 | 含义 | 约束 |
| --- | --- | --- | --- |
| `selection.writes` | 是 | 一次点击要写入的筛选状态集合；对象键是当前页筛选器 id | 至少一个写入目标，目标必须是 `dimension` 筛选器 |
| `writes.<filterId>.field` | 与 `value` 二选一 | 从当前单元格所在数据行读取字段值 | 字段引用，不允许 `format`，且字段必须属于表格已绑定的数据槽 |
| `writes.<filterId>.value` | 与 `field` 二选一 | 写入固定字符串，适合表达 NA / TOP100 等固定范围 | 字符串 |

下方明细页面数据源订阅这两个筛选器。默认选中状态由筛选器 `default` 表达，组件不保存
额外本地状态；点击后统一运行时一次更新完整筛选状态，只重新查询相关页面数据源。

## 5. `mixed` 不是第四个维度

同一页同时包含 `inline` 和 `query` 页面数据源时，页面数据形态为 `mixed`。它是取数组合，不是新的交互等级。

能力按组件实际绑定的页面数据源推导：

- 只绑定 `inline` 的组件仍然是静态的，不能声明 action 或远程分页。
- 绑定 `query` 的组件可以使用动态数据、action 和远程分页。
- 页面上存在一个 `query` 页面数据源，不会让其他 `inline` 组件自动获得动态能力。

## 6. 声明式页面与高代码组件开发

“页面文档保持简单”与“允许高代码开发”并不冲突，关键是把代码放在正确的 seam：

```text
页面作者 / AI
  └─ 只写 Page：标准组件 type + 数据槽 + 语义 props

高代码页面开发者
  └─ 用 TypeScript 函数、循环和类型检查生成 Page，再交给同一 validate

组件开发者
  └─ 在运行时组件集中实现纯渲染组件，把 CSS / SVG / 算法隐藏在组件内部
```

### 6.1 高代码页面组合

复杂、重复的页面可以用 TypeScript 工厂函数生成 `Page`，而不是手工复制大段 JSON。
当前 `/preview` 默认客户活动风险简报就是这种做法：循环生成四个对称业务分区和十六张表，
最终产物仍是普通、完整、可校验的页面文档。

这类辅助函数是**创作工具**，不是新的持久化协议。仓储、修订、diff、发布和统一运行时
仍只认 `Page`，因此不会产生第二套页面资产。

### 6.2 高代码组件开发

一个新的标准组件需要同时完成：

1. 在 [`packages/page/src/page.ts`](./packages/page/src/page.ts) 定义稳定的组件 props 和数据槽接口。
2. 在 [`packages/page/src/schema.ts`](./packages/page/src/schema.ts) 加入可完整校验的结构契约。
3. 在 [`packages/page/src/component-catalog.ts`](./packages/page/src/component-catalog.ts) 描述何时选择、需要什么数据，供 AI 组合页面。
4. 在 `packages/widgets` 实现纯渲染组件，在 Canvas 中登记运行时映射并补测试。

高代码组件内部可以使用 Svelte、CSS、SVG、ECharts 和复杂布局算法，但它对页面暴露的
接口必须保持小而稳定。页面文档不得携带组件源码、任意 CSS、HTML、脚本或远程组件 URL。

### 6.3 保持简单的演进规则

- **重复一次：** 先用 TypeScript 页面工厂消除作者侧重复，不修改 DSL。
- **跨页面稳定重复：** 优先深化已有标准组件，用少量语义 props 隐藏更多实现。
- **形成独立稳定语义：** 才新增受治理的组件 `type`。
- **不做：** 为了复用而在页面文档中增加表达式、继承、任意 `$ref`、CSS 或脚本。

当前最值得优化的是表格创作体验。建议下一步提供轻量的 typed page builder
（例如 `definePage`、`tableColumns`、`activitySection`），但其输出仍必须是现有 `Page`；
暂不增加 `definitions` / `templates` 等新的顶层字段。这样既降低高代码开发的重复劳动，
又不扩大页面作者和 AI 必须学习的持久化接口。

## 7. 从文档到渲染

统一运行时的执行顺序是：

1. `PageRepository` 按页面 id 加载页面文档。
2. 领域层校验 JSON Schema、字段/数据槽/筛选器引用、能力不变式和元数据快照语义。
3. 统一运行时从页面 `filters` 初始化筛选状态，并优先恢复 URL 中的筛选值。
4. `inline` 页面数据源同步产生终态数据快照；`query` 页面数据源的结构化查询与所订阅的筛选状态合成生效查询。
5. 数据网关执行生效查询，统一运行时管理 loading / ready / empty / error、并发和竞态。
6. 统一运行时按组件 `data` 槽分发数据快照，纯渲染组件根据 `props` 呈现。
7. 用户交互由组件上抛事件；统一运行时执行 `writeFilter` 或 `navigate`，然后进入新的状态/查询循环。

## 8. 校验与落库

新增或修改看板页面时：

1. 将完整 JSON 保存到 `pages/<page-id>.json`，文件名与 `id` 一致。
2. 运行 `pnpm validate`，校验结构、引用、能力、元数据快照语义、文件名和跨页链接。
3. 运行 `pnpm dev`，打开 `/pages/<page-id>` 检查数据状态、布局、筛选、页内联动和跨页下钻。

校验错误分为：

- `SCHEMA_ERROR`：页面文档的结构、引用、能力或元数据语义错误，必须修正。
- `METRIC_GAP`：看板页面要求的指标不在元数据快照中，属于需求与数据服务供给的缺口，不应在页面中伪造计算逻辑绕过。
