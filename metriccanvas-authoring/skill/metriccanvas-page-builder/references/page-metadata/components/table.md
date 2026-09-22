# 明细表 table

展示需要逐行核对、排序、筛选或通过单元格选择联动明细的记录。适用于明细、列表、字段较多、需要精确值、多级表头、选择一行联动下方明细。数据形状：一个或多个 dimension/metric 字段组成的多行记录。

columns区分普通字段列和kind:group递归列，分组列children保持层级。query分页使用服务总条数，排序/表头筛选能力不能绕过现有查询分页限制。selection优先于link；主/次/徽标字段各自声明，不靠字符串拼接。派生行样式按rowKindField解释，不靠单元格文案识别合计。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.11。结构真源为本册[schema.json](../schema.json)，SHA256 `508780df9e2561af9705f7ed2b0d07038e8f2d97027d66f0ae69b5a02a6cb75e`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74"></a>

### `@tableComponent`

Schema位置：`#/definitions/tableComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@tableComponent.id`

Schema位置：`#/definitions/tableComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@tableComponent.type`

Schema位置：`#/definitions/tableComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="table" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "table" | 用于选择@tableComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@tableComponent.layout`

Schema位置：`#/definitions/tableComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@tableComponent.data`

Schema位置：`#/definitions/tableComponent/properties/data`。目标：[#/definitions/tableData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f7461626c6544617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@tableComponent.props`

Schema位置：`#/definitions/tableComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["columns"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@tableComponent.props.title`

Schema位置：`#/definitions/tableComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@tableComponent.props.title · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7375627469746c65"></a>

### `@tableComponent.props.subtitle`

Schema位置：`#/definitions/tableComponent/properties/props/properties/subtitle`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 副标题文本取值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7375627469746c652f616c6c4f662f30"></a>

### `@tableComponent.props.subtitle · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/subtitle/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@tableComponent.props.variant`

Schema位置：`#/definitions/tableComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["reportCompact","embedded","forecastMatrix"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "reportCompact" | 紧凑报告呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "embedded" | 嵌入式内容呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "forecastMatrix" | 预测矩阵呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f626f74746f6d46616465"></a>

### `@tableComponent.props.bottomFade`

Schema位置：`#/definitions/tableComponent/properties/props/properties/bottomFade`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否使用底部渐隐呈现。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6d706f756e6443656c6c4c61796f7574"></a>

### `@tableComponent.props.compoundCellLayout`

Schema位置：`#/definitions/tableComponent/properties/props/properties/compoundCellLayout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="inline" | Schema未设默认；装配/运行时默认见语义说明 | 复合单元格的受控排列方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "inline" | 用于选择@tableComponent.props.compoundCellLayout分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774b6579"></a>

### `@tableComponent.props.rowKey`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowKey`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 多数据槽对齐的维度键，各槽字段类型须一致。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f774b696e644669656c64"></a>

### `@tableComponent.props.rowKindField`

Schema位置：`#/definitions/tableComponent/properties/props/properties/rowKindField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 表格读取的行类别字段，必须由折叠算子写入。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d657267654279"></a>

### `@tableComponent.props.mergeBy`

Schema位置：`#/definitions/tableComponent/properties/props/properties/mergeBy`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 表格合并分组字段，必须是已声明列。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f666974"></a>

### `@tableComponent.props.fit`

Schema位置：`#/definitions/tableComponent/properties/props/properties/fit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["content","container"] | Schema未设默认；装配/运行时默认见语义说明 | 受控适配方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "content" | 正常内容层。 |
| "container" | 当前容器作为交互/呈现作用域。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e73"></a>

### `@tableComponent.props.columns`

Schema位置：`#/definitions/tableComponent/properties/props/properties/columns`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 列或透视输出列的有序声明，按所属分支解释。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e732f6974656d73"></a>

### `@tableComponent.props.columns[]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/columns/items`。目标：[#/definitions/tableColumnNode](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f6465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumnNode | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f6465"></a>

### `@tableColumnNode`

Schema位置：`#/definitions/tableColumnNode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f64652f616e794f662f30"></a>

### `@tableColumnNode · anyOf[0]`

Schema位置：`#/definitions/tableColumnNode/anyOf/0`。目标：[#/definitions/tableColumn](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumn | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e"></a>

### `@tableColumn`

Schema位置：`#/definitions/tableColumn`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6b696e64"></a>

### `@tableColumn.kind`

Schema位置：`#/definitions/tableColumn/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="field" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "field" | 用于选择@tableColumn.kind分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6669656c64"></a>

### `@tableColumn.field`

Schema位置：`#/definitions/tableColumn/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7365636f6e646172794669656c64"></a>

### `@tableColumn.secondaryField`

Schema位置：`#/definitions/tableColumn/properties/secondaryField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 次要信息字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7365636f6e646172794669656c642f616c6c4f662f30"></a>

### `@tableColumn.secondaryField · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/secondaryField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f62616467654669656c64"></a>

### `@tableColumn.badgeField`

Schema位置：`#/definitions/tableColumn/properties/badgeField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 徽标内容绑定字段。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f62616467654669656c642f616c6c4f662f30"></a>

### `@tableColumn.badgeField · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/badgeField/allOf/0`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f64616e67657256616c756573"></a>

### `@tableColumn.dangerValues`

Schema位置：`#/definitions/tableColumn/properties/dangerValues`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 应使用异常语义的有限取值集合。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f64616e67657256616c7565732f6974656d73"></a>

### `@tableColumn.dangerValues[]`

Schema位置：`#/definitions/tableColumn/properties/dangerValues/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e"></a>

### `@tableColumn.selection`

Schema位置：`#/definitions/tableColumn/properties/selection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["writes"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 单元格选择写回，优先于同列link。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f777269746573"></a>

### `@tableColumn.selection.writes`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 选择写回的目标与字段/固定值映射。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f70657274696573"></a>

### `@tableColumn.selection.writes{key}`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f30"></a>

### `@tableColumn.selection.writes{key} · anyOf[0]`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f302f70726f706572746965732f6669656c64"></a>

### `@tableColumn.selection.writes{key} · anyOf[0].field`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/0/properties/field`。目标：[#/definitions/fieldReference](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c645265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldReference | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f31"></a>

### `@tableColumn.selection.writes{key} · anyOf[1]`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f6164646974696f6e616c50726f706572746965732f616e794f662f312f70726f706572746965732f76616c7565"></a>

### `@tableColumn.selection.writes{key} · anyOf[1].value`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/1/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7772697465732f70726f70657274794e616d6573"></a>

### `@tableColumn.selection.writes · propertyNames`

Schema位置：`#/definitions/tableColumn/properties/selection/properties/writes/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7469746c65"></a>

### `@tableColumn.title`

Schema位置：`#/definitions/tableColumn/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@tableColumn.title · allOf[0]`

Schema位置：`#/definitions/tableColumn/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f7769647468"></a>

### `@tableColumn.width`

Schema位置：`#/definitions/tableColumn/properties/width`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支可选 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 受控列宽数值。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6669786564"></a>

### `@tableColumn.fixed`

Schema位置：`#/definitions/tableColumn/properties/fixed`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["left","right"] | Schema未设默认；装配/运行时默认见语义说明 | 表格固定列位置。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |
| "right" | 右对齐或右侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f736f727461626c65"></a>

### `@tableColumn.sortable`

Schema位置：`#/definitions/tableColumn/properties/sortable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 本列是否开放排序，查询分页仍受能力限制。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c65"></a>

### `@tableColumn.filterable`

Schema位置：`#/definitions/tableColumn/properties/filterable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 表头筛选能力，仅允许适用的维度列。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f66696c74657261626c652f70726f706572746965732f6d6f6465"></a>

### `@tableColumn.filterable.mode`

Schema位置：`#/definitions/tableColumn/properties/filterable/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["select","dateRange"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "select" | 下拉候选选择。 |
| "dateRange" | 日期范围筛选控件。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f6c696e6b"></a>

### `@tableColumn.link`

Schema位置：`#/definitions/tableColumn/properties/link`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 把当前列/指标行作为导航入口，需对应navigate。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f616c69676e"></a>

### `@tableColumn.align`

Schema位置：`#/definitions/tableColumn/properties/align`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["left","right"] | Schema未设默认；装配/运行时默认见语义说明 | 所在列或文本的对齐方向。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "left" | 左对齐或左侧固定，由字段位置决定。 |
| "right" | 右对齐或右侧固定，由字段位置决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f656d706861736973"></a>

### `@tableColumn.emphasis`

Schema位置：`#/definitions/tableColumn/properties/emphasis`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="strong" | Schema未设默认；装配/运行时默认见语义说明 | 强调样式，不改变数值或角色。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "strong" | 用于选择@tableColumn.emphasis分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e2f70726f706572746965732f76697375616c"></a>

### `@tableColumn.visual`

Schema位置：`#/definitions/tableColumn/properties/visual`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["plain","rateBar","signed"] | Schema未设默认；装配/运行时默认见语义说明 | 单元格或数值的受控视觉语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "plain" | 普通呈现；分区为无额外容器，文本/单元格按各模块普通样式解释。 |
| "rateBar" | 在单元格内用比例条呈现。 |
| "signed" | 显示正负语义的数值呈现。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f64652f616e794f662f31"></a>

### `@tableColumnNode · anyOf[1]`

Schema位置：`#/definitions/tableColumnNode/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f64652f616e794f662f312f616c6c4f662f30"></a>

### `@tableColumnNode · anyOf[1] · allOf[0]`

Schema位置：`#/definitions/tableColumnNode/anyOf/1/allOf/0`。目标：[#/definitions/tableColumnGroup](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f7570)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumnGroup | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f7570"></a>

### `@tableColumnGroup`

Schema位置：`#/definitions/tableColumnGroup`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["kind","id","title","children"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f6b696e64"></a>

### `@tableColumnGroup.kind`

Schema位置：`#/definitions/tableColumnGroup/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="group" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "group" | 用于选择@tableColumnGroup.kind分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f6964"></a>

### `@tableColumnGroup.id`

Schema位置：`#/definitions/tableColumnGroup/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f7469746c65"></a>

### `@tableColumnGroup.title`

Schema位置：`#/definitions/tableColumnGroup/properties/title`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f6368696c6472656e"></a>

### `@tableColumnGroup.children`

Schema位置：`#/definitions/tableColumnGroup/properties/children`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 递归列组或受控子结构的子项。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e47726f75702f70726f706572746965732f6368696c6472656e2f6974656d73"></a>

### `@tableColumnGroup.children[]`

Schema位置：`#/definitions/tableColumnGroup/properties/children/items`。目标：[#/definitions/tableColumnNode](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6c756d6e4e6f6465)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableColumnNode | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e"></a>

### `@tableComponent.props.pagination`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 分页来源与大小配置；query与local条件不同。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f30"></a>

### `@tableComponent.props.pagination · oneOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f302f70726f706572746965732f6d6f6465"></a>

### `@tableComponent.props.pagination · oneOf[0].mode`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/0/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="none" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "none" | 用于选择@tableComponent.props.pagination · oneOf[0].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f31"></a>

### `@tableComponent.props.pagination · oneOf[1]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode","pageSize"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f6d6f6465"></a>

### `@tableComponent.props.pagination · oneOf[1].mode`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="local" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "local" | 用于选择@tableComponent.props.pagination · oneOf[1].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f7061676553697a65"></a>

### `@tableComponent.props.pagination · oneOf[1].pageSize`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1/properties/pageSize`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 分页每页条数。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f312f70726f706572746965732f6e756d6265726564"></a>

### `@tableComponent.props.pagination · oneOf[1].numbered`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1/properties/numbered`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显示序号。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f32"></a>

### `@tableComponent.props.pagination · oneOf[2]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706167696e6174696f6e2f6f6e654f662f322f70726f706572746965732f6d6f6465"></a>

### `@tableComponent.props.pagination · oneOf[2].mode`

Schema位置：`#/definitions/tableComponent/properties/props/properties/pagination/oneOf/2/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="query" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "query" | 用于选择@tableComponent.props.pagination · oneOf[2].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e73"></a>

### `@tableComponent.props.actions`

Schema位置：`#/definitions/tableComponent/properties/props/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@tableComponent.props.actions · allOf[0]`

Schema位置：`#/definitions/tableComponent/properties/props/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `table-row-key`：多数据槽表格必须声明各槽都有且类型一致的 dimension rowKey。反例：[table-multi-slot-without-row-key](../errors/table-multi-slot-without-row-key.json)、[table-row-key-missing-in-slot](../errors/table-row-key-missing-in-slot.json)、[table-row-key-not-dimension](../errors/table-row-key-not-dimension.json)、[table-row-key-type-inconsistent](../errors/table-row-key-type-inconsistent.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-row-kind-field`：表格行类别字段必须存在且由该数据源的折叠算子写入。反例：[table-row-kind-field-unknown](../errors/table-row-kind-field-unknown.json)、[table-row-kind-field-not-written](../errors/table-row-kind-field-not-written.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-merge-by-column`：mergeBy 必须是表格已声明的列字段。反例：[table-merge-by-not-column](../errors/table-merge-by-not-column.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-selection-writes`：单元格选择只能写入已声明的 dimension 筛选器。反例：[table-selection-writes-unknown-filter](../errors/table-selection-writes-unknown-filter.json)、[table-selection-writes-non-dimension](../errors/table-selection-writes-non-dimension.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-column-binding-unique`：表格列字段绑定不重复。反例：[table-duplicate-column-binding](../errors/table-duplicate-column-binding.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `table-filterable-dimension`：表头筛选只能声明在 dimension 列上。反例：[table-filterable-on-measure](../errors/table-filterable-on-measure.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-local-inline`：pagination.mode='local' 只允许绑定 inline 数据源。反例：[pagination-local-on-query](../errors/pagination-local-on-query.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-query-source`：pagination.mode='query' 只允许绑定 query 数据源。反例：[pagination-query-on-inline](../errors/pagination-query-on-inline.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-query-order`：查询分页要求 DQE order.offset 为 0 且 limit 为正整数。反例：[pagination-offset-not-zero](../errors/pagination-offset-not-zero.json)、[pagination-limit-not-positive](../errors/pagination-limit-not-positive.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-initial-rows`：查询分页的内嵌初始行必须声明 totalCount 且是完整第一页。反例：[pagination-initial-without-total-count](../errors/pagination-initial-without-total-count.json)、[pagination-initial-not-full-page](../errors/pagination-initial-not-full-page.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `pagination-exclusive-source`：查询分页表格必须独占页面数据源。反例：[pagination-shared-source](../errors/pagination-shared-source.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-table.json)：独立完整页面，保留必要语义依赖。
- [reportCompact](../examples/component-table-reportCompact.json)：独立完整页面，保留必要语义依赖。
- [embedded](../examples/component-table-embedded.json)：独立完整页面，保留必要语义依赖。
- [forecastMatrix](../examples/component-table-forecastMatrix.json)：独立完整页面，保留必要语义依赖。
- [query-dashboard](../examples/query-dashboard.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](../examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-table.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "top-table",
  "type": "table",
  "layout": {
    "span": 12
  },
  "data": {
    "main": "top"
  },
  "props": {
    "variant": "embedded",
    "bottomFade": true,
    "columns": [
      {
        "field": "name"
      },
      {
        "field": "value"
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/table.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/tableColumnNode/anyOf/0`：[合法完整页面](../examples/component-table.json)，JSON Pointer `#/sections/0/components/0/props/columns/0`。
- `#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/0`：[合法完整页面](../examples/filters-page.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/selection/writes/region`。
- `#/definitions/tableColumn/properties/selection/properties/writes/additionalProperties/anyOf/1`：[合法完整页面](../examples/filters-page.json)，JSON Pointer `#/sections/0/components/0/props/columns/0/selection/writes/city`。
- `#/definitions/tableColumnNode/anyOf/1`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/5/props/columns/0`。
- `#/definitions/tableComponent/properties/props/properties/pagination/oneOf/0`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/5/props/pagination`。
- `#/definitions/tableComponent/properties/props/properties/pagination/oneOf/1`：[合法完整页面](../examples/component-tabContainer.json)，JSON Pointer `#/sections/0/components/0/props/tabs/1/components/0/props/pagination`。
- `#/definitions/tableComponent/properties/props/properties/pagination/oneOf/2`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/1/props/pagination`。
