# 饼图 pieChart

展示少量类别对整体的占比或构成。适用于占比、构成、份额，且类别数量较少。数据形状：一个 dimension 类别字段 + 一个 metric 数值字段。

表达类别占比，维度与度量明确；数据是否适合占比仍取决于业务可加总性。

## 表格式图例与顺序（6.64）

`legend.type: "table"` 将图例作为饼图内部的一块无分割线数据表，类别带色点，数据列有列头；默认在右侧，`position: "left"` 可放左侧。每个类别仍占一条数据行，不折叠、不聚合、不截断；绘图区宽度不足 620px 时图例完整移至下方。图例与扇区共用有效数据行：缺失数量不参与，真实零保留。类别列默认无列头，声明 `categoryLabel` 可添加列头。类别色沿页面类别配色；页面未提供色板时，此模式使用看板类别色板作为统一回退。没有此声明的旧饼图保持原有配色与标签行为。

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

列按声明顺序展示。`field` 绑定 main 数据槽里的度量字段，继承字段格式，也可在字段绑定处覆盖；例如占比已由业务查询返回时，使用 `{ "label": "占比", "field": { "data": "main", "field": "share", "format": "percent-1" } }`，运行时不会重新计算该列。`value: "percentage"` 才按本图有效数值合计计算百分数（0–100 刻度），默认 `percent-1`；合计为零时返回缺失值，显示为“—”。饼图的数值应为业务可加总的非负数；本功能不改变查询和统计口径。

每列的 `unit` 和 `align` 均可省略。`unit` 缺省不追加单位；声明 `"家"` 时，格式化后的 `96` 显示为 `96 家`，仅用于显示，不改变原始数值、扇区大小、排序或占比计算。缺失值保持“—”或字段绑定的 `missingText`，不会追加单位；真实零显示为 `0 家`。`align` 支持 `left`、`center`、`right`，缺省保持数值列右对齐，同时作用于该列列头和全部数据单元格。普通字段列与自动占比列都支持这两个属性；这些选项仅属于饼图图例，不改变独立分类明细的页面协议。

**默认不按数值排序**，保留输入行序。需要跨刷新稳定的业务类别顺序时显式声明 `categoryOrder`，按类别字段的原始标量取值匹配，已声明类别保持此顺序并预留色位；未列出的类别按输入行序接在末尾。`sort: "asc" | "desc"` 是显式按扇区数值排序的可选项，同值保持输入相对顺序，不得与 `categoryOrder` 同时声明。排序对整个饼图生效，图例、扇区和点击对应的数据行始终一致；它不是修改源数据或排序查询。

开启表格式图例时，外围文字与引导线默认隐藏，`labelLine: true` 可显式恢复。扇区继续使用已有 tooltip、高亮和点击动作；图例为只读呈现，不点击隐藏、不实现自定义联动。该模式不能与 `compactRing` 或 `echartsOption.legend` 同时声明；原生高级图例仍可用于没有表格式图例的饼图。图例作为实际 DOM 表格随现有静态导出路径呈现。

完整内联合成场景：`/pages/pie-table-legend`，包含左右位置、默认/升降序、自定义类别顺序、数量变化后保持顺序、返回占比/自动占比、缺失与零合计。它不是独立的 `categoryBreakdown` 页面组件；只是内部复用其呈现实现。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文通过独立 [filterGroup](filterGroup.md) 组件声明筛选按钮组；需要同组放置时使用组合卡。图表本身不再声明 `props.filter`。迁移后的完整页面见 `chart-local-filter-page`。

6.32 的隐含高级入口 `props.echartsOption` 用于显式要求的 ECharts 呈现定制；普通创作优先使用上面的封闭属性。规则、保护路径、console 诊断与降级见[高级呈现扩展](../chart-option.md)。

## 常量取值（6.59）

本组件的数据配置项支持字段或常量来源，声明互斥、格式单位、空态和限制见[组件取值](../field-bindings-and-formats.md#chart-constant-values)。示例路由为 `/pages/chart-constant-values-page`。常量沿本组件原有行集或单值语义使用，不新增查询结果或业务身份。


页面协议 6.73。结构真源为本册[schema.json](../schema.json)，SHA256 `5746e4ce5ba4823452f4dfdfc6258798d2e4db3ed03d22131f4abd30af4d0b2a`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e74"></a>

### `@pieChartComponent`

Schema位置：`#/definitions/pieChartComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@pieChartComponent.id`

Schema位置：`#/definitions/pieChartComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@pieChartComponent.visibleWhen`

Schema位置：`#/definitions/pieChartComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@pieChartComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@pieChartComponent.type`

Schema位置：`#/definitions/pieChartComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="pieChart" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "pieChart" | 用于选择@pieChartComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@pieChartComponent.layout`

Schema位置：`#/definitions/pieChartComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@pieChartComponent.data`

Schema位置：`#/definitions/pieChartComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@pieChartComponent.props`

Schema位置：`#/definitions/pieChartComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f30"></a>

### `@pieChartComponent.props · anyOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["valueField","categoryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c75654669656c64"></a>

### `@pieChartComponent.props · anyOf[0].valueField`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c7565"></a>

### `@pieChartComponent.props · anyOf[0].value`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c75652f6e6f74"></a>

### `@pieChartComponent.props · anyOf[0].value · not`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/value/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f736f7274"></a>

### `@pieChartComponent.props · anyOf[0].sort`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/sort`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["asc","desc"] | Schema未设默认；装配/运行时默认见语义说明 | 显式按扇区数值升序或降序，同值稳定；默认不排序，不得与categoryOrder并用。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "asc" | 按原始可比较值升序，缺值仍排尾。 |
| "desc" | 按原始可比较值降序，缺值仍排尾。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f63617465676f72794f72646572"></a>

### `@pieChartComponent.props · anyOf[0].categoryOrder`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/categoryOrder`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 按类别原始标量声明固定顺序并预留色位；未声明类别保留输入顺序接到末尾。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f63617465676f72794f726465722f6974656d73"></a>

### `@pieChartComponent.props · anyOf[0].categoryOrder[]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/categoryOrder/items`。目标：[#/definitions/scalar](../fields.md#schema-232f646566696e6974696f6e732f7363616c6172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalar | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6567656e64"></a>

### `@pieChartComponent.props · anyOf[0].legend`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/legend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 图例及受控档位。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6567656e642f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[0].legend · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/legend/allOf/0`。目标：[#/definitions/pieLegend](../components/pieChart.md#schema-232f646566696e6974696f6e732f7069654c6567656e64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieLegend | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64"></a>

### `@pieLegend`

Schema位置：`#/definitions/pieLegend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","columns"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e642f70726f706572746965732f74797065"></a>

### `@pieLegend.type`

Schema位置：`#/definitions/pieLegend/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="table" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "table" | 用于选择@pieLegend.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e642f70726f706572746965732f706f736974696f6e"></a>

### `@pieLegend.position`

Schema位置：`#/definitions/pieLegend/properties/position`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["left","right"] | Schema未设默认；装配/运行时默认见语义说明 | 表格式图例位置，默认right；绘图区不足620px时移至下方。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |
| "right" | 右对齐或右侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e642f70726f706572746965732f63617465676f72794c6162656c"></a>

### `@pieLegend.categoryLabel`

Schema位置：`#/definitions/pieLegend/properties/categoryLabel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 类别列头；缺省取字段label，false显式隐藏列头。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e642f70726f706572746965732f63617465676f72794c6162656c2f616c6c4f662f30"></a>

### `@pieLegend.categoryLabel · allOf[0]`

Schema位置：`#/definitions/pieLegend/properties/categoryLabel/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e642f70726f706572746965732f636f6c756d6e73"></a>

### `@pieLegend.columns`

Schema位置：`#/definitions/pieLegend/properties/columns`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 列或透视输出列的有序声明，按所属分支解释。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e642f70726f706572746965732f636f6c756d6e732f6974656d73"></a>

### `@pieLegend.columns[]`

Schema位置：`#/definitions/pieLegend/properties/columns/items`。目标：[#/definitions/pieLegendColumn](../components/pieChart.md#schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieLegendColumn | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e"></a>

### `@pieLegendColumn`

Schema位置：`#/definitions/pieLegendColumn`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f30"></a>

### `@pieLegendColumn · anyOf[0]`

Schema位置：`#/definitions/pieLegendColumn/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f302f70726f706572746965732f6c6162656c"></a>

### `@pieLegendColumn · anyOf[0].label`

Schema位置：`#/definitions/pieLegendColumn/anyOf/0/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@pieLegendColumn · anyOf[0].field`

Schema位置：`#/definitions/pieLegendColumn/anyOf/0/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f302f70726f706572746965732f756e6974"></a>

### `@pieLegendColumn · anyOf[0].unit`

Schema位置：`#/definitions/pieLegendColumn/anyOf/0/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 仅在非缺失值后以一个空格追加的单位；缺省不追加，不改变计算值 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f302f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@pieLegendColumn · anyOf[0].unit · allOf[0]`

Schema位置：`#/definitions/pieLegendColumn/anyOf/0/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f302f70726f706572746965732f616c69676e"></a>

### `@pieLegendColumn · anyOf[0].align`

Schema位置：`#/definitions/pieLegendColumn/anyOf/0/properties/align`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["left","center","right"] | Schema未设默认；装配/运行时默认见语义说明 | 本列列头与数据共同对齐；缺省保持数值列右对齐 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |
| "center" | 本列列头与数据单元格水平居中。 |
| "right" | 右对齐或右侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f31"></a>

### `@pieLegendColumn · anyOf[1]`

Schema位置：`#/definitions/pieLegendColumn/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["label","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f312f70726f706572746965732f6c6162656c"></a>

### `@pieLegendColumn · anyOf[1].label`

Schema位置：`#/definitions/pieLegendColumn/anyOf/1/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pieLegendColumn · anyOf[1].value`

Schema位置：`#/definitions/pieLegendColumn/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="percentage" | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "percentage" | 用于选择@pieLegendColumn · anyOf[1].value分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@pieLegendColumn · anyOf[1].format`

Schema位置：`#/definitions/pieLegendColumn/anyOf/1/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 显示格式，不修改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 时间窗口：基准所在完整周期；offset按指定unit移动周期。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f312f70726f706572746965732f756e6974"></a>

### `@pieLegendColumn · anyOf[1].unit`

Schema位置：`#/definitions/pieLegendColumn/anyOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 仅在非缺失值后以一个空格追加的单位；缺省不追加，不改变计算值 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f312f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@pieLegendColumn · anyOf[1].unit · allOf[0]`

Schema位置：`#/definitions/pieLegendColumn/anyOf/1/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654c6567656e64436f6c756d6e2f616e794f662f312f70726f706572746965732f616c69676e"></a>

### `@pieLegendColumn · anyOf[1].align`

Schema位置：`#/definitions/pieLegendColumn/anyOf/1/properties/align`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["left","center","right"] | Schema未设默认；装配/运行时默认见语义说明 | 本列列头与数据共同对齐；缺省保持数值列右对齐 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |
| "center" | 本列列头与数据单元格水平居中。 |
| "right" | 右对齐或右侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f7469746c65"></a>

### `@pieChartComponent.props · anyOf[0].title`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[0].title · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f656d7074794265686176696f72"></a>

### `@pieChartComponent.props · anyOf[0].emptyBehavior`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/emptyBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["default","showConstants"] | Schema未设默认；装配/运行时默认见语义说明 | 图表级空数据策略；只作用于成功空结果，不把错误或加载中当成空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "default" | 沿用原有空数据呈现；空数据源不显示常量数值。 |
| "showConstants" | 成功空结果时允许显示具备必要上下文的常量；不伪造类别和地域。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f656368617274734f7074696f6e"></a>

### `@pieChartComponent.props · anyOf[0].echartsOption`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/echartsOption`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.32 高级呈现 JSON；仅显式需求时使用，保护数据、结构与交互，异常单次回退且诊断仅console。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f656368617274734f7074696f6e2f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[0].echartsOption · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/echartsOption/allOf/0`。目标：[#/definitions/chartOption](../chart-option.md#schema-232f646566696e6974696f6e732f63686172744f7074696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/chartOption | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76617269616e74"></a>

### `@pieChartComponent.props · anyOf[0].variant`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="compactRing" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compactRing" | 用于选择@pieChartComponent.props · anyOf[0].variant分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f63617465676f72794669656c64"></a>

### `@pieChartComponent.props · anyOf[0].categoryField`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/categoryField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 类别维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f72696e67"></a>

### `@pieChartComponent.props · anyOf[0].ring`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/ring`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^\\d{1,2}%$" | Schema未设默认；装配/运行时默认见语义说明 | 饼图环形呈现。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6162656c4c696e65"></a>

### `@pieChartComponent.props · anyOf[0].labelLine`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/labelLine`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 标签指引线呈现。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f616374696f6e73"></a>

### `@pieChartComponent.props · anyOf[0].actions`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[0].actions · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/0/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f31"></a>

### `@pieChartComponent.props · anyOf[1]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value","categoryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75654669656c64"></a>

### `@pieChartComponent.props · anyOf[1].valueField`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/valueField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75654669656c642f6e6f74"></a>

### `@pieChartComponent.props · anyOf[1].valueField · not`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/valueField/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pieChartComponent.props · anyOf[1].value`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@pieChartComponent.props · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@pieChartComponent.props · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@pieChartComponent.props · anyOf[1].format`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 显示格式，不修改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 时间窗口：基准所在完整周期；offset按指定unit移动周期。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f756e6974"></a>

### `@pieChartComponent.props · anyOf[1].unit`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[1].unit · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f63757272656e6379"></a>

### `@pieChartComponent.props · anyOf[1].currency`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6d697373696e6754657874"></a>

### `@pieChartComponent.props · anyOf[1].missingText`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/missingText`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1; maxLength=100 | Schema未设默认；装配/运行时默认见语义说明 | 当前取值缺失时显示的文字，不生成业务值。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f736f7274"></a>

### `@pieChartComponent.props · anyOf[1].sort`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/sort`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["asc","desc"] | Schema未设默认；装配/运行时默认见语义说明 | 显式按扇区数值升序或降序，同值稳定；默认不排序，不得与categoryOrder并用。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "asc" | 按原始可比较值升序，缺值仍排尾。 |
| "desc" | 按原始可比较值降序，缺值仍排尾。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f63617465676f72794f72646572"></a>

### `@pieChartComponent.props · anyOf[1].categoryOrder`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/categoryOrder`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 按类别原始标量声明固定顺序并预留色位；未声明类别保留输入顺序接到末尾。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f63617465676f72794f726465722f6974656d73"></a>

### `@pieChartComponent.props · anyOf[1].categoryOrder[]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/categoryOrder/items`。目标：[#/definitions/scalar](../fields.md#schema-232f646566696e6974696f6e732f7363616c6172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalar | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6567656e64"></a>

### `@pieChartComponent.props · anyOf[1].legend`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/legend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 图例及受控档位。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6567656e642f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[1].legend · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/legend/allOf/0`。目标：[#/definitions/pieLegend](../components/pieChart.md#schema-232f646566696e6974696f6e732f7069654c6567656e64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieLegend | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f7469746c65"></a>

### `@pieChartComponent.props · anyOf[1].title`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[1].title · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f656d7074794265686176696f72"></a>

### `@pieChartComponent.props · anyOf[1].emptyBehavior`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/emptyBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["default","showConstants"] | Schema未设默认；装配/运行时默认见语义说明 | 图表级空数据策略；只作用于成功空结果，不把错误或加载中当成空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "default" | 沿用原有空数据呈现；空数据源不显示常量数值。 |
| "showConstants" | 成功空结果时允许显示具备必要上下文的常量；不伪造类别和地域。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f656368617274734f7074696f6e"></a>

### `@pieChartComponent.props · anyOf[1].echartsOption`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/echartsOption`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.32 高级呈现 JSON；仅显式需求时使用，保护数据、结构与交互，异常单次回退且诊断仅console。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f656368617274734f7074696f6e2f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[1].echartsOption · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/echartsOption/allOf/0`。目标：[#/definitions/chartOption](../chart-option.md#schema-232f646566696e6974696f6e732f63686172744f7074696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/chartOption | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76617269616e74"></a>

### `@pieChartComponent.props · anyOf[1].variant`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="compactRing" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compactRing" | 用于选择@pieChartComponent.props · anyOf[1].variant分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f63617465676f72794669656c64"></a>

### `@pieChartComponent.props · anyOf[1].categoryField`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/categoryField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 类别维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f72696e67"></a>

### `@pieChartComponent.props · anyOf[1].ring`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/ring`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^\\d{1,2}%$" | Schema未设默认；装配/运行时默认见语义说明 | 饼图环形呈现。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6162656c4c696e65"></a>

### `@pieChartComponent.props · anyOf[1].labelLine`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/labelLine`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 标签指引线呈现。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f616374696f6e73"></a>

### `@pieChartComponent.props · anyOf[1].actions`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@pieChartComponent.props · anyOf[1].actions · allOf[0]`

Schema位置：`#/definitions/pieChartComponent/properties/props/anyOf/1/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-pieChart.json)：独立完整页面，保留必要语义依赖。
- [compactRing](../examples/component-pieChart-compactRing.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-values-page](../examples/chart-constant-values-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-branches](../examples/chart-constant-branches.json)：完整合法页面；查询仅为静态契约证据。
- [pie-table-legend](../examples/pie-table-legend.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-pieChart.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "pie",
  "type": "pieChart",
  "layout": {
    "span": 6
  },
  "props": {
    "title": "饼图：三个现有类别均为 2",
    "categoryField": "category",
    "value": 2
  },
  "data": {
    "main": "main"
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/charts.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/components/pie-chart/presentation.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/components/pie-chart/PieChart.svelte`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/pieChartComponent/properties/props/anyOf/0`：[合法完整页面](../examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/4/props`。
- `#/definitions/pieLegendColumn/anyOf/0`：[合法完整页面](../examples/pie-table-legend.json)，JSON Pointer `#/sections/0/components/0/props/legend/columns/0`。
- `#/definitions/pieLegendColumn/anyOf/1`：[合法完整页面](../examples/pie-table-legend.json)，JSON Pointer `#/sections/2/components/0/props/legend/columns/1`。
- `#/definitions/pieChartComponent/properties/props/anyOf/1`：[合法完整页面](../examples/component-pieChart.json)，JSON Pointer `#/sections/0/components/0/props`。
- `#/definitions/pieChartComponent/properties/props/anyOf/1/properties/value/anyOf/0`：[合法完整页面](../examples/component-pieChart.json)，JSON Pointer `#/sections/0/components/0/props/value`。
- `#/definitions/pieChartComponent/properties/props/anyOf/1/properties/value/anyOf/1`：[合法完整页面](../examples/chart-constant-branches.json)，JSON Pointer `#/sections/0/components/2/props/value`。
