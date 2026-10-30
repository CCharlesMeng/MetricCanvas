# 结果字段契约

页面字段id是dataSources.<id>.fields的键；queryField指向DQE输出，两者不可隐式当成同一个名字。dimension用于分类，measure用于数值计算，detail承载受控明细；字段类型、角色和nullable必须与真实结果匹配。

<a id="dqe-output-measures"></a>

## DQE 直接输出的数值作为度量（6.56）

DQE 的输出位置与页面的结果字段角色分别声明。`output_dims` 中已经存储的计数、金额等数值，可以显式映射为 `type: number | money`、`role: measure`，供柱状图、折线图、指标卡及表格等现有消费者使用。按角色分组的写法将该字段放入 `fields.measures`；金额仍须声明 `currency`。能力下限为 6.56，旧版本及 5.x 只读兼容文档不得使用。

```json
{
  "fields": {
    "region": {"queryField":"区域","type":"string","role":"dimension"},
    "projects": {"queryField":"项目数量","type":"number","role":"measure","unit":"个"}
  },
  "source": {
    "type":"query",
    "query":{"language":"dqe","body":{"dsl_list":[{
      "output_dims":["区域","项目数量"],"output_metrics":[],
      "filter":{"dims":[],"metrics":[]},"order":{}
    }]}}
  }
}
```

字段角色只声明页面用途，不改写 DQE 查询，不增加 `SUM`、`COUNT`、去重或客户端分组。每根柱使用该结果行已返回的数值；同一区域若返回多行，仍保留多行，目标区域粒度须由原查询保证。`measure` 不隐含可加总，折叠仍要求 `collapsible: true`。

未显式选择度量角色的数值编号仍是维度；字符串、布尔、日期和时间等 `output_dims` 标量不得借此声明为度量。`output_metrics` 的标量仍要求 `role: measure`。现有 `detail` 专用消费规则保持原义。数值度量沿用下文的归一化与缺失规则，包括来自 `output_dims` 的字段及其内嵌初始行。

查询筛选目标继续由 `filterBindings` 显式决定；把页面字段声明为度量不会把维度条件改写为指标条件。`numberRange` 等既有绑定仍使用原来的 DQE 指标谓词，不因本能力获得新的上游筛选能力。完整示例 `stored-count-measures` 展示两个现成计数的柱图与明细、真实零和缺失值，并支持区域维度筛选；使用本地合成数据，不代表真实 DQE 取数验真。

<a id="查询数值度量的容错"></a>

## 查询数值度量的容错

查询结果中 `role: measure` 且 `type: number` 或 `money` 的单元格统一归一化为有限数字或 `null`。有限数字（包括真实零和负数）原样保留；非空十进制及科学计数法字符串转换成有限数字；`"--"`、空串、非数字字符串、布尔、对象、数组及非有限数字转为 `null`。不解析千分位、百分号或十六进制，不把缺失值转为零。无效单元格保留所在行，其他字段和行继续渲染。

该规则同样作用于查询内嵌初始行与嵌套明细中的数值度量，动态返回和首屏一致。数值度量即使声明 `nullable: false`，实际缺失也只记录非阻断告警；此声明在查询结果上表示数据预期，不再保证运行时一定非空。已有可空字段的正常 `null` 不告警。数据网关返回可选的 `warnings`，并在查询诊断中按字段及原因汇总数量；不记录原始值或数据行。

6.60 起，查询顶层标量失配采用下节展示证据规则；缺少映射字段、非对象行及明细结构/数量上限保持严格校验；`inline` 数据和文档字面量仍按原结果字段契约严格验证。组合表格成员和投影复验允许查询数值度量的 `null`，行键继续严格校验。

没有原文展示证据时，表格和指标卡沿用字段绑定的 `missingText`（通常为 `—`），折线和柱图保留缺口，饼图略过缺失值，指标卡进度环显示缺失占位符且不附百分号。计算沿用各算子已声明的缺失值规则，不额外补零；允许忽略缺失的合计可能只覆盖有效值，不能视为完整数据。验收完整示例 `query-numeric-tolerance` 包含八种合成输入及派生完成率，不代表真实 DQE 或业务口径验真。

query支持平铺和按角色分组的文档字段写法，normalize保持原始文档，运行时解析才展平。一个DQE输出应唯一映射到页面字段；派生字段不带queryField，必须由compute产出。

recordList使用显式items.fields约束每条嵌套记录，限制在已支持的明细呈现。collapsible:true是小计/合计的显式授权，不能从measure角色推断可加总。格式只影响显示，不修改原数值。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

嵌套明细字段可通过6.32的`table.props.rowExpansion.data:{type:"recordList",field:"..."}`被显式消费为子表格；字段契约仍为一层、每父行最多100项，子表列直接引用items.fields中的页面字段id。


## 查询标量的原文展示证据（6.60）

查询数值度量（number/money）的空字符串及仅空白字符串按业务缺项归一化为 null，不产生空文本原文回退，单元格按字段绑定 missingText 展示；真实数值0与有效数字字符串0保持0。nullable:false 的非空预期仍产生缺项告警。非空非法数值文本继续保留原文证据和告警。此修复不改变文本维度内容、缺少声明属性的映射错误或 inline 的严格类型校验。验收 `/pages/partner-health-union-null-probe`（Mock）。

查询顶层 string、number、money、boolean、date、datetime 标量值失配时，可展示的原始有限标量独立保留为 cellFallbacks；有效值通道取 null。表格按 String(raw) 展示原文并告警，计算、查询输入、行键和其他组件仍使用有效类型值。合法数值字符串继续采用既有数值归一化规则，非数字文本不参与计算。

真正空值及非有限数字继续缺失处理，不显示字符串 null 或 NaN；非标量对象不走通用 String。nullable:false 在查询顶层标量上表示非空预期，实际缺失告警；inline、字面量、嵌套明细非数值项及结构规则保持严格。数值维度失配可在表格展示，但关联和结果绑定仍会因有效键缺失而拒绝执行，不能删掉输入条件后改查全量。

ready 数据快照和数据网关结果可以附带 cellFallbacks，按当前快照行下标及稳定页面字段 id 记录 raw 与 reason。所有行投影和序列化同步重排证据，派生计算不会把输入原文变成输出值。普通 query 初始行保存原始查询标量，重新打开时归一化；pagedJoin 的已归一化 initial 可附带相同证据，且不改变业务字段字典。初始行、动态查询和 Excel 保持一致。该字段是结果的展示证据，不是页面表达式或展示策略开关。


页面协议 6.76。结构真源为本册[schema.json](schema.json)，SHA256 `e606b54c8638162938b7ab7e3db3b7dd2c8f2e1a62e9e8257c77f90f6b821296`。字段表自动生成；可选不等于有默认值。

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
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 日期单点原值显示，范围“开始 至 结束”；同端点折叠，空筛选为全部期间。 |

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
| "string" | 本分支必填 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

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
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 日期单点原值显示，范围“开始 至 结束”；同端点折叠，空筛选为全部期间。 |

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
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 日期单点原值显示，范围“开始 至 结束”；同端点折叠，空筛选为全部期间。 |

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
| "string" | 本分支必填 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

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
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 日期单点原值显示，范围“开始 至 结束”；同端点折叠，空筛选为全部期间。 |

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
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 日期单点原值显示，范围“开始 至 结束”；同端点折叠，空筛选为全部期间。 |

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
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 日期单点原值显示，范围“开始 至 结束”；同端点折叠，空筛选为全部期间。 |

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
| "string" | 本分支必填 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

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
| "string" | 本分支可选 | enum=["text","number","number-1","number-signed","number-1-signed","number-2-signed","number-grouped-signed","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-million-0","compact-million-1","compact-million-2","compact-yi-1","cny-adaptive","usd-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day","period"] | Schema未设默认；装配/运行时默认见语义说明 | 字段的缺省显示格式；显式绑定format优先。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "text" | 普通文本格式，不能执行HTML。 |
| "number" | 数值标量或原数值格式，按所在字段解释。 |
| "number-1" | 保留1位小数。 |
| "number-signed" | 保留普通数值精度，正数加正号，负数保留负号，零无符号；6.17新增。 |
| "number-1-signed" | 保留一位小数，舍入后零无符号；表格正负颜色与指标卡变化箭头按展示方向判断；6.17新增。 |
| "number-2-signed" | 保留两位小数，正数加正号，舍入后零无符号；方向与展示精度一致；6.18新增。 |
| "number-grouped-signed" | 沿用number-grouped千分位与默认小数精度，正数加正号，舍入后零无符号；6.18新增。 |
| "number-2" | 保留2位小数。 |
| "number-grouped" | 千分位数值展示。 |
| "compact-wan-0" | 按万缩放，0位小数。 |
| "compact-wan-1" | 按万缩放，1位小数。 |
| "compact-million-0" | 按百万缩放，0位小数，附加百万后缀。 |
| "compact-million-1" | 按百万缩放，1位小数，附加百万后缀。 |
| "compact-million-2" | 按百万缩放，2位小数，附加百万后缀。 |
| "compact-yi-1" | 按亿缩放，1位小数。 |
| "cny-adaptive" | 按金额量级使用元/万/亿自适应展示。 |
| "usd-adaptive" | 美元数值带千分位、两位小数和美元单位。 |
| "percent-0" | 原数值加百分号，0位小数。 |
| "percent-1" | 原数值加百分号，1位小数。 |
| "percent-2" | 原数值加百分号，2位小数。 |
| "percent-2-signed" | 原数值百分比，2位小数并显示正负号。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "date-month-day" | 只展示月日的日期格式。 |
| "period" | 日期单点原值显示，范围“开始 至 结束”；同端点折叠，空筛选为全部期间。 |

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

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b73"></a>

### `@cellFallbacks`

Schema位置：`#/definitions/cellFallbacks`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string","pattern":"^(0&#124;[1-9]\\d*)$"} | Schema未设默认；装配/运行时默认见语义说明 | 按快照行下标和页面字段id保存原始标量展示证据。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f6164646974696f6e616c50726f70657274696573"></a>

### `@cellFallbacks{key}`

Schema位置：`#/definitions/cellFallbacks/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | propertyNames={"type":"string","pattern":"^[A-Za-z_][A-Za-z0-9_-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f6164646974696f6e616c50726f706572746965732f6164646974696f6e616c50726f70657274696573"></a>

### `@cellFallbacks{key}{key}`

Schema位置：`#/definitions/cellFallbacks/additionalProperties/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | required=["raw","reason"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f6164646974696f6e616c50726f706572746965732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f726177"></a>

### `@cellFallbacks{key}{key}.raw`

Schema位置：`#/definitions/cellFallbacks/additionalProperties/additionalProperties/properties/raw`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 有限原始标量；只用于原文展示和往返，不作为有效业务值。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f6164646974696f6e616c50726f706572746965732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f7261772f616e794f662f30"></a>

### `@cellFallbacks{key}{key}.raw · anyOf[0]`

Schema位置：`#/definitions/cellFallbacks/additionalProperties/additionalProperties/properties/raw/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f6164646974696f6e616c50726f706572746965732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f7261772f616e794f662f31"></a>

### `@cellFallbacks{key}{key}.raw · anyOf[1]`

Schema位置：`#/definitions/cellFallbacks/additionalProperties/additionalProperties/properties/raw/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f6164646974696f6e616c50726f706572746965732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f7261772f616e794f662f32"></a>

### `@cellFallbacks{key}{key}.raw · anyOf[2]`

Schema位置：`#/definitions/cellFallbacks/additionalProperties/additionalProperties/properties/raw/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f6164646974696f6e616c50726f706572746965732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f726561736f6e"></a>

### `@cellFallbacks{key}{key}.reason`

Schema位置：`#/definitions/cellFallbacks/additionalProperties/additionalProperties/properties/reason`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["TYPE_MISMATCH","INVALID_NUMERIC_VALUE"] | Schema未设默认；装配/运行时默认见语义说明 | 标量失配的脱值原因分类。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "TYPE_MISMATCH" | 原始标量与声明类型不符，有效值保持缺失。 |
| "INVALID_NUMERIC_VALUE" | 数值度量不能归一化为有限数字，原始标量仅供展示。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f6164646974696f6e616c50726f706572746965732f70726f70657274794e616d6573"></a>

### `@cellFallbacks{key} · propertyNames`

Schema位置：`#/definitions/cellFallbacks/additionalProperties/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63656c6c46616c6c6261636b732f70726f70657274794e616d6573"></a>

### `@cellFallbacks · propertyNames`

Schema位置：`#/definitions/cellFallbacks/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^(0&#124;[1-9]\\d*)$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `grouped-query-fields-unique`：按角色分组的查询字段在维度组与度量组之间不得重名。反例：[grouped-field-duplicate](errors/grouped-field-duplicate.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `grouped-query-field-label-not-id`：分组查询字段的 label 与字段 id 相同时应省略。反例：[grouped-field-label-equals-id](errors/grouped-field-label-equals-id.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `inline-rows-contract`：inline 数据行满足结果字段契约（字段集合、类型、nullable、明细约束）。反例：[inline-row-undeclared-field](errors/inline-row-undeclared-field.json)、[inline-row-missing-field](errors/inline-row-missing-field.json)、[inline-row-null-not-allowed](errors/inline-row-null-not-allowed.json)、[inline-row-type-mismatch](errors/inline-row-type-mismatch.json)、[inline-row-date-invalid](errors/inline-row-date-invalid.json)、[inline-row-datetime-invalid](errors/inline-row-datetime-invalid.json)、[inline-row-semantic-html-type](errors/inline-row-semantic-html-type.json)、[inline-row-detail-undeclared-field](errors/inline-row-detail-undeclared-field.json)、[inline-row-detail-missing-field](errors/inline-row-detail-missing-field.json)、[inline-row-detail-null-not-allowed](errors/inline-row-detail-null-not-allowed.json)、[inline-row-detail-type-mismatch](errors/inline-row-detail-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `detail-item-object`：嵌套明细的每一项必须是对象；inline 在结构层拒绝，查询原始初始行在归一化层拒绝。反例：[initial-row-detail-item-not-object](errors/initial-row-detail-item-not-object.json)、[inline-row-detail-item-not-object](errors/inline-row-detail-item-not-object.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `detail-list-max-items`：嵌套明细最多 100 项；inline 在结构层拒绝，查询原始初始行在归一化层拒绝。反例：[initial-row-detail-list-too-large](errors/initial-row-detail-list-too-large.json)、[inline-row-detail-list-too-large](errors/inline-row-detail-list-too-large.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `query-field-mapping`：query 数据源字段与 DQE 输出字段之间的显式、唯一、角色相容映射。反例：[query-field-without-mapping](errors/query-field-without-mapping.json)、[query-field-duplicate-mapping](errors/query-field-duplicate-mapping.json)、[query-field-not-output](errors/query-field-not-output.json)、[query-detail-item-duplicate-mapping](errors/query-detail-item-duplicate-mapping.json)、[query-dimension-role-mismatch](errors/query-dimension-role-mismatch.json)、[query-role-mismatch](errors/query-role-mismatch.json)、[query-output-unmapped](errors/query-output-unmapped.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `detail-field-consumption`：嵌套明细字段只能由显式支持 detail 的组件属性消费。反例：[detail-field-in-generic-binding](errors/detail-field-in-generic-binding.json)、[record-list-in-table-column](errors/record-list-in-table-column.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `query-dimension-measures`：6.56 DQE output_dims 中的现成数值显式作为页面度量，不改变查询与行粒度。反例：[dimension-measure-version](errors/dimension-measure-version.json)、[dimension-measure-legacy](errors/dimension-measure-legacy.json)、[dimension-measure-time-qualified-version](errors/dimension-measure-time-qualified-version.json)、[dimension-measure-nonnumeric](errors/dimension-measure-nonnumeric.json)、[dimension-number-not-series](errors/dimension-number-not-series.json)、[dimension-measure-not-collapsible](errors/dimension-measure-not-collapsible.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [grouped-fields-page](examples/grouped-fields-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [query-numeric-tolerance](examples/query-numeric-tolerance.json)：完整合法页面；查询仅为静态契约证据。
- [stored-count-measures](examples/stored-count-measures.json)：完整合法页面；查询仅为静态契约证据。
- [table-paged-fallback-page](examples/table-paged-fallback-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/data-source.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/query-output-measures.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/field/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/metrics/fields/amount`。
- `#/definitions/scalarField/oneOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/metrics/fields/amount`。
- `#/definitions/scalarField/oneOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/dataSources/amounts/fields/amount`。
- `#/definitions/field/anyOf/1`：[合法完整页面](examples/component-fieldText.json)，JSON Pointer `#/dataSources/notes/fields/items`。
- `#/definitions/field/anyOf/2`：[合法完整页面](examples/component-fieldText.json)，JSON Pointer `#/dataSources/notes/fields/body`。
- `#/definitions/fieldValue/anyOf/0`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/metrics/source/rows/0/amount`。
- `#/definitions/scalar/anyOf/0`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/dataSources/usage/source/rows/0/month`。
- `#/definitions/scalar/anyOf/1`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/dataSources/metrics/source/rows/0/amount`。
- `#/definitions/scalar/anyOf/2`：[合法完整页面](examples/component-fieldText.json)，JSON Pointer `#/dataSources/notes/source/rows/0/flag`。
- `#/definitions/scalar/anyOf/3`：[合法完整页面](examples/component-metricCard-primaryDetail.json)，JSON Pointer `#/dataSources/metrics/source/rows/0/missing`。
- `#/definitions/fieldValue/anyOf/1`：[合法完整页面](examples/component-fieldText.json)，JSON Pointer `#/dataSources/notes/source/rows/0/items`。
- `#/definitions/queryField/anyOf/0`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/fields/name`。
- `#/definitions/queryScalarField/oneOf/0`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/fields/name`。
- `#/definitions/queryScalarField/oneOf/1`：[合法完整页面](examples/unified-overflow-header.json)，JSON Pointer `#/dataSources/opportunity-list/fields/bidding-amount`。
- `#/definitions/queryField/anyOf/1`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/fields/events`。
- `#/definitions/queryField/anyOf/2`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/dataSources/customers/fields/reason`。
- `#/definitions/queryField/anyOf/3`：[合法完整页面](examples/query-numeric-tolerance.json)，JSON Pointer `#/dataSources/samples/fields/rate`。
- `#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/0`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields/measures/growth`。
- `#/definitions/groupedMeasureQueryFieldGroup/additionalProperties/oneOf/1`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields/measures/revenue`。
- `#/definitions/groupedQueryFields/anyOf/0`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields`。
- `#/definitions/groupedQueryFields/anyOf/1`：[合法完整页面](examples/grouped-fields-page.json)，JSON Pointer `#/dataSources/grouped/fields`。
- `#/definitions/cellFallbacks/additionalProperties/additionalProperties/properties/raw/anyOf/0`：[合法完整页面](examples/table-paged-fallback-page.json)，JSON Pointer `#/dataSources/office-overview/source/initial/cellFallbacks/0/bidding-amount/raw`。
- `#/definitions/cellFallbacks/additionalProperties/additionalProperties/properties/raw/anyOf/1`：[合法完整页面](examples/table-paged-fallback-page.json)，JSON Pointer `#/dataSources/office-overview/source/initial/cellFallbacks/0/rep-office-name/raw`。
- `#/definitions/cellFallbacks/additionalProperties/additionalProperties/properties/raw/anyOf/2`：[合法完整页面](examples/table-paged-fallback-page.json)，JSON Pointer `#/dataSources/office-overview/source/initial/cellFallbacks/0/region-dept-name/raw`。
