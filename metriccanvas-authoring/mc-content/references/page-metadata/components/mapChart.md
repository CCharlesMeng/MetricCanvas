# 地图 mapChart

展示国家或省级地域分布，可按层级维度筛选器做三级下钻。适用于明确要求中国/世界地图，且地域名称能映射到地图。数据形状：地域名称 dimension 字段 + 一个 metric 数值字段。

map限定china/world，区域名称须与底图名称或显式nameMap匹配；协议地名资产来自实际底图。regionalOverview、分段legend、tooltip字段与固定摘要遵循声明；未知地名可能无法着色，静态校验不能证明实际地理匹配。

nameMap 的方向是数据地名 → 底图区域名，例如 {"中国":"China"}。欧洲等宏观区域不能直接等同一个国家，须有明确的区域到几何或国家集合映射；缺少该输入时不能猜测替代国家。

层级绑定的 levelField 值必须等于 dimension filter 的 hierarchy.id，而非显示 label；例如 id 为 global、label 为 全球时，行内层级值为 global。初始作用域、codeField 和 parentField 需要与层级数据一致。地图着色、提示与下钻仍须在运行时验证，未知或未匹配地区不能用零值伪造完整覆盖。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

Dashboard 正文通过独立 [filterGroup](filterGroup.md) 组件声明筛选按钮组；需要同组放置时使用组合卡。图表本身不再声明 `props.filter`。迁移后的完整页面见 `chart-local-filter-page`。

## 常量取值（6.59）

本组件的数据配置项支持字段或常量来源，声明互斥、格式单位、空态和限制见[组件取值](../field-bindings-and-formats.md#chart-constant-values)。示例路由为 `/pages/chart-constant-values-page`。常量沿本组件原有行集或单值语义使用，不新增查询结果或业务身份。


页面协议 6.64。结构真源为本册[schema.json](../schema.json)，SHA256 `c0aed5e15e699271f4d50813b2e3e140123929c16bdb9b72e11a6555d12d669f`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e74"></a>

### `@mapChartComponent`

Schema位置：`#/definitions/mapChartComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@mapChartComponent.id`

Schema位置：`#/definitions/mapChartComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@mapChartComponent.visibleWhen`

Schema位置：`#/definitions/mapChartComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@mapChartComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@mapChartComponent.type`

Schema位置：`#/definitions/mapChartComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="mapChart" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "mapChart" | 用于选择@mapChartComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@mapChartComponent.layout`

Schema位置：`#/definitions/mapChartComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@mapChartComponent.data`

Schema位置：`#/definitions/mapChartComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@mapChartComponent.props`

Schema位置：`#/definitions/mapChartComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f30"></a>

### `@mapChartComponent.props · anyOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["valueField","nameField","map"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c75654669656c64"></a>

### `@mapChartComponent.props · anyOf[0].valueField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c7565"></a>

### `@mapChartComponent.props · anyOf[0].value`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76616c75652f6e6f74"></a>

### `@mapChartComponent.props · anyOf[0].value · not`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/value/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f7469746c65"></a>

### `@mapChartComponent.props · anyOf[0].title`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[0].title · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f656d7074794265686176696f72"></a>

### `@mapChartComponent.props · anyOf[0].emptyBehavior`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/emptyBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["default","showConstants"] | Schema未设默认；装配/运行时默认见语义说明 | 图表级空数据策略；只作用于成功空结果，不把错误或加载中当成空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "default" | 沿用原有空数据呈现；空数据源不显示常量数值。 |
| "showConstants" | 成功空结果时允许显示具备必要上下文的常量；不伪造类别和地域。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f76617269616e74"></a>

### `@mapChartComponent.props · anyOf[0].variant`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="regionalOverview" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "regionalOverview" | 用于选择@mapChartComponent.props · anyOf[0].variant分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6e616d654669656c64"></a>

### `@mapChartComponent.props · anyOf[0].nameField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/nameField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 对象名称维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6d6170"></a>

### `@mapChartComponent.props · anyOf[0].map`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/map`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["china","world"] | Schema未设默认；装配/运行时默认见语义说明 | 选用china/world内置底图。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "china" | 中国底图，区域名来自地名契约china集合。 |
| "world" | 世界底图，区域名来自地名契约world集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f73636174746572"></a>

### `@mapChartComponent.props · anyOf[0].scatter`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/scatter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["point","effect"] | Schema未设默认；装配/运行时默认见语义说明 | 地图散点或图表散点呈现结构。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "point" | 点型语义。 |
| "effect" | 效果值序列角色。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6e616d654d6170"></a>

### `@mapChartComponent.props · anyOf[0].nameMap`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/nameMap`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 业务区域名与底图原名的显式映射。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6e616d654d61702f6164646974696f6e616c50726f70657274696573"></a>

### `@mapChartComponent.props · anyOf[0].nameMap{key}`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/nameMap/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6e616d654d61702f70726f70657274794e616d6573"></a>

### `@mapChartComponent.props · anyOf[0].nameMap · propertyNames`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/nameMap/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f68696572617263687946696c746572"></a>

### `@mapChartComponent.props · anyOf[0].hierarchyFilter`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/hierarchyFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 地图负责下钻的层级维度筛选器id。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6576656c4669656c64"></a>

### `@mapChartComponent.props · anyOf[0].levelField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/levelField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 层级字段引用。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6576656c4669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[0].levelField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/levelField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f706172656e744669656c64"></a>

### `@mapChartComponent.props · anyOf[0].parentField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/parentField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 父地域/父级字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f706172656e744669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[0].parentField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/parentField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f636f64654669656c64"></a>

### `@mapChartComponent.props · anyOf[0].codeField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/codeField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 编码字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f636f64654669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[0].codeField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/codeField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6576656c4d617073"></a>

### `@mapChartComponent.props · anyOf[0].levelMaps`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/levelMaps`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 层级与地图配置的显式映射。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6576656c4d6170732f6164646974696f6e616c50726f70657274696573"></a>

### `@mapChartComponent.props · anyOf[0].levelMaps{key}`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/levelMaps/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | enum=["china","world"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "china" | 中国底图，区域名来自地名契约china集合。 |
| "world" | 世界底图，区域名来自地名契约world集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6576656c4d6170732f70726f70657274794e616d6573"></a>

### `@mapChartComponent.props · anyOf[0].levelMaps · propertyNames`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/levelMaps/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6567656e64"></a>

### `@mapChartComponent.props · anyOf[0].legend`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/legend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 图例及受控档位。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f6c6567656e642f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[0].legend · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/legend/allOf/0`。目标：[#/definitions/mapLegend](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704c6567656e64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapLegend | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704c6567656e64"></a>

### `@mapLegend`

Schema位置：`#/definitions/mapLegend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["bands"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704c6567656e642f70726f706572746965732f7469746c65"></a>

### `@mapLegend.title`

Schema位置：`#/definitions/mapLegend/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6d61704c6567656e642f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@mapLegend.title · allOf[0]`

Schema位置：`#/definitions/mapLegend/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704c6567656e642f70726f706572746965732f62616e6473"></a>

### `@mapLegend.bands`

Schema位置：`#/definitions/mapLegend/properties/bands`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=2 | Schema未设默认；装配/运行时默认见语义说明 | 按下界递增的图例档位。 |

<a id="schema-232f646566696e6974696f6e732f6d61704c6567656e642f70726f706572746965732f62616e64732f6974656d73"></a>

### `@mapLegend.bands[]`

Schema位置：`#/definitions/mapLegend/properties/bands/items`。目标：[#/definitions/mapLegendBand](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704c6567656e6442616e64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapLegendBand | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704c6567656e6442616e64"></a>

### `@mapLegendBand`

Schema位置：`#/definitions/mapLegendBand`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["label","from"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704c6567656e6442616e642f70726f706572746965732f6c6162656c"></a>

### `@mapLegendBand.label`

Schema位置：`#/definitions/mapLegendBand/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d61704c6567656e6442616e642f70726f706572746965732f66726f6d"></a>

### `@mapLegendBand.from`

Schema位置：`#/definitions/mapLegendBand/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f746f6f6c7469704669656c6473"></a>

### `@mapChartComponent.props · anyOf[0].tooltipFields`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/tooltipFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 悬浮提示允许展示的字段集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f746f6f6c7469704669656c64732f6974656d73"></a>

### `@mapChartComponent.props · anyOf[0].tooltipFields[]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/tooltipFields/items`。目标：[#/definitions/mapTooltipField](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapTooltipField | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c64"></a>

### `@mapTooltipField`

Schema位置：`#/definitions/mapTooltipField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f30"></a>

### `@mapTooltipField · anyOf[0]`

Schema位置：`#/definitions/mapTooltipField/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@mapTooltipField · anyOf[0].field`

Schema位置：`#/definitions/mapTooltipField/anyOf/0/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f302f70726f706572746965732f76616c7565"></a>

### `@mapTooltipField · anyOf[0].value`

Schema位置：`#/definitions/mapTooltipField/anyOf/0/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f302f70726f706572746965732f76616c75652f6e6f74"></a>

### `@mapTooltipField · anyOf[0].value · not`

Schema位置：`#/definitions/mapTooltipField/anyOf/0/properties/value/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f302f70726f706572746965732f6c6162656c"></a>

### `@mapTooltipField · anyOf[0].label`

Schema位置：`#/definitions/mapTooltipField/anyOf/0/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f31"></a>

### `@mapTooltipField · anyOf[1]`

Schema位置：`#/definitions/mapTooltipField/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@mapTooltipField · anyOf[1].field`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f6669656c642f6e6f74"></a>

### `@mapTooltipField · anyOf[1].field · not`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/field/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@mapTooltipField · anyOf[1].value`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/value`。目标：[#/definitions/scalar](../fields.md#schema-232f646566696e6974696f6e732f7363616c6172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalar | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@mapTooltipField · anyOf[1].format`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/format`。

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

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f756e6974"></a>

### `@mapTooltipField · anyOf[1].unit`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@mapTooltipField · anyOf[1].unit · allOf[0]`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f63757272656e6379"></a>

### `@mapTooltipField · anyOf[1].currency`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f6d697373696e6754657874"></a>

### `@mapTooltipField · anyOf[1].missingText`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/missingText`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1; maxLength=100 | Schema未设默认；装配/运行时默认见语义说明 | 当前取值缺失时显示的文字，不生成业务值。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f616e794f662f312f70726f706572746965732f6c6162656c"></a>

### `@mapTooltipField · anyOf[1].label`

Schema位置：`#/definitions/mapTooltipField/anyOf/1/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f70696e6e656453756d6d617279"></a>

### `@mapChartComponent.props · anyOf[0].pinnedSummary`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/pinnedSummary`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 地图固定地域摘要，须符合regionalOverview分支。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f70696e6e656453756d6d6172792f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[0].pinnedSummary · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/pinnedSummary/allOf/0`。目标：[#/definitions/mapPinnedSummary](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d617279)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapPinnedSummary | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d617279"></a>

### `@mapPinnedSummary`

Schema位置：`#/definitions/mapPinnedSummary`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["matchField","matchValue","titleField","fields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d6172792f70726f706572746965732f6d617463684669656c64"></a>

### `@mapPinnedSummary.matchField`

Schema位置：`#/definitions/mapPinnedSummary/properties/matchField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 用于匹配地域/行的字段。 |

<a id="schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d6172792f70726f706572746965732f6d6174636856616c7565"></a>

### `@mapPinnedSummary.matchValue`

Schema位置：`#/definitions/mapPinnedSummary/properties/matchValue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 与matchField类型一致的匹配值。 |

<a id="schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d6172792f70726f706572746965732f6d6174636856616c75652f616e794f662f30"></a>

### `@mapPinnedSummary.matchValue · anyOf[0]`

Schema位置：`#/definitions/mapPinnedSummary/properties/matchValue/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d6172792f70726f706572746965732f6d6174636856616c75652f616e794f662f31"></a>

### `@mapPinnedSummary.matchValue · anyOf[1]`

Schema位置：`#/definitions/mapPinnedSummary/properties/matchValue/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d6172792f70726f706572746965732f7469746c654669656c64"></a>

### `@mapPinnedSummary.titleField`

Schema位置：`#/definitions/mapPinnedSummary/properties/titleField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 详情浮层标题取被点行的该字段；省略时用组件标题。 |

<a id="schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d6172792f70726f706572746965732f6669656c6473"></a>

### `@mapPinnedSummary.fields`

Schema位置：`#/definitions/mapPinnedSummary/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=4 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d6172792f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@mapPinnedSummary.fields[]`

Schema位置：`#/definitions/mapPinnedSummary/properties/fields/items`。目标：[#/definitions/mapTooltipField](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapTooltipField | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f616374696f6e73"></a>

### `@mapChartComponent.props · anyOf[0].actions`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f302f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[0].actions · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/0/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f31"></a>

### `@mapChartComponent.props · anyOf[1]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value","nameField","map"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75654669656c64"></a>

### `@mapChartComponent.props · anyOf[1].valueField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/valueField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | not={} | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75654669656c642f6e6f74"></a>

### `@mapChartComponent.props · anyOf[1].valueField · not`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/valueField/not`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@mapChartComponent.props · anyOf[1].value`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@mapChartComponent.props · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@mapChartComponent.props · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@mapChartComponent.props · anyOf[1].format`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/format`。

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

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f756e6974"></a>

### `@mapChartComponent.props · anyOf[1].unit`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[1].unit · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f63757272656e6379"></a>

### `@mapChartComponent.props · anyOf[1].currency`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6d697373696e6754657874"></a>

### `@mapChartComponent.props · anyOf[1].missingText`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/missingText`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1; maxLength=100 | Schema未设默认；装配/运行时默认见语义说明 | 当前取值缺失时显示的文字，不生成业务值。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f7469746c65"></a>

### `@mapChartComponent.props · anyOf[1].title`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[1].title · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f656d7074794265686176696f72"></a>

### `@mapChartComponent.props · anyOf[1].emptyBehavior`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/emptyBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["default","showConstants"] | Schema未设默认；装配/运行时默认见语义说明 | 图表级空数据策略；只作用于成功空结果，不把错误或加载中当成空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "default" | 沿用原有空数据呈现；空数据源不显示常量数值。 |
| "showConstants" | 成功空结果时允许显示具备必要上下文的常量；不伪造类别和地域。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f76617269616e74"></a>

### `@mapChartComponent.props · anyOf[1].variant`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="regionalOverview" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "regionalOverview" | 用于选择@mapChartComponent.props · anyOf[1].variant分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6e616d654669656c64"></a>

### `@mapChartComponent.props · anyOf[1].nameField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/nameField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 对象名称维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6d6170"></a>

### `@mapChartComponent.props · anyOf[1].map`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/map`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["china","world"] | Schema未设默认；装配/运行时默认见语义说明 | 选用china/world内置底图。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "china" | 中国底图，区域名来自地名契约china集合。 |
| "world" | 世界底图，区域名来自地名契约world集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f73636174746572"></a>

### `@mapChartComponent.props · anyOf[1].scatter`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/scatter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["point","effect"] | Schema未设默认；装配/运行时默认见语义说明 | 地图散点或图表散点呈现结构。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "point" | 点型语义。 |
| "effect" | 效果值序列角色。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6e616d654d6170"></a>

### `@mapChartComponent.props · anyOf[1].nameMap`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/nameMap`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 业务区域名与底图原名的显式映射。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6e616d654d61702f6164646974696f6e616c50726f70657274696573"></a>

### `@mapChartComponent.props · anyOf[1].nameMap{key}`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/nameMap/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6e616d654d61702f70726f70657274794e616d6573"></a>

### `@mapChartComponent.props · anyOf[1].nameMap · propertyNames`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/nameMap/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f68696572617263687946696c746572"></a>

### `@mapChartComponent.props · anyOf[1].hierarchyFilter`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/hierarchyFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 地图负责下钻的层级维度筛选器id。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6576656c4669656c64"></a>

### `@mapChartComponent.props · anyOf[1].levelField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/levelField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 层级字段引用。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6576656c4669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[1].levelField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/levelField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f706172656e744669656c64"></a>

### `@mapChartComponent.props · anyOf[1].parentField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/parentField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 父地域/父级字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f706172656e744669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[1].parentField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/parentField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f636f64654669656c64"></a>

### `@mapChartComponent.props · anyOf[1].codeField`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/codeField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 编码字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f636f64654669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[1].codeField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/codeField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6576656c4d617073"></a>

### `@mapChartComponent.props · anyOf[1].levelMaps`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/levelMaps`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 层级与地图配置的显式映射。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6576656c4d6170732f6164646974696f6e616c50726f70657274696573"></a>

### `@mapChartComponent.props · anyOf[1].levelMaps{key}`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/levelMaps/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | enum=["china","world"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "china" | 中国底图，区域名来自地名契约china集合。 |
| "world" | 世界底图，区域名来自地名契约world集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6576656c4d6170732f70726f70657274794e616d6573"></a>

### `@mapChartComponent.props · anyOf[1].levelMaps · propertyNames`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/levelMaps/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6567656e64"></a>

### `@mapChartComponent.props · anyOf[1].legend`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/legend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 图例及受控档位。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f6c6567656e642f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[1].legend · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/legend/allOf/0`。目标：[#/definitions/mapLegend](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704c6567656e64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapLegend | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f746f6f6c7469704669656c6473"></a>

### `@mapChartComponent.props · anyOf[1].tooltipFields`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/tooltipFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 悬浮提示允许展示的字段集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f746f6f6c7469704669656c64732f6974656d73"></a>

### `@mapChartComponent.props · anyOf[1].tooltipFields[]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/tooltipFields/items`。目标：[#/definitions/mapTooltipField](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapTooltipField | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f70696e6e656453756d6d617279"></a>

### `@mapChartComponent.props · anyOf[1].pinnedSummary`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/pinnedSummary`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 地图固定地域摘要，须符合regionalOverview分支。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f70696e6e656453756d6d6172792f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[1].pinnedSummary · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/pinnedSummary/allOf/0`。目标：[#/definitions/mapPinnedSummary](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d617279)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapPinnedSummary | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f616374696f6e73"></a>

### `@mapChartComponent.props · anyOf[1].actions`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f616e794f662f312f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@mapChartComponent.props · anyOf[1].actions · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/anyOf/1/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `map-legend-bands-increasing`：地图图例档位下界严格递增。反例：[map-legend-bands-not-increasing](../errors/map-legend-bands-not-increasing.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `map-pinned-summary`：固定地域摘要只用于 regionalOverview，匹配值符合类型，标签不重复。反例：[map-pinned-summary-wrong-variant](../errors/map-pinned-summary-wrong-variant.json)、[map-pinned-summary-match-value-type](../errors/map-pinned-summary-match-value-type.json)、[map-pinned-summary-duplicate-label](../errors/map-pinned-summary-duplicate-label.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `map-hierarchy`：地图下钻字段只与 hierarchyFilter 一起使用，目标是声明了 hierarchy 的维度筛选器。反例：[map-level-fields-without-hierarchy-filter](../errors/map-level-fields-without-hierarchy-filter.json)、[map-hierarchy-filter-undeclared](../errors/map-hierarchy-filter-undeclared.json)、[map-hierarchy-filter-not-hierarchical](../errors/map-hierarchy-filter-not-hierarchical.json)、[map-level-maps-unknown-level](../errors/map-level-maps-unknown-level.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-mapChart.json)：独立完整页面，保留必要语义依赖。
- [regionalOverview](../examples/component-mapChart-regionalOverview.json)：独立完整页面，保留必要语义依赖。
- [map-page](../examples/map-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](../examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-values-page](../examples/chart-constant-values-page.json)：完整合法页面；查询仅为静态契约证据。
- [chart-constant-branches](../examples/chart-constant-branches.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-mapChart.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "map",
  "type": "mapChart",
  "layout": {
    "span": 6
  },
  "props": {
    "title": "地图与散点：现有地域均为 2",
    "nameField": "category",
    "value": 2,
    "map": "china",
    "scatter": "point",
    "tooltipFields": [
      {
        "label": "固定目标",
        "value": 2
      },
      {
        "label": "实际值",
        "field": "actual"
      }
    ],
    "nameMap": {
      "北京": "北京市",
      "上海": "上海市",
      "广东": "广东省"
    }
  },
  "data": {
    "main": "main"
  }
}
```


## 联合分支见证（生成）

- `#/definitions/mapChartComponent/properties/props/anyOf/0`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/12/props`。
- `#/definitions/mapTooltipField/anyOf/0`：[合法完整页面](../examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0/props/tooltipFields/1`。
- `#/definitions/mapTooltipField/anyOf/1`：[合法完整页面](../examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0/props/tooltipFields/0`。
- `#/definitions/mapPinnedSummary/properties/matchValue/anyOf/0`：[合法完整页面](../examples/chart-constant-values-page.json)，JSON Pointer `#/sections/0/components/8/props/pinnedSummary/matchValue`。
- `#/definitions/mapPinnedSummary/properties/matchValue/anyOf/1`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/12/props/pinnedSummary/matchValue`。
- `#/definitions/mapChartComponent/properties/props/anyOf/1`：[合法完整页面](../examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0/props`。
- `#/definitions/mapChartComponent/properties/props/anyOf/1/properties/value/anyOf/0`：[合法完整页面](../examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0/props/value`。
- `#/definitions/mapChartComponent/properties/props/anyOf/1/properties/value/anyOf/1`：[合法完整页面](../examples/chart-constant-branches.json)，JSON Pointer `#/sections/0/components/3/props/value`。
