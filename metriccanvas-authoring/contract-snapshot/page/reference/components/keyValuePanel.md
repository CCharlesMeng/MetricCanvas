# 信息面板 keyValuePanel

把一条记录的若干字段按「标签：取值」逐项列出。适用于详情页的基本信息区：字段各不相同、每个字段只有一个取值、不需要逐行核对、需要逐行核对或排序时改用明细表。数据形状：单行记录；每项绑定一个 dimension 或 measure 字段。

有序键值项每项声明label及字段绑定；布局variant改变排列，不改变取数口径。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.5。结构真源为本册[schema.json](../schema.json)，SHA256 `74d191638111da2be8353b210093f832ed2babed21b3e93cacd8a41b996f17c0`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e74"></a>

### `@keyValuePanelComponent`

Schema位置：`#/definitions/keyValuePanelComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@keyValuePanelComponent.id`

Schema位置：`#/definitions/keyValuePanelComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@keyValuePanelComponent.type`

Schema位置：`#/definitions/keyValuePanelComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="keyValuePanel" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "keyValuePanel" | 用于选择@keyValuePanelComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@keyValuePanelComponent.layout`

Schema位置：`#/definitions/keyValuePanelComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@keyValuePanelComponent.data`

Schema位置：`#/definitions/keyValuePanelComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@keyValuePanelComponent.props`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["items"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@keyValuePanelComponent.props.title`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@keyValuePanelComponent.props.title · allOf[0]`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c6549636f6e"></a>

### `@keyValuePanelComponent.props.titleIcon`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/titleIcon`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="reward" | Schema未设默认；装配/运行时默认见语义说明 | 标题前受控图标。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "reward" | 用于选择@keyValuePanelComponent.props.titleIcon分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@keyValuePanelComponent.props.variant`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["counterStrip","detailSummary","detailNormMatrix"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "counterStrip" | 计数器横条呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "detailSummary" | 明细摘要呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "detailNormMatrix" | 明细规范矩阵呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e73"></a>

### `@keyValuePanelComponent.props.columns`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/columns`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 列或透视输出列的有序声明，按所属分支解释。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e732f616e794f662f30"></a>

### `@keyValuePanelComponent.props.columns · anyOf[0]`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | const=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| 1 | 用于选择@keyValuePanelComponent.props.columns · anyOf[0]分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e732f616e794f662f31"></a>

### `@keyValuePanelComponent.props.columns · anyOf[1]`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | const=2 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| 2 | 用于选择@keyValuePanelComponent.props.columns · anyOf[1]分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e732f616e794f662f32"></a>

### `@keyValuePanelComponent.props.columns · anyOf[2]`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | const=3 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| 3 | 用于选择@keyValuePanelComponent.props.columns · anyOf[2]分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e732f616e794f662f33"></a>

### `@keyValuePanelComponent.props.columns · anyOf[3]`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/3`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | const=4 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| 4 | 用于选择@keyValuePanelComponent.props.columns · anyOf[3]分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e732f616e794f662f34"></a>

### `@keyValuePanelComponent.props.columns · anyOf[4]`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/4`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 独立分支（不合并required） | const=6 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| 6 | 用于选择@keyValuePanelComponent.props.columns · anyOf[4]分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6974656d73"></a>

### `@keyValuePanelComponent.props.items`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 数组/嵌套明细项的契约。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6974656d732f6974656d73"></a>

### `@keyValuePanelComponent.props.items[]`

Schema位置：`#/definitions/keyValuePanelComponent/properties/props/properties/items/items`。目标：[#/definitions/keyValueItem](../components/keyValuePanel.md#schema-232f646566696e6974696f6e732f6b657956616c75654974656d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/keyValueItem | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c75654974656d"></a>

### `@keyValueItem`

Schema位置：`#/definitions/keyValueItem`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c75654974656d2f70726f706572746965732f6c6162656c"></a>

### `@keyValueItem.label`

Schema位置：`#/definitions/keyValueItem/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c75654974656d2f70726f706572746965732f6669656c64"></a>

### `@keyValueItem.field`

Schema位置：`#/definitions/keyValueItem/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c75654974656d2f70726f706572746965732f756e6974"></a>

### `@keyValueItem.unit`

Schema位置：`#/definitions/keyValueItem/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c75654974656d2f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@keyValueItem.unit · allOf[0]`

Schema位置：`#/definitions/keyValueItem/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6b657956616c75654974656d2f70726f706572746965732f69636f6e"></a>

### `@keyValueItem.icon`

Schema位置：`#/definitions/keyValueItem/properties/icon`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["goldMedal","silverMedal","redCard","yellowCard"] | Schema未设默认；装配/运行时默认见语义说明 | 受控图标标识。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "goldMedal" | 金牌呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "silverMedal" | 银牌呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "redCard" | 红牌呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "yellowCard" | 黄牌呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

## 语义规则与反例（生成）

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-keyValuePanel.json)：独立完整页面，保留必要语义依赖。
- [counterStrip](../examples/component-keyValuePanel-counterStrip.json)：独立完整页面，保留必要语义依赖。
- [detailSummary](../examples/component-keyValuePanel-detailSummary.json)：独立完整页面，保留必要语义依赖。
- [detailNormMatrix](../examples/component-keyValuePanel-detailNormMatrix.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](../examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-keyValuePanel.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "single-panel",
  "type": "keyValuePanel",
  "layout": {
    "span": 1
  },
  "data": {
    "main": "summary"
  },
  "props": {
    "columns": 1,
    "items": [
      {
        "label": "负责人",
        "field": "owner"
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/key-value-panel.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/0`：[合法完整页面](../examples/component-keyValuePanel.json)，JSON Pointer `#/sections/0/components/0/props/columns`。
- `#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/1`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/7/props/columns`。
- `#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/2`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/8/props/columns`。
- `#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/3`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/9/props/columns`。
- `#/definitions/keyValuePanelComponent/properties/props/properties/columns/anyOf/4`：[合法完整页面](../examples/component-compositeCard.json)，JSON Pointer `#/sections/0/components/0/props/components/3/props/columns`。
