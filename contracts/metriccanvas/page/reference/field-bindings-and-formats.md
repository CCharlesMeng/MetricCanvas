# 数据槽、字段绑定与格式

data槽把组件关联到页面数据源；字段绑定引用该槽中的结果字段，可用显式source指定受支持的其它槽。match按声明维度取值选择对应行，不能充当通用查询表达式。

format优先于字段defaultFormat；未设置时走组件/类型的既有格式行为。number保留数值语义，number-1/2控制小数位，number-grouped千分位；compact-wan/yi是数量单位缩放。percent-*直接以原数值加百分号，0.42不自动变42%；需要ratio.scale:100或正确的原始刻度。

text不执行HTML，日期格式只格式化日期值。语义HTML须用专用字段类型。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.6。结构真源为本册[schema.json](schema.json)，SHA256 `724a223b61ed116ed3a542b273a0235b6778f87196f289a2a19d1c9feb5a24e7`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6d657472696344617461"></a>

### `@metricData`

Schema位置：`#/definitions/metricData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["main"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963446174612f70726f706572746965732f6d61696e"></a>

### `@metricData.main`

Schema位置：`#/definitions/metricData/properties/main`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 主数据槽，值引用已声明页面数据源。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963446174612f70726f706572746965732f636f6d70617265"></a>

### `@metricData.compare`

Schema位置：`#/definitions/metricData/properties/compare`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 对比数据槽。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963446174612f70726f706572746965732f746172676574"></a>

### `@metricData.target`

Schema位置：`#/definitions/metricData/properties/target`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 写回目标或查询绑定目标，按所在结构明确类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e67"></a>

### `@fieldBinding`

Schema位置：`#/definitions/fieldBinding`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f30"></a>

### `@fieldBinding · anyOf[0]`

Schema位置：`#/definitions/fieldBinding/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f31"></a>

### `@fieldBinding · anyOf[1]`

Schema位置：`#/definitions/fieldBinding/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["data","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f64617461"></a>

### `@fieldBinding · anyOf[1].data`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/data`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@fieldBinding · anyOf[1].field`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f666f726d6174"></a>

### `@fieldBinding · anyOf[1].format`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["text","number","number-1","number-2","number-grouped","compact-wan-0","compact-wan-1","compact-yi-1","cny-adaptive","percent-0","percent-1","percent-2","percent-2-signed","date","date-month-day"] | Schema未设默认；装配/运行时默认见语义说明 | 只控制当前组件中这一次字段绑定的展示格式 |

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

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6d61746368"></a>

### `@fieldBinding · anyOf[1].match`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/match`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["field","equals"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 按声明维度等值选择行。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6d617463682f70726f706572746965732f6669656c64"></a>

### `@fieldBinding · anyOf[1].match.field`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/match/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6442696e64696e672f616e794f662f312f70726f706572746965732f6d617463682f70726f706572746965732f657175616c73"></a>

### `@fieldBinding · anyOf[1].match.equals`

Schema位置：`#/definitions/fieldBinding/anyOf/1/properties/match/properties/equals`。目标：[#/definitions/scalar](fields.md#schema-232f646566696e6974696f6e732f7363616c6172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/scalar | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显式相等匹配值。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e6365"></a>

### `@fieldReference`

Schema位置：`#/definitions/fieldReference`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e63652f616e794f662f30"></a>

### `@fieldReference · anyOf[0]`

Schema位置：`#/definitions/fieldReference/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e63652f616e794f662f31"></a>

### `@fieldReference · anyOf[1]`

Schema位置：`#/definitions/fieldReference/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["data","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e63652f616e794f662f312f70726f706572746965732f64617461"></a>

### `@fieldReference · anyOf[1].data`

Schema位置：`#/definitions/fieldReference/anyOf/1/properties/data`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6669656c645265666572656e63652f616e794f662f312f70726f706572746965732f6669656c64"></a>

### `@fieldReference · anyOf[1].field`

Schema位置：`#/definitions/fieldReference/anyOf/1/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d61696e44617461"></a>

### `@mainData`

Schema位置：`#/definitions/mainData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["main"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d61696e446174612f70726f706572746965732f6d61696e"></a>

### `@mainData.main`

Schema位置：`#/definitions/mainData/properties/main`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 主数据槽，值引用已声明页面数据源。 |

<a id="schema-232f646566696e6974696f6e732f7461626c6544617461"></a>

### `@tableData`

Schema位置：`#/definitions/tableData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1; required=["main"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65446174612f6164646974696f6e616c50726f70657274696573"></a>

### `@tableData{key}`

Schema位置：`#/definitions/tableData/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 动态键的值 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65446174612f70726f70657274794e616d6573"></a>

### `@tableData · propertyNames`

Schema位置：`#/definitions/tableData/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](errors/data-slot-unknown-source.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](errors/field-binding-undeclared-slot.json)、[unknown-component-field](errors/unknown-component-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](errors/field-binding-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](errors/match-field-unknown.json)、[match-field-not-dimension](errors/match-field-not-dimension.json)、[match-value-type-mismatch](errors/match-value-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [compute-page](examples/compute-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/primitives.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/fieldBinding/anyOf/0`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/sections/0/components/0/props/categoryField`。
- `#/definitions/fieldBinding/anyOf/1`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/sections/0/components/0/props/rows/0/valueField`。
- `#/definitions/fieldReference/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/2/props/actions/0/field`。
- `#/definitions/fieldReference/anyOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/1/props/actions/0/field`。
