# 具名算子

compute按声明顺序处理归一化行集。ratio逐行相除，零/缺分母按null或zero处理，缺分子取空；scale缺省原比率，100将其变成百分刻度。delta做减法，任一输入空则空。

groupSubtotal在每组明细后插小计；grandTotal只累计明细、不重复累计小计；两者只使用collapsible:true度量。rowKind字段是可空string维度，subtotal/total标记汇总行。pivot按有序类别列表匹配首个类别，把行转列。

所有产出字段必须就地声明，不能伪装成原始输入或queryField。这是封闭算子系统，显示格式、任意公式及通用脚本均不是算子。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 汇总的全空结果（6.12）

`groupSubtotal`和`grandTotal`可声明`allMissing: "null" | "zero"`。省略或null保持原行为：某项度量整组没有数值时输出null；zero仅将全部为null/缺失的汇总输出0，不改明细。无效非空输入不因此变成0；溢出仍为null。空行集不生成汇总，总计继续排除小计行。策略属于该次计算，不属于字段的全局缺失规则。6.11不能使用该声明。

## 多度量透视与有限主集合左关联 6.14

pivot.columns可指定valueField覆盖算子默认字段。同类别可用于不同度量，重复的有效valueField与类别组合拒绝；新多度量透视的分组键与类别必须唯一。缺阶段产出null，0保持0。有限主结果仅在被结果绑定引用且声明正整数limit、无offset/查询分页时允许左关联；辅助源仍须complete，无分页窗口。导出保持此选择范围并使用本轮原始结果重建明细输入。


页面协议 6.64。结构真源为本册[schema.json](schema.json)，SHA256 `c0aed5e15e699271f4d50813b2e3e140123929c16bdb9b72e11a6555d12d669f`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f636f6d70757465"></a>

### `@compute`

Schema位置：`#/definitions/compute`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 类型/分支 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 页面数据源的受控计算阶段；算子按声明顺序作用于已归一化的行集 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574652f6974656d73"></a>

### `@compute[]`

Schema位置：`#/definitions/compute/items`。目标：[#/definitions/computeOperator](compute.md#schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f72)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/computeOperator | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f72"></a>

### `@computeOperator`

Schema位置：`#/definitions/computeOperator`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f30"></a>

### `@computeOperator · oneOf[0]`

Schema位置：`#/definitions/computeOperator/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","source","keys","values","onMissing"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[0].op`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="joinAggregate" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "joinAggregate" | 用于选择@computeOperator · oneOf[0].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@computeOperator · oneOf[0].source`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6b657973"></a>

### `@computeOperator · oneOf[0].keys`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/keys`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 按 local/foreign 显式声明跨源匹配字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6b6579732f6974656d73"></a>

### `@computeOperator · oneOf[0].keys[]`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/keys/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["local","foreign"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6b6579732f6974656d732f70726f706572746965732f6c6f63616c"></a>

### `@computeOperator · oneOf[0].keys[].local`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/keys/items/properties/local`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 当前数据源关联键字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6b6579732f6974656d732f70726f706572746965732f666f726569676e"></a>

### `@computeOperator · oneOf[0].keys[].foreign`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/keys/items/properties/foreign`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 被关联数据源的匹配字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f76616c756573"></a>

### `@computeOperator · oneOf[0].values`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/values`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 聚合字段、输出字段及封闭聚合方式。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f76616c7565732f6974656d73"></a>

### `@computeOperator · oneOf[0].values[]`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/values/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["field","output","aggregate"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f76616c7565732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@computeOperator · oneOf[0].values[].field`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/values/items/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f76616c7565732f6974656d732f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[0].values[].output`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/values/items/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f76616c7565732f6974656d732f70726f706572746965732f616767726567617465"></a>

### `@computeOperator · oneOf[0].values[].aggregate`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/values/items/properties/aggregate`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["unique","sum"] | Schema未设默认；装配/运行时默认见语义说明 | unique 要求唯一值，sum 按可加度量求和；不推断口径。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "unique" | 要求唯一非空值，歧义时拒绝计算。 |
| "sum" | 按声明可加度量求和。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6f6e4d697373696e67"></a>

### `@computeOperator · oneOf[0].onMissing`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/onMissing`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="null" | Schema未设默认；装配/运行时默认见语义说明 | 明确关联或字段缺失时的处理方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "null" | 零/缺分母时输出空值。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f31"></a>

### `@computeOperator · oneOf[1]`

Schema位置：`#/definitions/computeOperator/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","fields","output","onMissing"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[1].op`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="sumFields" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "sumFields" | 用于选择@computeOperator · oneOf[1].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f6669656c6473"></a>

### `@computeOperator · oneOf[1].fields`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=2; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@computeOperator · oneOf[1].fields[]`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/fields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[1].output`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f6f6e4d697373696e67"></a>

### `@computeOperator · oneOf[1].onMissing`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/onMissing`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["null","ignore"] | Schema未设默认；装配/运行时默认见语义说明 | 明确关联或字段缺失时的处理方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "null" | 零/缺分母时输出空值。 |
| "ignore" | 忽略缺失输入；其余值参与求和。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f32"></a>

### `@computeOperator · oneOf[2]`

Schema位置：`#/definitions/computeOperator/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","beginning","ending","periods","output"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[2].op`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="cagr" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "cagr" | 用于选择@computeOperator · oneOf[2].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f626567696e6e696e67"></a>

### `@computeOperator · oneOf[2].beginning`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/beginning`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 复合增长率的起始字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f656e64696e67"></a>

### `@computeOperator · oneOf[2].ending`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/ending`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 复合增长率的结束字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f706572696f6473"></a>

### `@computeOperator · oneOf[2].periods`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/periods`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 复合增长率的正周期数。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[2].output`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f7363616c65"></a>

### `@computeOperator · oneOf[2].scale`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/scale`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | const=100 | Schema未设默认；装配/运行时默认见语义说明 | ratio输出刻度；显式100转换为百分刻度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| 100 | ratio输出乘100，匹配百分比原值展示。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f33"></a>

### `@computeOperator · oneOf[3]`

Schema位置：`#/definitions/computeOperator/oneOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","timeField","granularity","format","range","measures"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[3].op`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timeFill" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timeFill" | 用于选择@computeOperator · oneOf[3].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f74696d654669656c64"></a>

### `@computeOperator · oneOf[3].timeField`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/timeField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 补齐时间轴的时间字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f6772616e756c6172697479"></a>

### `@computeOperator · oneOf[3].granularity`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/granularity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["day","month"] | Schema未设默认；装配/运行时默认见语义说明 | 时间值的粒度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "day" | YYYY-MM-DD日范围及匹配静态day查询。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f666f726d6174"></a>

### `@computeOperator · oneOf[3].format`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["iso","compact"] | Schema未设默认；装配/运行时默认见语义说明 | 显示格式，不修改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "iso" | 时间点原样送 YYYY-MM / YYYY-MM-DD。 |
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f72616e6765"></a>

### `@computeOperator · oneOf[3].range`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/range`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控范围结构。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f72616e67652f616e794f662f30"></a>

### `@computeOperator · oneOf[3].range · anyOf[0]`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/range/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["from","to"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f72616e67652f616e794f662f302f70726f706572746965732f66726f6d"></a>

### `@computeOperator · oneOf[3].range · anyOf[0].from`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/range/anyOf/0/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f72616e67652f616e794f662f302f70726f706572746965732f746f"></a>

### `@computeOperator · oneOf[3].range · anyOf[0].to`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/range/anyOf/0/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f72616e67652f616e794f662f31"></a>

### `@computeOperator · oneOf[3].range · anyOf[1]`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/range/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["currentYearOffset"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f72616e67652f616e794f662f312f70726f706572746965732f63757272656e74596561724f6666736574"></a>

### `@computeOperator · oneOf[3].range · anyOf[1].currentYearOffset`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/range/anyOf/1/properties/currentYearOffset`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=-100; maximum=100 | Schema未设默认；装配/运行时默认见语义说明 | 相对打开页面时自然年的显式偏移。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f72616e67652f616e794f662f32"></a>

### `@computeOperator · oneOf[3].range · anyOf[2]`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/range/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["filter"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f72616e67652f616e794f662f322f70726f706572746965732f66696c746572"></a>

### `@computeOperator · oneOf[3].range · anyOf[2].filter`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/range/anyOf/2/properties/filter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 显式引用本页筛选器状态。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f6d65617375726573"></a>

### `@computeOperator · oneOf[3].measures`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/measures`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 度量字段集合或分组。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f6d656173757265732f6974656d73"></a>

### `@computeOperator · oneOf[3].measures[]`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/measures/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f67726f75704279"></a>

### `@computeOperator · oneOf[3].groupBy`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/groupBy`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 折叠分组的维度字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f67726f757042792f6974656d73"></a>

### `@computeOperator · oneOf[3].groupBy[]`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/groupBy/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f34"></a>

### `@computeOperator · oneOf[4]`

Schema位置：`#/definitions/computeOperator/oneOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","filter","cases","defaultMode","output"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[4].op`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="selectField" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "selectField" | 用于选择@computeOperator · oneOf[4].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f66696c746572"></a>

### `@computeOperator · oneOf[4].filter`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/filter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 显式引用本页筛选器状态。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f6361736573"></a>

### `@computeOperator · oneOf[4].cases`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/cases`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","minLength":1}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 按筛选值显式映射要投影的字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f63617365732f6164646974696f6e616c50726f70657274696573"></a>

### `@computeOperator · oneOf[4].cases{key}`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/cases/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f63617365732f70726f70657274794e616d6573"></a>

### `@computeOperator · oneOf[4].cases · propertyNames`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/cases/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f64656661756c744d6f6465"></a>

### `@computeOperator · oneOf[4].defaultMode`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/defaultMode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 无匹配筛选值时的声明模式。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[4].output`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f35"></a>

### `@computeOperator · oneOf[5]`

Schema位置：`#/definitions/computeOperator/oneOf/5`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","numerator","denominator","output","onZeroDenominator"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f352f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[5].op`

Schema位置：`#/definitions/computeOperator/oneOf/5/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="ratio" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "ratio" | 用于选择@computeOperator · oneOf[5].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f352f70726f706572746965732f6e756d657261746f72"></a>

### `@computeOperator · oneOf[5].numerator`

Schema位置：`#/definitions/computeOperator/oneOf/5/properties/numerator`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | ratio分子数值字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f352f70726f706572746965732f64656e6f6d696e61746f72"></a>

### `@computeOperator · oneOf[5].denominator`

Schema位置：`#/definitions/computeOperator/oneOf/5/properties/denominator`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | ratio分母数值字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f352f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[5].output`

Schema位置：`#/definitions/computeOperator/oneOf/5/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f352f70726f706572746965732f6f6e5a65726f44656e6f6d696e61746f72"></a>

### `@computeOperator · oneOf[5].onZeroDenominator`

Schema位置：`#/definitions/computeOperator/oneOf/5/properties/onZeroDenominator`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["null","zero"] | Schema未设默认；装配/运行时默认见语义说明 | 分母为零或缺失时取空还是取零；必须显式声明，默认值会静默改数 |

| 允许值 | 解释与适用条件 |
|---|---|
| "null" | 零/缺分母时输出空值。 |
| "zero" | 零/缺分母时输出0。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f352f70726f706572746965732f7363616c65"></a>

### `@computeOperator · oneOf[5].scale`

Schema位置：`#/definitions/computeOperator/oneOf/5/properties/scale`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | const=100 | Schema未设默认；装配/运行时默认见语义说明 | 输出刻度；缺省产出 0–1 分数，100 产出 0–100。闭集只有 100，开放数值等于在算子里引入乘法表达式 |

| 允许值 | 解释与适用条件 |
|---|---|
| 100 | ratio输出乘100，匹配百分比原值展示。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f36"></a>

### `@computeOperator · oneOf[6]`

Schema位置：`#/definitions/computeOperator/oneOf/6`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","minuend","subtrahend","output"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f362f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[6].op`

Schema位置：`#/definitions/computeOperator/oneOf/6/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="delta" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "delta" | 用于选择@computeOperator · oneOf[6].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f362f70726f706572746965732f6d696e75656e64"></a>

### `@computeOperator · oneOf[6].minuend`

Schema位置：`#/definitions/computeOperator/oneOf/6/properties/minuend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | delta被减数数值字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f362f70726f706572746965732f73756274726168656e64"></a>

### `@computeOperator · oneOf[6].subtrahend`

Schema位置：`#/definitions/computeOperator/oneOf/6/properties/subtrahend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | delta减数数值字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f362f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[6].output`

Schema位置：`#/definitions/computeOperator/oneOf/6/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f37"></a>

### `@computeOperator · oneOf[7]`

Schema位置：`#/definitions/computeOperator/oneOf/7`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","groupBy","measures","rowKind"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f372f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[7].op`

Schema位置：`#/definitions/computeOperator/oneOf/7/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="groupSubtotal" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "groupSubtotal" | 用于选择@computeOperator · oneOf[7].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f372f70726f706572746965732f616c6c4d697373696e67"></a>

### `@computeOperator · oneOf[7].allMissing`

Schema位置：`#/definitions/computeOperator/oneOf/7/properties/allMissing`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["null","zero"] | Schema未设默认；装配/运行时默认见语义说明 | 折叠输入全为空时显式选择 null 或 zero，缺省 null。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "null" | 零/缺分母时输出空值。 |
| "zero" | 零/缺分母时输出0。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f372f70726f706572746965732f67726f75704279"></a>

### `@computeOperator · oneOf[7].groupBy`

Schema位置：`#/definitions/computeOperator/oneOf/7/properties/groupBy`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 折叠分组的维度字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f372f70726f706572746965732f6d65617375726573"></a>

### `@computeOperator · oneOf[7].measures`

Schema位置：`#/definitions/computeOperator/oneOf/7/properties/measures`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 度量字段集合或分组。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f372f70726f706572746965732f6d656173757265732f6974656d73"></a>

### `@computeOperator · oneOf[7].measures[]`

Schema位置：`#/definitions/computeOperator/oneOf/7/properties/measures/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f372f70726f706572746965732f726f774b696e64"></a>

### `@computeOperator · oneOf[7].rowKind`

Schema位置：`#/definitions/computeOperator/oneOf/7/properties/rowKind`。目标：[#/definitions/rowKindMark](compute.md#schema-232f646566696e6974696f6e732f726f774b696e644d61726b)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rowKindMark | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 算子写入汇总行类别的声明。 |

<a id="schema-232f646566696e6974696f6e732f726f774b696e644d61726b"></a>

### `@rowKindMark`

Schema位置：`#/definitions/rowKindMark`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["field","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 折叠行写入的行类别字段与取值；表格按同一闭集识别呈现档位 |

<a id="schema-232f646566696e6974696f6e732f726f774b696e644d61726b2f70726f706572746965732f6669656c64"></a>

### `@rowKindMark.field`

Schema位置：`#/definitions/rowKindMark/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f726f774b696e644d61726b2f70726f706572746965732f76616c7565"></a>

### `@rowKindMark.value`

Schema位置：`#/definitions/rowKindMark/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["subtotal","total"] | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "subtotal" | 分组小计行标记。 |
| "total" | 全局合计行标记。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f372f70726f706572746965732f6c6162656c537566666978"></a>

### `@computeOperator · oneOf[7].labelSuffix`

Schema位置：`#/definitions/computeOperator/oneOf/7/properties/labelSuffix`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 分组小计标签后缀。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f38"></a>

### `@computeOperator · oneOf[8]`

Schema位置：`#/definitions/computeOperator/oneOf/8`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","measures","rowKind","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f382f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[8].op`

Schema位置：`#/definitions/computeOperator/oneOf/8/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="grandTotal" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "grandTotal" | 用于选择@computeOperator · oneOf[8].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f382f70726f706572746965732f616c6c4d697373696e67"></a>

### `@computeOperator · oneOf[8].allMissing`

Schema位置：`#/definitions/computeOperator/oneOf/8/properties/allMissing`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["null","zero"] | Schema未设默认；装配/运行时默认见语义说明 | 折叠输入全为空时显式选择 null 或 zero，缺省 null。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "null" | 零/缺分母时输出空值。 |
| "zero" | 零/缺分母时输出0。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f382f70726f706572746965732f6d65617375726573"></a>

### `@computeOperator · oneOf[8].measures`

Schema位置：`#/definitions/computeOperator/oneOf/8/properties/measures`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 度量字段集合或分组。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f382f70726f706572746965732f6d656173757265732f6974656d73"></a>

### `@computeOperator · oneOf[8].measures[]`

Schema位置：`#/definitions/computeOperator/oneOf/8/properties/measures/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f382f70726f706572746965732f726f774b696e64"></a>

### `@computeOperator · oneOf[8].rowKind`

Schema位置：`#/definitions/computeOperator/oneOf/8/properties/rowKind`。目标：[#/definitions/rowKindMark](compute.md#schema-232f646566696e6974696f6e732f726f774b696e644d61726b)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rowKindMark | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 算子写入汇总行类别的声明。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f382f70726f706572746965732f6c6162656c"></a>

### `@computeOperator · oneOf[8].label`

Schema位置：`#/definitions/computeOperator/oneOf/8/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["field","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f382f70726f706572746965732f6c6162656c2f70726f706572746965732f6669656c64"></a>

### `@computeOperator · oneOf[8].label.field`

Schema位置：`#/definitions/computeOperator/oneOf/8/properties/label/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f382f70726f706572746965732f6c6162656c2f70726f706572746965732f76616c7565"></a>

### `@computeOperator · oneOf[8].label.value`

Schema位置：`#/definitions/computeOperator/oneOf/8/properties/label/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f39"></a>

### `@computeOperator · oneOf[9]`

Schema位置：`#/definitions/computeOperator/oneOf/9`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","categoryField","valueField","columns"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[9].op`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="pivot" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "pivot" | 用于选择@computeOperator · oneOf[9].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f63617465676f72794669656c64"></a>

### `@computeOperator · oneOf[9].categoryField`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/categoryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 类别维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f76616c75654669656c64"></a>

### `@computeOperator · oneOf[9].valueField`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/valueField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f636f6c756d6e73"></a>

### `@computeOperator · oneOf[9].columns`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/columns`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 列或透视输出列的有序声明，按所属分支解释。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f636f6c756d6e732f6974656d73"></a>

### `@computeOperator · oneOf[9].columns[]`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/columns/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["output","categories"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f636f6c756d6e732f6974656d732f70726f706572746965732f76616c75654669656c64"></a>

### `@computeOperator · oneOf[9].columns[].valueField`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/columns/items/properties/valueField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f636f6c756d6e732f6974656d732f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[9].columns[].output`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/columns/items/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f636f6c756d6e732f6974656d732f70726f706572746965732f63617465676f72696573"></a>

### `@computeOperator · oneOf[9].columns[].categories`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/columns/items/properties/categories`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 有序类别取值，取第一个命中的 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f636f6c756d6e732f6974656d732f70726f706572746965732f63617465676f726965732f6974656d73"></a>

### `@computeOperator · oneOf[9].columns[].categories[]`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/columns/items/properties/categories/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f6b65794669656c6473"></a>

### `@computeOperator · oneOf[9].keyFields`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/keyFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | pivot保留的分组键字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f392f70726f706572746965732f6b65794669656c64732f6974656d73"></a>

### `@computeOperator · oneOf[9].keyFields[]`

Schema位置：`#/definitions/computeOperator/oneOf/9/properties/keyFields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `compute-operator-inputs`：算子引用的字段已声明、角色相容、数值算子输入为数值类型。反例：[compute-undeclared-field](errors/compute-undeclared-field.json)、[compute-role-mismatch](errors/compute-role-mismatch.json)、[compute-non-numeric-input](errors/compute-non-numeric-input.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `compute-operator-outputs`：算子产出字段已声明、不重名、不来自外部响应。反例：[compute-duplicate-output](errors/compute-duplicate-output.json)、[compute-output-with-query-field](errors/compute-output-with-query-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `compute-folding-collapsible`：折叠算子只能作用于显式声明 collapsible 的度量字段。反例：[compute-fold-non-collapsible](errors/compute-fold-non-collapsible.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `compute-row-kind-field`：行类别字段必须是可空的 string 维度。反例：[compute-row-kind-not-string](errors/compute-row-kind-not-string.json)、[compute-row-kind-not-nullable](errors/compute-row-kind-not-nullable.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `compute-pivot-categories-unique`：透视类别取值只能映射到一个目标列。反例：[compute-pivot-duplicate-category](errors/compute-pivot-duplicate-category.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `compute-output-not-in-rows`：算子产出字段不得出现在数据行中。反例：[compute-output-in-inline-rows](errors/compute-output-in-inline-rows.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [compute-page](examples/compute-page.json)：完整合法页面；查询仅为静态契约证据。
- [cross-source-page](examples/cross-source-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-export-compute-branches](examples/reference-export-compute-branches.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/compute.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/computeOperator/oneOf/0`：[合法完整页面](examples/query-cascade-page.json)，JSON Pointer `#/dataSources/project-efficiency-bottom5/compute/0`。
- `#/definitions/computeOperator/oneOf/1`：[合法完整页面](examples/time-binding-branches-page.json)，JSON Pointer `#/dataSources/main/compute/0`。
- `#/definitions/computeOperator/oneOf/2`：[合法完整页面](examples/reference-export-compute-branches.json)，JSON Pointer `#/dataSources/calc/compute/1`。
- `#/definitions/computeOperator/oneOf/3`：[合法完整页面](examples/reference-export-compute-branches.json)，JSON Pointer `#/dataSources/fill-0/compute/0`。
- `#/definitions/computeOperator/oneOf/3/properties/range/anyOf/0`：[合法完整页面](examples/reference-export-compute-branches.json)，JSON Pointer `#/dataSources/fill-0/compute/0/range`。
- `#/definitions/computeOperator/oneOf/3/properties/range/anyOf/1`：[合法完整页面](examples/reference-export-compute-branches.json)，JSON Pointer `#/dataSources/fill-1/compute/0/range`。
- `#/definitions/computeOperator/oneOf/3/properties/range/anyOf/2`：[合法完整页面](examples/reference-export-compute-branches.json)，JSON Pointer `#/dataSources/fill-2/compute/0/range`。
- `#/definitions/computeOperator/oneOf/4`：[合法完整页面](examples/reference-export-compute-branches.json)，JSON Pointer `#/dataSources/calc/compute/2`。
- `#/definitions/computeOperator/oneOf/5`：[合法完整页面](examples/query-numeric-tolerance.json)，JSON Pointer `#/dataSources/samples/compute/0`。
- `#/definitions/computeOperator/oneOf/6`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/targets/compute/1`。
- `#/definitions/computeOperator/oneOf/7`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/targets/compute/2`。
- `#/definitions/computeOperator/oneOf/8`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/targets/compute/3`。
- `#/definitions/computeOperator/oneOf/9`：[合法完整页面](examples/query-cascade-page.json)，JSON Pointer `#/dataSources/project-efficiency-bottom5-stages/compute/0`。
