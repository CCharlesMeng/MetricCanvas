# 筛选声明与运行状态

六类筛选为dimension、timeRange、timePoint、boolean、numberRange、search。声明描述输入能力，当前值由页内FilterState保存。URL只在初始化时读；重复维度键表示多值，不拆逗号。boolean的false是显式值，不能被默认true覆盖。

维度display选择select、tabs或tree；层级维度显式声明层级和初始层，不能把层级初值当6.2 initialParam绑定。时间范围支持绝对from/to和受控相对时间；timePoint限定month/date粒度。numberRange允许单边界，两边空视为无条件；search为普通文本。

urlParams仅映射该类允许的value/from/to/level键，不能与本页其它参数或筛选输入冲突。候选值来自受控数据能力，业务维度值不是协议枚举。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.5。结构真源为本册[schema.json](schema.json)，SHA256 `6ef401964cd74ad2805a8257e75f43ae5cb6b20f3f3479bb2ad49b481ed3ba60`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c746572"></a>

### `@dimensionFilter`

Schema位置：`#/definitions/dimensionFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","dimension"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6964"></a>

### `@dimensionFilter.id`

Schema位置：`#/definitions/dimensionFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@dimensionFilter.urlParams`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@dimensionFilter.urlParams.value`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@dimensionFilter.urlParams.from`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@dimensionFilter.urlParams.to`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@dimensionFilter.urlParams.level`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f74797065"></a>

### `@dimensionFilter.type`

Schema位置：`#/definitions/dimensionFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f64696d656e73696f6e"></a>

### `@dimensionFilter.dimension`

Schema位置：`#/definitions/dimensionFilter/properties/dimension`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 筛选维度语义或维度字段绑定；不隐式等于queryField。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6c6162656c"></a>

### `@dimensionFilter.label`

Schema位置：`#/definitions/dimensionFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f656d7074794c6162656c"></a>

### `@dimensionFilter.emptyLabel`

Schema位置：`#/definitions/dimensionFilter/properties/emptyLabel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 空值状态的展示文案。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368795069636b6572"></a>

### `@dimensionFilter.hierarchyPicker`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchyPicker`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["tabs","hidden"] | Schema未设默认；装配/运行时默认见语义说明 | 层级选择器显示方式；隐藏时须有地图承担下钻。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "tabs" | 平铺Tab选项。 |
| "hidden" | 隐藏统一工具栏，适用于页面已有自有页头。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f646973706c6179"></a>

### `@dimensionFilter.display`

Schema位置：`#/definitions/dimensionFilter/properties/display`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["select","tabs","tree","search"] | Schema未设默认；装配/运行时默认见语义说明 | 当前筛选器的受控输入显示方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "select" | 下拉候选选择。 |
| "tabs" | 平铺Tab选项。 |
| "tree" | 层级树选择。 |
| "search" | 普通文本搜索输入。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f76697369626c65"></a>

### `@dimensionFilter.visible`

Schema位置：`#/definitions/dimensionFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f64656661756c74"></a>

### `@dimensionFilter.default`

Schema位置：`#/definitions/dimensionFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f64656661756c742f6974656d73"></a>

### `@dimensionFilter.default[]`

Schema位置：`#/definitions/dimensionFilter/properties/default/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f696e697469616c506172616d"></a>

### `@dimensionFilter.initialParam`

Schema位置：`#/definitions/dimensionFilter/properties/initialParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 只初始化筛选状态的维度参数id。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f686965726172636879"></a>

### `@dimensionFilter.hierarchy`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=2 | Schema未设默认；装配/运行时默认见语义说明 | 显式层级维度定义。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368792f6974656d73"></a>

### `@dimensionFilter.hierarchy[]`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","dimension"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368792f6974656d732f70726f706572746965732f6964"></a>

### `@dimensionFilter.hierarchy[].id`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368792f6974656d732f70726f706572746965732f64696d656e73696f6e"></a>

### `@dimensionFilter.hierarchy[].dimension`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy/items/properties/dimension`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 筛选维度语义或维度字段绑定；不隐式等于queryField。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368792f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@dimensionFilter.hierarchy[].label`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f64656661756c744c6576656c"></a>

### `@dimensionFilter.defaultLevel`

Schema位置：`#/definitions/dimensionFilter/properties/defaultLevel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 初始层级id，须存在于hierarchy。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f646570656e64734f6e"></a>

### `@dimensionFilter.dependsOn`

Schema位置：`#/definitions/dimensionFilter/properties/dependsOn`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 级联依赖的维度筛选器id，不能形成环。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c746572"></a>

### `@timeRangeFilter`

Schema位置：`#/definitions/timeRangeFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6964"></a>

### `@timeRangeFilter.id`

Schema位置：`#/definitions/timeRangeFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@timeRangeFilter.urlParams`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@timeRangeFilter.urlParams.value`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@timeRangeFilter.urlParams.from`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@timeRangeFilter.urlParams.to`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@timeRangeFilter.urlParams.level`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f74797065"></a>

### `@timeRangeFilter.type`

Schema位置：`#/definitions/timeRangeFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timeRange" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timeRange" | 用于选择@timeRangeFilter.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6c6162656c"></a>

### `@timeRangeFilter.label`

Schema位置：`#/definitions/timeRangeFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f707265636973696f6e"></a>

### `@timeRangeFilter.precision`

Schema位置：`#/definitions/timeRangeFilter/properties/precision`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["date","datetime"] | Schema未设默认；装配/运行时默认见语义说明 | 显示精度，不改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "datetime" | 带时间部分的日期时间字段。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f76697369626c65"></a>

### `@timeRangeFilter.visible`

Schema位置：`#/definitions/timeRangeFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c74"></a>

### `@timeRangeFilter.default`

Schema位置：`#/definitions/timeRangeFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f30"></a>

### `@timeRangeFilter.default · anyOf[0]`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | enum=["today","last7d","last30d","last90d"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "today" | 以当前日为锚的今天范围。 |
| "last7d" | 受控最近7日快捷范围。 |
| "last30d" | 受控最近30日快捷范围。 |
| "last90d" | 受控最近90日快捷范围。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f31"></a>

### `@timeRangeFilter.default · anyOf[1]`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["from","to"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f312f70726f706572746965732f66726f6d"></a>

### `@timeRangeFilter.default · anyOf[1].from`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/1/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f312f70726f706572746965732f746f"></a>

### `@timeRangeFilter.default · anyOf[1].to`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/1/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f32"></a>

### `@timeRangeFilter.default · anyOf[2]`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/2`。目标：[#/definitions/relativeTimeExpression](filters.md#schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/relativeTimeExpression | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e"></a>

### `@relativeTimeExpression`

Schema位置：`#/definitions/relativeTimeExpression`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["unit","range","includeCurrent"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f756e6974"></a>

### `@relativeTimeExpression.unit`

Schema位置：`#/definitions/relativeTimeExpression/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["day","week","month","quarter","year"] | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "day" | 日粒度。 |
| "week" | 周粒度。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "quarter" | 季度粒度。 |
| "year" | 年粒度。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e6765"></a>

### `@relativeTimeExpression.range`

Schema位置：`#/definitions/relativeTimeExpression/properties/range`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控范围结构。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f30"></a>

### `@relativeTimeExpression.range · oneOf[0]`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind","n"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f302f70726f706572746965732f6b696e64"></a>

### `@relativeTimeExpression.range · oneOf[0].kind`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/0/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="lastN" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "lastN" | 含基准期的最近N期；时间参数窗口按自身日期/月精度计数。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f302f70726f706572746965732f6e"></a>

### `@relativeTimeExpression.range · oneOf[0].n`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/0/properties/n`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间的周期数量。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f31"></a>

### `@relativeTimeExpression.range · oneOf[1]`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f312f70726f706572746965732f6b696e64"></a>

### `@relativeTimeExpression.range · oneOf[1].kind`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/1/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="previousComplete" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "previousComplete" | 用于选择@relativeTimeExpression.range · oneOf[1].kind分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f32"></a>

### `@relativeTimeExpression.range · oneOf[2]`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f322f70726f706572746965732f6b696e64"></a>

### `@relativeTimeExpression.range · oneOf[2].kind`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/2/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="currentToDate" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "currentToDate" | 用于选择@relativeTimeExpression.range · oneOf[2].kind分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f696e636c75646543757272656e74"></a>

### `@relativeTimeExpression.includeCurrent`

Schema位置：`#/definitions/relativeTimeExpression/properties/includeCurrent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间范围是否包含当前周期。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f616e63686f72"></a>

### `@relativeTimeExpression.anchor`

Schema位置：`#/definitions/relativeTimeExpression/properties/anchor`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间计算所用的日历锚点。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c746572"></a>

### `@timePointFilter`

Schema位置：`#/definitions/timePointFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","granularity"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6964"></a>

### `@timePointFilter.id`

Schema位置：`#/definitions/timePointFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@timePointFilter.urlParams`

Schema位置：`#/definitions/timePointFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@timePointFilter.urlParams.value`

Schema位置：`#/definitions/timePointFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@timePointFilter.urlParams.from`

Schema位置：`#/definitions/timePointFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@timePointFilter.urlParams.to`

Schema位置：`#/definitions/timePointFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@timePointFilter.urlParams.level`

Schema位置：`#/definitions/timePointFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f74797065"></a>

### `@timePointFilter.type`

Schema位置：`#/definitions/timePointFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timePoint" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timePoint" | 用于选择@timePointFilter.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6c6162656c"></a>

### `@timePointFilter.label`

Schema位置：`#/definitions/timePointFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f76697369626c65"></a>

### `@timePointFilter.visible`

Schema位置：`#/definitions/timePointFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6772616e756c6172697479"></a>

### `@timePointFilter.granularity`

Schema位置：`#/definitions/timePointFilter/properties/granularity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["month","date"] | Schema未设默认；装配/运行时默认见语义说明 | 时间值的粒度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f64656661756c74"></a>

### `@timePointFilter.default`

Schema位置：`#/definitions/timePointFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c746572"></a>

### `@booleanFilter`

Schema位置：`#/definitions/booleanFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f6964"></a>

### `@booleanFilter.id`

Schema位置：`#/definitions/booleanFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@booleanFilter.urlParams`

Schema位置：`#/definitions/booleanFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@booleanFilter.urlParams.value`

Schema位置：`#/definitions/booleanFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@booleanFilter.urlParams.from`

Schema位置：`#/definitions/booleanFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@booleanFilter.urlParams.to`

Schema位置：`#/definitions/booleanFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@booleanFilter.urlParams.level`

Schema位置：`#/definitions/booleanFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f74797065"></a>

### `@booleanFilter.type`

Schema位置：`#/definitions/booleanFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="boolean" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "boolean" | 布尔值；false是显式取值。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f6c6162656c"></a>

### `@booleanFilter.label`

Schema位置：`#/definitions/booleanFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f76697369626c65"></a>

### `@booleanFilter.visible`

Schema位置：`#/definitions/booleanFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f64656661756c74"></a>

### `@booleanFilter.default`

Schema位置：`#/definitions/booleanFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c746572"></a>

### `@numberRangeFilter`

Schema位置：`#/definitions/numberRangeFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f6964"></a>

### `@numberRangeFilter.id`

Schema位置：`#/definitions/numberRangeFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@numberRangeFilter.urlParams`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@numberRangeFilter.urlParams.value`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@numberRangeFilter.urlParams.from`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@numberRangeFilter.urlParams.to`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@numberRangeFilter.urlParams.level`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f74797065"></a>

### `@numberRangeFilter.type`

Schema位置：`#/definitions/numberRangeFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="numberRange" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "numberRange" | 用于选择@numberRangeFilter.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f6c6162656c"></a>

### `@numberRangeFilter.label`

Schema位置：`#/definitions/numberRangeFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f76697369626c65"></a>

### `@numberRangeFilter.visible`

Schema位置：`#/definitions/numberRangeFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f64656661756c74"></a>

### `@numberRangeFilter.default`

Schema位置：`#/definitions/numberRangeFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f64656661756c742f70726f706572746965732f66726f6d"></a>

### `@numberRangeFilter.default.from`

Schema位置：`#/definitions/numberRangeFilter/properties/default/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f64656661756c742f70726f706572746965732f746f"></a>

### `@numberRangeFilter.default.to`

Schema位置：`#/definitions/numberRangeFilter/properties/default/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c746572"></a>

### `@searchFilter`

Schema位置：`#/definitions/searchFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f6964"></a>

### `@searchFilter.id`

Schema位置：`#/definitions/searchFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@searchFilter.urlParams`

Schema位置：`#/definitions/searchFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@searchFilter.urlParams.value`

Schema位置：`#/definitions/searchFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@searchFilter.urlParams.from`

Schema位置：`#/definitions/searchFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@searchFilter.urlParams.to`

Schema位置：`#/definitions/searchFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@searchFilter.urlParams.level`

Schema位置：`#/definitions/searchFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f74797065"></a>

### `@searchFilter.type`

Schema位置：`#/definitions/searchFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="search" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "search" | 普通文本搜索输入。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f6c6162656c"></a>

### `@searchFilter.label`

Schema位置：`#/definitions/searchFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f76697369626c65"></a>

### `@searchFilter.visible`

Schema位置：`#/definitions/searchFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f64656661756c74"></a>

### `@searchFilter.default`

Schema位置：`#/definitions/searchFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

## 语义规则与反例（生成）

- `filter-id-unique`：筛选器 id 唯一。反例：[duplicate-filter-id](errors/duplicate-filter-id.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `time-range-default-calendar`：timeRange 绝对默认值须为合法公历值、精度一致且 from 不晚于 to。反例：[time-range-from-format](errors/time-range-from-format.json)、[time-range-to-calendar](errors/time-range-to-calendar.json)、[time-range-datetime-without-precision](errors/time-range-datetime-without-precision.json)、[time-range-from-after-to](errors/time-range-from-after-to.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `relative-time-anchor`：结构化相对时间的 anchor 须为合法公历日期。反例：[relative-time-anchor-invalid](errors/relative-time-anchor-invalid.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `time-point-default`：timePoint 默认值符合其粒度的格式与日历。反例：[time-point-month-format](errors/time-point-month-format.json)、[time-point-month-range](errors/time-point-month-range.json)、[time-point-date-format](errors/time-point-date-format.json)、[time-point-date-calendar](errors/time-point-date-calendar.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `number-range-default`：numberRange 默认值至少有一端且 from 不大于 to。反例：[number-range-empty](errors/number-range-empty.json)、[number-range-inverted](errors/number-range-inverted.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `hierarchy-level-id-unique`：层级 id 在同一筛选器内唯一。反例：[duplicate-hierarchy-level-id](errors/duplicate-hierarchy-level-id.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `default-level-declared`：defaultLevel 只能用于声明了 hierarchy 的筛选器并引用已声明层级。反例：[default-level-without-hierarchy](errors/default-level-without-hierarchy.json)、[default-level-unknown](errors/default-level-unknown.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `hierarchy-picker-requires-hierarchy`：hierarchyPicker 只能用于声明了 hierarchy 的维度筛选器。反例：[hierarchy-picker-without-hierarchy](errors/hierarchy-picker-without-hierarchy.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `filter-depends-on`：级联只能依赖另一个已声明的 dimension 筛选器且不成环。反例：[depends-on-self](errors/depends-on-self.json)、[depends-on-undeclared](errors/depends-on-undeclared.json)、[depends-on-non-dimension](errors/depends-on-non-dimension.json)、[depends-on-cycle](errors/depends-on-cycle.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `hidden-hierarchy-picker-needs-map`：隐藏层级切换器时必须有地图通过 hierarchyFilter 承担下钻。反例：[hidden-hierarchy-picker-without-map](errors/hidden-hierarchy-picker-without-map.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [filters-page](examples/filters-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/filter.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/timeRangeFilter/properties/default/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/1/default`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/1`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/filters/2/default`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/2`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/2/default`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/0`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/filters/3/default/range`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/2/default/range`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/2`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/3/default/range`。
