# 按钮

6.35起，button组件以props.label和单个props.action声明受控操作，不绑定页面数据源。顶层visibleWhen控制展示，enabledWhen控制执行，动作继续使用导航、筛选写入或受控详情。独立按钮没有行上下文。

完整规则和限制见[条件显隐](../conditions.md)，演示见page-visibility-region-linkage。


页面协议 6.40。结构真源为本册[schema.json](../schema.json)，SHA256 `90400cbd2aa370809afb7fa5124ef0b62c049da7e48493bfd98d4668663704df`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e74"></a>

### `@buttonComponent`

Schema位置：`#/definitions/buttonComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@buttonComponent.id`

Schema位置：`#/definitions/buttonComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@buttonComponent.type`

Schema位置：`#/definitions/buttonComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="button" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "button" | 用于选择@buttonComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@buttonComponent.layout`

Schema位置：`#/definitions/buttonComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@buttonComponent.visibleWhen`

Schema位置：`#/definitions/buttonComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@buttonComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/buttonComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f656e61626c65645768656e"></a>

### `@buttonComponent.enabledWhen`

Schema位置：`#/definitions/buttonComponent/properties/enabledWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可见入口的执行条件；执行时重新判定。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f656e61626c65645768656e2f616c6c4f662f30"></a>

### `@buttonComponent.enabledWhen · allOf[0]`

Schema位置：`#/definitions/buttonComponent/properties/enabledWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@buttonComponent.props`

Schema位置：`#/definitions/buttonComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["label","action"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6c6162656c"></a>

### `@buttonComponent.props.label`

Schema位置：`#/definitions/buttonComponent/properties/props/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e"></a>

### `@buttonComponent.props.action`

Schema位置：`#/definitions/buttonComponent/properties/props/properties/action`。目标：[#/definitions/componentAction](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e74416374696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentAction | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 沿用既有受控click动作，独立按钮无行上下文。 |

## 语义规则与反例（生成）


## 示例与溯源（生成）

- [最小组件](../examples/component-button.json)：独立完整页面，保留必要语义依赖。
- [page-visibility-region-linkage](../examples/page-visibility-region-linkage.json)：完整合法页面；查询仅为静态契约证据。
- [reference-conditions-page](../examples/reference-conditions-page.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-button.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "reference-button",
  "type": "button",
  "layout": {
    "span": 3
  },
  "visibleWhen": {
    "any": [
      {
        "permission": "read"
      },
      {
        "filter": "f-list",
        "part": "values",
        "op": "containsAny",
        "values": [
          "s"
        ]
      }
    ]
  },
  "enabledWhen": {
    "fact": "flag",
    "op": "eq",
    "value": true
  },
  "props": {
    "label": "静态契约按钮",
    "action": {
      "on": "click",
      "writeFilter": "f-list",
      "value": "s",
      "visibleWhen": {
        "permission": "read"
      },
      "enabledWhen": {
        "not": {
          "permission": "deny"
        }
      }
    }
  }
}
```


## 联合分支见证（生成）
