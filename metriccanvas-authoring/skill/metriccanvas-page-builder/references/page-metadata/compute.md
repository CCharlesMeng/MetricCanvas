# 具名算子

compute按声明顺序处理归一化行集。ratio逐行相除，零/缺分母按null或zero处理，缺分子取空；scale缺省原比率，100将其变成百分刻度。delta做减法，任一输入空则空。

groupSubtotal在每组明细后插小计；grandTotal只累计明细、不重复累计小计；两者只使用collapsible:true度量。rowKind字段是可空string维度，subtotal/total标记汇总行。pivot按有序类别列表匹配首个类别，把行转列。

所有产出字段必须就地声明，不能伪装成原始输入或queryField。这是封闭算子系统，显示格式、任意公式及通用脚本均不是算子。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.3。结构真源为本册[schema.json](schema.json)，SHA256 `716d55d27e8ac6026ed8c3f2174eb0b98c80dc9f52a582aa377354e098615c96`。字段表自动生成；可选不等于有默认值。

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
| "object" | 独立分支（不合并required） | required=["op","numerator","denominator","output","onZeroDenominator"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[0].op`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="ratio" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "ratio" | 用于选择@computeOperator · oneOf[0].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6e756d657261746f72"></a>

### `@computeOperator · oneOf[0].numerator`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/numerator`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | ratio分子数值字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f64656e6f6d696e61746f72"></a>

### `@computeOperator · oneOf[0].denominator`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/denominator`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | ratio分母数值字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[0].output`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f6f6e5a65726f44656e6f6d696e61746f72"></a>

### `@computeOperator · oneOf[0].onZeroDenominator`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/onZeroDenominator`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["null","zero"] | Schema未设默认；装配/运行时默认见语义说明 | 分母为零或缺失时取空还是取零；必须显式声明，默认值会静默改数 |

| 允许值 | 解释与适用条件 |
|---|---|
| "null" | 零/缺分母时输出空值。 |
| "zero" | 零/缺分母时输出0。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f302f70726f706572746965732f7363616c65"></a>

### `@computeOperator · oneOf[0].scale`

Schema位置：`#/definitions/computeOperator/oneOf/0/properties/scale`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | const=100 | Schema未设默认；装配/运行时默认见语义说明 | 输出刻度；缺省产出 0–1 分数，100 产出 0–100。闭集只有 100，开放数值等于在算子里引入乘法表达式 |

| 允许值 | 解释与适用条件 |
|---|---|
| 100 | ratio输出乘100，匹配百分比原值展示。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f31"></a>

### `@computeOperator · oneOf[1]`

Schema位置：`#/definitions/computeOperator/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","minuend","subtrahend","output"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[1].op`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="delta" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "delta" | 用于选择@computeOperator · oneOf[1].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f6d696e75656e64"></a>

### `@computeOperator · oneOf[1].minuend`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/minuend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | delta被减数数值字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f73756274726168656e64"></a>

### `@computeOperator · oneOf[1].subtrahend`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/subtrahend`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | delta减数数值字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f312f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[1].output`

Schema位置：`#/definitions/computeOperator/oneOf/1/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f32"></a>

### `@computeOperator · oneOf[2]`

Schema位置：`#/definitions/computeOperator/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","groupBy","measures","rowKind"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[2].op`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="groupSubtotal" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "groupSubtotal" | 用于选择@computeOperator · oneOf[2].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f67726f75704279"></a>

### `@computeOperator · oneOf[2].groupBy`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/groupBy`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 折叠分组的维度字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f6d65617375726573"></a>

### `@computeOperator · oneOf[2].measures`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/measures`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 度量字段集合或分组。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f6d656173757265732f6974656d73"></a>

### `@computeOperator · oneOf[2].measures[]`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/measures/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f726f774b696e64"></a>

### `@computeOperator · oneOf[2].rowKind`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/rowKind`。目标：[#/definitions/rowKindMark](compute.md#schema-232f646566696e6974696f6e732f726f774b696e644d61726b)。

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

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f322f70726f706572746965732f6c6162656c537566666978"></a>

### `@computeOperator · oneOf[2].labelSuffix`

Schema位置：`#/definitions/computeOperator/oneOf/2/properties/labelSuffix`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 分组小计标签后缀。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f33"></a>

### `@computeOperator · oneOf[3]`

Schema位置：`#/definitions/computeOperator/oneOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","measures","rowKind","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[3].op`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="grandTotal" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "grandTotal" | 用于选择@computeOperator · oneOf[3].op分支；同分支其它约束同时成立。 |

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

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f726f774b696e64"></a>

### `@computeOperator · oneOf[3].rowKind`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/rowKind`。目标：[#/definitions/rowKindMark](compute.md#schema-232f646566696e6974696f6e732f726f774b696e644d61726b)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rowKindMark | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 算子写入汇总行类别的声明。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f6c6162656c"></a>

### `@computeOperator · oneOf[3].label`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["field","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f6c6162656c2f70726f706572746965732f6669656c64"></a>

### `@computeOperator · oneOf[3].label.field`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/label/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f332f70726f706572746965732f6c6162656c2f70726f706572746965732f76616c7565"></a>

### `@computeOperator · oneOf[3].label.value`

Schema位置：`#/definitions/computeOperator/oneOf/3/properties/label/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f34"></a>

### `@computeOperator · oneOf[4]`

Schema位置：`#/definitions/computeOperator/oneOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["op","categoryField","valueField","columns"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f6f70"></a>

### `@computeOperator · oneOf[4].op`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="pivot" | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "pivot" | 用于选择@computeOperator · oneOf[4].op分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f63617465676f72794669656c64"></a>

### `@computeOperator · oneOf[4].categoryField`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/categoryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 类别维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f76616c75654669656c64"></a>

### `@computeOperator · oneOf[4].valueField`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/valueField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f636f6c756d6e73"></a>

### `@computeOperator · oneOf[4].columns`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/columns`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 列或透视输出列的有序声明，按所属分支解释。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f636f6c756d6e732f6974656d73"></a>

### `@computeOperator · oneOf[4].columns[]`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/columns/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["output","categories"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f636f6c756d6e732f6974656d732f70726f706572746965732f6f7574707574"></a>

### `@computeOperator · oneOf[4].columns[].output`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/columns/items/properties/output`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 算子写入的已声明页面字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f636f6c756d6e732f6974656d732f70726f706572746965732f63617465676f72696573"></a>

### `@computeOperator · oneOf[4].columns[].categories`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/columns/items/properties/categories`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 有序类别取值，取第一个命中的 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f636f6c756d6e732f6974656d732f70726f706572746965732f63617465676f726965732f6974656d73"></a>

### `@computeOperator · oneOf[4].columns[].categories[]`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/columns/items/properties/categories/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f6b65794669656c6473"></a>

### `@computeOperator · oneOf[4].keyFields`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/keyFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | pivot保留的分组键字段。 |

<a id="schema-232f646566696e6974696f6e732f636f6d707574654f70657261746f722f6f6e654f662f342f70726f706572746965732f6b65794669656c64732f6974656d73"></a>

### `@computeOperator · oneOf[4].keyFields[]`

Schema位置：`#/definitions/computeOperator/oneOf/4/properties/keyFields/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `compute-operator-inputs`：算子引用的字段已声明、角色相容、数值算子输入为数值类型。反例：[compute-undeclared-field](errors/compute-undeclared-field.json)、[compute-role-mismatch](errors/compute-role-mismatch.json)、[compute-non-numeric-input](errors/compute-non-numeric-input.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-operator-outputs`：算子产出字段已声明、不重名、不来自外部响应。反例：[compute-duplicate-output](errors/compute-duplicate-output.json)、[compute-output-with-query-field](errors/compute-output-with-query-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-folding-collapsible`：折叠算子只能作用于显式声明 collapsible 的度量字段。反例：[compute-fold-non-collapsible](errors/compute-fold-non-collapsible.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-row-kind-field`：行类别字段必须是可空的 string 维度。反例：[compute-row-kind-not-string](errors/compute-row-kind-not-string.json)、[compute-row-kind-not-nullable](errors/compute-row-kind-not-nullable.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-pivot-categories-unique`：透视类别取值只能映射到一个目标列。反例：[compute-pivot-duplicate-category](errors/compute-pivot-duplicate-category.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-output-not-in-rows`：算子产出字段不得出现在数据行中。反例：[compute-output-in-inline-rows](errors/compute-output-in-inline-rows.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [compute-page](examples/compute-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/compute.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/computeOperator/oneOf/0`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/targets/compute/0`。
- `#/definitions/computeOperator/oneOf/1`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/targets/compute/1`。
- `#/definitions/computeOperator/oneOf/2`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/targets/compute/2`。
- `#/definitions/computeOperator/oneOf/3`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/targets/compute/3`。
- `#/definitions/computeOperator/oneOf/4`：[合法完整页面](examples/compute-page.json)，JSON Pointer `#/dataSources/pivoted/compute/0`。
