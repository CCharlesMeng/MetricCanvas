# 页面、版本与布局

页面元数据是统一运行时消费的声明式文档；数据上下文、会话、修订和执行身份由宿主管理。页面id、字段id、组件id分别属于自己的命名空间，组件id在整页唯一。

作者版本以本册 [index.json](index.json) 的 schemaVersion 为准，可读版本以 [schema.json](schema.json) 的 schemaVersion 分支为准。能力下限由独立校验脚本检查。历史页面先校验，再按明确需求修改；不得只改版本号假装完成迁移。5.x在读取边界转换为6.x运行态文档。6.0使用layoutForm，6.1起允许layout。双字段同时出现即拒绝；缺布局默认report。normalizePageDocument只进行已声明的兼容规范化并保留文档原始字段，不将运行时参数替换结果保存。历史修订先核验原文hash再规范化。

report定宽居中，dashboard占满宿主宽度。dashboardToolbar缺省visible；hidden用于页面已有自有页头；compact对象表达紧凑工具栏，readOnly只影响呈现，不是服务权限。meta.title是页面级标题，缺席时消费方可回退页头再回退页面id。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.22。结构真源为本册[schema.json](schema.json)，SHA256 `48844824923af573b27be8c9c53d7be88910b12628c548cefdcb9362b7612fc5`。字段表自动生成；可选不等于有默认值。

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
| "string" | 本分支必填 | enum=["5.0","5.1","5.2","5.3","5.4","6.5","6.11","6.12","6.13","6.14","6.15","6.16","6.17","6.18","6.19","6.20","6.21","6.22"] | Schema未设默认；装配/运行时默认见语义说明 | 页面文档契约版本；当前支持 5.0 / 5.1 / 5.2 / 5.3 / 5.4 / 6.5 / 6.11 / 6.12 / 6.13 / 6.14 / 6.15 / 6.16 / 6.17 / 6.18 / 6.19 / 6.20 / 6.21 / 6.22 |

| 允许值 | 解释与适用条件 |
|---|---|
| "5.0" | 历史5.0文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "5.1" | 历史5.1文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "5.2" | 历史5.2文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "5.3" | 历史5.3文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "5.4" | 历史5.4文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "6.5" | 新增按百万呈现的0/1/2位小数格式。 |
| "6.11" | 当前作者写出版本，新增时间点与层级维度筛选器的参数初值。 |
| "6.12" | 增加跨源计算、内容导航、详情视图和展示字段；保留 6.11 读取。 |
| "6.13" | 增加页头日期筛选、月份范围、范围参数初值及时间点查询窗口。 |
| "6.14" | 增加查询结果集合绑定、多度量透视和有限主集合左关联；保留6.13读取。 |
| "6.15" | 6.15 增加显式筛选文本引用与统一 period 期间格式。 |
| "6.16" | 新增显式数字颜色、全部类别标签及常驻数值标签。 |
| "6.17" | 新增带符号普通数值格式，按展示精度统一符号、正负颜色与变化箭头。 |
| "6.18" | 补齐普通数值格式族的两位小数及千分位带符号版本；保留6.17读取。 |
| "6.19" | 新增查询结果绑定where：下游按原始字段独立筛行后提取维度集合，上游完整结果保持不变。 |
| "6.20" | 查询分页窗口可作为结果绑定输入；任意可排序列驱动依赖更新，排序回到第一页，下游仍只接收字段集合。 |
| "6.21" | 表格独立搜索与完整Excel导出工具区；查询搜索字段必须映射，搜索编码由数据网关提供。 |
| "6.22" | 组合查询源和数值表头范围的当前写出版本。 |

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
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |

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
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 一次初始化的不可变页面参数声明。 |

<a id="schema-232f70726f706572746965732f706172616d732f616e794f662f30"></a>

### `$.params · anyOf[0]`

Schema位置：`#/properties/params/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 独立分支（不合并required） | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f706172616d732f616e794f662f302f6974656d73"></a>

### `$.params · anyOf[0][]`

Schema位置：`#/properties/params/anyOf/0/items`。目标：[#/definitions/pageParam](params-and-text-values.md#schema-232f646566696e6974696f6e732f70616765506172616d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageParam | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f706172616d732f616e794f662f31"></a>

### `$.params · anyOf[1]`

Schema位置：`#/properties/params/anyOf/1`。目标：[#/definitions/groupedPageParams](params-and-text-values.md#schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/groupedPageParams | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

<a id="schema-232f70726f706572746965732f64657461696c5669657773"></a>

### `$.detailViews`

Schema位置：`#/properties/detailViews`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 按 id 声明快照或独立查询详情；导出页面不包含详情浮层。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d73"></a>

### `$.detailViews[]`

Schema位置：`#/properties/detailViews/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","mode","components"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f6964"></a>

### `$.detailViews[].id`

Schema位置：`#/properties/detailViews/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f6d6f6465"></a>

### `$.detailViews[].mode`

Schema位置：`#/properties/detailViews/items/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["snapshot","query"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "snapshot" | 消费主页面同一份快照，不另查详情数据。 |
| "query" | 详情显式独立参数和查询，打开时执行。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f66696c74657273"></a>

### `$.detailViews[].filters`

Schema位置：`#/properties/detailViews/items/properties/filters`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 页面筛选器声明集合。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f66696c746572732f6974656d73"></a>

### `$.detailViews[].filters[]`

Schema位置：`#/properties/detailViews/items/properties/filters/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e7473"></a>

### `$.detailViews[].components`

Schema位置：`#/properties/detailViews/items/properties/components`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 受控子组件集合；容器白名单与顶层集合不同。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d73"></a>

### `$.detailViews[].components[]`

Schema位置：`#/properties/detailViews/items/properties/components/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f30"></a>

### `$.detailViews[].components[] · oneOf[0]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/0`。目标：[#/definitions/reportHeaderComponent](components/reportHeader.md#schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/reportHeaderComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f31"></a>

### `$.detailViews[].components[] · oneOf[1]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/1`。目标：[#/definitions/metricCardComponent](components/metricCard.md#schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f32"></a>

### `$.detailViews[].components[] · oneOf[2]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/2`。目标：[#/definitions/barChartComponent](components/barChart.md#schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/barChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f33"></a>

### `$.detailViews[].components[] · oneOf[3]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/3`。目标：[#/definitions/lineChartComponent](components/lineChart.md#schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/lineChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f34"></a>

### `$.detailViews[].components[] · oneOf[4]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/4`。目标：[#/definitions/pieChartComponent](components/pieChart.md#schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f35"></a>

### `$.detailViews[].components[] · oneOf[5]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/5`。目标：[#/definitions/tableComponent](components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f36"></a>

### `$.detailViews[].components[] · oneOf[6]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/6`。目标：[#/definitions/mapChartComponent](components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f37"></a>

### `$.detailViews[].components[] · oneOf[7]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/7`。目标：[#/definitions/gaugeComponent](components/gauge.md#schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/gaugeComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f38"></a>

### `$.detailViews[].components[] · oneOf[8]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/8`。目标：[#/definitions/tabContainerComponent](components/tabContainer.md#schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tabContainerComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f39"></a>

### `$.detailViews[].components[] · oneOf[9]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/9`。目标：[#/definitions/compositeCardComponent](components/compositeCard.md#schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compositeCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3130"></a>

### `$.detailViews[].components[] · oneOf[10]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/10`。目标：[#/definitions/rankingCardComponent](components/rankingCard.md#schema-232f646566696e6974696f6e732f72616e6b696e6743617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rankingCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3131"></a>

### `$.detailViews[].components[] · oneOf[11]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/11`。目标：[#/definitions/rankingDetailCardComponent](components/rankingDetailCard.md#schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rankingDetailCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3132"></a>

### `$.detailViews[].components[] · oneOf[12]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/12`。目标：[#/definitions/keyValuePanelComponent](components/keyValuePanel.md#schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/keyValuePanelComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3133"></a>

### `$.detailViews[].components[] · oneOf[13]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/13`。目标：[#/definitions/categoryBreakdownComponent](components/categoryBreakdown.md#schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/categoryBreakdownComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3134"></a>

### `$.detailViews[].components[] · oneOf[14]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/14`。目标：[#/definitions/fieldTextComponent](components/fieldText.md#schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldTextComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3135"></a>

### `$.detailViews[].components[] · oneOf[15]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/15`。目标：[#/definitions/textComponent](components/text.md#schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3136"></a>

### `$.detailViews[].components[] · oneOf[16]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/16`。目标：[#/definitions/aiSummaryComponent](components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f757073"></a>

### `$.sectionGroups`

Schema位置：`#/properties/sectionGroups`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 声明互斥内容分区组；导出展开全部分区。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d73"></a>

### `$.sectionGroups[]`

Schema位置：`#/properties/sectionGroups/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","label","sectionIds"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f6964"></a>

### `$.sectionGroups[].id`

Schema位置：`#/properties/sectionGroups/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `$.sectionGroups[].label`

Schema位置：`#/properties/sectionGroups/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f73656374696f6e496473"></a>

### `$.sectionGroups[].sectionIds`

Schema位置：`#/properties/sectionGroups/items/properties/sectionIds`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 该组包含的分区 id 有序列表。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f73656374696f6e4964732f6974656d73"></a>

### `$.sectionGroups[].sectionIds[]`

Schema位置：`#/properties/sectionGroups/items/properties/sectionIds/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64656661756c7453656374696f6e47726f7570"></a>

### `$.defaultSectionGroup`

Schema位置：`#/properties/defaultSectionGroup`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 默认内容分区组 id。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570506172616d"></a>

### `$.sectionGroupParam`

Schema位置：`#/properties/sectionGroupParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 初始化内容分区组的 URL 参数名。 |

<a id="schema-232f70726f706572746965732f73656374696f6e416e63686f7273"></a>

### `$.sectionAnchors`

Schema位置：`#/properties/sectionAnchors`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 章节定位项；不隐式改变日期筛选。 |

<a id="schema-232f70726f706572746965732f73656374696f6e416e63686f72732f6974656d73"></a>

### `$.sectionAnchors[]`

Schema位置：`#/properties/sectionAnchors/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["sectionId","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f73656374696f6e416e63686f72732f6974656d732f70726f706572746965732f73656374696f6e4964"></a>

### `$.sectionAnchors[].sectionId`

Schema位置：`#/properties/sectionAnchors/items/properties/sectionId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 定位目标内容分区 id。 |

<a id="schema-232f70726f706572746965732f73656374696f6e416e63686f72732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `$.sectionAnchors[].label`

Schema位置：`#/properties/sectionAnchors/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

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

- `page-layout-compatibility`：6.1 layout 能力下限与单布局真源；6.0 layoutForm 仍可读取。反例：[layout-before-6.1](errors/layout-before-6.1.json)、[layout-dual-equal](errors/layout-dual-equal.json)、[layout-dual-conflict](errors/layout-dual-conflict.json)、[layout-invalid-value](errors/layout-invalid-value.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](errors/missing-schema-version.json)、[unknown-top-level-field](errors/unknown-top-level-field.json)、[layout-span-out-of-range](errors/layout-span-out-of-range.json)、[field-id-pattern](errors/field-id-pattern.json)、[sections-empty](errors/sections-empty.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `schema-version-supported`：schemaVersion 必须是当前主版本内的受支持次版本。反例：[version-major-unsupported](errors/version-major-unsupported.json)、[version-minor-ahead](errors/version-minor-ahead.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `detail-view-component-types`：详情只允许说明、图表和表格；共享 Schema 其它组件分支有显式拒绝见证。反例：[detail-component-reject-reportheader](errors/detail-component-reject-reportheader.json)、[detail-component-reject-metriccard](errors/detail-component-reject-metriccard.json)、[detail-component-reject-mapchart](errors/detail-component-reject-mapchart.json)、[detail-component-reject-tabcontainer](errors/detail-component-reject-tabcontainer.json)、[detail-component-reject-compositecard](errors/detail-component-reject-compositecard.json)、[detail-component-reject-rankingcard](errors/detail-component-reject-rankingcard.json)、[detail-component-reject-rankingdetailcard](errors/detail-component-reject-rankingdetailcard.json)、[detail-component-reject-keyvaluepanel](errors/detail-component-reject-keyvaluepanel.json)、[detail-component-reject-categorybreakdown](errors/detail-component-reject-categorybreakdown.json)、[detail-component-reject-fieldtext](errors/detail-component-reject-fieldtext.json)、[detail-component-reject-aisummary](errors/detail-component-reject-aisummary.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [inline-report](examples/inline-report.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [detail-views](examples/detail-views.json)：完整合法页面；查询仅为静态契约证据。
- [report-date-filters-page](examples/report-date-filters-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-export-detail-branches](examples/reference-export-detail-branches.json)：完整合法页面；查询仅为静态契约证据。

## 联合分支见证（生成）

- `#/definitions/dashboardToolbar/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/dashboardToolbar`。
- `#/definitions/dashboardToolbar/anyOf/1`：[合法完整页面](examples/component-pieChart.json)，JSON Pointer `#/dashboardToolbar`。
- `#/properties/params/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params`。
- `#/properties/params/anyOf/1`：[合法完整页面](examples/report-date-filters-page.json)，JSON Pointer `#/params`。
- `#/properties/filters/items/oneOf/0`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/filters/0`。
- `#/properties/filters/items/oneOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/1`。
- `#/properties/filters/items/oneOf/2`：[合法完整页面](examples/non-dimension-bindings-page.json)，JSON Pointer `#/filters/0`。
- `#/properties/filters/items/oneOf/3`：[合法完整页面](examples/non-dimension-bindings-page.json)，JSON Pointer `#/filters/1`。
- `#/properties/filters/items/oneOf/4`：[合法完整页面](examples/non-dimension-bindings-page.json)，JSON Pointer `#/filters/2`。
- `#/properties/filters/items/oneOf/5`：[合法完整页面](examples/detail-views.json)，JSON Pointer `#/filters/0`。
- `#/properties/detailViews/items/properties/components/items/oneOf/0`：[语义拒绝反例](errors/detail-component-reject-reportheader.json)：详情的展示闭集拒绝 reportHeader；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/1`：[语义拒绝反例](errors/detail-component-reject-metriccard.json)：详情的展示闭集拒绝 metricCard；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/2`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/2`。
- `#/properties/detailViews/items/properties/components/items/oneOf/3`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/3`。
- `#/properties/detailViews/items/properties/components/items/oneOf/4`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/4`。
- `#/properties/detailViews/items/properties/components/items/oneOf/5`：[合法完整页面](examples/detail-views.json)，JSON Pointer `#/detailViews/0/components/0`。
- `#/properties/detailViews/items/properties/components/items/oneOf/6`：[语义拒绝反例](errors/detail-component-reject-mapchart.json)：详情的展示闭集拒绝 mapChart；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/7`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/5`。
- `#/properties/detailViews/items/properties/components/items/oneOf/8`：[语义拒绝反例](errors/detail-component-reject-tabcontainer.json)：详情的展示闭集拒绝 tabContainer；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/9`：[语义拒绝反例](errors/detail-component-reject-compositecard.json)：详情的展示闭集拒绝 compositeCard；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/10`：[语义拒绝反例](errors/detail-component-reject-rankingcard.json)：详情的展示闭集拒绝 rankingCard；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/11`：[语义拒绝反例](errors/detail-component-reject-rankingdetailcard.json)：详情的展示闭集拒绝 rankingDetailCard；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/12`：[语义拒绝反例](errors/detail-component-reject-keyvaluepanel.json)：详情的展示闭集拒绝 keyValuePanel；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/13`：[语义拒绝反例](errors/detail-component-reject-categorybreakdown.json)：详情的展示闭集拒绝 categoryBreakdown；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/14`：[语义拒绝反例](errors/detail-component-reject-fieldtext.json)：详情的展示闭集拒绝 fieldText；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/15`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/0`。
- `#/properties/detailViews/items/properties/components/items/oneOf/16`：[语义拒绝反例](errors/detail-component-reject-aisummary.json)：详情的展示闭集拒绝 aiSummary；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
