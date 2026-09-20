# 分类明细 categoryBreakdown

按类别逐行、按度量逐列列出少数几行带列头的紧凑明细。适用于环形图旁边那份「类别 + 两三个度量」的小表,或卡内的分档明细、行数与列数都很少、不需要分页排序表头筛选时;需要那些能力改用明细表、每个类别只有一个取值、结构是键值对时改用信息面板。数据形状：每行一个类别;一个 dimension 类别字段 + 一到多个 measure 字段。

分类列由显式字段和维度匹配得到；布局展示不授权对不可加总度量求和。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

categoryLabel缺省使用字段label，字符串覆盖列头，false明确隐藏列头。swatches按类别取值从共享配色取色，需要同页饼图绑定相同类别字段；不是按行序猜颜色。带色点的完整例子保留这一依赖。


页面协议 6.6。结构真源为本册[schema.json](../schema.json)，SHA256 `724a223b61ed116ed3a542b273a0235b6778f87196f289a2a19d1c9feb5a24e7`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e74"></a>

### `@categoryBreakdownComponent`

Schema位置：`#/definitions/categoryBreakdownComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@categoryBreakdownComponent.id`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@categoryBreakdownComponent.type`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="categoryBreakdown" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "categoryBreakdown" | 用于选择@categoryBreakdownComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@categoryBreakdownComponent.layout`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@categoryBreakdownComponent.data`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@categoryBreakdownComponent.props`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["categoryField","columns"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@categoryBreakdownComponent.props.title`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@categoryBreakdownComponent.props.title · allOf[0]`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@categoryBreakdownComponent.props.variant`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="compactList" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compactList" | 用于选择@categoryBreakdownComponent.props.variant分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f63617465676f72794669656c64"></a>

### `@categoryBreakdownComponent.props.categoryField`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/categoryField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 类别维度字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f63617465676f72794c6162656c"></a>

### `@categoryBreakdownComponent.props.categoryLabel`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/categoryLabel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 类别列头；缺省取字段label，false显式隐藏列头。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f63617465676f72794c6162656c2f616e794f662f30"></a>

### `@categoryBreakdownComponent.props.categoryLabel · anyOf[0]`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/categoryLabel/anyOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f63617465676f72794c6162656c2f616e794f662f31"></a>

### `@categoryBreakdownComponent.props.categoryLabel · anyOf[1]`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/categoryLabel/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 独立分支（不合并required） | const=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| false | 用于选择@categoryBreakdownComponent.props.categoryLabel · anyOf[1]分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e73"></a>

### `@categoryBreakdownComponent.props.columns`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/columns`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 列或透视输出列的有序声明，按所属分支解释。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6c756d6e732f6974656d73"></a>

### `@categoryBreakdownComponent.props.columns[]`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/columns/items`。目标：[#/definitions/categoryBreakdownColumn](../components/categoryBreakdown.md#schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6c756d6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/categoryBreakdownColumn | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6c756d6e"></a>

### `@categoryBreakdownColumn`

Schema位置：`#/definitions/categoryBreakdownColumn`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6c756d6e2f70726f706572746965732f6c6162656c"></a>

### `@categoryBreakdownColumn.label`

Schema位置：`#/definitions/categoryBreakdownColumn/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6c756d6e2f70726f706572746965732f6669656c64"></a>

### `@categoryBreakdownColumn.field`

Schema位置：`#/definitions/categoryBreakdownColumn/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7377617463686573"></a>

### `@categoryBreakdownComponent.props.swatches`

Schema位置：`#/definitions/categoryBreakdownComponent/properties/props/properties/swatches`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按类别取值显示同色点，须同页匹配饼图。 |

## 语义规则与反例（生成）

- `category-swatches-need-pie`：分类明细开启色点要求同页有饼图绑定同一类别字段。反例：[category-swatches-without-pie](../errors/category-swatches-without-pie.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-categoryBreakdown.json)：独立完整页面，保留必要语义依赖。
- [compactList](../examples/component-categoryBreakdown-compactList.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](../examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-categoryBreakdown.json)的`#/sections/0/components/0/props/components/4`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "channel-breakdown",
  "type": "categoryBreakdown",
  "layout": {
    "span": 12
  },
  "data": {
    "main": "summary"
  },
  "props": {
    "categoryField": "channel",
    "columns": [
      {
        "label": "金额",
        "field": "amount"
      }
    ],
    "swatches": true
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/category-breakdown.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/categoryBreakdownComponent/properties/props/properties/categoryLabel/anyOf/0`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/10/props/categoryLabel`。
- `#/definitions/categoryBreakdownComponent/properties/props/properties/categoryLabel/anyOf/1`：[合法完整页面](../examples/reference-branches-page.json)，JSON Pointer `#/sections/0/components/11/props/categoryLabel`。
