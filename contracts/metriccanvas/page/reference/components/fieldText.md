# 字段长文本 fieldText

把数据源里的一段长文本按段落呈现，标题写在组件上。适用于项目背景、项目风险、会议结论这类整段来自数据字段的文本、正文是页面文档里写死的静态说明时改用 text 组件。数据形状：单行记录；绑定一个 string 字段，或一个 semanticHtml/detail 字段。

从已声明数据字段取得文本，和页面参数文本取值分属不同来源。不得把一段静态文本假装成动态字段。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.6。结构真源为本册[schema.json](../schema.json)，SHA256 `a421c583a35d98c6d01d1a47965f13984e4d6ec1aab62779b4d5ec78b7c8cf8f`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e74"></a>

### `@fieldTextComponent`

Schema位置：`#/definitions/fieldTextComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@fieldTextComponent.id`

Schema位置：`#/definitions/fieldTextComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@fieldTextComponent.type`

Schema位置：`#/definitions/fieldTextComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="fieldText" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "fieldText" | 用于选择@fieldTextComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@fieldTextComponent.layout`

Schema位置：`#/definitions/fieldTextComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@fieldTextComponent.data`

Schema位置：`#/definitions/fieldTextComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@fieldTextComponent.props`

Schema位置：`#/definitions/fieldTextComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@fieldTextComponent.props.title`

Schema位置：`#/definitions/fieldTextComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@fieldTextComponent.props.title · allOf[0]`

Schema位置：`#/definitions/fieldTextComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6669656c64"></a>

### `@fieldTextComponent.props.field`

Schema位置：`#/definitions/fieldTextComponent/properties/props/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@fieldTextComponent.props.variant`

Schema位置：`#/definitions/fieldTextComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["plain","quote","narrativeShort","narrativeMeeting","narrativeRisk","narrativeProgress"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "plain" | 普通呈现；分区为无额外容器，文本/单元格按各模块普通样式解释。 |
| "quote" | 引用文字呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "narrativeShort" | 短叙述呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "narrativeMeeting" | 会议叙述呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "narrativeRisk" | 风险叙述呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "narrativeProgress" | 进展叙述呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

## 语义规则与反例（生成）

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-fieldText.json)：独立完整页面，保留必要语义依赖。
- [plain](../examples/component-fieldText-plain.json)：独立完整页面，保留必要语义依赖。
- [quote](../examples/component-fieldText-quote.json)：独立完整页面，保留必要语义依赖。
- [narrativeShort](../examples/component-fieldText-narrativeShort.json)：独立完整页面，保留必要语义依赖。
- [narrativeMeeting](../examples/component-fieldText-narrativeMeeting.json)：独立完整页面，保留必要语义依赖。
- [narrativeRisk](../examples/component-fieldText-narrativeRisk.json)：独立完整页面，保留必要语义依赖。
- [narrativeProgress](../examples/component-fieldText-narrativeProgress.json)：独立完整页面，保留必要语义依赖。
- [compute-page](../examples/compute-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-fieldText.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "note-text",
  "type": "fieldText",
  "layout": {
    "span": 12
  },
  "data": {
    "main": "notes"
  },
  "props": {
    "field": "body",
    "variant": "quote"
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/field-text.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

