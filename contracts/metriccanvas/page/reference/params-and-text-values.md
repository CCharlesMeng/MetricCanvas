# 页面参数与文本取值

旧数组参数：页面参数是一次初始化的不可变取值；筛选器是页内可变状态。标量参数保留string/number/boolean；6.2的dimension单值使用非空string，multiple:true使用非空、无重复string[]。URL多值用重复键，不拆逗号。标量/维度参数的非法URL输入回退唯一default；必需参数缺值会阻止呈现和查数。

文本取值引用为{param:id}，由声明取值并按可选format格式化；必需文本不能引用可能缺失的参数。initialParam只把实际参数用于筛选初值，不能与filter.default双默认；6.11起timePoint筛选器与层级维度筛选器同样可用，前者引用单点times参数，后者的初值落在defaultLevel那一层；paramBindings显式指定查询目标，后续筛选清空不会复活原值。受筛选控制的目标不同时写静态参数条件。

执行回执的appliedInputs/filterValues是初始化权威；浏览器不再次用URL或模板默认覆盖。服务权限优先级不由Schema证明。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

可选参数缺失时，文本引用所在属性整体移除，数组位置按已有解析规则移除；必填文本只能引用必需参数。每个声明参数必须有消费者，6.2的查询初始化/筛选初值绑定也计入消费，既有conformance规则标识名保持兼容。参数格式要与类型相容；导航的`source:param`也是显式读取途径。


## 6.3 确定性时间参数

时间参数声明 `type: "time"`、`granularity: "month" | "date"`，值分别为真实日历的 YYYY-MM / YYYY-MM-DD（0001—9999年）。仅未提供URL键时使用default；显式非法、空串或重复时间键阻止初始化，不回退默认月份。时间文本引用当前支持原值展示，不接受数值或日期格式预设。

查询通过 `paramBindings.<参数id> = {target:"time",window:...}` 引用必需时间参数。每个查询只有一个时间参数来源，不与时间filterBindings共同控制；query.body内必须保留filter.time，不能同时声明start/end。month参数要求period=month，date参数要求period=day；这只是第一版接入限制，不是把输入精度与指标统计周期等同。

窗口：`{kind:"period",unit:"day"|"month"|"year",offset?:整数}` 表示完整周期（offset缺省0）；`{kind:"lastN",unit:"day"|"month",n:正整数}` 表示含基准期的最近N期；6.4新增 `{kind:"monthToDate"}` / `{kind:"yearToDate"}` 表示自然月/年起点至基准期，不读取系统今天，无需unit。旧 `{kind:"toDate",unit:"month"|"year"}` 保持兼容。月参数不能推断某一天；lastN单位须与输入精度一致（month→month、date→day）。日期计算为确定性日历算术，不读取时钟，不受进程时区影响；起止包含。生成窗口越出0001—9999年时报错。

运行时仅改副本中的查询起止，保留period、is_aggregate及指标；无数据呈现空结果，不回退最新期。时间绑定查询不消费没有参数执行凭据的source.initial旧行；经过prepareExecution核验的执行回执仍是权威。累计、同比/环比、历史预测版本、结果按小时分组与物理分区路由不由此规则计算。

## 6.6 分层参数与查询侧时间窗口

params 增加对象分支，按消费位置分两层：params.query.{dimensions,times} 落进 DQE 请求体，params.display 只被文本取值与导航消费。三个数组均为可选非空数组，至少声明一个参数。dimensions 每项为 id、dim_name、可选 dim_value_list；times 每项为 id、granularity、可选且成对的 start/end；display 每项为 id、type 与可选 value。两层 ID 全局唯一，required 缺省 true，label 可选；新结构不接受 default。

维度统一非空去重字符串数组。时间精度 month/date，校验真实日历及起止顺序。一个 times 项就是一个包含区间，单点写成 start 与 end 相同；多个 times 是独立输入，查询显式按 ID 选择；period 与 is_aggregate 留在查询侧。未填值模板允许校验与保存，但必需输入不全不能执行。

原位引用限于 DQE filter.dims[].dim_value_list 的 {param:id} 和 filter.time 的 {period,is_aggregate?,param,window?}。时间引用不写 window 时原样取参数起止，写 window 时以参数值为基准点派生，此时被引用输入必须是单点——已填值的在声明期判，未填值模板留到取值代入时报。window 的取值与语义同上一节，单位须与输入精度相容。引用的参数必须声明在 params.query 下；引用不得与筛选/旧参数绑定双控、不得与查询体字面量起止并存、不得出现在其他请求位置。执行前在副本解析，带引用的查询不消费未经核验的 initial 旧行。

文本区间显示 start 至 end，相同起止显示一次，维度多值用顿号连接。URL 维度用重复键；时间是纯文本，单点写 2026-03，区间写 2026-01..2026-06，未传使用保存实际值，显式非法不回退。旧数组/default/time-window 保持兼容，规范化保存不把分层结构改写为数组。


页面协议 6.11。结构真源为本册[schema.json](schema.json)，SHA256 `6b28ba0e717198c2963d957ea5c11e3177d05605f5bcc5e818f55f71e945e174`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565"></a>

### `@nonEmptyTextValue`

Schema位置：`#/definitions/nonEmptyTextValue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c75652f616e794f662f30"></a>

### `@nonEmptyTextValue · anyOf[0]`

Schema位置：`#/definitions/nonEmptyTextValue/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c75652f616e794f662f31"></a>

### `@nonEmptyTextValue · anyOf[1]`

Schema位置：`#/definitions/nonEmptyTextValue/anyOf/1`。目标：[#/definitions/textValueReference](params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c75655265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValueReference | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7465787456616c75655265666572656e6365"></a>

### `@textValueReference`

Schema位置：`#/definitions/textValueReference`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["param"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 对一个页面参数的整值引用；不是模板插值，不参与拼接 |

<a id="schema-232f646566696e6974696f6e732f7465787456616c75655265666572656e63652f70726f706572746965732f706172616d"></a>

### `@textValueReference.param`

Schema位置：`#/definitions/textValueReference/properties/param`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 已声明页面参数id，整值替换，不插值拼接。 |

<a id="schema-232f646566696e6974696f6e732f7465787456616c75655265666572656e63652f70726f706572746965732f666f726d6174"></a>

### `@textValueReference.format`

Schema位置：`#/definitions/textValueReference/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 引用处的展示格式；复用组件字段绑定的同一套封闭闭集 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀（6.5）。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀（6.5）。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀（6.5）。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d"></a>

### `@pageParam`

Schema位置：`#/definitions/pageParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面参数：一次初始化确定的具名输入；6.5 以 value 承载本次实际值，旧 URL/default 路径兼容读取 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f30"></a>

### `@pageParam · anyOf[0]`

Schema位置：`#/definitions/pageParam/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f6964"></a>

### `@pageParam · anyOf[0].id`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f74797065"></a>

### `@pageParam · anyOf[0].type`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["string","number","boolean"] | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "string" | 字符串标量。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "boolean" | 布尔值；false是显式取值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f7265717569726564"></a>

### `@pageParam · anyOf[0].required`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f6c6162656c"></a>

### `@pageParam · anyOf[0].label`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f64656661756c74"></a>

### `@pageParam · anyOf[0].default`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f64656661756c742f616e794f662f30"></a>

### `@pageParam · anyOf[0].default · anyOf[0]`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/default/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f64656661756c742f616e794f662f31"></a>

### `@pageParam · anyOf[0].default · anyOf[1]`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/default/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f64656661756c742f616e794f662f32"></a>

### `@pageParam · anyOf[0].default · anyOf[2]`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/default/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f76616c7565"></a>

### `@pageParam · anyOf[0].value`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@pageParam · anyOf[0].value · anyOf[0]`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@pageParam · anyOf[0].value · anyOf[1]`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f302f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@pageParam · anyOf[0].value · anyOf[2]`

Schema位置：`#/definitions/pageParam/anyOf/0/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f31"></a>

### `@pageParam · anyOf[1]`

Schema位置：`#/definitions/pageParam/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f6964"></a>

### `@pageParam · anyOf[1].id`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f74797065"></a>

### `@pageParam · anyOf[1].type`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f7265717569726564"></a>

### `@pageParam · anyOf[1].required`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f6c6162656c"></a>

### `@pageParam · anyOf[1].label`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f6d756c7469706c65"></a>

### `@pageParam · anyOf[1].multiple`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/multiple`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 维度参数多值开关，缺省单值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f64656661756c74"></a>

### `@pageParam · anyOf[1].default`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f64656661756c742f616e794f662f30"></a>

### `@pageParam · anyOf[1].default · anyOf[0]`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/default/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f64656661756c742f616e794f662f31"></a>

### `@pageParam · anyOf[1].default · anyOf[1]`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/default/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 独立分支（不合并required） | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f64656661756c742f616e794f662f312f6974656d73"></a>

### `@pageParam · anyOf[1].default · anyOf[1][]`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/default/anyOf/1/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@pageParam · anyOf[1].value`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@pageParam · anyOf[1].value · anyOf[0]`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@pageParam · anyOf[1].value · anyOf[1]`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 独立分支（不合并required） | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f312f70726f706572746965732f76616c75652f616e794f662f312f6974656d73"></a>

### `@pageParam · anyOf[1].value · anyOf[1][]`

Schema位置：`#/definitions/pageParam/anyOf/1/properties/value/anyOf/1/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f32"></a>

### `@pageParam · anyOf[2]`

Schema位置：`#/definitions/pageParam/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["id","type","granularity"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f322f70726f706572746965732f6964"></a>

### `@pageParam · anyOf[2].id`

Schema位置：`#/definitions/pageParam/anyOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f322f70726f706572746965732f74797065"></a>

### `@pageParam · anyOf[2].type`

Schema位置：`#/definitions/pageParam/anyOf/2/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="time" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "time" | 用于选择@pageParam · anyOf[2].type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f322f70726f706572746965732f6772616e756c6172697479"></a>

### `@pageParam · anyOf[2].granularity`

Schema位置：`#/definitions/pageParam/anyOf/2/properties/granularity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["month","date"] | Schema未设默认；装配/运行时默认见语义说明 | 时间值的粒度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f322f70726f706572746965732f7265717569726564"></a>

### `@pageParam · anyOf[2].required`

Schema位置：`#/definitions/pageParam/anyOf/2/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f322f70726f706572746965732f6c6162656c"></a>

### `@pageParam · anyOf[2].label`

Schema位置：`#/definitions/pageParam/anyOf/2/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f322f70726f706572746965732f64656661756c74"></a>

### `@pageParam · anyOf[2].default`

Schema位置：`#/definitions/pageParam/anyOf/2/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f322f70726f706572746965732f76616c7565"></a>

### `@pageParam · anyOf[2].value`

Schema位置：`#/definitions/pageParam/anyOf/2/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f33"></a>

### `@pageParam · anyOf[3]`

Schema位置：`#/definitions/pageParam/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["id","type","granularity"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f6964"></a>

### `@pageParam · anyOf[3].id`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f74797065"></a>

### `@pageParam · anyOf[3].type`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timeRange" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timeRange" | 用于选择@pageParam · anyOf[3].type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f6772616e756c6172697479"></a>

### `@pageParam · anyOf[3].granularity`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/granularity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["month","date"] | Schema未设默认；装配/运行时默认见语义说明 | 时间值的粒度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f7265717569726564"></a>

### `@pageParam · anyOf[3].required`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f6c6162656c"></a>

### `@pageParam · anyOf[3].label`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f76616c7565"></a>

### `@pageParam · anyOf[3].value`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["start","end","granularity"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f76616c75652f70726f706572746965732f7374617274"></a>

### `@pageParam · anyOf[3].value.start`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/value/properties/start`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | timeRange 参数的包含起点；与 end 一起表达一次页面实例的明确时间区间。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f76616c75652f70726f706572746965732f656e64"></a>

### `@pageParam · anyOf[3].value.end`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/value/properties/end`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | timeRange 参数的包含终点；必须与 start 使用相同粒度且不早于起点。 |

<a id="schema-232f646566696e6974696f6e732f70616765506172616d2f616e794f662f332f70726f706572746965732f76616c75652f70726f706572746965732f6772616e756c6172697479"></a>

### `@pageParam · anyOf[3].value.granularity`

Schema位置：`#/definitions/pageParam/anyOf/3/properties/value/properties/granularity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["month","date"] | Schema未设默认；装配/运行时默认见语义说明 | 时间值的粒度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d73"></a>

### `@groupedPageParams`

Schema位置：`#/definitions/groupedPageParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 按用途分层的页面输入：params.query 落进查询，params.display 只供呈现；两层共享唯一参数 ID 空间。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f7175657279"></a>

### `@groupedPageParams.query`

Schema位置：`#/definitions/groupedPageParams/properties/query`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 落进查询请求的输入层：只有这一层下的参数可被查询体原位引用。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f64696d656e73696f6e73"></a>

### `@groupedPageParams.query.dimensions`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/dimensions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 维度输入数组，每项由唯一参数 ID 引用，dim_name 必须与被引用查询条件一致。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f64696d656e73696f6e732f6974656d73"></a>

### `@groupedPageParams.query.dimensions[]`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/dimensions/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","dim_name"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f64696d656e73696f6e732f6974656d732f70726f706572746965732f6964"></a>

### `@groupedPageParams.query.dimensions[].id`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/dimensions/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f64696d656e73696f6e732f6974656d732f70726f706572746965732f64696d5f6e616d65"></a>

### `@groupedPageParams.query.dimensions[].dim_name`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/dimensions/items/properties/dim_name`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 参数对应的业务维度字段；查询目标须与之相同。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f64696d656e73696f6e732f6974656d732f70726f706572746965732f64696d5f76616c75655f6c697374"></a>

### `@groupedPageParams.query.dimensions[].dim_value_list`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/dimensions/items/properties/dim_value_list`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 本次页面实例的非空、无重复维度值列表；模板可省略。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f64696d656e73696f6e732f6974656d732f70726f706572746965732f64696d5f76616c75655f6c6973742f6974656d73"></a>

### `@groupedPageParams.query.dimensions[].dim_value_list[]`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/dimensions/items/properties/dim_value_list/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f64696d656e73696f6e732f6974656d732f70726f706572746965732f7265717569726564"></a>

### `@groupedPageParams.query.dimensions[].required`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/dimensions/items/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f64696d656e73696f6e732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@groupedPageParams.query.dimensions[].label`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/dimensions/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f74696d6573"></a>

### `@groupedPageParams.query.times`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/times`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 时间输入数组，每项是一个包含区间；单点写成 start 与 end 相同。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f74696d65732f6974656d73"></a>

### `@groupedPageParams.query.times[]`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/times/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","granularity"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f74696d65732f6974656d732f70726f706572746965732f6964"></a>

### `@groupedPageParams.query.times[].id`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/times/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f74696d65732f6974656d732f70726f706572746965732f6772616e756c6172697479"></a>

### `@groupedPageParams.query.times[].granularity`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/times/items/properties/granularity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["month","date"] | Schema未设默认；装配/运行时默认见语义说明 | 时间值的粒度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f74696d65732f6974656d732f70726f706572746965732f7374617274"></a>

### `@groupedPageParams.query.times[].start`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/times/items/properties/start`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 包含的区间起点，与 end 同时填写或省略。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f74696d65732f6974656d732f70726f706572746965732f656e64"></a>

### `@groupedPageParams.query.times[].end`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/times/items/properties/end`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 包含的区间终点，不早于 start。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f74696d65732f6974656d732f70726f706572746965732f7265717569726564"></a>

### `@groupedPageParams.query.times[].required`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/times/items/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f71756572792f70726f706572746965732f74696d65732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@groupedPageParams.query.times[].label`

Schema位置：`#/definitions/groupedPageParams/properties/query/properties/times/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c6179"></a>

### `@groupedPageParams.display`

Schema位置：`#/definitions/groupedPageParams/properties/display`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 只供呈现的输入层：被文本取值和导航消费，不能进入查询；实际取值用 value 保存。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d73"></a>

### `@groupedPageParams.display[]`

Schema位置：`#/definitions/groupedPageParams/properties/display/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d732f70726f706572746965732f6964"></a>

### `@groupedPageParams.display[].id`

Schema位置：`#/definitions/groupedPageParams/properties/display/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d732f70726f706572746965732f74797065"></a>

### `@groupedPageParams.display[].type`

Schema位置：`#/definitions/groupedPageParams/properties/display/items/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["string","number","boolean"] | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "string" | 字符串标量。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "boolean" | 布尔值；false是显式取值。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d732f70726f706572746965732f76616c7565"></a>

### `@groupedPageParams.display[].value`

Schema位置：`#/definitions/groupedPageParams/properties/display/items/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d732f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `@groupedPageParams.display[].value · anyOf[0]`

Schema位置：`#/definitions/groupedPageParams/properties/display/items/properties/value/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d732f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `@groupedPageParams.display[].value · anyOf[1]`

Schema位置：`#/definitions/groupedPageParams/properties/display/items/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d732f70726f706572746965732f76616c75652f616e794f662f32"></a>

### `@groupedPageParams.display[].value · anyOf[2]`

Schema位置：`#/definitions/groupedPageParams/properties/display/items/properties/value/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d732f70726f706572746965732f7265717569726564"></a>

### `@groupedPageParams.display[].required`

Schema位置：`#/definitions/groupedPageParams/properties/display/items/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d732f70726f706572746965732f646973706c61792f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@groupedPageParams.display[].label`

Schema位置：`#/definitions/groupedPageParams/properties/display/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f77"></a>

### `@timeWindow`

Schema位置：`#/definitions/timeWindow`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f30"></a>

### `@timeWindow · oneOf[0]`

Schema位置：`#/definitions/timeWindow/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind","unit"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f302f70726f706572746965732f6b696e64"></a>

### `@timeWindow · oneOf[0].kind`

Schema位置：`#/definitions/timeWindow/oneOf/0/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="period" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "period" | 时间窗口：基准所在完整周期；offset按指定unit移动周期。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f302f70726f706572746965732f756e6974"></a>

### `@timeWindow · oneOf[0].unit`

Schema位置：`#/definitions/timeWindow/oneOf/0/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["day","month","year"] | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "day" | 日粒度。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "year" | 年粒度。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f302f70726f706572746965732f6f6666736574"></a>

### `@timeWindow · oneOf[0].offset`

Schema位置：`#/definitions/timeWindow/oneOf/0/properties/offset`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=-9007199254740991; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 完整周期偏移量，按window.unit计数；缺省0，负数表示以前的周期。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f31"></a>

### `@timeWindow · oneOf[1]`

Schema位置：`#/definitions/timeWindow/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind","unit","n"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f312f70726f706572746965732f6b696e64"></a>

### `@timeWindow · oneOf[1].kind`

Schema位置：`#/definitions/timeWindow/oneOf/1/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="lastN" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "lastN" | 含基准期的最近N期；时间参数窗口按自身日期/月精度计数。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f312f70726f706572746965732f756e6974"></a>

### `@timeWindow · oneOf[1].unit`

Schema位置：`#/definitions/timeWindow/oneOf/1/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["day","month"] | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "day" | 日粒度。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f312f70726f706572746965732f6e"></a>

### `@timeWindow · oneOf[1].n`

Schema位置：`#/definitions/timeWindow/oneOf/1/properties/n`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间的周期数量。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f32"></a>

### `@timeWindow · oneOf[2]`

Schema位置：`#/definitions/timeWindow/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f322f70726f706572746965732f6b696e64"></a>

### `@timeWindow · oneOf[2].kind`

Schema位置：`#/definitions/timeWindow/oneOf/2/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="yearToDate" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "yearToDate" | 自然年起点至绑定参数的报告基准期，不读取系统今天（6.4）。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f33"></a>

### `@timeWindow · oneOf[3]`

Schema位置：`#/definitions/timeWindow/oneOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f332f70726f706572746965732f6b696e64"></a>

### `@timeWindow · oneOf[3].kind`

Schema位置：`#/definitions/timeWindow/oneOf/3/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="monthToDate" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "monthToDate" | 自然月起点至绑定参数的报告基准期，不读取系统今天（6.4）。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f34"></a>

### `@timeWindow · oneOf[4]`

Schema位置：`#/definitions/timeWindow/oneOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind","unit"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f342f70726f706572746965732f6b696e64"></a>

### `@timeWindow · oneOf[4].kind`

Schema位置：`#/definitions/timeWindow/oneOf/4/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="toDate" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "toDate" | 兼容6.3的旧写法，新文档优先使用yearToDate或monthToDate。 |

<a id="schema-232f646566696e6974696f6e732f74696d6557696e646f772f6f6e654f662f342f70726f706572746965732f756e6974"></a>

### `@timeWindow · oneOf[4].unit`

Schema位置：`#/definitions/timeWindow/oneOf/4/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["month","year"] | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "year" | 年粒度。 |

<a id="schema-232f646566696e6974696f6e732f7465787456616c7565"></a>

### `@textValue`

Schema位置：`#/definitions/textValue`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7465787456616c75652f616e794f662f30"></a>

### `@textValue · anyOf[0]`

Schema位置：`#/definitions/textValue/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7465787456616c75652f616e794f662f31"></a>

### `@textValue · anyOf[1]`

Schema位置：`#/definitions/textValue/anyOf/1`。目标：[#/definitions/textValueReference](params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c75655265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValueReference | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `page-param-id-unique`：页面参数 id 唯一。反例：[duplicate-page-param-id](errors/duplicate-page-param-id.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `page-param-not-filter-name`：页面参数不得与筛选器同名。反例：[page-param-named-like-filter](errors/page-param-named-like-filter.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `page-param-default-type`：页面参数默认值符合声明类型。反例：[page-param-default-type-mismatch](errors/page-param-default-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `text-value-param-declared`：文本取值只能引用已声明的页面参数。反例：[text-value-unknown-param](errors/text-value-unknown-param.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `text-value-format-compatible`：文本取值引用的展示格式与参数类型相容。反例：[text-value-format-mismatch](errors/text-value-format-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `page-param-consumed`：每个页面参数至少被一处文本取值消费。反例：[page-param-unconsumed](errors/page-param-unconsumed.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `optional-param-not-in-required-text`：必填文本属性只能引用必需参数。反例：[required-title-references-optional-param](errors/required-title-references-optional-param.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [dimension-params-page](examples/dimension-params-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-params-page](examples/time-params-page.json)：完整合法页面；查询仅为静态契约证据。
- [grouped-params-page](examples/grouped-params-page.json)：完整合法页面；查询仅为静态契约证据。
- [grouped-scalar-params-page](examples/grouped-scalar-params-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/primitives.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/time-param.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/param-bindings.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/nonEmptyTextValue/anyOf/0`：[合法完整页面](examples/component-reportHeader.json)，JSON Pointer `#/sections/0/components/0/props/title`。
- `#/definitions/nonEmptyTextValue/anyOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/0/props/title`。
- `#/definitions/pageParam/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/2`。
- `#/definitions/pageParam/anyOf/0/properties/default/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/2/default`。
- `#/definitions/pageParam/anyOf/0/properties/default/anyOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/3/default`。
- `#/definitions/pageParam/anyOf/0/properties/default/anyOf/2`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/4/default`。
- `#/definitions/pageParam/anyOf/0/properties/value/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/2/value`。
- `#/definitions/pageParam/anyOf/0/properties/value/anyOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/3/value`。
- `#/definitions/pageParam/anyOf/0/properties/value/anyOf/2`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/4/value`。
- `#/definitions/pageParam/anyOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/0`。
- `#/definitions/pageParam/anyOf/1/properties/default/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/0/default`。
- `#/definitions/pageParam/anyOf/1/properties/default/anyOf/1`：[合法完整页面](examples/dimension-params-page.json)，JSON Pointer `#/params/0/default`。
- `#/definitions/pageParam/anyOf/1/properties/value/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/0/value`。
- `#/definitions/pageParam/anyOf/1/properties/value/anyOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/1/value`。
- `#/definitions/pageParam/anyOf/2`：[合法完整页面](examples/time-params-page.json)，JSON Pointer `#/params/0`。
- `#/definitions/pageParam/anyOf/3`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params/5`。
- `#/definitions/groupedPageParams/properties/display/items/properties/value/anyOf/0`：[合法完整页面](examples/grouped-scalar-params-page.json)，JSON Pointer `#/params/display/0/value`。
- `#/definitions/groupedPageParams/properties/display/items/properties/value/anyOf/1`：[合法完整页面](examples/grouped-scalar-params-page.json)，JSON Pointer `#/params/display/1/value`。
- `#/definitions/groupedPageParams/properties/display/items/properties/value/anyOf/2`：[合法完整页面](examples/grouped-scalar-params-page.json)，JSON Pointer `#/params/display/2/value`。
- `#/definitions/timeWindow/oneOf/0`：[合法完整页面](examples/time-params-page.json)，JSON Pointer `#/dataSources/current/source/query/paramBindings/report-month/window`。
- `#/definitions/timeWindow/oneOf/1`：[合法完整页面](examples/time-params-page.json)，JSON Pointer `#/dataSources/rolling/source/query/paramBindings/report-month/window`。
- `#/definitions/timeWindow/oneOf/2`：[合法完整页面](examples/time-params-page.json)，JSON Pointer `#/dataSources/to-date/source/query/paramBindings/report-month/window`。
- `#/definitions/timeWindow/oneOf/3`：[合法完整页面](examples/time-params-page.json)，JSON Pointer `#/dataSources/month-to-date/source/query/paramBindings/report-month/window`。
- `#/definitions/timeWindow/oneOf/4`：[合法完整页面](examples/time-params-page.json)，JSON Pointer `#/dataSources/legacy-to-date/source/query/paramBindings/report-month/window`。
- `#/definitions/textValue/anyOf/0`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0/props/legend/title`。
- `#/definitions/textValue/anyOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/4/props/title`。
