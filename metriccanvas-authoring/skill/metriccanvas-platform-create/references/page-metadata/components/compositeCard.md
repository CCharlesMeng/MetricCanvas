# 组合卡 compositeCard

把若干组件框进一张卡,并让这张卡作为一个组件进 12 列栅格横向并排。适用于需要若干张白卡横向并排,每张卡自带卡壳、可选标题与卡内分隔、要装的这组组件本身就是一个内容分区时改用 section.container: "card"、卡内是多张表格互斥切换时改用 Tab 容器。数据形状：不绑定页面数据源；每个子组件自己声明数据槽与字段绑定。

metricGrid、compactSummary、analysisStack等变体决定卡内结构；子组件仅使用各变体允许的类型与布局。组合卡拥有完整子树，删除时依赖清理由创作工具负责。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.3。结构真源为本册[schema.json](../schema.json)，SHA256 `716d55d27e8ac6026ed8c3f2174eb0b98c80dc9f52a582aa377354e098615c96`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e74"></a>

### `@compositeCardComponent`

Schema位置：`#/definitions/compositeCardComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@compositeCardComponent.id`

Schema位置：`#/definitions/compositeCardComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@compositeCardComponent.type`

Schema位置：`#/definitions/compositeCardComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="compositeCard" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compositeCard" | 用于选择@compositeCardComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@compositeCardComponent.layout`

Schema位置：`#/definitions/compositeCardComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@compositeCardComponent.props`

Schema位置：`#/definitions/compositeCardComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["components"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@compositeCardComponent.props.title`

Schema位置：`#/definitions/compositeCardComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@compositeCardComponent.props.title · allOf[0]`

Schema位置：`#/definitions/compositeCardComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c6549636f6e"></a>

### `@compositeCardComponent.props.titleIcon`

Schema位置：`#/definitions/compositeCardComponent/properties/props/properties/titleIcon`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["opportunity","tieredManagement","review"] | Schema未设默认；装配/运行时默认见语义说明 | 标题前受控图标。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "opportunity" | 机会点呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "tieredManagement" | 分层管理呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "review" | 复盘呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@compositeCardComponent.props.variant`

Schema位置：`#/definitions/compositeCardComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["compact","projectNorms","metricGrid"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compact" | 紧凑工具栏呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "projectNorms" | 项目规范呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "metricGrid" | 指标网格呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6469766964657273"></a>

### `@compositeCardComponent.props.dividers`

Schema位置：`#/definitions/compositeCardComponent/properties/props/properties/dividers`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 是否显示分隔线。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6d706f6e656e7473"></a>

### `@compositeCardComponent.props.components`

Schema位置：`#/definitions/compositeCardComponent/properties/props/properties/components`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 受控子组件集合；容器白名单与顶层集合不同。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6d706f6e656e74732f6974656d73"></a>

### `@compositeCardComponent.props.components[]`

Schema位置：`#/definitions/compositeCardComponent/properties/props/properties/components/items`。目标：[#/definitions/compositeCardChild](../components/compositeCard.md#schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c64)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compositeCardChild | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c64"></a>

### `@compositeCardChild`

Schema位置：`#/definitions/compositeCardChild`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f30"></a>

### `@compositeCardChild · oneOf[0]`

Schema位置：`#/definitions/compositeCardChild/oneOf/0`。目标：[#/definitions/metricCardComponent](../components/metricCard.md#schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f31"></a>

### `@compositeCardChild · oneOf[1]`

Schema位置：`#/definitions/compositeCardChild/oneOf/1`。目标：[#/definitions/pieChartComponent](../components/pieChart.md#schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f32"></a>

### `@compositeCardChild · oneOf[2]`

Schema位置：`#/definitions/compositeCardChild/oneOf/2`。目标：[#/definitions/gaugeComponent](../components/gauge.md#schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/gaugeComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f33"></a>

### `@compositeCardChild · oneOf[3]`

Schema位置：`#/definitions/compositeCardChild/oneOf/3`。目标：[#/definitions/keyValuePanelComponent](../components/keyValuePanel.md#schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/keyValuePanelComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f34"></a>

### `@compositeCardChild · oneOf[4]`

Schema位置：`#/definitions/compositeCardChild/oneOf/4`。目标：[#/definitions/categoryBreakdownComponent](../components/categoryBreakdown.md#schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/categoryBreakdownComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `composite-card-pure-container`：组合卡是纯容器：不声明 data / actions、至少一个子组件、不嵌套容器、子组件在白名单内。反例：[composite-card-with-data](../errors/composite-card-with-data.json)、[composite-card-with-actions](../errors/composite-card-with-actions.json)、[composite-card-empty](../errors/composite-card-empty.json)、[composite-card-nested-container](../errors/composite-card-nested-container.json)、[composite-card-child-not-whitelisted](../errors/composite-card-child-not-whitelisted.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-compositeCard.json)：独立完整页面，保留必要语义依赖。
- [compact](../examples/component-compositeCard-compact.json)：独立完整页面，保留必要语义依赖。
- [projectNorms](../examples/component-compositeCard-projectNorms.json)：独立完整页面，保留必要语义依赖。
- [metricGrid](../examples/component-compositeCard-metricGrid.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-compositeCard.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "card",
  "type": "compositeCard",
  "layout": {
    "span": 2
  },
  "props": {
    "title": "渠道概览",
    "titleIcon": "opportunity",
    "variant": "metricGrid",
    "components": [
      {
        "id": "amount-card",
        "type": "metricCard",
        "layout": {
          "span": 6
        },
        "data": {
          "main": "summary"
        },
        "props": {
          "rows": [
            {
              "label": "线上金额",
              "context": "近60天",
              "valueField": {
                "data": "main",
                "field": "amount",
                "match": {
                  "field": "channel",
                  "equals": "线上"
                }
              },
              "link": true
            }
          ],
          "secondaryRows": [
            {
              "label": "评分",
              "valueField": "score"
            }
          ],
          "actions": [
            {
              "on": "click",
              "navigate": {
                "href": "/pages/inline-report"
              }
            }
          ]
        }
      },
      {
        "id": "share-pie",
        "type": "pieChart",
        "layout": {
          "span": 6
        },
        "data": {
          "main": "summary"
        },
        "props": {
          "categoryField": "channel",
          "valueField": "share"
        }
      },
      {
        "id": "score-gauge",
        "type": "gauge",
        "layout": {
          "span": 6
        },
        "data": {
          "main": "summary"
        },
        "props": {
          "valueField": "score",
          "max": 100
        }
      },
      {
        "id": "owner-panel",
        "type": "keyValuePanel",
        "layout": {
          "span": 6
        },
        "data": {
          "main": "summary"
        },
        "props": {
          "titleIcon": "reward",
          "columns": 6,
          "items": [
            {
              "label": "负责人",
              "field": "owner",
              "icon": "goldMedal"
            },
            {
              "label": "金额",
              "field": "amount",
              "unit": "万元"
            }
          ]
        }
      },
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
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/composite-card.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/compositeCardChild/oneOf/0`：[合法完整页面](../examples/component-compositeCard.json)，JSON Pointer `#/sections/0/components/0/props/components/0`。
- `#/definitions/compositeCardChild/oneOf/1`：[合法完整页面](../examples/component-compositeCard.json)，JSON Pointer `#/sections/0/components/0/props/components/1`。
- `#/definitions/compositeCardChild/oneOf/2`：[合法完整页面](../examples/component-compositeCard.json)，JSON Pointer `#/sections/0/components/0/props/components/2`。
- `#/definitions/compositeCardChild/oneOf/3`：[合法完整页面](../examples/component-compositeCard.json)，JSON Pointer `#/sections/0/components/0/props/components/3`。
- `#/definitions/compositeCardChild/oneOf/4`：[合法完整页面](../examples/component-compositeCard.json)，JSON Pointer `#/sections/0/components/0/props/components/4`。
