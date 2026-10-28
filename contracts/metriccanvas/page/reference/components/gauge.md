# 仪表 gauge

用环形刻度突出一个比率或完成度类 KPI。适用于管道支撑率、完成率、达标率这类单值百分比 KPI。数据形状：单行记录；一个 measure 数值字段。

取主数据源单行measure。运行时min缺省0、max缺省100；进度夹到0–1，非法范围不产生有效进度。variant唯一显式值mini，用于紧凑环形仪表。max在Schema必须大于0；这不代表任意min/max组合都有有效区间。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

## 常量取值（6.59）

本组件的数据配置项支持字段或常量来源，声明互斥、格式单位、空态和限制见[组件取值](../field-bindings-and-formats.md#chart-constant-values)。示例路由为 `/pages/chart-constant-values-page`。常量沿本组件原有行集或单值语义使用，不新增查询结果或业务身份。


页面协议 6.71。结构真源为本册[schema.json](../schema.json)，SHA256 `532a0b97ddd9a62fd15d49e5a9752e6e334eceacc5d5fc00e06e8e9a280e8194`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e74"></a>

### `@gaugeComponent`

Schema位置：`#/definitions/gaugeComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@gaugeComponent.id`

Schema位置：`#/definitions/gaugeComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@gaugeComponent.visibleWhen`

Schema位置：`#/definitions/gaugeComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@gaugeComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@gaugeComponent.type`

Schema位置：`#/definitions/gaugeComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="gauge" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "gauge" | 用于选择@gaugeComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@gaugeComponent.layout`

Schema位置：`#/definitions/gaugeComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@gaugeComponent.data`

Schema位置：`#/definitions/gaugeComponent/properties/data`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f646174612f616c6c4f662f30"></a>

### `@gaugeComponent.data · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/data/allOf/0`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@gaugeComponent.props`

Schema位置：`#/definitions/gaugeComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f30"></a>

### `@gaugeComponent.props · anyOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c75654669656c64"></a>

### `@gaugeComponent.props · anyOf[0].valueField`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c7565"></a>

### `@gaugeComponent.props · anyOf[0].value`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c75652f6e6f74"></a>

### `@gaugeComponent.props · anyOf[0].value · not`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/value/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f7469746c65"></a>

### `@gaugeComponent.props · anyOf[0].title`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@gaugeComponent.props · anyOf[0].title · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76617269616e74"></a>

### `@gaugeComponent.props · anyOf[0].variant`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="mini" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "mini" | 紧凑环形仪表，值域计算不变。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f656d7074794265686176696f72"></a>

### `@gaugeComponent.props · anyOf[0].emptyBehavior`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/emptyBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["default","showConstants"] | Schema未设默认；装配/运行时默认见语义说明 | 图表级空数据策略；只作用于成功空结果，不把错误或加载中当成空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "default" | 沿用原有空数据呈现；空数据源不显示常量数值。 |
| "showConstants" | 成功空结果时允许显示具备必要上下文的常量；不伪造类别和地域。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6d696e"></a>

### `@gaugeComponent.props · anyOf[0].min`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/min`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 量表下界。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6d6178"></a>

### `@gaugeComponent.props · anyOf[0].max`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/max`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | exclusiveMinimum=0 | Schema未设默认；装配/运行时默认见语义说明 | 时间上限与min/disableFuture/禁选范围取交集；完整自然期不能截短。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f756e6974"></a>

### `@gaugeComponent.props · anyOf[0].unit`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@gaugeComponent.props · anyOf[0].unit · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6162656c"></a>

### `@gaugeComponent.props · anyOf[0].label`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@gaugeComponent.props · anyOf[0].label · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f616374696f6e73"></a>

### `@gaugeComponent.props · anyOf[0].actions`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@gaugeComponent.props · anyOf[0].actions · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/0/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f31"></a>

### `@gaugeComponent.props · anyOf[1]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75654669656c64"></a>

### `@gaugeComponent.props · anyOf[1].valueField`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/valueField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75654669656c642f6e6f74"></a>

### `@gaugeComponent.props · anyOf[1].valueField · not`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/valueField/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@gaugeComponent.props · anyOf[1].value`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@gaugeComponent.props · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@gaugeComponent.props · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@gaugeComponent.props · anyOf[1].format`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/format`。

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

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f756e6974"></a>

### `@gaugeComponent.props · anyOf[1].unit`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@gaugeComponent.props · anyOf[1].unit · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f63757272656e6379"></a>

### `@gaugeComponent.props · anyOf[1].currency`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6d697373696e6754657874"></a>

### `@gaugeComponent.props · anyOf[1].missingText`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/missingText`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1; maxLength=100 | Schema未设默认；装配/运行时默认见语义说明 | 当前取值缺失时显示的文字，不生成业务值。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f7469746c65"></a>

### `@gaugeComponent.props · anyOf[1].title`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@gaugeComponent.props · anyOf[1].title · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76617269616e74"></a>

### `@gaugeComponent.props · anyOf[1].variant`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="mini" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "mini" | 紧凑环形仪表，值域计算不变。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f656d7074794265686176696f72"></a>

### `@gaugeComponent.props · anyOf[1].emptyBehavior`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/emptyBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["default","showConstants"] | Schema未设默认；装配/运行时默认见语义说明 | 图表级空数据策略；只作用于成功空结果，不把错误或加载中当成空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "default" | 沿用原有空数据呈现；空数据源不显示常量数值。 |
| "showConstants" | 成功空结果时允许显示具备必要上下文的常量；不伪造类别和地域。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6d696e"></a>

### `@gaugeComponent.props · anyOf[1].min`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/min`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 量表下界。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6d6178"></a>

### `@gaugeComponent.props · anyOf[1].max`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/max`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | exclusiveMinimum=0 | Schema未设默认；装配/运行时默认见语义说明 | 时间上限与min/disableFuture/禁选范围取交集；完整自然期不能截短。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6162656c"></a>

### `@gaugeComponent.props · anyOf[1].label`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@gaugeComponent.props · anyOf[1].label · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f616374696f6e73"></a>

### `@gaugeComponent.props · anyOf[1].actions`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@gaugeComponent.props · anyOf[1].actions · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/anyOf/1/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

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

- [最小组件](../examples/component-gauge.json)：独立完整页面，保留必要语义依赖。
- [mini](../examples/component-gauge-mini.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-variants-page](../examples/reference-variants-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-values-page](../examples/chart-constant-values-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-branches](../examples/chart-constant-branches.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-gauge.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "zero",
  "type": "gauge",
  "layout": {
    "span": 6
  },
  "props": {
    "variant": "mini",
    "value": 0,
    "max": 5,
    "label": "零值"
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/gauge.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/components/gauge/Gauge.svelte`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/components/gauge/gauge.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/gaugeComponent/properties/props/anyOf/0`：[合法完整页面](../examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/5/props`。
- `#/definitions/gaugeComponent/properties/props/anyOf/1`：[合法完整页面](../examples/component-gauge.json)，JSON Pointer `#/sections/0/components/0/props`。
- `#/definitions/gaugeComponent/properties/props/anyOf/1/properties/value/anyOf/0`：[合法完整页面](../examples/component-gauge.json)，JSON Pointer `#/sections/0/components/0/props/value`。
- `#/definitions/gaugeComponent/properties/props/anyOf/1/properties/value/anyOf/1`：[合法完整页面](../examples/chart-constant-branches.json)，JSON Pointer `#/sections/0/components/4/props/value`。
