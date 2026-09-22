# 地图 mapChart

展示国家或省级地域分布，可按层级维度筛选器做三级下钻。适用于明确要求中国/世界地图，且地域名称能映射到地图。数据形状：地域名称 dimension 字段 + 一个 metric 数值字段。

map限定china/world，区域名称须与底图名称或显式nameMap匹配；协议地名资产来自实际底图。regionalOverview、分段legend、tooltip字段与固定摘要遵循声明；未知地名可能无法着色，静态校验不能证明实际地理匹配。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.3。结构真源为本册[schema.json](../schema.json)，SHA256 `716d55d27e8ac6026ed8c3f2174eb0b98c80dc9f52a582aa377354e098615c96`。字段表自动生成；可选不等于有默认值。

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
| "object" | 本分支必填 | required=["nameField","valueField","map"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@mapChartComponent.props.title`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@mapChartComponent.props.title · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@mapChartComponent.props.variant`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="regionalOverview" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "regionalOverview" | 用于选择@mapChartComponent.props.variant分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6e616d654669656c64"></a>

### `@mapChartComponent.props.nameField`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/nameField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 对象名称维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76616c75654669656c64"></a>

### `@mapChartComponent.props.valueField`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d6170"></a>

### `@mapChartComponent.props.map`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/map`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["china","world"] | Schema未设默认；装配/运行时默认见语义说明 | 选用china/world内置底图。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "china" | 中国底图，区域名来自地名契约china集合。 |
| "world" | 世界底图，区域名来自地名契约world集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73636174746572"></a>

### `@mapChartComponent.props.scatter`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/scatter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["point","effect"] | Schema未设默认；装配/运行时默认见语义说明 | 地图散点或图表散点呈现结构。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "point" | 点型语义。 |
| "effect" | 效果值序列角色。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6e616d654d6170"></a>

### `@mapChartComponent.props.nameMap`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/nameMap`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 业务区域名与底图原名的显式映射。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6e616d654d61702f6164646974696f6e616c50726f70657274696573"></a>

### `@mapChartComponent.props.nameMap{key}`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/nameMap/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6e616d654d61702f70726f70657274794e616d6573"></a>

### `@mapChartComponent.props.nameMap · propertyNames`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/nameMap/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f68696572617263687946696c746572"></a>

### `@mapChartComponent.props.hierarchyFilter`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/hierarchyFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 地图负责下钻的层级维度筛选器id。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6576656c4669656c64"></a>

### `@mapChartComponent.props.levelField`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/levelField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 层级字段引用。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6576656c4669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props.levelField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/levelField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706172656e744669656c64"></a>

### `@mapChartComponent.props.parentField`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/parentField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 父地域/父级字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706172656e744669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props.parentField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/parentField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f64654669656c64"></a>

### `@mapChartComponent.props.codeField`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/codeField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 编码字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f64654669656c642f616c6c4f662f30"></a>

### `@mapChartComponent.props.codeField · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/codeField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6576656c4d617073"></a>

### `@mapChartComponent.props.levelMaps`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/levelMaps`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 层级与地图配置的显式映射。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6576656c4d6170732f6164646974696f6e616c50726f70657274696573"></a>

### `@mapChartComponent.props.levelMaps{key}`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/levelMaps/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | enum=["china","world"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "china" | 中国底图，区域名来自地名契约china集合。 |
| "world" | 世界底图，区域名来自地名契约world集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6576656c4d6170732f70726f70657274794e616d6573"></a>

### `@mapChartComponent.props.levelMaps · propertyNames`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/levelMaps/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6567656e64"></a>

### `@mapChartComponent.props.legend`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/legend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 图例及受控档位。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6567656e642f616c6c4f662f30"></a>

### `@mapChartComponent.props.legend · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/legend/allOf/0`。目标：[#/definitions/mapLegend](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704c6567656e64)。

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

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c7469704669656c6473"></a>

### `@mapChartComponent.props.tooltipFields`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/tooltipFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 悬浮提示允许展示的字段集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6f6c7469704669656c64732f6974656d73"></a>

### `@mapChartComponent.props.tooltipFields[]`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/tooltipFields/items`。目标：[#/definitions/mapTooltipField](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapTooltipField | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c64"></a>

### `@mapTooltipField`

Schema位置：`#/definitions/mapTooltipField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f70726f706572746965732f6c6162656c"></a>

### `@mapTooltipField.label`

Schema位置：`#/definitions/mapTooltipField/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d6170546f6f6c7469704669656c642f70726f706572746965732f6669656c64"></a>

### `@mapTooltipField.field`

Schema位置：`#/definitions/mapTooltipField/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70696e6e656453756d6d617279"></a>

### `@mapChartComponent.props.pinnedSummary`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/pinnedSummary`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 地图固定地域摘要，须符合regionalOverview分支。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70696e6e656453756d6d6172792f616c6c4f662f30"></a>

### `@mapChartComponent.props.pinnedSummary · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/pinnedSummary/allOf/0`。目标：[#/definitions/mapPinnedSummary](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d617050696e6e656453756d6d617279)。

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
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 标题内容绑定字段。 |

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

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e73"></a>

### `@mapChartComponent.props.actions`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@mapChartComponent.props.actions · allOf[0]`

Schema位置：`#/definitions/mapChartComponent/properties/props/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `map-legend-bands-increasing`：地图图例档位下界严格递增。反例：[map-legend-bands-not-increasing](../errors/map-legend-bands-not-increasing.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `map-pinned-summary`：固定地域摘要只用于 regionalOverview，匹配值符合类型，标签不重复。反例：[map-pinned-summary-wrong-variant](../errors/map-pinned-summary-wrong-variant.json)、[map-pinned-summary-match-value-type](../errors/map-pinned-summary-match-value-type.json)、[map-pinned-summary-duplicate-label](../errors/map-pinned-summary-duplicate-label.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `map-hierarchy`：地图下钻字段只与 hierarchyFilter 一起使用，目标是声明了 hierarchy 的维度筛选器。反例：[map-level-fields-without-hierarchy-filter](../errors/map-level-fields-without-hierarchy-filter.json)、[map-hierarchy-filter-undeclared](../errors/map-hierarchy-filter-undeclared.json)、[map-hierarchy-filter-not-hierarchical](../errors/map-hierarchy-filter-not-hierarchical.json)、[map-level-maps-unknown-level](../errors/map-level-maps-unknown-level.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-mapChart.json)：独立完整页面，保留必要语义依赖。
- [regionalOverview](../examples/component-mapChart-regionalOverview.json)：独立完整页面，保留必要语义依赖。
- [map-page](../examples/map-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](../examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-mapChart.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "china-map",
  "type": "mapChart",
  "layout": {
    "span": 12
  },
  "data": {
    "main": "regions"
  },
  "props": {
    "variant": "regionalOverview",
    "nameField": "name",
    "valueField": "gmv",
    "map": "china",
    "hierarchyFilter": "area",
    "levelField": "level",
    "parentField": "parent",
    "codeField": "code",
    "levelMaps": {
      "province": "china"
    },
    "legend": {
      "title": "GMV",
      "bands": [
        {
          "label": "低",
          "from": 0
        },
        {
          "label": "高",
          "from": 100
        }
      ]
    },
    "tooltipFields": [
      {
        "label": "增长",
        "field": {
          "data": "main",
          "field": "growth",
          "format": "percent-1"
        }
      }
    ],
    "pinnedSummary": {
      "matchField": "code",
      "matchValue": "310000",
      "titleField": "name",
      "fields": [
        {
          "label": "GMV",
          "field": "gmv"
        },
        {
          "label": "增长",
          "field": "growth"
        }
      ]
    },
    "actions": [
      {
        "on": "click",
        "navigate": {
          "href": "/pages/map-page",
          "query": {
            "area": {
              "source": "filter",
              "id": "area"
            },
            "area.level": {
              "source": "filter",
              "id": "area",
              "part": "level"
            }
          }
        }
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/map-chart.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/mapPinnedSummary/properties/matchValue/anyOf/0`：[合法完整页面](../examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0/props/pinnedSummary/matchValue`。
- `#/definitions/mapPinnedSummary/properties/matchValue/anyOf/1`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/12/props/pinnedSummary/matchValue`。
