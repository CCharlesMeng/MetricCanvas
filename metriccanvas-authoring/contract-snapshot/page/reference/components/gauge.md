# 仪表 gauge

用环形刻度突出一个比率或完成度类 KPI。适用于管道支撑率、完成率、达标率这类单值百分比 KPI。数据形状：单行记录；一个 measure 数值字段。

取主数据源单行measure。运行时min缺省0、max缺省100；进度夹到0–1，非法范围不产生有效进度。variant唯一显式值mini，用于紧凑环形仪表。max在Schema必须大于0；这不代表任意min/max组合都有有效区间。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.6。结构真源为本册[schema.json](../schema.json)，SHA256 `a421c583a35d98c6d01d1a47965f13984e4d6ec1aab62779b4d5ec78b7c8cf8f`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e74"></a>

### `@gaugeComponent`

Schema位置：`#/definitions/gaugeComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@gaugeComponent.id`

Schema位置：`#/definitions/gaugeComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@gaugeComponent.type`

Schema位置：`#/definitions/gaugeComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="gauge" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "gauge" | 用于选择@gaugeComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@gaugeComponent.layout`

Schema位置：`#/definitions/gaugeComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@gaugeComponent.data`

Schema位置：`#/definitions/gaugeComponent/properties/data`。目标：[#/definitions/mainData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d61696e44617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mainData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@gaugeComponent.props`

Schema位置：`#/definitions/gaugeComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@gaugeComponent.props.title`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@gaugeComponent.props.title · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@gaugeComponent.props.variant`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="mini" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "mini" | 紧凑环形仪表，值域计算不变。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76616c75654669656c64"></a>

### `@gaugeComponent.props.valueField`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d696e"></a>

### `@gaugeComponent.props.min`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/min`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 量表下界。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d6178"></a>

### `@gaugeComponent.props.max`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/max`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | exclusiveMinimum=0 | Schema未设默认；装配/运行时默认见语义说明 | 量表上界；Schema数值约束与运行时范围规则同时适用。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f756e6974"></a>

### `@gaugeComponent.props.unit`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@gaugeComponent.props.unit · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6162656c"></a>

### `@gaugeComponent.props.label`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@gaugeComponent.props.label · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e73"></a>

### `@gaugeComponent.props.actions`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@gaugeComponent.props.actions · allOf[0]`

Schema位置：`#/definitions/gaugeComponent/properties/props/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-gauge.json)：独立完整页面，保留必要语义依赖。
- [mini](../examples/component-gauge-mini.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-variants-page](../examples/reference-variants-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-gauge.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "completion",
  "type": "gauge",
  "layout": {
    "span": 4
  },
  "data": {
    "main": "ranking"
  },
  "props": {
    "title": "完成度",
    "variant": "mini",
    "valueField": "score",
    "min": 0,
    "max": 100,
    "unit": "%"
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/gauge.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/components/gauge/Gauge.svelte`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/components/gauge/gauge.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

