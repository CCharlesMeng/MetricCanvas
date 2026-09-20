# 文本 text

承载说明、口径提示或由后端返回的人工/AI 已确认分析结论；可显式使用受控语义 HTML 正文。适用于摘要默认使用 text；说明、提示、后端返回或已确认结论均选择本组件、页面内分隔章节的大标题使用 variant: heading，标题写在 props.title，通常放在 container: plain 的分区里、摘要需要分色富文本时声明 bodyFormat: semanticHtml，并在 body 中只使用受控标签和语义类、分析报告摘要使用 variant: reportInline；它会默认显示图标和“AI 总结：”，metadata 只需声明正文。数据形状：不绑定页面数据源。

静态文字使用body及受控variant。plain、insight、heading、reportInline、riskNotice表达不同文体。bodyFormat:semanticHtml显式选择受控富文本；未声明时按普通文本呈现，不执行任意HTML。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.6。结构真源为本册[schema.json](../schema.json)，SHA256 `724a223b61ed116ed3a542b273a0235b6778f87196f289a2a19d1c9feb5a24e7`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e74"></a>

### `@textComponent`

Schema位置：`#/definitions/textComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@textComponent.id`

Schema位置：`#/definitions/textComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@textComponent.type`

Schema位置：`#/definitions/textComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="text" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@textComponent.layout`

Schema位置：`#/definitions/textComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@textComponent.props`

Schema位置：`#/definitions/textComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@textComponent.props.title`

Schema位置：`#/definitions/textComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@textComponent.props.title · allOf[0]`

Schema位置：`#/definitions/textComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f626f6479"></a>

### `@textComponent.props.body`

Schema位置：`#/definitions/textComponent/properties/props/properties/body`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 静态正文或页面参数文本取值；bodyFormat决定是否走受控语义HTML。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f626f64792f616c6c4f662f30"></a>

### `@textComponent.props.body · allOf[0]`

Schema位置：`#/definitions/textComponent/properties/props/properties/body/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f626f6479466f726d6174"></a>

### `@textComponent.props.bodyFormat`

Schema位置：`#/definitions/textComponent/properties/props/properties/bodyFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="semanticHtml" | Schema未设默认；装配/运行时默认见语义说明 | 正文的显式格式分支，非任意HTML授权。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "semanticHtml" | 用于选择@textComponent.props.bodyFormat分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@textComponent.props.variant`

Schema位置：`#/definitions/textComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["plain","heading","insight","reportInline","riskNotice"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "plain" | 普通呈现；分区为无额外容器，文本/单元格按各模块普通样式解释。 |
| "heading" | 标题文字呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "insight" | 洞察文字呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "reportInline" | 报告行内呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "riskNotice" | 风险提示呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d61785769647468"></a>

### `@textComponent.props.maxWidth`

Schema位置：`#/definitions/textComponent/properties/props/properties/maxWidth`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 受控最大宽度数值，不接受任意CSS。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b73"></a>

### `@textComponent.props.links`

Schema位置：`#/definitions/textComponent/properties/props/properties/links`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式文本导航链接集合。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d73"></a>

### `@textComponent.props.links[]`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["href","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f68726566"></a>

### `@textComponent.props.links[].href`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/href`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 目标URL，必须通过安全协议及结构检查。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f7175657279"></a>

### `@textComponent.props.links[].query`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f70657274696573"></a>

### `@textComponent.props.links[].query{key}`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@textComponent.props.links[].query{key} · oneOf[0]`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@textComponent.props.links[].query{key} · oneOf[0].source`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="row" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "row" | 用于选择@textComponent.props.links[].query{key} · oneOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@textComponent.props.links[].query{key} · oneOf[0].field`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@textComponent.props.links[].query{key} · oneOf[1]`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@textComponent.props.links[].query{key} · oneOf[1].source`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@textComponent.props.links[].query{key} · oneOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6964"></a>

### `@textComponent.props.links[].query{key} · oneOf[1].id`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f32"></a>

### `@textComponent.props.links[].query{key} · oneOf[2]`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f736f75726365"></a>

### `@textComponent.props.links[].query{key} · oneOf[2].source`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@textComponent.props.links[].query{key} · oneOf[2].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f6964"></a>

### `@textComponent.props.links[].query{key} · oneOf[2].id`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f70617274"></a>

### `@textComponent.props.links[].query{key} · oneOf[2].part`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/2/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level"] | Schema未设默认；装配/运行时默认见语义说明 | 导航取筛选值的value/from/to/level部分。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f71756572792f70726f70657274794e616d6573"></a>

### `@textComponent.props.links[].query · propertyNames`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c696e6b732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@textComponent.props.links[].label`

Schema位置：`#/definitions/textComponent/properties/props/properties/links/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

## 语义规则与反例（生成）

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-text.json)：独立完整页面，保留必要语义依赖。
- [plain](../examples/component-text-plain.json)：独立完整页面，保留必要语义依赖。
- [heading](../examples/component-text-heading.json)：独立完整页面，保留必要语义依赖。
- [insight](../examples/component-text-insight.json)：独立完整页面，保留必要语义依赖。
- [reportInline](../examples/component-text-reportInline.json)：独立完整页面，保留必要语义依赖。
- [riskNotice](../examples/component-text-riskNotice.json)：独立完整页面，保留必要语义依赖。
- [reference-text-page](../examples/reference-text-page.json)：完整合法页面；查询仅为静态契约证据。
- [url-navigation-page](../examples/url-navigation-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](../examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-text.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "explanation",
  "type": "text",
  "layout": {
    "span": 12
  },
  "props": {
    "title": "章节说明",
    "body": "这是页面中的静态说明正文。",
    "variant": "plain"
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/text.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/0`：[语义拒绝反例](../errors/navigation-text-row-source.json)：text不绑定行数据；结构共享的row来源分支被页面导航语义明确拒绝，只有反例，没有合法页面见证。（规则 `url-navigation-source-contract`）。此项不计入合法示例覆盖。
- `#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/1`：[合法完整页面](../examples/url-navigation-page.json)，JSON Pointer `#/sections/0/components/1/props/links/0/query/project`。
- `#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/2`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/4/props/links/0/query/region`。
