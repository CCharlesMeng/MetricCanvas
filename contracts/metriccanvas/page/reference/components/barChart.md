# 柱状图 barChart

比较离散类别之间的大小或展示分类分布。适用于区域/渠道/产品对比、分类分布、多指标类别比较。数据形状：一个 dimension 类别字段 + 一个或多个 metric 字段。

每个series显式绑定measure并声明适用角色，维度轴来自dimension字段。forecast/actual等角色与色彩语义应与真实业务口径一致。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.11。结构真源为本册[schema.json](../schema.json)，SHA256 `508780df9e2561af9705f7ed2b0d07038e8f2d97027d66f0ae69b5a02a6cb75e`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e74"></a>

### `@barChartComponent`

Schema位置：`#/definitions/barChartComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@barChartComponent.id`

Schema位置：`#/definitions/barChartComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@barChartComponent.type`

Schema位置：`#/definitions/barChartComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="barChart" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "barChart" | 用于选择@barChartComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@barChartComponent.layout`

Schema位置：`#/definitions/barChartComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@barChartComponent.data`

Schema位置：`#/definitions/barChartComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@barChartComponent.props`

Schema位置：`#/definitions/barChartComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["categoryField","series"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@barChartComponent.props.title`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@barChartComponent.props.title · allOf[0]`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@barChartComponent.props.variant`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="reportForecast" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "reportForecast" | 用于选择@barChartComponent.props.variant分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f63617465676f72794669656c64"></a>

### `@barChartComponent.props.categoryField`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/categoryField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 类别维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f736572696573"></a>

### `@barChartComponent.props.series`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/series`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 图表序列及角色/字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365726965732f6974656d73"></a>

### `@barChartComponent.props.series[]`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/series/items`。目标：[#/definitions/barChartSeries](../components/barChart.md#schema-232f646566696e6974696f6e732f6261724368617274536572696573)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/barChartSeries | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274536572696573"></a>

### `@barChartSeries`

Schema位置：`#/definitions/barChartSeries`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f62617243686172745365726965732f70726f706572746965732f6669656c64"></a>

### `@barChartSeries.field`

Schema位置：`#/definitions/barChartSeries/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f62617243686172745365726965732f70726f706572746965732f6c6162656c"></a>

### `@barChartSeries.label`

Schema位置：`#/definitions/barChartSeries/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f62617243686172745365726965732f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@barChartSeries.label · allOf[0]`

Schema位置：`#/definitions/barChartSeries/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f62617243686172745365726965732f70726f706572746965732f726f6c65"></a>

### `@barChartSeries.role`

Schema位置：`#/definitions/barChartSeries/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["actual","forecast"] | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "actual" | 实际值序列角色。 |
| "forecast" | 预测值序列角色。 |

<a id="schema-232f646566696e6974696f6e732f62617243686172745365726965732f70726f706572746965732f737461636b4f72646572"></a>

### `@barChartSeries.stackOrder`

Schema位置：`#/definitions/barChartSeries/properties/stackOrder`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=-9007199254740991; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 堆叠序列的受控顺序。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f737461636b6564"></a>

### `@barChartComponent.props.stacked`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/stacked`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 启用堆叠呈现。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f756e646564"></a>

### `@barChartComponent.props.rounded`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/rounded`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控圆角呈现。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73686f775365676d656e744c6162656c73"></a>

### `@barChartComponent.props.showSegmentLabels`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/showSegmentLabels`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示堆叠分段标签。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73686f77537461636b546f74616c4c6162656c73"></a>

### `@barChartComponent.props.showStackTotalLabels`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/showStackTotalLabels`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示堆叠总量标签。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f686f72697a6f6e74616c"></a>

### `@barChartComponent.props.horizontal`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/horizontal`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 使用横向图表方向。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6475616c41786973"></a>

### `@barChartComponent.props.dualAxis`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/dualAxis`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控双轴呈现。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e73"></a>

### `@barChartComponent.props.actions`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@barChartComponent.props.actions · allOf[0]`

Schema位置：`#/definitions/barChartComponent/properties/props/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `bar-forecast-boundary`：实际 / 预测系列不得跨越采集时间所在月。反例：[forecast-before-captured-month](../errors/forecast-before-captured-month.json)、[actual-after-captured-month](../errors/actual-after-captured-month.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-barChart.json)：独立完整页面，保留必要语义依赖。
- [reportForecast](../examples/component-barChart-reportForecast.json)：独立完整页面，保留必要语义依赖。
- [forecast-page](../examples/forecast-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-barChart.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "trend",
  "type": "barChart",
  "layout": {
    "span": 8
  },
  "data": {
    "main": "monthly"
  },
  "props": {
    "variant": "reportForecast",
    "categoryField": "month",
    "series": [
      {
        "field": "actual",
        "role": "actual"
      },
      {
        "field": "forecast",
        "role": "forecast"
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/charts.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

