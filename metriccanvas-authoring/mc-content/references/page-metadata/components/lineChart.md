# 折线图 lineChart

展示指标随时间或有序维度的变化趋势。适用于趋势、走势、按日/月变化、时间序列。数据形状：一个 date/datetime/dimension 横轴字段 + 一个或多个 metric 字段。

用于沿有序维度观察趋势；序列measure与横轴dimension显式绑定，不把随机类别顺序冒充时间趋势。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文通过独立 [filterGroup](filterGroup.md) 组件声明筛选按钮组；需要同组放置时使用组合卡。图表本身不再声明 `props.filter`。迁移后的完整页面见 `chart-local-filter-page`。

6.32 的隐含高级入口 `props.echartsOption` 用于显式要求的 ECharts 呈现定制；普通创作优先使用上面的封闭属性。规则、保护路径、console 诊断与降级见[高级呈现扩展](../chart-option.md)。

## 常量取值（6.59）

本组件的数据配置项支持字段或常量来源，声明互斥、格式单位、空态和限制见[组件取值](../field-bindings-and-formats.md#chart-constant-values)。示例路由为 `/pages/chart-constant-values-page`。常量沿本组件原有行集或单值语义使用，不新增查询结果或业务身份。


页面协议 6.62。结构真源为本册[schema.json](../schema.json)，SHA256 `ee1b549ffa88f6bbe75c2d1909fed0cbca6cdafe48bd328cc85d78027336b2ac`。字段表自动生成；可选不等于有默认值。

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

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@lineChartComponent.visibleWhen`

Schema位置：`#/definitions/lineChartComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@lineChartComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/lineChartComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f656d7074794265686176696f72"></a>

### `@lineChartComponent.props.emptyBehavior`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/emptyBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["default","showConstants"] | Schema未设默认；装配/运行时默认见语义说明 | 图表级空数据策略；只作用于成功空结果，不把错误或加载中当成空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "default" | 沿用原有空数据呈现；空数据源不显示常量数值。 |
| "showConstants" | 成功空结果时允许显示具备必要上下文的常量；不伪造类别和地域。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f656368617274734f7074696f6e"></a>

### `@lineChartComponent.props.echartsOption`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/echartsOption`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.32 高级呈现 JSON；仅显式需求时使用，保护数据、结构与交互，异常单次回退且诊断仅console。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f656368617274734f7074696f6e2f616c6c4f662f30"></a>

### `@lineChartComponent.props.echartsOption · allOf[0]`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/echartsOption/allOf/0`。目标：[#/definitions/chartOption](../chart-option.md#schema-232f646566696e6974696f6e732f63686172744f7074696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/chartOption | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f30"></a>

### `@chartSeries · anyOf[0]`

Schema位置：`#/definitions/chartSeries/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@chartSeries · anyOf[0].field`

Schema位置：`#/definitions/chartSeries/anyOf/0/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f302f70726f706572746965732f76616c7565"></a>

### `@chartSeries · anyOf[0].value`

Schema位置：`#/definitions/chartSeries/anyOf/0/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f302f70726f706572746965732f76616c75652f6e6f74"></a>

### `@chartSeries · anyOf[0].value · not`

Schema位置：`#/definitions/chartSeries/anyOf/0/properties/value/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f302f70726f706572746965732f6c6162656c"></a>

### `@chartSeries · anyOf[0].label`

Schema位置：`#/definitions/chartSeries/anyOf/0/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f302f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@chartSeries · anyOf[0].label · allOf[0]`

Schema位置：`#/definitions/chartSeries/anyOf/0/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f31"></a>

### `@chartSeries · anyOf[1]`

Schema位置：`#/definitions/chartSeries/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@chartSeries · anyOf[1].field`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f6669656c642f6e6f74"></a>

### `@chartSeries · anyOf[1].field · not`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/field/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@chartSeries · anyOf[1].value`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@chartSeries · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@chartSeries · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@chartSeries · anyOf[1].format`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/format`。

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

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f756e6974"></a>

### `@chartSeries · anyOf[1].unit`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@chartSeries · anyOf[1].unit · allOf[0]`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f63757272656e6379"></a>

### `@chartSeries · anyOf[1].currency`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f6d697373696e6754657874"></a>

### `@chartSeries · anyOf[1].missingText`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/missingText`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1; maxLength=100 | Schema未设默认；装配/运行时默认见语义说明 | 当前取值缺失时显示的文字，不生成业务值。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f6c6162656c"></a>

### `@chartSeries · anyOf[1].label`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f63686172745365726965732f616e794f662f312f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@chartSeries · anyOf[1].label · allOf[0]`

Schema位置：`#/definitions/chartSeries/anyOf/1/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

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

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f63617465676f72794c6162656c73"></a>

### `@lineChartComponent.props.categoryLabels`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/categoryLabels`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 类别轴名称展示策略；all保留完整类别，不抽样或默认窗口。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f63617465676f72794c6162656c732f616c6c4f662f30"></a>

### `@lineChartComponent.props.categoryLabels · allOf[0]`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/categoryLabels/allOf/0`。目标：[#/definitions/categoryLabels](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f63617465676f72794c6162656c73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/categoryLabels | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73686f7756616c75654c6162656c73"></a>

### `@lineChartComponent.props.showValueLabels`

Schema位置：`#/definitions/lineChartComponent/properties/props/properties/showValueLabels`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 为每个有效柱值或折线节点常驻显示格式化数字；与旧标签开关互斥。 |

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

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-lineChart.json)：独立完整页面，保留必要语义依赖。
- [mixed-page](../examples/mixed-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-values-page](../examples/chart-constant-values-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-branches](../examples/chart-constant-branches.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-lineChart.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "empty-line",
  "type": "lineChart",
  "layout": {
    "span": 6
  },
  "props": {
    "title": "空横轴：保留空图，不伪造类别",
    "xField": "category",
    "series": [
      {
        "value": 2,
        "label": "固定值"
      }
    ],
    "emptyBehavior": "showConstants"
  },
  "data": {
    "main": "empty"
  }
}
```


## 联合分支见证（生成）

- `#/definitions/chartSeries/anyOf/0`：[合法完整页面](../examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/3/props/series/0`。
- `#/definitions/chartSeries/anyOf/1`：[合法完整页面](../examples/component-lineChart.json)，JSON Pointer `#/sections/0/components/0/props/series/0`。
- `#/definitions/chartSeries/anyOf/1/properties/value/anyOf/0`：[合法完整页面](../examples/component-lineChart.json)，JSON Pointer `#/sections/0/components/0/props/series/0/value`。
- `#/definitions/chartSeries/anyOf/1/properties/value/anyOf/1`：[合法完整页面](../examples/chart-constant-branches.json)，JSON Pointer `#/sections/0/components/1/props/series/0/value`。
