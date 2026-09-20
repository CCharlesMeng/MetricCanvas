# 交互与导航

受控action支持写筛选与导航。writeFilter目标须存在且类型匹配；表格selection只把受控字段/固定值映射到允许目标。URL导航使用目标页面公开参数名，保留标准anchor能力，宿主可选择接管。

表格列selection与link同时存在时selection优先。行导航只在声明的入口列触发。当前页字段、目标页面参数和筛选器id不能靠同名猜映射。文本链接与普通URL不开放脚本执行。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 当前内容工具边界

#137只开放add/update/remove_dimension_filter、set/remove_table_link五项原子操作。筛选声明和完整绑定集合一起修改；仅现有DQE dimension queryField，不改原查询body/order/initial，也不借此创建params、initialParam、paramBindings或层级筛选。悬空级联、参数或导航引用阻止删除。

表格链接可定位Tab子树/分组列；必须显式给出安全href及非空row/param/filter映射。selection抢占、多navigate歧义或共享目标不一致会拒绝；删除最后链接时清导航并保留其它动作。它不是通用actions或表头筛选编辑器。

`t11-evidence.md`记录两形态真实Chrome→createDqeGateway→本地HTTP，选择/清空raw_region、未绑定表格保留，以及真实anchor跳转携row/param/filter/fixed/hash。实际外部DQE、权限及目标业务页仍待独立联调。源码定位：`metriccanvas-authoring/tool/metriccanvas_authoring/domain/interaction_editing.py`、`page_editing.py`，公开回归`test_content_interactions.py`。


页面协议 6.6。结构真源为本册[schema.json](schema.json)，SHA256 `724a223b61ed116ed3a542b273a0235b6778f87196f289a2a19d1c9feb5a24e7`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f616374696f6e73"></a>

### `@actions`

Schema位置：`#/definitions/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 类型/分支 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616374696f6e732f6974656d73"></a>

### `@actions[]`

Schema位置：`#/definitions/actions/items`。目标：[#/definitions/componentAction](actions-and-navigation.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentAction | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e"></a>

### `@componentAction`

Schema位置：`#/definitions/componentAction`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f30"></a>

### `@componentAction · anyOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["on","writeFilter","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f70726f706572746965732f6f6e"></a>

### `@componentAction · anyOf[0].on`

Schema位置：`#/definitions/componentAction/anyOf/0/properties/on`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="click" | Schema未设默认；装配/运行时默认见语义说明 | 触发动作的受控事件。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "click" | 用于选择@componentAction · anyOf[0].on分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f70726f706572746965732f777269746546696c746572"></a>

### `@componentAction · anyOf[0].writeFilter`

Schema位置：`#/definitions/componentAction/anyOf/0/properties/writeFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 写入已声明dimension筛选器。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@componentAction · anyOf[0].field`

Schema位置：`#/definitions/componentAction/anyOf/0/properties/field`。目标：[#/definitions/fieldReference](field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f31"></a>

### `@componentAction · anyOf[1]`

Schema位置：`#/definitions/componentAction/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["on","navigate"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6f6e"></a>

### `@componentAction · anyOf[1].on`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/on`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="click" | Schema未设默认；装配/运行时默认见语义说明 | 触发动作的受控事件。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "click" | 用于选择@componentAction · anyOf[1].on分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e61766967617465"></a>

### `@componentAction · anyOf[1].navigate`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["href"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 受控URL与参数来源映射。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f68726566"></a>

### `@componentAction · anyOf[1].navigate.href`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/href`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 目标URL，必须通过安全协议及结构检查。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f7175657279"></a>

### `@componentAction · anyOf[1].navigate.query`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 受控查询定义，或导航URL参数映射，按所属结构判别。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f70657274696573"></a>

### `@componentAction · anyOf[1].navigate.query{key}`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f30"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[0]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[0].source`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/0/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="row" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "row" | 用于选择@componentAction · anyOf[1].navigate.query{key} · oneOf[0].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f302f70726f706572746965732f6669656c64"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[0].field`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/0/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f31"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[1]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[1].source`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/1/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="param" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "param" | 用于选择@componentAction · anyOf[1].navigate.query{key} · oneOf[1].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f312f70726f706572746965732f6964"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[1].id`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f32"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[2]`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["source","id"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f736f75726365"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[2].source`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="filter" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "filter" | 用于选择@componentAction · anyOf[1].navigate.query{key} · oneOf[2].source分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f6964"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[2].id`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f6164646974696f6e616c50726f706572746965732f6f6e654f662f322f70726f706572746965732f70617274"></a>

### `@componentAction · anyOf[1].navigate.query{key} · oneOf[2].part`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["value","from","to","level"] | Schema未设默认；装配/运行时默认见语义说明 | 导航取筛选值的value/from/to/level部分。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "value" | 普通单值/多值输入部分。 |
| "from" | 范围起点部分。 |
| "to" | 范围终点部分。 |
| "level" | 层级维度的层级部分。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e2f616e794f662f312f70726f706572746965732f6e617669676174652f70726f706572746965732f71756572792f70726f70657274794e616d6573"></a>

### `@componentAction · anyOf[1].navigate.query · propertyNames`

Schema位置：`#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `url-navigation-source-contract`：URL 与来源绑定可校验，目标存在性与必填项由目标负责。反例：[navigation-invalid-authority](errors/navigation-invalid-authority.json)、[navigation-invalid-port](errors/navigation-invalid-port.json)、[navigation-scheme-without-authority](errors/navigation-scheme-without-authority.json)、[navigation-unsafe-url](errors/navigation-unsafe-url.json)、[navigation-missing-row-field](errors/navigation-missing-row-field.json)、[navigation-unknown-param](errors/navigation-unknown-param.json)、[navigation-wrong-filter-part](errors/navigation-wrong-filter-part.json)、[navigation-text-row-source](errors/navigation-text-row-source.json)、[navigation-text-unsafe-url](errors/navigation-text-unsafe-url.json)、[navigation-url-input-collision](errors/navigation-url-input-collision.json)、[navigation-url-input-wrong-part](errors/navigation-url-input-wrong-part.json)、[navigation-clicked-slot-missing-field](errors/navigation-clicked-slot-missing-field.json)、[navigation-legacy-target-rejected](errors/navigation-legacy-target-rejected.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `metric-row-link-needs-navigate`：指标行声明 link 时组件必须至少有一个 navigate 动作。反例：[metric-row-link-without-navigate](errors/metric-row-link-without-navigate.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `actions-live-only`：writeFilter 只允许绑定 query 数据源的组件。反例：[write-filter-on-inline-component](errors/write-filter-on-inline-component.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `write-filter-target`：回写目标是已声明的 dimension 筛选器。反例：[write-filter-undeclared](errors/write-filter-undeclared.json)、[write-filter-non-dimension](errors/write-filter-non-dimension.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `navigation-filter-source`：导航绑定只能引用已声明的筛选器。反例：[navigation-filter-undeclared](errors/navigation-filter-undeclared.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [url-navigation-page](examples/url-navigation-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/actions.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/componentAction/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/1/props/actions/0`。
- `#/definitions/componentAction/anyOf/1`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0/props/actions/0`。
- `#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/0`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/sections/0/components/0/props/actions/1/navigate/query/city`。
- `#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/1`：[合法完整页面](examples/url-navigation-page.json)，JSON Pointer `#/sections/0/components/0/props/actions/0/navigate/query/project`。
- `#/definitions/componentAction/anyOf/1/properties/navigate/properties/query/additionalProperties/oneOf/2`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0/props/actions/0/navigate/query/area`。
