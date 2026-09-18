# 页面数据源与初始行

页面数据源使用inline静态行或query受控查询。源id来自dataSources对象键，组件data槽引用它。每个数据源声明结果字段契约；数据快照ready/empty/error是运行态，不回写文档。

query.initial保存捕获时间和匹配该查询的初始行，只能在当前条件与声明初值匹配时使用；变更后由网关查询。执行bootstrap初始结果另走执行端口，条件标识与查询定义一致才复用，不与旧initial混用。查询分页需有效totalCount，失败源沿现有错误分类隔离。

可选compute作用于已归一化行集。inline行使用页面字段id；query结果经queryField映射。静态JSON通过校验不证明真实DQE成功。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.5。结构真源为本册[schema.json](schema.json)，SHA256 `6ef401964cd74ad2805a8257e75f43ae5cb6b20f3f3479bb2ad49b481ed3ba60`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f64617461536f75726365"></a>

### `@dataSource`

Schema位置：`#/definitions/dataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64617461536f757263652f616e794f662f30"></a>

### `@dataSource · anyOf[0]`

Schema位置：`#/definitions/dataSource/anyOf/0`。目标：[#/definitions/inlineDataSource](data-sources.md#schema-232f646566696e6974696f6e732f696e6c696e6544617461536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/inlineDataSource | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f75726365"></a>

### `@inlineDataSource`

Schema位置：`#/definitions/inlineDataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["fields","source"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f757263652f70726f706572746965732f6669656c6473"></a>

### `@inlineDataSource.fields`

Schema位置：`#/definitions/inlineDataSource/properties/fields`。目标：[#/definitions/fields](fields.md#schema-232f646566696e6974696f6e732f6669656c6473)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fields | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f757263652f70726f706572746965732f636f6d70757465"></a>

### `@inlineDataSource.compute`

Schema位置：`#/definitions/inlineDataSource/properties/compute`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按顺序执行的封闭具名算子。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f757263652f70726f706572746965732f636f6d707574652f616c6c4f662f30"></a>

### `@inlineDataSource.compute · allOf[0]`

Schema位置：`#/definitions/inlineDataSource/properties/compute/allOf/0`。目标：[#/definitions/compute](compute.md#schema-232f646566696e6974696f6e732f636f6d70757465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compute | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e6544617461536f757263652f70726f706572746965732f736f75726365"></a>

### `@inlineDataSource.source`

Schema位置：`#/definitions/inlineDataSource/properties/source`。目标：[#/definitions/inlineSource](data-sources.md#schema-232f646566696e6974696f6e732f696e6c696e65536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/inlineSource | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f75726365"></a>

### `@inlineSource`

Schema位置：`#/definitions/inlineSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","rows"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f74797065"></a>

### `@inlineSource.type`

Schema位置：`#/definitions/inlineSource/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="inline" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "inline" | 用于选择@inlineSource.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f726f7773"></a>

### `@inlineSource.rows`

Schema位置：`#/definitions/inlineSource/properties/rows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按结果字段契约命名和校验的数据行。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f726f77732f6974656d73"></a>

### `@inlineSource.rows[]`

Schema位置：`#/definitions/inlineSource/properties/rows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f726f77732f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@inlineSource.rows[]{key}`

Schema位置：`#/definitions/inlineSource/properties/rows/items/additionalProperties`。目标：[#/definitions/fieldValue](fields.md#schema-232f646566696e6974696f6e732f6669656c6456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldValue | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f696e6c696e65536f757263652f70726f706572746965732f726f77732f6974656d732f70726f70657274794e616d6573"></a>

### `@inlineSource.rows[] · propertyNames`

Schema位置：`#/definitions/inlineSource/properties/rows/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64617461536f757263652f616e794f662f31"></a>

### `@dataSource · anyOf[1]`

Schema位置：`#/definitions/dataSource/anyOf/1`。目标：[#/definitions/queryDataSource](data-sources.md#schema-232f646566696e6974696f6e732f717565727944617461536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryDataSource | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f75726365"></a>

### `@queryDataSource`

Schema位置：`#/definitions/queryDataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["fields","source"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f6669656c6473"></a>

### `@queryDataSource.fields`

Schema位置：`#/definitions/queryDataSource/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f6669656c64732f616e794f662f30"></a>

### `@queryDataSource.fields · anyOf[0]`

Schema位置：`#/definitions/queryDataSource/properties/fields/anyOf/0`。目标：[#/definitions/queryFields](fields.md#schema-232f646566696e6974696f6e732f71756572794669656c6473)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/queryFields | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f6669656c64732f616e794f662f31"></a>

### `@queryDataSource.fields · anyOf[1]`

Schema位置：`#/definitions/queryDataSource/properties/fields/anyOf/1`。目标：[#/definitions/groupedQueryFields](fields.md#schema-232f646566696e6974696f6e732f67726f7570656451756572794669656c6473)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/groupedQueryFields | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f636f6d70757465"></a>

### `@queryDataSource.compute`

Schema位置：`#/definitions/queryDataSource/properties/compute`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按顺序执行的封闭具名算子。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f636f6d707574652f616c6c4f662f30"></a>

### `@queryDataSource.compute · allOf[0]`

Schema位置：`#/definitions/queryDataSource/properties/compute/allOf/0`。目标：[#/definitions/compute](compute.md#schema-232f646566696e6974696f6e732f636f6d70757465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compute | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f717565727944617461536f757263652f70726f706572746965732f736f75726365"></a>

### `@queryDataSource.source`

Schema位置：`#/definitions/queryDataSource/properties/source`。目标：[#/definitions/querySource](data-sources.md#schema-232f646566696e6974696f6e732f7175657279536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/querySource | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f75726365"></a>

### `@querySource`

Schema位置：`#/definitions/querySource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["type","query"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f74797065"></a>

### `@querySource.type`

Schema位置：`#/definitions/querySource/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="query" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "query" | 用于选择@querySource.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f696e697469616c"></a>

### `@querySource.initial`

Schema位置：`#/definitions/querySource/properties/initial`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 与声明查询条件匹配的内嵌初始行。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f696e697469616c2f616c6c4f662f30"></a>

### `@querySource.initial · allOf[0]`

Schema位置：`#/definitions/querySource/properties/initial/allOf/0`。目标：[#/definitions/embeddedInitialRows](data-sources.md#schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f7773)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/embeddedInitialRows | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f7773"></a>

### `@embeddedInitialRows`

Schema位置：`#/definitions/embeddedInitialRows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["capturedAt","rows"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f63617074757265644174"></a>

### `@embeddedInitialRows.capturedAt`

Schema位置：`#/definitions/embeddedInitialRows/properties/capturedAt`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z&#124;[+-]\\d{2}:\\d{2})$" | Schema未设默认；装配/运行时默认见语义说明 | 内嵌行的有效RFC3339捕获时间。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f726f7773"></a>

### `@embeddedInitialRows.rows`

Schema位置：`#/definitions/embeddedInitialRows/properties/rows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按结果字段契约命名和校验的数据行。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f726f77732f6974656d73"></a>

### `@embeddedInitialRows.rows[]`

Schema位置：`#/definitions/embeddedInitialRows/properties/rows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f726f77732f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@embeddedInitialRows.rows[]{key}`

Schema位置：`#/definitions/embeddedInitialRows/properties/rows/items/additionalProperties`。目标：[#/definitions/fieldValue](fields.md#schema-232f646566696e6974696f6e732f6669656c6456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldValue | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f726f77732f6974656d732f70726f70657274794e616d6573"></a>

### `@embeddedInitialRows.rows[] · propertyNames`

Schema位置：`#/definitions/embeddedInitialRows/properties/rows/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f656d626564646564496e697469616c526f77732f70726f706572746965732f746f74616c436f756e74"></a>

### `@embeddedInitialRows.totalCount`

Schema位置：`#/definitions/embeddedInitialRows/properties/totalCount`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=0; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 查询总条数；不能用当前页rows.length冒充。 |

<a id="schema-232f646566696e6974696f6e732f7175657279536f757263652f70726f706572746965732f7175657279"></a>

### `@querySource.query`

Schema位置：`#/definitions/querySource/properties/query`。目标：[#/definitions/pageQuery](queries-and-bindings.md#schema-232f646566696e6974696f6e732f706167655175657279)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageQuery | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

## 语义规则与反例（生成）

- `query-initial-rows-normalize`：DQE 内嵌初始行按 queryField 归一化并满足结果字段契约。反例：[initial-row-missing-query-field](errors/initial-row-missing-query-field.json)、[initial-row-null-not-allowed](errors/initial-row-null-not-allowed.json)、[initial-row-type-mismatch](errors/initial-row-type-mismatch.json)、[initial-row-date-invalid](errors/initial-row-date-invalid.json)、[initial-row-semantic-html-too-large](errors/initial-row-semantic-html-too-large.json)、[initial-row-detail-missing-query-field](errors/initial-row-detail-missing-query-field.json)、[initial-row-detail-null-not-allowed](errors/initial-row-detail-null-not-allowed.json)、[initial-row-detail-type-mismatch](errors/initial-row-detail-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `inline-rows-contract`：inline 数据行满足结果字段契约（字段集合、类型、nullable、明细约束）。反例：[inline-row-undeclared-field](errors/inline-row-undeclared-field.json)、[inline-row-missing-field](errors/inline-row-missing-field.json)、[inline-row-null-not-allowed](errors/inline-row-null-not-allowed.json)、[inline-row-type-mismatch](errors/inline-row-type-mismatch.json)、[inline-row-date-invalid](errors/inline-row-date-invalid.json)、[inline-row-datetime-invalid](errors/inline-row-datetime-invalid.json)、[inline-row-semantic-html-type](errors/inline-row-semantic-html-type.json)、[inline-row-detail-undeclared-field](errors/inline-row-detail-undeclared-field.json)、[inline-row-detail-missing-field](errors/inline-row-detail-missing-field.json)、[inline-row-detail-null-not-allowed](errors/inline-row-detail-null-not-allowed.json)、[inline-row-detail-type-mismatch](errors/inline-row-detail-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `captured-at-valid`：内嵌初始行的 capturedAt 须为有效的 RFC 3339 日期时间。反例：[captured-at-invalid-month](errors/captured-at-invalid-month.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `pagination-initial-rows`：查询分页的内嵌初始行必须声明 totalCount 且是完整第一页。反例：[pagination-initial-without-total-count](errors/pagination-initial-without-total-count.json)、[pagination-initial-not-full-page](errors/pagination-initial-not-full-page.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [query-dashboard](examples/query-dashboard.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/data-source.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/dataSource/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/fixed-target`。
- `#/definitions/dataSource/anyOf/1`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/monthly`。
- `#/definitions/queryDataSource/properties/fields/anyOf/0`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/monthly/fields`。
- `#/definitions/queryDataSource/properties/fields/anyOf/1`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields`。
