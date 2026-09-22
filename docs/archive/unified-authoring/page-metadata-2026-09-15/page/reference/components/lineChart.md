# 折线图 lineChart

展示指标随时间或有序维度的变化趋势。适用于趋势、走势、按日/月变化、时间序列。数据形状：一个 date/datetime/dimension 横轴字段 + 一个或多个 metric 字段。

用于沿有序维度观察趋势；序列measure与横轴dimension显式绑定，不把随机类别顺序冒充时间趋势。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.3。结构真源为本册[schema.json](../schema.json)，SHA256 `716d55d27e8ac6026ed8c3f2174eb0b98c80dc9f52a582aa377354e098615c96`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e74"></a>

### `@lineChartComponent`

Schema位置：`#/definitions/lineChartComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@lineChartComponent.id`

Schema位置：`#/definitions/lineChartComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@lineChartComponent.type`

Schema位置：`#/definitions/lineChartComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="lineChart" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "lineChart" | 用于选择@lineChartComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@lineChartComponent.layout`

Schema位置：`#/definitions/lineChartComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@lineChartComponent.data`

Schema位置：`#/definitions/lineChartComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@lineChartComponent.props`

Schema位置：`#/definitions/lineChartComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["xField","series"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@lineChartComponent.props.title`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@lineChartComponent.props.title · allOf[0]`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f784669656c64"></a>

### `@lineChartComponent.props.xField`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/xField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 横轴维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f736572696573"></a>

### `@lineChartComponent.props.series`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/series`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 图表序列及角色/字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365726965732f6974656d73"></a>

### `@lineChartComponent.props.series[]`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/series/items`。目标：[#/definitions/chartSeries](../components/lineChart.md#schema-232f646566696e6974696f6e732f6368617274536572696573)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/chartSeries | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6368617274536572696573"></a>

### `@chartSeries`

Schema位置：`#/definitions/chartSeries`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f70726f706572746965732f6669656c64"></a>

### `@chartSeries.field`

Schema位置：`#/definitions/chartSeries/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f70726f706572746965732f6c6162656c"></a>

### `@chartSeries.label`

Schema位置：`#/definitions/chartSeries/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@chartSeries.label · allOf[0]`

Schema位置：`#/definitions/chartSeries/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f736d6f6f7468"></a>

### `@lineChartComponent.props.smooth`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/smooth`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 使用平滑曲线呈现。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f617265614772616469656e74"></a>

### `@lineChartComponent.props.areaGradient`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/areaGradient`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 折线/面积呈现使用受控渐变。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f737461636b6564"></a>

### `@lineChartComponent.props.stacked`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/stacked`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 启用堆叠呈现。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6475616c41786973"></a>

### `@lineChartComponent.props.dualAxis`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/dualAxis`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控双轴呈现。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73686f77506f696e744c6162656c73"></a>

### `@lineChartComponent.props.showPointLabels`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/showPointLabels`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示各数据点标签。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f686964655941786973"></a>

### `@lineChartComponent.props.hideYAxis`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/hideYAxis`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 隐藏纵轴呈现。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e73"></a>

### `@lineChartComponent.props.actions`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@lineChartComponent.props.actions · allOf[0]`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-lineChart.json)：独立完整页面，保留必要语义依赖。
- [mixed-page](../examples/mixed-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-lineChart.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "sales-trend",
  "type": "lineChart",
  "layout": {
    "span": 8
  },
  "data": {
    "main": "live-sales"
  },
  "props": {
    "xField": {
      "data": "main",
      "field": "stat-date",
      "format": "date-month-day"
    },
    "series": [
      {
        "field": {
          "data": "main",
          "field": "gmv",
          "format": "compact-yi-1"
        }
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/charts.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

