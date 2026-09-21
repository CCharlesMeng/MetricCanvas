# 查询定义与显式绑定

当前受控查询语言为DQE。查询体遵循真实协议分支，模型不得拼任意SQL或表达式。filterBindings对象键引用页面筛选器；dimension目标必须声明queryField，time目标只绑定时间范围。页面字段id、筛选器dimension和DQE字段属于不同空间。

未绑定到某源的筛选变化不触发该源；绑定字段须存在于合法查询位置。paramBindings用于6.2维度初始化，目标唯一、共享源显式声明，不与同目标静态条件或多个参数竞争。页面只声明目标，不声明服务权限。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.11。结构真源为本册[schema.json](schema.json)，SHA256 `064fc35affc3504cd66b5e0b8134b11b2a41da36985b28804f00db025207d6fa`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f706167655175657279"></a>

### `@pageQuery`

Schema位置：`#/definitions/pageQuery`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7061676551756572792f6f6e654f662f30"></a>

### `@pageQuery · oneOf[0]`

Schema位置：`#/definitions/pageQuery/oneOf/0`。目标：[#/definitions/dqeQuery](queries-and-bindings.md#schema-232f646566696e6974696f6e732f6471655175657279)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/dqeQuery | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6471655175657279"></a>

### `@dqeQuery`

Schema位置：`#/definitions/dqeQuery`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["language","body"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f6c616e6775616765"></a>

### `@dqeQuery.language`

Schema位置：`#/definitions/dqeQuery/properties/language`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dqe" | Schema未设默认；装配/运行时默认见语义说明 | 受控查询语言判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dqe" | 用于选择@dqeQuery.language分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f6479"></a>

### `@dqeQuery.body`

Schema位置：`#/definitions/dqeQuery/properties/body`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["dsl_list"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 静态正文或页面参数文本取值；bodyFormat决定是否走受控语义HTML。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c697374"></a>

### `@dqeQuery.body.dsl_list`

Schema位置：`#/definitions/dqeQuery/properties/body/properties/dsl_list`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE协议中的查询DSL列表。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d73"></a>

### `@dqeQuery.body.dsl_list[]`

Schema位置：`#/definitions/dqeQuery/properties/body/properties/dsl_list/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | propertyNames={"type":"string"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.body.dsl_list[]{key}`

Schema位置：`#/definitions/dqeQuery/properties/body/properties/dsl_list/items/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f626f64792f70726f706572746965732f64736c5f6c6973742f6974656d732f70726f70657274794e616d6573"></a>

### `@dqeQuery.body.dsl_list[] · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/body/properties/dsl_list/items/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e6773"></a>

### `@dqeQuery.paramBindings`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 参数id到查询维度目标的显式绑定。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.paramBindings{key}`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@dqeQuery.paramBindings{key} · oneOf[0]`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f746172676574"></a>

### `@dqeQuery.paramBindings{key} · oneOf[0].target`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/0/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.paramBindings{key} · oneOf[0].queryField`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/0/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@dqeQuery.paramBindings{key} · oneOf[1]`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","window"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f746172676574"></a>

### `@dqeQuery.paramBindings{key} · oneOf[1].target`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/1/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="time" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "time" | 用于选择@dqeQuery.paramBindings{key} · oneOf[1].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f77696e646f77"></a>

### `@dqeQuery.paramBindings{key} · oneOf[1].window`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/1/properties/window`。目标：[#/definitions/timeWindow](params-and-text-values.md#schema-232f646566696e6974696f6e732f74696d6557696e646f77)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/timeWindow | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 确定性查询时间窗口：由绑定参数推导起止，起止包含；不决定指标口径。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f706172616d42696e64696e67732f70726f70657274794e616d6573"></a>

### `@dqeQuery.paramBindings · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/paramBindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e6773"></a>

### `@dqeQuery.filterBindings`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 筛选器id到当前查询目标的显式绑定。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.filterBindings{key}`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@dqeQuery.filterBindings{key} · anyOf[0]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[0].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/0/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.filterBindings{key} · anyOf[0].queryField`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/0/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","levelQueryFields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c6473"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1].levelQueryFields`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=2 | Schema未设默认；装配/运行时默认见语义说明 | 层级维度筛选器逐级声明的谓词字段：键是层级id，值是该层的DQE字段；必须逐级写全。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c64732f6164646974696f6e616c50726f70657274696573"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1].levelQueryFields{key}`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f6c6576656c51756572794669656c64732f70726f70657274794e616d6573"></a>

### `@dqeQuery.filterBindings{key} · anyOf[1].levelQueryFields · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1/properties/levelQueryFields/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f32"></a>

### `@dqeQuery.filterBindings{key} · anyOf[2]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f322f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[2].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/2/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="time" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "time" | 用于选择@dqeQuery.filterBindings{key} · anyOf[2].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f33"></a>

### `@dqeQuery.filterBindings{key} · anyOf[3]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[3].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timePoint" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timePoint" | 用于选择@dqeQuery.filterBindings{key} · anyOf[3].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.filterBindings{key} · anyOf[3].queryField`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f332f70726f706572746965732f76616c7565466f726d6174"></a>

### `@dqeQuery.filterBindings{key} · anyOf[3].valueFormat`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3/properties/valueFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["iso","compact"] | Schema未设默认；装配/运行时默认见语义说明 | 时间点取值送进谓词的写法：iso原样YYYY-MM，compact去掉分隔符。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "iso" | 时间点原样送 YYYY-MM / YYYY-MM-DD。 |
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f34"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","queryField","whenTrue"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="boolean" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "boolean" | 布尔值；false是显式取值。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f71756572794669656c64"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].queryField`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/queryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | DQE输出或目标字段名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e54727565"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].whenTrue`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/whenTrue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 布尔筛选器勾选时下推的取值；不勾选默认无条件。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e547275652f6974656d73"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].whenTrue[]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/whenTrue/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e46616c7365"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].whenFalse`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/whenFalse`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 布尔筛选器显式为假时下推的取值；缺席即不勾选不加条件。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f342f70726f706572746965732f7768656e46616c73652f6974656d73"></a>

### `@dqeQuery.filterBindings{key} · anyOf[4].whenFalse[]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4/properties/whenFalse/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f35"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5]`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["target","metric"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f746172676574"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].target`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="numberRange" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "numberRange" | 用于选择@dqeQuery.filterBindings{key} · anyOf[5].target分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f6164646974696f6e616c50726f706572746965732f616e794f662f352f70726f706572746965732f6d6574726963"></a>

### `@dqeQuery.filterBindings{key} · anyOf[5].metric`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5/properties/metric`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 数值区间谓词作用的DQE指标名，不等于页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f64716551756572792f70726f706572746965732f66696c74657242696e64696e67732f70726f70657274794e616d6573"></a>

### `@dqeQuery.filterBindings · propertyNames`

Schema位置：`#/definitions/dqeQuery/properties/filterBindings/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `query-field-mapping`：query 数据源字段与 DQE 输出字段之间的显式、唯一、角色相容映射。反例：[query-field-without-mapping](errors/query-field-without-mapping.json)、[query-field-duplicate-mapping](errors/query-field-duplicate-mapping.json)、[query-field-not-output](errors/query-field-not-output.json)、[query-detail-item-duplicate-mapping](errors/query-detail-item-duplicate-mapping.json)、[query-dimension-role-mismatch](errors/query-dimension-role-mismatch.json)、[query-role-mismatch](errors/query-role-mismatch.json)、[query-output-unmapped](errors/query-output-unmapped.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `filter-binding`：筛选绑定引用已声明筛选器，time / dimension 目标类型匹配，层级绑定逐级声明谓词字段。反例：[level-query-fields-on-flat-filter](errors/level-query-fields-on-flat-filter.json)、[level-query-fields-missing-level](errors/level-query-fields-missing-level.json)、[level-query-fields-undeclared-level](errors/level-query-fields-undeclared-level.json)、[hierarchy-filter-flat-query-field](errors/hierarchy-filter-flat-query-field.json)、[time-point-target-not-time-point](errors/time-point-target-not-time-point.json)、[boolean-target-not-boolean](errors/boolean-target-not-boolean.json)、[number-range-target-not-number-range](errors/number-range-target-not-number-range.json)、[time-point-initial-param-not-times](errors/time-point-initial-param-not-times.json)、[time-point-initial-param-precision](errors/time-point-initial-param-precision.json)、[time-point-initial-param-range](errors/time-point-initial-param-range.json)、[time-point-initial-param-and-default](errors/time-point-initial-param-and-default.json)、[time-point-initial-param-without-query-target](errors/time-point-initial-param-without-query-target.json)、[unknown-filter-binding](errors/unknown-filter-binding.json)、[filter-binding-time-target-not-time-range](errors/filter-binding-time-target-not-time-range.json)、[filter-binding-dimension-target-not-dimension](errors/filter-binding-dimension-target-not-dimension.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [dimension-params-page](examples/dimension-params-page.json)：完整合法页面；查询仅为静态契约证据。
- [hierarchy-binding-page](examples/hierarchy-binding-page.json)：完整合法页面；查询仅为静态契约证据。
- [non-dimension-bindings-page](examples/non-dimension-bindings-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/query.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/pageQuery/oneOf/0`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/monthly/source/query`。
- `#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/dataSources/sales/source/query/paramBindings/regions`。
- `#/definitions/dqeQuery/properties/paramBindings/additionalProperties/oneOf/1`：[合法完整页面](examples/time-params-page.json)，JSON Pointer `#/dataSources/current/source/query/paramBindings/report-month`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/dataSources/sales/source/query/filterBindings/region-filter`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/1`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/dataSources/regions/source/query/filterBindings/area`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/2`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/dataSources/orders/source/query/filterBindings/period`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/3`：[合法完整页面](examples/non-dimension-bindings-page.json)，JSON Pointer `#/dataSources/sales/source/query/filterBindings/month`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/4`：[合法完整页面](examples/non-dimension-bindings-page.json)，JSON Pointer `#/dataSources/sales/source/query/filterBindings/only-key`。
- `#/definitions/dqeQuery/properties/filterBindings/additionalProperties/anyOf/5`：[合法完整页面](examples/non-dimension-bindings-page.json)，JSON Pointer `#/dataSources/sales/source/query/filterBindings/amount-range`。
