# Tab 容器 tabContainer

在同一卡位切换多张表格,不占用额外栅格行。适用于概览 / TOP / 丢单这类互斥表格需要共用一块区域。数据形状：不绑定页面数据源；每个 Tab 内的表格自己声明数据槽。

活动面板只呈现声明Tab，子组件类型受限；切换不生成另一份页面文档。嵌套边界由Schema分支限定，不能递归塞任意容器。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.4。结构真源为本册[schema.json](../schema.json)，SHA256 `eba4e60b84fce7271971b06cd704b44b0de2baa906c0734914a731bf6695db46`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e74"></a>

### `@tabContainerComponent`

Schema位置：`#/definitions/tabContainerComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@tabContainerComponent.id`

Schema位置：`#/definitions/tabContainerComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@tabContainerComponent.type`

Schema位置：`#/definitions/tabContainerComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="tabContainer" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "tabContainer" | 用于选择@tabContainerComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@tabContainerComponent.layout`

Schema位置：`#/definitions/tabContainerComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@tabContainerComponent.props`

Schema位置：`#/definitions/tabContainerComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["tabs"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@tabContainerComponent.props.title`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@tabContainerComponent.props.title · allOf[0]`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@tabContainerComponent.props.variant`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["compact","analysisStack"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compact" | 紧凑工具栏呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "analysisStack" | 分析纵向堆叠呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f64656661756c74546162"></a>

### `@tabContainerComponent.props.defaultTab`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/defaultTab`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 初始Tab id，须存在于tabs。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f74616273"></a>

### `@tabContainerComponent.props.tabs`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/tabs`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 非空Tab集合，每项id唯一。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746162732f6974656d73"></a>

### `@tabContainerComponent.props.tabs[]`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/tabs/items`。目标：[#/definitions/tabItem](../components/tabContainer.md#schema-232f646566696e6974696f6e732f7461624974656d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tabItem | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d"></a>

### `@tabItem`

Schema位置：`#/definitions/tabItem`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f30"></a>

### `@tabItem · anyOf[0]`

Schema位置：`#/definitions/tabItem/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["id","label","component"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f302f70726f706572746965732f6964"></a>

### `@tabItem · anyOf[0].id`

Schema位置：`#/definitions/tabItem/anyOf/0/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f302f70726f706572746965732f6c6162656c"></a>

### `@tabItem · anyOf[0].label`

Schema位置：`#/definitions/tabItem/anyOf/0/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f302f70726f706572746965732f636f6d706f6e656e74"></a>

### `@tabItem · anyOf[0].component`

Schema位置：`#/definitions/tabItem/anyOf/0/properties/component`。目标：[#/definitions/tableComponent](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableComponent | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 单个受控组件声明。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f31"></a>

### `@tabItem · anyOf[1]`

Schema位置：`#/definitions/tabItem/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["id","label","components"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f6964"></a>

### `@tabItem · anyOf[1].id`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f6c6162656c"></a>

### `@tabItem · anyOf[1].label`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f636f6d706f6e656e7473"></a>

### `@tabItem · anyOf[1].components`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/components`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 受控子组件集合；容器白名单与顶层集合不同。 |

<a id="schema-232f646566696e6974696f6e732f7461624974656d2f616e794f662f312f70726f706572746965732f636f6d706f6e656e74732f6974656d73"></a>

### `@tabItem · anyOf[1].components[]`

Schema位置：`#/definitions/tabItem/anyOf/1/properties/components/items`。目标：[#/definitions/tableComponent](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableComponent | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `tab-container`：Tab id 唯一且 defaultTab 已声明。反例：[tab-id-duplicate](../errors/tab-id-duplicate.json)、[tab-default-unknown](../errors/tab-default-unknown.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-tabContainer.json)：独立完整页面，保留必要语义依赖。
- [compact](../examples/component-tabContainer-compact.json)：独立完整页面，保留必要语义依赖。
- [analysisStack](../examples/component-tabContainer-analysisStack.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-tabContainer.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "tab-container",
  "type": "tabContainer",
  "layout": {
    "span": 12
  },
  "props": {
    "variant": "analysisStack",
    "defaultTab": "top",
    "tabs": [
      {
        "id": "top",
        "label": "TOP",
        "component": {
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
      },
      {
        "id": "all",
        "label": "全部",
        "components": [
          {
            "id": "all-table",
            "type": "table",
            "layout": {
              "span": 12
            },
            "data": {
              "main": "summary"
            },
            "props": {
              "columns": [
                {
                  "field": "channel"
                },
                {
                  "field": "amount"
                }
              ],
              "pagination": {
                "mode": "local",
                "pageSize": 10
              }
            }
          }
        ]
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/tab-container.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/tabItem/anyOf/0`：[合法完整页面](../examples/component-tabContainer.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0`。
- `#/definitions/tabItem/anyOf/1`：[合法完整页面](../examples/component-tabContainer.json)，JSON Pointer `#/sections/0/components/0/props/tabs/1`。
