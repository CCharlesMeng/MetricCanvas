# AI 总结 aiSummary

仅在需求明确声明时，基于关联数据通过 SSE 流式生成 AI 总结。适用于需求明确声明运行时 SSE 动态生成；仅有摘要标题、数据或 AI 文案不得推断为 aiSummary。数据形状：不声明数据槽；relatedData 显式引用页面数据源字段。

动态总结只消费relatedData白名单字段和promptTemplate；运行时SSE需要可信宿主配置，创作时不调用总结服务。页面不能自行指定服务地址。无配置、错误或空响应按运行时状态处理。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.8。结构真源为本册[schema.json](../schema.json)，SHA256 `78606c1cea35ee7975d7a8cbd3349f71ee2fb271fb38fdfce399ea10432e83f4`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e74"></a>

### `@aiSummaryComponent`

Schema位置：`#/definitions/aiSummaryComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@aiSummaryComponent.id`

Schema位置：`#/definitions/aiSummaryComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@aiSummaryComponent.type`

Schema位置：`#/definitions/aiSummaryComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="aiSummary" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "aiSummary" | 用于选择@aiSummaryComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@aiSummaryComponent.layout`

Schema位置：`#/definitions/aiSummaryComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@aiSummaryComponent.props`

Schema位置：`#/definitions/aiSummaryComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["promptTemplate","relatedData"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@aiSummaryComponent.props.title`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@aiSummaryComponent.props.title · allOf[0]`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@aiSummaryComponent.props.variant`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="reportInline" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "reportInline" | 报告行内呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f6d707454656d706c617465"></a>

### `@aiSummaryComponent.props.promptTemplate`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/promptTemplate`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1; pattern="\\S" | Schema未设默认；装配/运行时默认见语义说明 | 动态总结提示模板；字段数据受relatedData白名单约束。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656444617461"></a>

### `@aiSummaryComponent.props.relatedData`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 动态总结允许读取的数据源/字段集合。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c61746564446174612f6164646974696f6e616c50726f70657274696573"></a>

### `@aiSummaryComponent.props.relatedData{key}`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedData/additionalProperties`。目标：[#/definitions/aiSummaryRelatedDataDefinition](../components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d61727952656c6174656444617461446566696e6974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryRelatedDataDefinition | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727952656c6174656444617461446566696e6974696f6e"></a>

### `@aiSummaryRelatedDataDefinition`

Schema位置：`#/definitions/aiSummaryRelatedDataDefinition`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["source","description","fields"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727952656c6174656444617461446566696e6974696f6e2f70726f706572746965732f736f75726365"></a>

### `@aiSummaryRelatedDataDefinition.source`

Schema位置：`#/definitions/aiSummaryRelatedDataDefinition/properties/source`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 此处声明的数据来源，分支由type选择。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727952656c6174656444617461446566696e6974696f6e2f70726f706572746965732f6465736372697074696f6e"></a>

### `@aiSummaryRelatedDataDefinition.description`

Schema位置：`#/definitions/aiSummaryRelatedDataDefinition/properties/description`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1; pattern="\\S" | Schema未设默认；装配/运行时默认见语义说明 | 说明文本。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727952656c6174656444617461446566696e6974696f6e2f70726f706572746965732f6669656c6473"></a>

### `@aiSummaryRelatedDataDefinition.fields`

Schema位置：`#/definitions/aiSummaryRelatedDataDefinition/properties/fields`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结果字段契约；对象键就是页面字段id。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727952656c6174656444617461446566696e6974696f6e2f70726f706572746965732f6669656c64732f6974656d73"></a>

### `@aiSummaryRelatedDataDefinition.fields[]`

Schema位置：`#/definitions/aiSummaryRelatedDataDefinition/properties/fields/items`。目标：[#/definitions/aiSummaryRelatedField](../components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d61727952656c617465644669656c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryRelatedField | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727952656c617465644669656c64"></a>

### `@aiSummaryRelatedField`

Schema位置：`#/definitions/aiSummaryRelatedField`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["field","term"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727952656c617465644669656c642f70726f706572746965732f6669656c64"></a>

### `@aiSummaryRelatedField.field`

Schema位置：`#/definitions/aiSummaryRelatedField/properties/field`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727952656c617465644669656c642f70726f706572746965732f7465726d"></a>

### `@aiSummaryRelatedField.term`

Schema位置：`#/definitions/aiSummaryRelatedField/properties/term`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1; pattern="\\S" | Schema未设默认；装配/运行时默认见语义说明 | 关联字段对应的业务术语。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c61746564446174612f70726f70657274794e616d6573"></a>

### `@aiSummaryComponent.props.relatedData · propertyNames`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedData/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `ai-summary-related-data`：AI 总结关联数据引用已声明数据源中的非明细字段，不重复且术语一致。反例：[ai-summary-unknown-source](../errors/ai-summary-unknown-source.json)、[ai-summary-unknown-field](../errors/ai-summary-unknown-field.json)、[ai-summary-detail-field](../errors/ai-summary-detail-field.json)、[ai-summary-duplicate-field](../errors/ai-summary-duplicate-field.json)、[ai-summary-term-conflict](../errors/ai-summary-term-conflict.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-aiSummary.json)：独立完整页面，保留必要语义依赖。
- [reportInline](../examples/component-aiSummary-reportInline.json)：独立完整页面，保留必要语义依赖。
- [forecast-page](../examples/forecast-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-aiSummary.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "summary",
  "type": "aiSummary",
  "layout": {
    "span": 12
  },
  "props": {
    "promptTemplate": "总结 GMV 表现",
    "relatedData": {
      "kpi": {
        "source": "current",
        "description": "当期指标",
        "fields": [
          {
            "field": "gmv",
            "term": "成交额"
          },
          {
            "field": "yoy",
            "term": "同比"
          }
        ]
      }
    }
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/ai-summary.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

