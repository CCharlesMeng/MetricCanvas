# 详细排行卡 rankingDetailCard

按查询结果顺序展示对象、指标、变化、徽标与原因说明。适用于需要保留查询排序的增长/下降排行、排行项需要展示标签与原因说明。数据形状：名称 dimension + 数值 measure，可选变化 measure、最多两个徽标 dimension、普通说明 dimension、语义 HTML 说明 semanticHtml/detail，以及可展开 recordList/detail。

排行条目可通过显式recordList字段展开受控明细；内嵌语义HTML和行列表各走自己的字段契约，不能互换。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.6。结构真源为本册[schema.json](../schema.json)，SHA256 `a421c583a35d98c6d01d1a47965f13984e4d6ec1aab62779b4d5ec78b7c8cf8f`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e74"></a>

### `@rankingDetailCardComponent`

Schema位置：`#/definitions/rankingDetailCardComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@rankingDetailCardComponent.id`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@rankingDetailCardComponent.type`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="rankingDetailCard" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "rankingDetailCard" | 用于选择@rankingDetailCardComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@rankingDetailCardComponent.layout`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@rankingDetailCardComponent.data`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@rankingDetailCardComponent.props`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["nameField","valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@rankingDetailCardComponent.props.title`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@rankingDetailCardComponent.props.title · allOf[0]`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@rankingDetailCardComponent.props.variant`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="report" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "report" | 定宽居中报表外框，未声明布局时采用。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d65747269634c6162656c"></a>

### `@rankingDetailCardComponent.props.metricLabel`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/metricLabel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 度量展示标签。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d65747269634c6162656c2f616c6c4f662f30"></a>

### `@rankingDetailCardComponent.props.metricLabel · allOf[0]`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/metricLabel/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746f6e65"></a>

### `@rankingDetailCardComponent.props.tone`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/tone`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["positive","negative","neutral"] | Schema未设默认；装配/运行时默认见语义说明 | 受控内容语气/正负语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "positive" | 正向语义。 |
| "negative" | 负向语义。 |
| "neutral" | 中性语义。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6e616d654669656c64"></a>

### `@rankingDetailCardComponent.props.nameField`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/nameField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 对象名称维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76616c75654669656c64"></a>

### `@rankingDetailCardComponent.props.valueField`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6368616e67654669656c64"></a>

### `@rankingDetailCardComponent.props.changeField`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/changeField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 变化量/变化率的字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6368616e67654669656c642f616c6c4f662f30"></a>

### `@rankingDetailCardComponent.props.changeField · allOf[0]`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/changeField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f62616467654669656c6473"></a>

### `@rankingDetailCardComponent.props.badgeFields`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/badgeFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | maxItems=2 | Schema未设默认；装配/运行时默认见语义说明 | 多项徽标字段集合。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f62616467654669656c64732f6974656d73"></a>

### `@rankingDetailCardComponent.props.badgeFields[]`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/badgeFields/items`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6465736372697074696f6e4669656c64"></a>

### `@rankingDetailCardComponent.props.descriptionField`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/descriptionField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 说明内容的字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6465736372697074696f6e4669656c642f616c6c4f662f30"></a>

### `@rankingDetailCardComponent.props.descriptionField · allOf[0]`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/descriptionField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73656d616e7469634465736372697074696f6e4669656c64"></a>

### `@rankingDetailCardComponent.props.semanticDescriptionField`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/semanticDescriptionField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 语义HTML说明字段，必须是semanticHtml/detail。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73656d616e7469634465736372697074696f6e4669656c642f616c6c4f662f30"></a>

### `@rankingDetailCardComponent.props.semanticDescriptionField · allOf[0]`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/semanticDescriptionField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64657461696c73"></a>

### `@rankingDetailCardComponent.props.details`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/details`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["field","titleField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 受控明细呈现结构。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64657461696c732f70726f706572746965732f6669656c64"></a>

### `@rankingDetailCardComponent.props.details.field`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/details/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64657461696c732f70726f706572746965732f7469746c654669656c64"></a>

### `@rankingDetailCardComponent.props.details.titleField`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/details/properties/titleField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 标题内容绑定字段。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64657461696c732f70726f706572746965732f76616c75654669656c64"></a>

### `@rankingDetailCardComponent.props.details.valueField`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/details/properties/valueField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64657461696c732f70726f706572746965732f76616c75654669656c642f70726f706572746965732f6669656c64"></a>

### `@rankingDetailCardComponent.props.details.valueField.field`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/details/properties/valueField/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64657461696c732f70726f706572746965732f76616c75654669656c642f70726f706572746965732f666f726d6174"></a>

### `@rankingDetailCardComponent.props.details.valueField.format`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/details/properties/valueField/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 显示格式，不修改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀（6.5）。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀（6.5）。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀（6.5）。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64657461696c732f70726f706572746965732f6465736372697074696f6e4669656c64"></a>

### `@rankingDetailCardComponent.props.details.descriptionField`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/details/properties/descriptionField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 说明内容的字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64657461696c732f70726f706572746965732f64656661756c74457870616e646564"></a>

### `@rankingDetailCardComponent.props.details.defaultExpanded`

Schema位置：`#/definitions/rankingDetailCardComponent/properties/props/properties/details/properties/defaultExpanded`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 初始展开状态，后续交互由运行态维护。 |

## 语义规则与反例（生成）

- `ranking-detail-semantic-description`：语义 HTML 说明必须绑定 semanticHtml 类型的 detail 字段。反例：[ranking-semantic-description-not-detail](../errors/ranking-semantic-description-not-detail.json)、[ranking-semantic-description-record-list](../errors/ranking-semantic-description-record-list.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `ranking-detail-records`：结构化明细必须绑定 recordList 字段，项字段存在且角色相容。反例：[ranking-details-not-record-list](../errors/ranking-details-not-record-list.json)、[ranking-details-item-field-unknown](../errors/ranking-details-item-field-unknown.json)、[ranking-details-item-role-mismatch](../errors/ranking-details-item-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-rankingDetailCard.json)：独立完整页面，保留必要语义依赖。
- [report](../examples/component-rankingDetailCard-report.json)：独立完整页面，保留必要语义依赖。
- [compute-page](../examples/compute-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-rankingDetailCard.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "ranking",
  "type": "rankingDetailCard",
  "layout": {
    "span": 6
  },
  "data": {
    "main": "customers"
  },
  "props": {
    "nameField": "name",
    "valueField": "score",
    "changeField": "change",
    "badgeFields": [
      "tier"
    ],
    "descriptionField": "note",
    "semanticDescriptionField": "reason",
    "details": {
      "field": "events",
      "titleField": "title",
      "valueField": {
        "field": "impact"
      },
      "descriptionField": "desc"
    }
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/ranking-detail-card.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

