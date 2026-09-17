# 页面、版本与布局

页面元数据是统一运行时消费的声明式文档；数据上下文、会话、修订和执行身份由宿主管理。页面id、字段id、组件id分别属于自己的命名空间，组件id在整页唯一。

当前作者写出6.4。公开读取兼容5.0—5.4及6.0—6.4；5.x在读取边界转换为6.x运行态文档。6.0使用layoutForm，6.1起允许layout。双字段同时出现即拒绝；缺布局默认report。normalizePageDocument只进行已声明的兼容规范化并保留文档原始字段，不将运行时参数替换结果保存。历史修订先核验原文hash再规范化。

report定宽居中，dashboard占满宿主宽度。dashboardToolbar缺省visible；hidden用于页面已有自有页头；compact对象表达紧凑工具栏，readOnly只影响呈现，不是服务权限。meta.title是页面级标题，缺席时消费方可回退页头再回退页面id。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.5。结构真源为本册[schema.json](schema.json)，SHA256 `1bf8de8d30f1440785aac3c696ea6a2f13b14628a986038bbd1eee92dfb34b99`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-23"></a>

### `$`

Schema位置：`#`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 页面根 | required=["schemaVersion","id","dataSources","sections"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f736368656d6156657273696f6e"></a>

### `$.schemaVersion`

Schema位置：`#/properties/schemaVersion`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["5.0","5.1","5.2","5.3","5.4","6.0","6.1","6.2","6.3","6.4","6.5"] | Schema未设默认；装配/运行时默认见语义说明 | 页面文档契约版本；当前支持 5.0 / 5.1 / 5.2 / 5.3 / 5.4 / 6.0 / 6.1 / 6.2 / 6.3 / 6.4 / 6.5 |

| 允许值 | 解释与适用条件 |
|---|---|
| "5.0" | 兼容读取的历史主版本。 |
| "5.1" | 兼容读取的历史主版本。 |
| "5.2" | 兼容读取的历史主版本。 |
| "5.3" | 兼容读取的历史主版本。 |
| "5.4" | 兼容读取的历史主版本。 |
| "6.0" | 布局使用layoutForm的兼容旧文档；不能声明layout或6.2参数能力。 |
| "6.1" | 支持layout的增量布局协议；不能使用6.2维度参数能力。 |
| "6.2" | 维度单/多值参数及显式初始化绑定；不能使用6.3时间参数。 |
| "6.3" | 增加确定性日期/月参数与查询时间窗口绑定。 |
| "6.4" | 当前作者写出版本，新增yearToDate和monthToDate具名窗口，终点为报告基准期。 |
| "6.5" | 参数value、timeRange与查询值位置的原位引用。 |

<a id="schema-232f70726f706572746965732f6964"></a>

### `$.id`

Schema位置：`#/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f70726f706572746965732f6d657461"></a>

### `$.meta`

Schema位置：`#/properties/meta`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面标题和说明等元信息。 |

<a id="schema-232f70726f706572746965732f6d6574612f70726f706572746965732f7469746c65"></a>

### `$.meta.title`

Schema位置：`#/properties/meta/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f70726f706572746965732f6d6574612f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `$.meta.title · allOf[0]`

Schema位置：`#/properties/meta/properties/title/allOf/0`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f6d6574612f70726f706572746965732f6465736372697074696f6e"></a>

### `$.meta.description`

Schema位置：`#/properties/meta/properties/description`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 说明文本。 |

<a id="schema-232f70726f706572746965732f6c61796f7574"></a>

### `$.layout`

Schema位置：`#/properties/layout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f70726f706572746965732f6c61796f75742f616c6c4f662f30"></a>

### `$.layout · allOf[0]`

Schema位置：`#/properties/layout/allOf/0`。目标：[#/definitions/pageLayoutForm](page.md#schema-232f646566696e6974696f6e732f706167654c61796f7574466f726d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageLayoutForm | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f706167654c61796f7574466f726d"></a>

### `@pageLayoutForm`

Schema位置：`#/definitions/pageLayoutForm`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 类型/分支 | enum=["report","dashboard"] | Schema未设默认；装配/运行时默认见语义说明 | report 定宽居中报表外框（缺省）；dashboard 满宽看板外框，中性画布、无外层留白 |

| 允许值 | 解释与适用条件 |
|---|---|
| "report" | 定宽居中报表外框，未声明布局时采用。 |
| "dashboard" | 满宽看板外框。 |

<a id="schema-232f70726f706572746965732f6c61796f7574466f726d"></a>

### `$.layoutForm`

Schema位置：`#/properties/layoutForm`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 旧布局字段，仅兼容输入；新作者写layout。 |

<a id="schema-232f70726f706572746965732f6c61796f7574466f726d2f616c6c4f662f30"></a>

### `$.layoutForm · allOf[0]`

Schema位置：`#/properties/layoutForm/allOf/0`。目标：[#/definitions/pageLayoutForm](page.md#schema-232f646566696e6974696f6e732f706167654c61796f7574466f726d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageLayoutForm | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64617368626f617264546f6f6c626172"></a>

### `$.dashboardToolbar`

Schema位置：`#/properties/dashboardToolbar`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 看板统一工具栏的显示或compact分支。 |

<a id="schema-232f70726f706572746965732f64617368626f617264546f6f6c6261722f616c6c4f662f30"></a>

### `$.dashboardToolbar · allOf[0]`

Schema位置：`#/properties/dashboardToolbar/allOf/0`。目标：[#/definitions/dashboardToolbar](page.md#schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c626172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/dashboardToolbar | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c626172"></a>

### `@dashboardToolbar`

Schema位置：`#/definitions/dashboardToolbar`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | dashboard 页面统一工具栏显隐或紧凑只读呈现；缺省 visible |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f30"></a>

### `@dashboardToolbar · anyOf[0]`

Schema位置：`#/definitions/dashboardToolbar/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | enum=["visible","hidden"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "visible" | 显示统一工具栏。 |
| "hidden" | 隐藏统一工具栏，适用于页面已有自有页头。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f31"></a>

### `@dashboardToolbar · anyOf[1]`

Schema位置：`#/definitions/dashboardToolbar/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["variant"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f312f70726f706572746965732f76617269616e74"></a>

### `@dashboardToolbar · anyOf[1].variant`

Schema位置：`#/definitions/dashboardToolbar/anyOf/1/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="compact" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compact" | 紧凑工具栏呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f312f70726f706572746965732f726561644f6e6c79"></a>

### `@dashboardToolbar · anyOf[1].readOnly`

Schema位置：`#/definitions/dashboardToolbar/anyOf/1/properties/readOnly`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 只读呈现标记，不是服务端权限保证。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f312f70726f706572746965732f6e6f7465"></a>

### `@dashboardToolbar · anyOf[1].note`

Schema位置：`#/definitions/dashboardToolbar/anyOf/1/properties/note`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 补充说明文本。 |

<a id="schema-232f70726f706572746965732f706172616d73"></a>

### `$.params`

Schema位置：`#/properties/params`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 一次初始化的不可变页面参数声明。 |

<a id="schema-232f70726f706572746965732f706172616d732f6974656d73"></a>

### `$.params[]`

Schema位置：`#/properties/params/items`。目标：[#/definitions/pageParam](params-and-text-values.md#schema-232f646566696e6974696f6e732f70616765506172616d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageParam | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64617461536f7572636573"></a>

### `$.dataSources`

Schema位置：`#/properties/dataSources`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 命名页面数据源集合，键为源id。 |

<a id="schema-232f70726f706572746965732f64617461536f75726365732f6164646974696f6e616c50726f70657274696573"></a>

### `$.dataSources{key}`

Schema位置：`#/properties/dataSources/additionalProperties`。目标：[#/definitions/dataSource](data-sources.md#schema-232f646566696e6974696f6e732f64617461536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/dataSource | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64617461536f75726365732f70726f70657274794e616d6573"></a>

### `$.dataSources · propertyNames`

Schema位置：`#/properties/dataSources/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c74657273"></a>

### `$.filters`

Schema位置：`#/properties/filters`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面筛选器声明集合。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d73"></a>

### `$.filters[]`

Schema位置：`#/properties/filters/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f30"></a>

### `$.filters[] · oneOf[0]`

Schema位置：`#/properties/filters/items/oneOf/0`。目标：[#/definitions/dimensionFilter](filters.md#schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/dimensionFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f31"></a>

### `$.filters[] · oneOf[1]`

Schema位置：`#/properties/filters/items/oneOf/1`。目标：[#/definitions/timeRangeFilter](filters.md#schema-232f646566696e6974696f6e732f74696d6552616e676546696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/timeRangeFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f32"></a>

### `$.filters[] · oneOf[2]`

Schema位置：`#/properties/filters/items/oneOf/2`。目标：[#/definitions/timePointFilter](filters.md#schema-232f646566696e6974696f6e732f74696d65506f696e7446696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/timePointFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f33"></a>

### `$.filters[] · oneOf[3]`

Schema位置：`#/properties/filters/items/oneOf/3`。目标：[#/definitions/booleanFilter](filters.md#schema-232f646566696e6974696f6e732f626f6f6c65616e46696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/booleanFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f34"></a>

### `$.filters[] · oneOf[4]`

Schema位置：`#/properties/filters/items/oneOf/4`。目标：[#/definitions/numberRangeFilter](filters.md#schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/numberRangeFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f35"></a>

### `$.filters[] · oneOf[5]`

Schema位置：`#/properties/filters/items/oneOf/5`。目标：[#/definitions/searchFilter](filters.md#schema-232f646566696e6974696f6e732f73656172636846696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/searchFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f73656374696f6e73"></a>

### `$.sections`

Schema位置：`#/properties/sections`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 有序内容分区集合。 |

<a id="schema-232f70726f706572746965732f73656374696f6e732f6974656d73"></a>

### `$.sections[]`

Schema位置：`#/properties/sections/items`。目标：[#/definitions/section](sections-and-layout.md#schema-232f646566696e6974696f6e732f73656374696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/section | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `page-layout-compatibility`：6.1 layout 能力下限与单布局真源；6.0 layoutForm 仍可读取。反例：[layout-before-6.1](errors/layout-before-6.1.json)、[layout-dual-equal](errors/layout-dual-equal.json)、[layout-dual-conflict](errors/layout-dual-conflict.json)、[layout-invalid-value](errors/layout-invalid-value.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](errors/missing-schema-version.json)、[unknown-top-level-field](errors/unknown-top-level-field.json)、[layout-span-out-of-range](errors/layout-span-out-of-range.json)、[field-id-pattern](errors/field-id-pattern.json)、[sections-empty](errors/sections-empty.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `schema-version-supported`：schemaVersion 必须是当前主版本内的受支持次版本。反例：[version-major-unsupported](errors/version-major-unsupported.json)、[version-minor-ahead](errors/version-minor-ahead.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [inline-report](examples/inline-report.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/page.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/dashboardToolbar/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/dashboardToolbar`。
- `#/definitions/dashboardToolbar/anyOf/1`：[合法完整页面](examples/component-pieChart.json)，JSON Pointer `#/dashboardToolbar`。
- `#/properties/filters/items/oneOf/0`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/filters/0`。
- `#/properties/filters/items/oneOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/1`。
- `#/properties/filters/items/oneOf/2`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/filters/4`。
- `#/properties/filters/items/oneOf/3`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/filters/7`。
- `#/properties/filters/items/oneOf/4`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/filters/6`。
- `#/properties/filters/items/oneOf/5`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/filters/8`。
