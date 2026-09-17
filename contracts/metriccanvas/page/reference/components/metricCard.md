# 指标卡 metricCard

突出一个或少量核心指标的当前值、变化值与可选完成率。适用于总额、数量、完成率、KPI、核心指标、年度活动进展。数据形状：单行或少量行；至少一个 metric 字段，可选变化值和完成率 metric。

数据槽和字段绑定声明取哪行哪列；不同variant改变摘要结构，不能把列清单当任意HTML模板。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.5。结构真源为本册[schema.json](../schema.json)，SHA256 `1bf8de8d30f1440785aac3c696ea6a2f13b14628a986038bbd1eee92dfb34b99`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e74"></a>

### `@metricCardComponent`

Schema位置：`#/definitions/metricCardComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@metricCardComponent.id`

Schema位置：`#/definitions/metricCardComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@metricCardComponent.type`

Schema位置：`#/definitions/metricCardComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="metricCard" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "metricCard" | 用于选择@metricCardComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@metricCardComponent.layout`

Schema位置：`#/definitions/metricCardComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@metricCardComponent.data`

Schema位置：`#/definitions/metricCardComponent/properties/data`。目标：[#/definitions/metricData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d657472696344617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@metricCardComponent.props`

Schema位置：`#/definitions/metricCardComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["rows"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@metricCardComponent.props.title`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@metricCardComponent.props.title · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@metricCardComponent.props.variant`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["summary","activityProgress","compactSummary","dualSummary","compactStrip","compactStack"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "summary" | 摘要呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "activityProgress" | 活动进展呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "compactSummary" | 紧凑摘要呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "dualSummary" | 双摘要呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "compactStrip" | 紧凑横条呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "compactStack" | 紧凑纵向堆叠呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e646172795469746c65"></a>

### `@metricCardComponent.props.secondaryTitle`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryTitle`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 次要标题文本。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e646172795469746c652f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryTitle · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryTitle/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f7773"></a>

### `@metricCardComponent.props.rows`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 按结果字段契约命名和校验的数据行。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d73"></a>

### `@metricCardComponent.props.rows[]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.rows[].label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f636f6e74657874"></a>

### `@metricCardComponent.props.rows[].context`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/context`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 上下文说明字段或结构。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f636f6e746578742f616c6c4f662f30"></a>

### `@metricCardComponent.props.rows[].context · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/context/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f76616c75654669656c64"></a>

### `@metricCardComponent.props.rows[].valueField`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6c696e6b"></a>

### `@metricCardComponent.props.rows[].link`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/link`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 把当前列/指标行作为导航入口，需对应navigate。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f756e6974"></a>

### `@metricCardComponent.props.rows[].unit`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@metricCardComponent.props.rows[].unit · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e676573"></a>

### `@metricCardComponent.props.rows[].changes`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 变化项集合，具体形状由所属分支约束。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d73"></a>

### `@metricCardComponent.props.rows[].changes[]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.rows[].changes[].label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@metricCardComponent.props.rows[].changes[].field`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f756e6974"></a>

### `@metricCardComponent.props.rows[].changes[].unit`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@metricCardComponent.props.rows[].changes[].unit · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f746f6e65"></a>

### `@metricCardComponent.props.rows[].changes[].tone`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/tone`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["auto","neutral","positive","danger"] | Schema未设默认；装配/运行时默认见语义说明 | 受控内容语气/正负语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "auto" | 由当前组件既有自动规则选择。 |
| "neutral" | 中性语义。 |
| "positive" | 正向语义。 |
| "danger" | 危险/异常语义。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f7773"></a>

### `@metricCardComponent.props.secondaryRows`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 次要指标行集合。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d73"></a>

### `@metricCardComponent.props.secondaryRows[]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.secondaryRows[].label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f636f6e74657874"></a>

### `@metricCardComponent.props.secondaryRows[].context`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/context`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 上下文说明字段或结构。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f636f6e746578742f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryRows[].context · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/context/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f76616c75654669656c64"></a>

### `@metricCardComponent.props.secondaryRows[].valueField`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6c696e6b"></a>

### `@metricCardComponent.props.secondaryRows[].link`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/link`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 把当前列/指标行作为导航入口，需对应navigate。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f756e6974"></a>

### `@metricCardComponent.props.secondaryRows[].unit`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryRows[].unit · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e676573"></a>

### `@metricCardComponent.props.secondaryRows[].changes`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 变化项集合，具体形状由所属分支约束。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d73"></a>

### `@metricCardComponent.props.secondaryRows[].changes[]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].field`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f756e6974"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].unit`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].unit · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f746f6e65"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].tone`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/tone`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["auto","neutral","positive","danger"] | Schema未设默认；装配/运行时默认见语义说明 | 受控内容语气/正负语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "auto" | 由当前组件既有自动规则选择。 |
| "neutral" | 中性语义。 |
| "positive" | 正向语义。 |
| "danger" | 危险/异常语义。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70616e656c4c61796f7574"></a>

### `@metricCardComponent.props.panelLayout`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/panelLayout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["stacked","twoColumn"] | Schema未设默认；装配/运行时默认见语义说明 | 面板内的受控布局。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "stacked" | 堆叠结构。 |
| "twoColumn" | 双列呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73686f775472656e644172726f7773"></a>

### `@metricCardComponent.props.showTrendArrows`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/showTrendArrows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示趋势箭头。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f6772657373"></a>

### `@metricCardComponent.props.progress`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 进度呈现相关结构。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f67726573732f70726f706572746965732f76616c75654669656c64"></a>

### `@metricCardComponent.props.progress.valueField`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f67726573732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.progress.label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f67726573732f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@metricCardComponent.props.progress.label · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f67726573732f70726f706572746965732f72696e6750657263656e74"></a>

### `@metricCardComponent.props.progress.ringPercent`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress/properties/ringPercent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | minimum=0; maximum=100 | Schema未设默认；装配/运行时默认见语义说明 | 环形占比呈现声明。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e73"></a>

### `@metricCardComponent.props.actions`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@metricCardComponent.props.actions · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

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

- [最小组件](../examples/component-metricCard.json)：独立完整页面，保留必要语义依赖。
- [summary](../examples/component-metricCard-summary.json)：独立完整页面，保留必要语义依赖。
- [activityProgress](../examples/component-metricCard-activityProgress.json)：独立完整页面，保留必要语义依赖。
- [compactSummary](../examples/component-metricCard-compactSummary.json)：独立完整页面，保留必要语义依赖。
- [dualSummary](../examples/component-metricCard-dualSummary.json)：独立完整页面，保留必要语义依赖。
- [compactStrip](../examples/component-metricCard-compactStrip.json)：独立完整页面，保留必要语义依赖。
- [compactStack](../examples/component-metricCard-compactStack.json)：独立完整页面，保留必要语义依赖。
- [inline-report](../examples/inline-report.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-metricCard.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "target-card",
  "type": "metricCard",
  "layout": {
    "span": 4
  },
  "data": {
    "main": "fixed-target"
  },
  "props": {
    "rows": [
      {
        "label": "目标",
        "valueField": {
          "data": "main",
          "field": "target",
          "format": "number-grouped"
        }
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/metric-card.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

