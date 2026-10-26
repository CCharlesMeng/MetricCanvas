# 条件显隐与动作资格

6.35起，使用visibleWhen控制节点展示，使用enabledWhen控制动作执行；条件写在其控制的节点，未声明时沿用原行为。分区、组件、筛选器、分区组、Tab和正文片段使用同一条件。父级隐藏覆盖后代，子项全隐藏不反推父级；6.62 的表格列组作为表头结构节点，无可见叶子时不生成空表头，详见[列显隐](components/table.md#table-column-visibility)。标题、容器和原布局占位保留。需要整块隐藏时把条件写在父级。

```json
{"visibleWhen":{"filter":"organization","part":"level","op":"ne","value":"department"}}
```

上述ID必须已声明。filter可读取level、values、value、from、to，合法part由筛选器类型决定。permission读取集成应用已有布尔结果，fact读取有限具名事实，row只在合法行上下文读取字段。条件组合为all/any/not，最多4层64叶子；比较严格区分类型，不执行脚本和动态属性路径。缺少外部输入、类型错误和等待不会被not变成允许，错误与等待内容不展示；其他独立内容正常呈现。

维度多选用containsAny/containsAll和values，标量用eq/ne、in/notIn与value/values，数值支持gt/gte/lt/lte。isNull/isNotNull判断标量空值，isEmpty/isNotEmpty判断字符串或集合。维度无选择是已知空集合；层级无选择仍保留当前level，URL可以仅携带层级。

分区组和Tab的条件同时限制入口与内容。当前选择失效时回退到可用默认项或第一项；无可用项时不选中任何项，但不收起父容器。URL初选只在初始化读取。数据加载、空结果和查询错误不改变节点的条件资格。

表格props.rowVisibleWhen只投影本表完整本地结果，先于搜索、表头筛选、排序和本地分页；不修改共享源或合计口径。远程query/pagedJoin窗口必须改用filterBindings重查；不能删掉本页行后沿用源总数。含条件行交互时使用稳定rowKey。

button组件使用props.label和单个props.action，顶层可声明visibleWhen/enabledWhen。writeFilter支持互斥的field或value分支，目标必须是有查询绑定或显隐消费方的维度筛选器。独立按钮没有当前行，不能引用row或行字段动作。

text的props.parts可声明{id,text,visibleWhen?}，与body/bodyFormat互斥，纯文本按顺序连接，标点属于片段本身。它与现有Text Value的{parts:[字符串或引用]}位于不同层，原有标题组合保持原义。

集成应用可提供displayInputs的getSnapshot/subscribe，携带permissionRevision、permissions、values及依赖筛选的filterRevision。筛选条件页无需外部输入。权限会话变化立即停用旧内容、详情及导出，集成应用用当前身份重新初始化；页面无法改写已有权限。

PDF/PNG导出捕获当前条件和筛选，展开所有允许的分区/Tab，不受当前选项限制；条件禁止的内容不导出，允许的空父容器保留。XLSX使用同一表格行投影。普通筛选变化不修改已捕获导出，权限修订变化取消下载；隐藏不会自动停止查询。

验收入口：[层级联动](examples/page-visibility-region-linkage.json)、[外部事实Sim](examples/page-visibility-inputs.json)。示例使用明确的本地演示输入；内联数据与Sim事实不能替代真实CloudIOC/DQE联调。


页面协议 6.63。结构真源为本册[schema.json](schema.json)，SHA256 `28ea3f3ecadfc9f159412a62ca43463c70033c67206aeade47f4291c11ed4114`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e"></a>

### `@condition`

Schema位置：`#/definitions/condition`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f30"></a>

### `@condition · anyOf[0]`

Schema位置：`#/definitions/condition/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["all"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f302f70726f706572746965732f616c6c"></a>

### `@condition · anyOf[0].all`

Schema位置：`#/definitions/condition/anyOf/0/properties/all`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=64 | Schema未设默认；装配/运行时默认见语义说明 | 非空条件集合，所有条件满足；最多4层组合、64个叶子。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f302f70726f706572746965732f616c6c2f6974656d73"></a>

### `@condition · anyOf[0].all[]`

Schema位置：`#/definitions/condition/anyOf/0/properties/all/items`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31"></a>

### `@condition · anyOf[1]`

Schema位置：`#/definitions/condition/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["any"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f312f70726f706572746965732f616e79"></a>

### `@condition · anyOf[1].any`

Schema位置：`#/definitions/condition/anyOf/1/properties/any`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=64 | Schema未设默认；装配/运行时默认见语义说明 | 非空条件集合，任意条件满足；最多4层组合、64个叶子。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f312f70726f706572746965732f616e792f6974656d73"></a>

### `@condition · anyOf[1].any[]`

Schema位置：`#/definitions/condition/anyOf/1/properties/any/items`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f32"></a>

### `@condition · anyOf[2]`

Schema位置：`#/definitions/condition/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["not"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f322f70726f706572746965732f6e6f74"></a>

### `@condition · anyOf[2].not`

Schema位置：`#/definitions/condition/anyOf/2/properties/not`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 对已就绪且合法的子条件取反，未知输入不会变成允许。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f33"></a>

### `@condition · anyOf[3]`

Schema位置：`#/definitions/condition/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["permission"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f332f70726f706572746965732f7065726d697373696f6e"></a>

### `@condition · anyOf[3].permission`

Schema位置：`#/definitions/condition/anyOf/3/properties/permission`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 集成应用已有布尔权限结果的稳定键。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f34"></a>

### `@condition · anyOf[4]`

Schema位置：`#/definitions/condition/anyOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["filter","part","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f342f70726f706572746965732f66696c746572"></a>

### `@condition · anyOf[4].filter`

Schema位置：`#/definitions/condition/anyOf/4/properties/filter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 页面已声明筛选器ID；part决定读取值或层级。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f342f70726f706572746965732f70617274"></a>

### `@condition · anyOf[4].part`

Schema位置：`#/definitions/condition/anyOf/4/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["level","values","value","from","to"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "level" | 层级维度的层级部分。 |
| "values" | 维度多选值集合。 |
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f342f70726f706572746965732f6f70"></a>

### `@condition · anyOf[4].op`

Schema位置：`#/definitions/condition/anyOf/4/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["eq","ne"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "eq" | 原始标量严格等值；null不匹配。 |
| "ne" | 原始标量严格不等值；null不匹配。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f342f70726f706572746965732f76616c7565"></a>

### `@condition · anyOf[4].value`

Schema位置：`#/definitions/condition/anyOf/4/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f342f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@condition · anyOf[4].value · anyOf[0]`

Schema位置：`#/definitions/condition/anyOf/4/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f342f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@condition · anyOf[4].value · anyOf[1]`

Schema位置：`#/definitions/condition/anyOf/4/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f342f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@condition · anyOf[4].value · anyOf[2]`

Schema位置：`#/definitions/condition/anyOf/4/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f35"></a>

### `@condition · anyOf[5]`

Schema位置：`#/definitions/condition/anyOf/5`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["filter","part","op","values"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f352f70726f706572746965732f66696c746572"></a>

### `@condition · anyOf[5].filter`

Schema位置：`#/definitions/condition/anyOf/5/properties/filter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 页面已声明筛选器ID；part决定读取值或层级。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f352f70726f706572746965732f70617274"></a>

### `@condition · anyOf[5].part`

Schema位置：`#/definitions/condition/anyOf/5/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["level","values","value","from","to"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "level" | 层级维度的层级部分。 |
| "values" | 维度多选值集合。 |
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f352f70726f706572746965732f6f70"></a>

### `@condition · anyOf[5].op`

Schema位置：`#/definitions/condition/anyOf/5/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["in","notIn","containsAny","containsAll"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "in" | 原始值严格属于字面量集合；null不匹配。 |
| "notIn" | 原始值严格不属于字面量集合；null不匹配。 |
| "containsAny" | 来源集合至少包含一个给定值。 |
| "containsAll" | 来源集合包含全部给定值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f352f70726f706572746965732f76616c756573"></a>

### `@condition · anyOf[5].values`

Schema位置：`#/definitions/condition/anyOf/5/properties/values`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=1000 | Schema未设默认；装配/运行时默认见语义说明 | 集合比较的同类型字面量，不能与单值value混用。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f352f70726f706572746965732f76616c7565732f6974656d73"></a>

### `@condition · anyOf[5].values[]`

Schema位置：`#/definitions/condition/anyOf/5/properties/values/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f352f70726f706572746965732f76616c7565732f6974656d732f616e794f662f30"></a>

### `@condition · anyOf[5].values[] · anyOf[0]`

Schema位置：`#/definitions/condition/anyOf/5/properties/values/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f352f70726f706572746965732f76616c7565732f6974656d732f616e794f662f31"></a>

### `@condition · anyOf[5].values[] · anyOf[1]`

Schema位置：`#/definitions/condition/anyOf/5/properties/values/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f352f70726f706572746965732f76616c7565732f6974656d732f616e794f662f32"></a>

### `@condition · anyOf[5].values[] · anyOf[2]`

Schema位置：`#/definitions/condition/anyOf/5/properties/values/items/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f36"></a>

### `@condition · anyOf[6]`

Schema位置：`#/definitions/condition/anyOf/6`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["filter","part","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f362f70726f706572746965732f66696c746572"></a>

### `@condition · anyOf[6].filter`

Schema位置：`#/definitions/condition/anyOf/6/properties/filter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 页面已声明筛选器ID；part决定读取值或层级。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f362f70726f706572746965732f70617274"></a>

### `@condition · anyOf[6].part`

Schema位置：`#/definitions/condition/anyOf/6/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["level","values","value","from","to"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "level" | 层级维度的层级部分。 |
| "values" | 维度多选值集合。 |
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f362f70726f706572746965732f6f70"></a>

### `@condition · anyOf[6].op`

Schema位置：`#/definitions/condition/anyOf/6/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["gt","gte","lt","lte"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "gt" | 原始number/money值大于阈值，按原始单位。 |
| "gte" | 原始number/money值大于等于阈值，按原始单位。 |
| "lt" | 原始number/money值小于阈值，按原始单位。 |
| "lte" | 原始number/money值小于等于阈值，按原始单位。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f362f70726f706572746965732f76616c7565"></a>

### `@condition · anyOf[6].value`

Schema位置：`#/definitions/condition/anyOf/6/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f37"></a>

### `@condition · anyOf[7]`

Schema位置：`#/definitions/condition/anyOf/7`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["filter","part","op"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f372f70726f706572746965732f66696c746572"></a>

### `@condition · anyOf[7].filter`

Schema位置：`#/definitions/condition/anyOf/7/properties/filter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 页面已声明筛选器ID；part决定读取值或层级。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f372f70726f706572746965732f70617274"></a>

### `@condition · anyOf[7].part`

Schema位置：`#/definitions/condition/anyOf/7/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["level","values","value","from","to"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "level" | 层级维度的层级部分。 |
| "values" | 维度多选值集合。 |
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f372f70726f706572746965732f6f70"></a>

### `@condition · anyOf[7].op`

Schema位置：`#/definitions/condition/anyOf/7/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["isNull","isNotNull","isEmpty","isNotEmpty"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "isNull" | 只匹配合法null值；缺字段仍是契约错误。 |
| "isNotNull" | 只匹配合法非null值；缺字段仍是契约错误。 |
| "isEmpty" | 字符串或集合为空；未知输入不同于空值。 |
| "isNotEmpty" | 字符串或集合非空。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f38"></a>

### `@condition · anyOf[8]`

Schema位置：`#/definitions/condition/anyOf/8`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["fact","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f382f70726f706572746965732f66616374"></a>

### `@condition · anyOf[8].fact`

Schema位置：`#/definitions/condition/anyOf/8/properties/fact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 只用于IOC facts.value及availability；从可信displayInputs源读取，不从URL或Page数据推断。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f382f70726f706572746965732f6f70"></a>

### `@condition · anyOf[8].op`

Schema位置：`#/definitions/condition/anyOf/8/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["eq","ne"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "eq" | 原始标量严格等值；null不匹配。 |
| "ne" | 原始标量严格不等值；null不匹配。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f382f70726f706572746965732f76616c7565"></a>

### `@condition · anyOf[8].value`

Schema位置：`#/definitions/condition/anyOf/8/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f382f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@condition · anyOf[8].value · anyOf[0]`

Schema位置：`#/definitions/condition/anyOf/8/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f382f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@condition · anyOf[8].value · anyOf[1]`

Schema位置：`#/definitions/condition/anyOf/8/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f382f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@condition · anyOf[8].value · anyOf[2]`

Schema位置：`#/definitions/condition/anyOf/8/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f39"></a>

### `@condition · anyOf[9]`

Schema位置：`#/definitions/condition/anyOf/9`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["fact","op","values"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f392f70726f706572746965732f66616374"></a>

### `@condition · anyOf[9].fact`

Schema位置：`#/definitions/condition/anyOf/9/properties/fact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 只用于IOC facts.value及availability；从可信displayInputs源读取，不从URL或Page数据推断。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f392f70726f706572746965732f6f70"></a>

### `@condition · anyOf[9].op`

Schema位置：`#/definitions/condition/anyOf/9/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["in","notIn","containsAny","containsAll"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "in" | 原始值严格属于字面量集合；null不匹配。 |
| "notIn" | 原始值严格不属于字面量集合；null不匹配。 |
| "containsAny" | 来源集合至少包含一个给定值。 |
| "containsAll" | 来源集合包含全部给定值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f392f70726f706572746965732f76616c756573"></a>

### `@condition · anyOf[9].values`

Schema位置：`#/definitions/condition/anyOf/9/properties/values`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=1000 | Schema未设默认；装配/运行时默认见语义说明 | 集合比较的同类型字面量，不能与单值value混用。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f392f70726f706572746965732f76616c7565732f6974656d73"></a>

### `@condition · anyOf[9].values[]`

Schema位置：`#/definitions/condition/anyOf/9/properties/values/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f392f70726f706572746965732f76616c7565732f6974656d732f616e794f662f30"></a>

### `@condition · anyOf[9].values[] · anyOf[0]`

Schema位置：`#/definitions/condition/anyOf/9/properties/values/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f392f70726f706572746965732f76616c7565732f6974656d732f616e794f662f31"></a>

### `@condition · anyOf[9].values[] · anyOf[1]`

Schema位置：`#/definitions/condition/anyOf/9/properties/values/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f392f70726f706572746965732f76616c7565732f6974656d732f616e794f662f32"></a>

### `@condition · anyOf[9].values[] · anyOf[2]`

Schema位置：`#/definitions/condition/anyOf/9/properties/values/items/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f3130"></a>

### `@condition · anyOf[10]`

Schema位置：`#/definitions/condition/anyOf/10`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["fact","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31302f70726f706572746965732f66616374"></a>

### `@condition · anyOf[10].fact`

Schema位置：`#/definitions/condition/anyOf/10/properties/fact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 只用于IOC facts.value及availability；从可信displayInputs源读取，不从URL或Page数据推断。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31302f70726f706572746965732f6f70"></a>

### `@condition · anyOf[10].op`

Schema位置：`#/definitions/condition/anyOf/10/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["gt","gte","lt","lte"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "gt" | 原始number/money值大于阈值，按原始单位。 |
| "gte" | 原始number/money值大于等于阈值，按原始单位。 |
| "lt" | 原始number/money值小于阈值，按原始单位。 |
| "lte" | 原始number/money值小于等于阈值，按原始单位。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31302f70726f706572746965732f76616c7565"></a>

### `@condition · anyOf[10].value`

Schema位置：`#/definitions/condition/anyOf/10/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f3131"></a>

### `@condition · anyOf[11]`

Schema位置：`#/definitions/condition/anyOf/11`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["fact","op"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31312f70726f706572746965732f66616374"></a>

### `@condition · anyOf[11].fact`

Schema位置：`#/definitions/condition/anyOf/11/properties/fact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 只用于IOC facts.value及availability；从可信displayInputs源读取，不从URL或Page数据推断。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31312f70726f706572746965732f6f70"></a>

### `@condition · anyOf[11].op`

Schema位置：`#/definitions/condition/anyOf/11/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["isNull","isNotNull","isEmpty","isNotEmpty"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "isNull" | 只匹配合法null值；缺字段仍是契约错误。 |
| "isNotNull" | 只匹配合法非null值；缺字段仍是契约错误。 |
| "isEmpty" | 字符串或集合为空；未知输入不同于空值。 |
| "isNotEmpty" | 字符串或集合非空。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f3132"></a>

### `@condition · anyOf[12]`

Schema位置：`#/definitions/condition/anyOf/12`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["row","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31322f70726f706572746965732f726f77"></a>

### `@condition · anyOf[12].row`

Schema位置：`#/definitions/condition/anyOf/12/properties/row`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前行内已声明的标量字段ID，只能在合法行上下文使用。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31322f70726f706572746965732f6f70"></a>

### `@condition · anyOf[12].op`

Schema位置：`#/definitions/condition/anyOf/12/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["eq","ne"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "eq" | 原始标量严格等值；null不匹配。 |
| "ne" | 原始标量严格不等值；null不匹配。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31322f70726f706572746965732f76616c7565"></a>

### `@condition · anyOf[12].value`

Schema位置：`#/definitions/condition/anyOf/12/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31322f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@condition · anyOf[12].value · anyOf[0]`

Schema位置：`#/definitions/condition/anyOf/12/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31322f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@condition · anyOf[12].value · anyOf[1]`

Schema位置：`#/definitions/condition/anyOf/12/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31322f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@condition · anyOf[12].value · anyOf[2]`

Schema位置：`#/definitions/condition/anyOf/12/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f3133"></a>

### `@condition · anyOf[13]`

Schema位置：`#/definitions/condition/anyOf/13`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["row","op","values"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31332f70726f706572746965732f726f77"></a>

### `@condition · anyOf[13].row`

Schema位置：`#/definitions/condition/anyOf/13/properties/row`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前行内已声明的标量字段ID，只能在合法行上下文使用。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31332f70726f706572746965732f6f70"></a>

### `@condition · anyOf[13].op`

Schema位置：`#/definitions/condition/anyOf/13/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["in","notIn","containsAny","containsAll"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "in" | 原始值严格属于字面量集合；null不匹配。 |
| "notIn" | 原始值严格不属于字面量集合；null不匹配。 |
| "containsAny" | 来源集合至少包含一个给定值。 |
| "containsAll" | 来源集合包含全部给定值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31332f70726f706572746965732f76616c756573"></a>

### `@condition · anyOf[13].values`

Schema位置：`#/definitions/condition/anyOf/13/properties/values`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; maxItems=1000 | Schema未设默认；装配/运行时默认见语义说明 | 集合比较的同类型字面量，不能与单值value混用。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31332f70726f706572746965732f76616c7565732f6974656d73"></a>

### `@condition · anyOf[13].values[]`

Schema位置：`#/definitions/condition/anyOf/13/properties/values/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31332f70726f706572746965732f76616c7565732f6974656d732f616e794f662f30"></a>

### `@condition · anyOf[13].values[] · anyOf[0]`

Schema位置：`#/definitions/condition/anyOf/13/properties/values/items/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31332f70726f706572746965732f76616c7565732f6974656d732f616e794f662f31"></a>

### `@condition · anyOf[13].values[] · anyOf[1]`

Schema位置：`#/definitions/condition/anyOf/13/properties/values/items/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31332f70726f706572746965732f76616c7565732f6974656d732f616e794f662f32"></a>

### `@condition · anyOf[13].values[] · anyOf[2]`

Schema位置：`#/definitions/condition/anyOf/13/properties/values/items/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f3134"></a>

### `@condition · anyOf[14]`

Schema位置：`#/definitions/condition/anyOf/14`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["row","op","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31342f70726f706572746965732f726f77"></a>

### `@condition · anyOf[14].row`

Schema位置：`#/definitions/condition/anyOf/14/properties/row`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前行内已声明的标量字段ID，只能在合法行上下文使用。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31342f70726f706572746965732f6f70"></a>

### `@condition · anyOf[14].op`

Schema位置：`#/definitions/condition/anyOf/14/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["gt","gte","lt","lte"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "gt" | 原始number/money值大于阈值，按原始单位。 |
| "gte" | 原始number/money值大于等于阈值，按原始单位。 |
| "lt" | 原始number/money值小于阈值，按原始单位。 |
| "lte" | 原始number/money值小于等于阈值，按原始单位。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31342f70726f706572746965732f76616c7565"></a>

### `@condition · anyOf[14].value`

Schema位置：`#/definitions/condition/anyOf/14/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f3135"></a>

### `@condition · anyOf[15]`

Schema位置：`#/definitions/condition/anyOf/15`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["row","op"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31352f70726f706572746965732f726f77"></a>

### `@condition · anyOf[15].row`

Schema位置：`#/definitions/condition/anyOf/15/properties/row`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前行内已声明的标量字段ID，只能在合法行上下文使用。 |

<a id="schema-232f646566696e6974696f6e732f636f6e646974696f6e2f616e794f662f31352f70726f706572746965732f6f70"></a>

### `@condition · anyOf[15].op`

Schema位置：`#/definitions/condition/anyOf/15/properties/op`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["isNull","isNotNull","isEmpty","isNotEmpty"] | Schema未设默认；装配/运行时默认见语义说明 | 选择具名算子，不接受表达式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "isNull" | 只匹配合法null值；缺字段仍是契约错误。 |
| "isNotNull" | 只匹配合法非null值；缺字段仍是契约错误。 |
| "isEmpty" | 字符串或集合为空；未知输入不同于空值。 |
| "isNotEmpty" | 字符串或集合非空。 |

## 语义规则与反例（生成）


## 示例与溯源（生成）

- [page-visibility-region-linkage](examples/page-visibility-region-linkage.json)：完整合法页面；查询仅为静态契约证据。
- [page-visibility-inputs](examples/page-visibility-inputs.json)：完整合法页面；查询仅为静态契约证据。
- [reference-conditions-page](examples/reference-conditions-page.json)：完整合法页面；查询仅为静态契约证据。
- [page-visibility-report](examples/page-visibility-report.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/schema/condition.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/condition.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/presentation-policy.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/condition/anyOf/0`：[合法完整页面](examples/page-visibility-region-linkage.json)，JSON Pointer `#/sectionGroups/0/visibleWhen`。
- `#/definitions/condition/anyOf/1`：[合法完整页面](examples/page-visibility-region-linkage.json)，JSON Pointer `#/sections/3/components/0/props/rowVisibleWhen`。
- `#/definitions/condition/anyOf/2`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/filters/0/visibleWhen`。
- `#/definitions/condition/anyOf/3`：[合法完整页面](examples/page-visibility-inputs.json)，JSON Pointer `#/sections/1/visibleWhen`。
- `#/definitions/condition/anyOf/4`：[合法完整页面](examples/page-visibility-region-linkage.json)，JSON Pointer `#/sections/1/visibleWhen`。
- `#/definitions/condition/anyOf/4/properties/value/anyOf/0`：[合法完整页面](examples/page-visibility-region-linkage.json)，JSON Pointer `#/sections/1/visibleWhen/value`。
- `#/definitions/condition/anyOf/4/properties/value/anyOf/1`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/4/value`。
- `#/definitions/condition/anyOf/4/properties/value/anyOf/2`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/6/value`。
- `#/definitions/condition/anyOf/5`：[合法完整页面](examples/table-column-visibility.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/visibleWhen`。
- `#/definitions/condition/anyOf/5/properties/values/items/anyOf/0`：[合法完整页面](examples/table-column-visibility.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/visibleWhen/values/0`。
- `#/definitions/condition/anyOf/5/properties/values/items/anyOf/1`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/5/values/0`。
- `#/definitions/condition/anyOf/5/properties/values/items/anyOf/2`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/7/values/0`。
- `#/definitions/condition/anyOf/6`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/8`。
- `#/definitions/condition/anyOf/7`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/9`。
- `#/definitions/condition/anyOf/8`：[合法完整页面](examples/availability-page.json)，JSON Pointer `#/sections/1/components/0/visibleWhen`。
- `#/definitions/condition/anyOf/8/properties/value/anyOf/0`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/11/value`。
- `#/definitions/condition/anyOf/8/properties/value/anyOf/1`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/13/value`。
- `#/definitions/condition/anyOf/8/properties/value/anyOf/2`：[合法完整页面](examples/availability-page.json)，JSON Pointer `#/sections/1/components/0/visibleWhen/value`。
- `#/definitions/condition/anyOf/9`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/12`。
- `#/definitions/condition/anyOf/9/properties/values/items/anyOf/0`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/12/values/0`。
- `#/definitions/condition/anyOf/9/properties/values/items/anyOf/1`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/14/values/0`。
- `#/definitions/condition/anyOf/9/properties/values/items/anyOf/2`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/16/values/0`。
- `#/definitions/condition/anyOf/10`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/17`。
- `#/definitions/condition/anyOf/11`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/18`。
- `#/definitions/condition/anyOf/12`：[合法完整页面](examples/page-visibility-region-linkage.json)，JSON Pointer `#/sections/3/components/0/props/columns/0/navigate/visibleWhen`。
- `#/definitions/condition/anyOf/12/properties/value/anyOf/0`：[合法完整页面](examples/page-visibility-region-linkage.json)，JSON Pointer `#/sections/3/components/0/props/columns/0/navigate/visibleWhen/value`。
- `#/definitions/condition/anyOf/12/properties/value/anyOf/1`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/22/value`。
- `#/definitions/condition/anyOf/12/properties/value/anyOf/2`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/24/value`。
- `#/definitions/condition/anyOf/13`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/21`。
- `#/definitions/condition/anyOf/13/properties/values/items/anyOf/0`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/21/values/0`。
- `#/definitions/condition/anyOf/13/properties/values/items/anyOf/1`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/23/values/0`。
- `#/definitions/condition/anyOf/13/properties/values/items/anyOf/2`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/25/values/0`。
- `#/definitions/condition/anyOf/14`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/26`。
- `#/definitions/condition/anyOf/15`：[合法完整页面](examples/reference-conditions-page.json)，JSON Pointer `#/sections/0/components/1/props/rowVisibleWhen/all/27`。
