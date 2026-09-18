# 结果字段契约

页面字段id是dataSources.<id>.fields的键；queryField指向DQE输出，两者不可隐式当成同一个名字。dimension用于分类，measure用于数值计算，detail承载受控明细；字段类型、角色和nullable必须与真实结果匹配。

query支持平铺和按角色分组的文档字段写法，normalize保持原始文档，运行时解析才展平。一个DQE输出应唯一映射到页面字段；派生字段不带queryField，必须由compute产出。

recordList使用显式items.fields约束每条嵌套记录，限制在已支持的明细呈现。collapsible:true是小计/合计的显式授权，不能从measure角色推断可加总。格式只影响显示，不修改原数值。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.5。结构真源为本册[schema.json](schema.json)，SHA256 `6ef401964cd74ad2805a8257e75f43ae5cb6b20f3f3479bb2ad49b481ed3ba60`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6669656c6473"></a>

### `@fields`

Schema位置：`#/definitions/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c64732f6164646974696f6e616c50726f70657274696573"></a>

### `@fields{key}`

Schema位置：`#/definitions/fields/additionalProperties`。目标：[#/definitions/field](fields.md#schema-232f646566696e6974696f6e732f6669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/field | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c64"></a>

### `@field`

Schema位置：`#/definitions/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c642f616e794f662f30"></a>

### `@field · anyOf[0]`

Schema位置：`#/definitions/field/anyOf/0`。目标：[#/definitions/scalarField](fields.md#schema-232f646566696e6974696f6e732f7363616c61724669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalarField | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c64"></a>

### `@scalarField`

Schema位置：`#/definitions/scalarField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f30"></a>

### `@scalarField · oneOf[0]`

Schema位置：`#/definitions/scalarField/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["type","role"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f302f70726f706572746965732f74797065"></a>

### `@scalarField · oneOf[0].type`

Schema位置：`#/definitions/scalarField/oneOf/0/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["string","number","boolean","date","datetime"] | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "string" | 字符串标量。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "boolean" | 布尔值；false是显式取值。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "datetime" | 带时间部分的日期时间字段。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f302f70726f706572746965732f726f6c65"></a>

### `@scalarField · oneOf[0].role`

Schema位置：`#/definitions/scalarField/oneOf/0/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["dimension","measure"] | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |
| "measure" | 可计算的数值度量；能否加总还须collapsible。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f302f70726f706572746965732f6c6162656c"></a>

### `@scalarField · oneOf[0].label`

Schema位置：`#/definitions/scalarField/oneOf/0/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f302f70726f706572746965732f756e6974"></a>

### `@scalarField · oneOf[0].unit`

Schema位置：`#/definitions/scalarField/oneOf/0/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f302f70726f706572746965732f6e756c6c61626c65"></a>

### `@scalarField · oneOf[0].nullable`

Schema位置：`#/definitions/scalarField/oneOf/0/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f302f70726f706572746965732f636f6c6c61707369626c65"></a>

### `@scalarField · oneOf[0].collapsible`

Schema位置：`#/definitions/scalarField/oneOf/0/properties/collapsible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式允许折叠加总，不能从measure角色推断。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f302f70726f706572746965732f64656661756c74466f726d6174"></a>

### `@scalarField · oneOf[0].defaultFormat`

Schema位置：`#/definitions/scalarField/oneOf/0/properties/defaultFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f31"></a>

### `@scalarField · oneOf[1]`

Schema位置：`#/definitions/scalarField/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["type","role","currency"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f312f70726f706572746965732f74797065"></a>

### `@scalarField · oneOf[1].type`

Schema位置：`#/definitions/scalarField/oneOf/1/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="money" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "money" | 用于选择@scalarField · oneOf[1].type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f312f70726f706572746965732f726f6c65"></a>

### `@scalarField · oneOf[1].role`

Schema位置：`#/definitions/scalarField/oneOf/1/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="measure" | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "measure" | 可计算的数值度量；能否加总还须collapsible。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f312f70726f706572746965732f63757272656e6379"></a>

### `@scalarField · oneOf[1].currency`

Schema位置：`#/definitions/scalarField/oneOf/1/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="CNY" | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 用于选择@scalarField · oneOf[1].currency分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f312f70726f706572746965732f6c6162656c"></a>

### `@scalarField · oneOf[1].label`

Schema位置：`#/definitions/scalarField/oneOf/1/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f312f70726f706572746965732f756e6974"></a>

### `@scalarField · oneOf[1].unit`

Schema位置：`#/definitions/scalarField/oneOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f312f70726f706572746965732f6e756c6c61626c65"></a>

### `@scalarField · oneOf[1].nullable`

Schema位置：`#/definitions/scalarField/oneOf/1/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f312f70726f706572746965732f636f6c6c61707369626c65"></a>

### `@scalarField · oneOf[1].collapsible`

Schema位置：`#/definitions/scalarField/oneOf/1/properties/collapsible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式允许折叠加总，不能从measure角色推断。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61724669656c642f6f6e654f662f312f70726f706572746965732f64656661756c74466f726d6174"></a>

### `@scalarField · oneOf[1].defaultFormat`

Schema位置：`#/definitions/scalarField/oneOf/1/properties/defaultFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f6669656c642f616e794f662f31"></a>

### `@field · anyOf[1]`

Schema位置：`#/definitions/field/anyOf/1`。目标：[#/definitions/recordListField](fields.md#schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/recordListField | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c64"></a>

### `@recordListField`

Schema位置：`#/definitions/recordListField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","role","items"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c642f70726f706572746965732f74797065"></a>

### `@recordListField.type`

Schema位置：`#/definitions/recordListField/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="recordList" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "recordList" | 用于选择@recordListField.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c642f70726f706572746965732f726f6c65"></a>

### `@recordListField.role`

Schema位置：`#/definitions/recordListField/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="detail" | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "detail" | 用于选择@recordListField.role分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c642f70726f706572746965732f6c6162656c"></a>

### `@recordListField.label`

Schema位置：`#/definitions/recordListField/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c642f70726f706572746965732f6e756c6c61626c65"></a>

### `@recordListField.nullable`

Schema位置：`#/definitions/recordListField/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c642f70726f706572746965732f6974656d73"></a>

### `@recordListField.items`

Schema位置：`#/definitions/recordListField/properties/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["fields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 数组/嵌套明细项的契约。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c642f70726f706572746965732f6974656d732f70726f706572746965732f6669656c6473"></a>

### `@recordListField.items.fields`

Schema位置：`#/definitions/recordListField/properties/items/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c642f70726f706572746965732f6974656d732f70726f706572746965732f6669656c64732f6164646974696f6e616c50726f70657274696573"></a>

### `@recordListField.items.fields{key}`

Schema位置：`#/definitions/recordListField/properties/items/properties/fields/additionalProperties`。目标：[#/definitions/scalarField](fields.md#schema-232f646566696e6974696f6e732f7363616c61724669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalarField | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265636f72644c6973744669656c642f70726f706572746965732f6974656d732f70726f706572746965732f6669656c64732f70726f70657274794e616d6573"></a>

### `@recordListField.items.fields · propertyNames`

Schema位置：`#/definitions/recordListField/properties/items/properties/fields/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c642f616e794f662f32"></a>

### `@field · anyOf[2]`

Schema位置：`#/definitions/field/anyOf/2`。目标：[#/definitions/semanticHtmlField](semantic-html.md#schema-232f646566696e6974696f6e732f73656d616e74696348746d6c4669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/semanticHtmlField | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c64732f70726f70657274794e616d6573"></a>

### `@fields · propertyNames`

Schema位置：`#/definitions/fields/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6456616c7565"></a>

### `@fieldValue`

Schema位置：`#/definitions/fieldValue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6456616c75652f616e794f662f30"></a>

### `@fieldValue · anyOf[0]`

Schema位置：`#/definitions/fieldValue/anyOf/0`。目标：[#/definitions/scalar](fields.md#schema-232f646566696e6974696f6e732f7363616c6172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalar | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c6172"></a>

### `@scalar`

Schema位置：`#/definitions/scalar`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61722f616e794f662f30"></a>

### `@scalar · anyOf[0]`

Schema位置：`#/definitions/scalar/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61722f616e794f662f31"></a>

### `@scalar · anyOf[1]`

Schema位置：`#/definitions/scalar/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61722f616e794f662f32"></a>

### `@scalar · anyOf[2]`

Schema位置：`#/definitions/scalar/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7363616c61722f616e794f662f33"></a>

### `@scalar · anyOf[3]`

Schema位置：`#/definitions/scalar/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "null" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6456616c75652f616e794f662f31"></a>

### `@fieldValue · anyOf[1]`

Schema位置：`#/definitions/fieldValue/anyOf/1`。目标：[#/definitions/detailRecordList](fields.md#schema-232f646566696e6974696f6e732f64657461696c5265636f72644c697374)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/detailRecordList | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5265636f72644c697374"></a>

### `@detailRecordList`

Schema位置：`#/definitions/detailRecordList`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 类型/分支 | maxItems=100 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5265636f72644c6973742f6974656d73"></a>

### `@detailRecordList[]`

Schema位置：`#/definitions/detailRecordList/items`。目标：[#/definitions/detailRecord](fields.md#schema-232f646566696e6974696f6e732f64657461696c5265636f7264)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/detailRecord | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5265636f7264"></a>

### `@detailRecord`

Schema位置：`#/definitions/detailRecord`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5265636f72642f6164646974696f6e616c50726f70657274696573"></a>

### `@detailRecord{key}`

Schema位置：`#/definitions/detailRecord/additionalProperties`。目标：[#/definitions/scalar](fields.md#schema-232f646566696e6974696f6e732f7363616c6172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalar | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64657461696c5265636f72642f70726f70657274794e616d6573"></a>

### `@detailRecord · propertyNames`

Schema位置：`#/definitions/detailRecord/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572794669656c6473"></a>

### `@queryFields`

Schema位置：`#/definitions/queryFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572794669656c64732f6164646974696f6e616c50726f70657274696573"></a>

### `@queryFields{key}`

Schema位置：`#/definitions/queryFields/additionalProperties`。目标：[#/definitions/queryField](fields.md#schema-232f646566696e6974696f6e732f71756572794669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryField | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572794669656c64"></a>

### `@queryField`

Schema位置：`#/definitions/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572794669656c642f616e794f662f30"></a>

### `@queryField · anyOf[0]`

Schema位置：`#/definitions/queryField/anyOf/0`。目标：[#/definitions/queryScalarField](fields.md#schema-232f646566696e6974696f6e732f71756572795363616c61724669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryScalarField | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c64"></a>

### `@queryScalarField`

Schema位置：`#/definitions/queryScalarField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f30"></a>

### `@queryScalarField · oneOf[0]`

Schema位置：`#/definitions/queryScalarField/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["type","role","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f302f70726f706572746965732f74797065"></a>

### `@queryScalarField · oneOf[0].type`

Schema位置：`#/definitions/queryScalarField/oneOf/0/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["string","number","boolean","date","datetime"] | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "string" | 字符串标量。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "boolean" | 布尔值；false是显式取值。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "datetime" | 带时间部分的日期时间字段。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f302f70726f706572746965732f726f6c65"></a>

### `@queryScalarField · oneOf[0].role`

Schema位置：`#/definitions/queryScalarField/oneOf/0/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["dimension","measure"] | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |
| "measure" | 可计算的数值度量；能否加总还须collapsible。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f302f70726f706572746965732f6c6162656c"></a>

### `@queryScalarField · oneOf[0].label`

Schema位置：`#/definitions/queryScalarField/oneOf/0/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f302f70726f706572746965732f756e6974"></a>

### `@queryScalarField · oneOf[0].unit`

Schema位置：`#/definitions/queryScalarField/oneOf/0/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f302f70726f706572746965732f6e756c6c61626c65"></a>

### `@queryScalarField · oneOf[0].nullable`

Schema位置：`#/definitions/queryScalarField/oneOf/0/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f302f70726f706572746965732f636f6c6c61707369626c65"></a>

### `@queryScalarField · oneOf[0].collapsible`

Schema位置：`#/definitions/queryScalarField/oneOf/0/properties/collapsible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式允许折叠加总，不能从measure角色推断。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f302f70726f706572746965732f64656661756c74466f726d6174"></a>

### `@queryScalarField · oneOf[0].defaultFormat`

Schema位置：`#/definitions/queryScalarField/oneOf/0/properties/defaultFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f302f70726f706572746965732f71756572794669656c64"></a>

### `@queryScalarField · oneOf[0].queryField`

Schema位置：`#/definitions/queryScalarField/oneOf/0/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f31"></a>

### `@queryScalarField · oneOf[1]`

Schema位置：`#/definitions/queryScalarField/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["type","role","currency","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f74797065"></a>

### `@queryScalarField · oneOf[1].type`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="money" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "money" | 用于选择@queryScalarField · oneOf[1].type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f726f6c65"></a>

### `@queryScalarField · oneOf[1].role`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="measure" | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "measure" | 可计算的数值度量；能否加总还须collapsible。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f63757272656e6379"></a>

### `@queryScalarField · oneOf[1].currency`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="CNY" | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 用于选择@queryScalarField · oneOf[1].currency分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f6c6162656c"></a>

### `@queryScalarField · oneOf[1].label`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f756e6974"></a>

### `@queryScalarField · oneOf[1].unit`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f6e756c6c61626c65"></a>

### `@queryScalarField · oneOf[1].nullable`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f636f6c6c61707369626c65"></a>

### `@queryScalarField · oneOf[1].collapsible`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/collapsible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式允许折叠加总，不能从measure角色推断。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f64656661756c74466f726d6174"></a>

### `@queryScalarField · oneOf[1].defaultFormat`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/defaultFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f71756572795363616c61724669656c642f6f6e654f662f312f70726f706572746965732f71756572794669656c64"></a>

### `@queryScalarField · oneOf[1].queryField`

Schema位置：`#/definitions/queryScalarField/oneOf/1/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f71756572794669656c642f616e794f662f31"></a>

### `@queryField · anyOf[1]`

Schema位置：`#/definitions/queryField/anyOf/1`。目标：[#/definitions/queryRecordListField](fields.md#schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryRecordListField | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c64"></a>

### `@queryRecordListField`

Schema位置：`#/definitions/queryRecordListField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","role","queryField","items"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f74797065"></a>

### `@queryRecordListField.type`

Schema位置：`#/definitions/queryRecordListField/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="recordList" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "recordList" | 用于选择@queryRecordListField.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f726f6c65"></a>

### `@queryRecordListField.role`

Schema位置：`#/definitions/queryRecordListField/properties/role`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="detail" | Schema未设默认；装配/运行时默认见语义说明 | 维度、度量或明细等受控字段角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "detail" | 用于选择@queryRecordListField.role分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f71756572794669656c64"></a>

### `@queryRecordListField.queryField`

Schema位置：`#/definitions/queryRecordListField/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f6c6162656c"></a>

### `@queryRecordListField.label`

Schema位置：`#/definitions/queryRecordListField/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f6e756c6c61626c65"></a>

### `@queryRecordListField.nullable`

Schema位置：`#/definitions/queryRecordListField/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f6974656d73"></a>

### `@queryRecordListField.items`

Schema位置：`#/definitions/queryRecordListField/properties/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["fields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 数组/嵌套明细项的契约。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f6974656d732f70726f706572746965732f6669656c6473"></a>

### `@queryRecordListField.items.fields`

Schema位置：`#/definitions/queryRecordListField/properties/items/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f6974656d732f70726f706572746965732f6669656c64732f6164646974696f6e616c50726f70657274696573"></a>

### `@queryRecordListField.items.fields{key}`

Schema位置：`#/definitions/queryRecordListField/properties/items/properties/fields/additionalProperties`。目标：[#/definitions/queryScalarField](fields.md#schema-232f646566696e6974696f6e732f71756572795363616c61724669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryScalarField | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572795265636f72644c6973744669656c642f70726f706572746965732f6974656d732f70726f706572746965732f6669656c64732f70726f70657274794e616d6573"></a>

### `@queryRecordListField.items.fields · propertyNames`

Schema位置：`#/definitions/queryRecordListField/properties/items/properties/fields/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572794669656c642f616e794f662f32"></a>

### `@queryField · anyOf[2]`

Schema位置：`#/definitions/queryField/anyOf/2`。目标：[#/definitions/querySemanticHtmlField](semantic-html.md#schema-232f646566696e6974696f6e732f717565727953656d616e74696348746d6c4669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/querySemanticHtmlField | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572794669656c642f616e794f662f33"></a>

### `@queryField · anyOf[3]`

Schema位置：`#/definitions/queryField/anyOf/3`。目标：[#/definitions/scalarField](fields.md#schema-232f646566696e6974696f6e732f7363616c61724669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalarField | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f71756572794669656c64732f70726f70657274794e616d6573"></a>

### `@queryFields · propertyNames`

Schema位置：`#/definitions/queryFields/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c6473"></a>

### `@groupedQueryFields`

Schema位置：`#/definitions/groupedQueryFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c64732f70726f706572746965732f64696d656e73696f6e73"></a>

### `@groupedQueryFields.dimensions`

Schema位置：`#/definitions/groupedQueryFields/properties/dimensions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按角色声明的维度字段组。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c64732f70726f706572746965732f64696d656e73696f6e732f616c6c4f662f30"></a>

### `@groupedQueryFields.dimensions · allOf[0]`

Schema位置：`#/definitions/groupedQueryFields/properties/dimensions/allOf/0`。目标：[#/definitions/groupedDimensionQueryFieldGroup](fields.md#schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f7570)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/groupedDimensionQueryFieldGroup | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f7570"></a>

### `@groupedDimensionQueryFieldGroup`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f6164646974696f6e616c50726f70657274696573"></a>

### `@groupedDimensionQueryFieldGroup{key}`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | required=["queryField","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f70726f706572746965732f71756572794669656c64"></a>

### `@groupedDimensionQueryFieldGroup{key}.queryField`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/additionalProperties/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f70726f706572746965732f74797065"></a>

### `@groupedDimensionQueryFieldGroup{key}.type`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/additionalProperties/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["string","number","boolean","date","datetime"] | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "string" | 字符串标量。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "boolean" | 布尔值；false是显式取值。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "datetime" | 带时间部分的日期时间字段。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6c6162656c"></a>

### `@groupedDimensionQueryFieldGroup{key}.label`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/additionalProperties/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f70726f706572746965732f756e6974"></a>

### `@groupedDimensionQueryFieldGroup{key}.unit`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/additionalProperties/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6e756c6c61626c65"></a>

### `@groupedDimensionQueryFieldGroup{key}.nullable`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/additionalProperties/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f70726f706572746965732f636f6c6c61707369626c65"></a>

### `@groupedDimensionQueryFieldGroup{key}.collapsible`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/additionalProperties/properties/collapsible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式允许折叠加总，不能从measure角色推断。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f70726f706572746965732f64656661756c74466f726d6174"></a>

### `@groupedDimensionQueryFieldGroup{key}.defaultFormat`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/additionalProperties/properties/defaultFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656444696d656e73696f6e51756572794669656c6447726f75702f70726f70657274794e616d6573"></a>

### `@groupedDimensionQueryFieldGroup · propertyNames`

Schema位置：`#/definitions/groupedDimensionQueryFieldGroup/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c64732f70726f706572746965732f6d65617375726573"></a>

### `@groupedQueryFields.measures`

Schema位置：`#/definitions/groupedQueryFields/properties/measures`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 度量字段集合或分组。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c64732f70726f706572746965732f6d656173757265732f616c6c4f662f30"></a>

### `@groupedQueryFields.measures · allOf[0]`

Schema位置：`#/definitions/groupedQueryFields/properties/measures/allOf/0`。目标：[#/definitions/groupedMeasureQueryFieldGroup](fields.md#schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f7570)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/groupedMeasureQueryFieldGroup | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f7570"></a>

### `@groupedMeasureQueryFieldGroup`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f70657274696573"></a>

### `@groupedMeasureQueryFieldGroup{key}`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[0]`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["queryField","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f71756572794669656c64"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[0].queryField`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f74797065"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[0].type`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["string","number","boolean","date","datetime"] | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "string" | 字符串标量。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "boolean" | 布尔值；false是显式取值。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "datetime" | 带时间部分的日期时间字段。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6c6162656c"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[0].label`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f756e6974"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[0].unit`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6e756c6c61626c65"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[0].nullable`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f636f6c6c61707369626c65"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[0].collapsible`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0/properties/collapsible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式允许折叠加总，不能从measure角色推断。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f64656661756c74466f726d6174"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[0].defaultFormat`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0/properties/defaultFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1]`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["queryField","type","currency"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f71756572794669656c64"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1].queryField`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f74797065"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1].type`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="money" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "money" | 用于选择@groupedMeasureQueryFieldGroup{key} · oneOf[1].type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f63757272656e6379"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1].currency`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="CNY" | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 用于选择@groupedMeasureQueryFieldGroup{key} · oneOf[1].currency分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6c6162656c"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1].label`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f756e6974"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1].unit`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6e756c6c61626c65"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1].nullable`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1/properties/nullable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显式允许空值，不能以字段缺失代替null。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f636f6c6c61707369626c65"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1].collapsible`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1/properties/collapsible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式允许折叠加总，不能从measure角色推断。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f64656661756c74466f726d6174"></a>

### `@groupedMeasureQueryFieldGroup{key} · oneOf[1].defaultFormat`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1/properties/defaultFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f67726f757065644d65617375726551756572794669656c6447726f75702f70726f70657274794e616d6573"></a>

### `@groupedMeasureQueryFieldGroup · propertyNames`

Schema位置：`#/definitions/groupedMeasureQueryFieldGroup/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c64732f616e794f662f30"></a>

### `@groupedQueryFields · anyOf[0]`

Schema位置：`#/definitions/groupedQueryFields/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 独立分支（不合并required） | required=["dimensions"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c64732f616e794f662f31"></a>

### `@groupedQueryFields · anyOf[1]`

Schema位置：`#/definitions/groupedQueryFields/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 独立分支（不合并required） | required=["measures"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `grouped-query-fields-unique`：按角色分组的查询字段在维度组与度量组之间不得重名。反例：[grouped-field-duplicate](errors/grouped-field-duplicate.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `grouped-query-field-label-not-id`：分组查询字段的 label 与字段 id 相同时应省略。反例：[grouped-field-label-equals-id](errors/grouped-field-label-equals-id.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `inline-rows-contract`：inline 数据行满足结果字段契约（字段集合、类型、nullable、明细约束）。反例：[inline-row-undeclared-field](errors/inline-row-undeclared-field.json)、[inline-row-missing-field](errors/inline-row-missing-field.json)、[inline-row-null-not-allowed](errors/inline-row-null-not-allowed.json)、[inline-row-type-mismatch](errors/inline-row-type-mismatch.json)、[inline-row-date-invalid](errors/inline-row-date-invalid.json)、[inline-row-datetime-invalid](errors/inline-row-datetime-invalid.json)、[inline-row-semantic-html-type](errors/inline-row-semantic-html-type.json)、[inline-row-detail-undeclared-field](errors/inline-row-detail-undeclared-field.json)、[inline-row-detail-missing-field](errors/inline-row-detail-missing-field.json)、[inline-row-detail-null-not-allowed](errors/inline-row-detail-null-not-allowed.json)、[inline-row-detail-type-mismatch](errors/inline-row-detail-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `detail-item-object`：嵌套明细的每一项必须是对象；由 Page Schema 在结构层拒绝，语义层的同名判定因此不可达。反例：[initial-row-detail-item-not-object](errors/initial-row-detail-item-not-object.json)、[inline-row-detail-item-not-object](errors/inline-row-detail-item-not-object.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `detail-list-max-items`：嵌套明细最多 100 项；由 Page Schema 的 maxItems 在结构层拒绝，语义层的同名判定因此不可达。反例：[initial-row-detail-list-too-large](errors/initial-row-detail-list-too-large.json)、[inline-row-detail-list-too-large](errors/inline-row-detail-list-too-large.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `query-field-mapping`：query 数据源字段与 DQE 输出字段之间的显式、唯一、角色相容映射。反例：[query-field-without-mapping](errors/query-field-without-mapping.json)、[query-field-duplicate-mapping](errors/query-field-duplicate-mapping.json)、[query-field-not-output](errors/query-field-not-output.json)、[query-detail-item-duplicate-mapping](errors/query-detail-item-duplicate-mapping.json)、[query-dimension-role-mismatch](errors/query-dimension-role-mismatch.json)、[query-role-mismatch](errors/query-role-mismatch.json)、[query-output-unmapped](errors/query-output-unmapped.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `detail-field-consumption`：嵌套明细字段只能由显式支持 detail 的组件属性消费。反例：[detail-field-in-generic-binding](errors/detail-field-in-generic-binding.json)、[record-list-in-table-column](errors/record-list-in-table-column.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [grouped-fields-page](examples/grouped-fields-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/data-source.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/field/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/fixed-target/fields/target`。
- `#/definitions/scalarField/oneOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/fixed-target/fields/target`。
- `#/definitions/scalarField/oneOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/dataSources/amounts/fields/amount`。
- `#/definitions/field/anyOf/1`：[合法完整页面](examples/component-fieldText.json)，JSON Pointer `#/dataSources/notes/fields/items`。
- `#/definitions/field/anyOf/2`：[合法完整页面](examples/component-fieldText.json)，JSON Pointer `#/dataSources/notes/fields/body`。
- `#/definitions/fieldValue/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/fixed-target/source/rows/0/target`。
- `#/definitions/scalar/anyOf/0`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/monthly/source/initial/rows/0/month`。
- `#/definitions/scalar/anyOf/1`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/fixed-target/source/rows/0/target`。
- `#/definitions/scalar/anyOf/2`：[合法完整页面](examples/component-fieldText.json)，JSON Pointer `#/dataSources/notes/source/rows/0/flag`。
- `#/definitions/scalar/anyOf/3`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/monthly/source/initial/rows/0/forecast`。
- `#/definitions/fieldValue/anyOf/1`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/source/initial/rows/0/events`。
- `#/definitions/queryField/anyOf/0`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/monthly/fields/month`。
- `#/definitions/queryScalarField/oneOf/0`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/monthly/fields/month`。
- `#/definitions/queryScalarField/oneOf/1`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/dataSources/orders/fields/amount`。
- `#/definitions/queryField/anyOf/1`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/fields/events`。
- `#/definitions/queryField/anyOf/2`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/fields/reason`。
- `#/definitions/queryField/anyOf/3`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/pivoted/fields/online`。
- `#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields/measures/growth`。
- `#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields/measures/revenue`。
- `#/definitions/groupedQueryFields/anyOf/0`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields`。
- `#/definitions/groupedQueryFields/anyOf/1`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields`。
