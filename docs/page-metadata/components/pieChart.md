# 饼图 pieChart

展示少量类别对整体的占比或构成。适用于占比、构成、份额，且类别数量较少。数据形状：一个 dimension 类别字段 + 一个 metric 数值字段。

表达类别占比，维度与度量明确；数据是否适合占比仍取决于业务可加总性。

## 表格式图例与顺序（6.64）

`legend.type: "table"` 将图例作为饼图内部的一块无分割线数据表，类别带色点，数据列有列头；默认在右侧，`position: "left"` 可放左侧。每个类别仍占一条数据行，不折叠、不聚合、不截断。组件放不下最小绘图区、图例实际宽度及间距时，图例整体换到图形下方。图例与扇区共用有效数据行：缺失数量不参与，真实零保留。类别列默认无列头，声明 `categoryLabel` 可添加列头。类别色沿页面类别配色；页面未提供色板时，此模式使用看板类别色板作为统一回退。没有此声明的旧饼图保持原有配色与标签行为。

```json
{
  "categoryField": "band",
  "valueField": "customers",
  "ring": "58%",
  "categoryOrder": ["0–25%", "25–50%", "50–75%", "75–125%"],
  "legend": {
    "type": "table",
    "position": "right",
    "columns": [
      { "label": "客户数量", "field": "customers", "unit": "家", "align": "right" },
      { "label": "占比", "value": "percentage", "format": "percent-1" }
    ]
  }
}
```

列按声明顺序展示。`field` 绑定 main 数据槽里的度量字段，继承字段格式，也可在字段绑定处覆盖；例如占比已由业务查询返回时，使用 `{ "label": "占比", "field": { "data": "main", "field": "share", "format": "percent-1" } }`，运行时不会重新计算该列。`value: "percentage"` 才按本图有效数值合计计算百分数（0–100 刻度），默认 `percent-1`；合计为零时返回缺失值，显示为“- -”。饼图的数值应为业务可加总的非负数；本功能不改变查询和统计口径。

每列的 `unit` 和 `align` 均可省略。`unit` 缺省不追加单位；声明 `"家"` 时，格式化后的 `96` 显示为 `96 家`，仅用于显示，不改变原始数值、扇区大小、排序或占比计算。缺失值显示“—”或字段绑定的 `missingText`，不会追加单位；真实零显示为 `0 家`。`align` 支持 `left`、`center`、`right`，缺省保持数值列右对齐，同时作用于该列列头和全部数据单元格。普通字段列与自动占比列都支持这两个属性；这些选项仅属于饼图图例，不改变独立分类明细的页面协议。

**默认不按数值排序**，保留输入行序。需要跨刷新稳定的业务类别顺序时显式声明 `categoryOrder`，按类别字段的原始标量取值匹配，已声明类别保持此顺序并预留色位；未列出的类别按输入行序接在末尾。`sort: "asc" | "desc"` 是显式按扇区数值排序的可选项，同值保持输入相对顺序，不得与 `categoryOrder` 同时声明。排序对整个饼图生效，图例、扇区和点击对应的数据行始终一致；它不是修改源数据或排序查询。

开启表格式图例时，外围文字与引导线默认隐藏，`labelLine: true` 可显式恢复。扇区继续使用已有 tooltip、高亮和点击动作；图例为只读呈现，不点击隐藏、不实现自定义联动。该模式不能与 `compactRing` 或 `echartsOption.legend` 同时声明；原生高级图例仍可用于没有表格式图例的饼图。图例作为实际 DOM 表格随现有静态导出路径呈现。

表格式图例各列间隔 16px。使用默认图形布局时，并排的图形与表格式图例按图形的可见外缘和图例宽度整体水平居中。图例换到下方时，图形与图例分别水平居中。图形外缘与图例相隔 16px，环形图在 `ring` 指定的内半径上向外绘制 16px，受绘图区的默认外半径上限约束。环形图点击弹窗由页面显式声明的 `actions` 触发，省略该动作时仍可悬停查看数据。

完整内联合成场景：`/pages/pie-table-legend`，包含半宽环形图与柱状图并排、左右图例整体居中和窄容器换行、默认/升降序、自定义类别顺序、数量变化后保持顺序、返回占比/自动占比、缺失与零合计。它不是独立的 `categoryBreakdown` 页面组件；只是内部复用其呈现实现。

<a id="pie-legend-color-rule"></a>

## 图例数字着色（6.133）

在 `props.legend.columns[]` 的字段列声明可选 `colorRule`，绑定 main 数据槽的 `number` 或 `money` 度量。规则与表格数字列和指标卡变化项共用。

```json
{
  "label": "同比",
  "field": { "data": "main", "field": "yoy", "format": "percent-2-signed" },
  "colorRule": { "mode": "sign", "positive": "green", "negative": "red" }
}
```

`sign` 分别声明正、负值的颜色，零和缺失值用普通文字色。`{"mode":"fixed","color":"red"}` 给所有有效数值着色，包括零。两种模式均只接受 `red` 和 `green`。正负判断沿用[共享数值格式规则](../field-bindings-and-formats.md#numeric-value-color)，使用列内显式格式或字段的默认格式。示例中的 `8.5` 表示 `8.5%`。

颜色作用于屏幕和静态导出的数值单元格。省略规则时沿用普通文字色。类别色点、扇区、列头和图例行序沿用各自既有规则。自动占比列 `value: "percentage"` 使用普通文字色。合成入口 `/pages/pie-legend-color-rule` 对照同比、环比、固定色、零、缺失和舍入。

<a id="percentage-labels"></a>

## 外围百分比标签

普通饼图及 `labelLine: true` 显示的外围标签统一采用通用 `percent-adaptive` 格式，显示“类别: 1.25%”。占比与表格式图例的自动占比列共用有效原值合计及百分数计算，直接按 0–100 刻度格式化，不使用 ECharts 预舍入的 `percent`，也不为凑齐 100% 分配舍入差额。三个相等扇区各显示 `33.3%`。真实零在有效合计下显示 `0%`，零合计显示“- -%”；缺失值不参与合计，也不生成扇区。

外围标签是派生占比，使用默认 `percent-adaptive`；数值字段的格式仍负责原数值展示，图例列的显式格式只作用于该列。已有 `compactRing`、`labelLine: false` 和表格式图例默认隐藏外围标签的行为保持。显式高级 `echartsOption.series[].label.formatter` 仍按原扩展规则覆盖默认标签。本次修正默认呈现，不新增字段或 Schema 版本。

内联合成验收入口：`/pages/chart-number-format`，包含舍入边界、有效零、缺失、零合计、均分占比及外围与表格式图例对照。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文通过独立 [filterGroup](filterGroup.md) 组件声明筛选按钮组；需要同组放置时使用组合卡。图表本身不再声明 `props.filter`。迁移后的完整页面见 `chart-local-filter-page`。

6.32 的隐含高级入口 `props.echartsOption` 用于显式要求的 ECharts 呈现定制；普通创作优先使用上面的封闭属性。规则、保护路径、console 诊断与降级见[高级呈现扩展](../chart-option.md)。

## 常量取值（6.59）

本组件的数据配置项支持字段或常量来源，声明互斥、格式单位、空态和限制见[组件取值](../field-bindings-and-formats.md#chart-constant-values)。示例路由为 `/pages/chart-constant-values-page`。常量沿本组件原有行集或单值语义使用，不新增查询结果或业务身份。
