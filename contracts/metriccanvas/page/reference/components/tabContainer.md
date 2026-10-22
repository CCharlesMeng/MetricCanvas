# Tab 容器 tabContainer

在同一区域切换普通内容与组合卡。容器不绑定数据，每个子组件独立声明数据槽。

6.32 起支持全部普通内容组件及组合卡；不允许 reportHeader 和嵌套 tabContainer，组合卡内部继续遵守自身白名单，所有子组件禁止 layout.layer。`component` 与非空 `components` 二选一。

`props.contentLayout: "grid"` 复用12列栅格，子组件 layout.span 相对当前面板生效；省略时保留旧纵向全宽，不修改已有页面布局。

首次进入只读取当前内容所需数据与上游依赖；已访问面板保持挂载，切换保留图例、滚动、表格状态和AI总结会话。公共条件改变使相关隐藏数据失效，重新进入后补查，迟到响应不得覆盖新条件。AI输入失效立即中止旧流，重新取得数据后再生成；单纯切换不重新生成。

页面公共筛选与组件局部筛选继续通过显式绑定消费，不新增Tab筛选栏；独立筛选控件使用各自 filterId 和独立查询源，沿用现有单图隔离校验。同字段公共/局部查询条件取交集，不相交按空结果处理。

活动项由 `tab.<组件id>=<页签id>` 保存，复用 navigation.replaceSearch（替换历史、不刷新）；局部筛选沿用筛选URL。多个容器互不覆盖，未知页签回退 defaultTab 或第一项，无关参数保留。URL不保存结果、滚动、图例或AI文本。

Report整页导出按声明顺序展开全部Tab，补齐普通数据，只捕获已有AI文本，未生成则空态；Dashboard不新增整页导出，表格Excel保留自身范围。可观察入口：[混合内容](../examples/tab-mixed-content.json)，Playground `/pages/tab-mixed-content`。Report验收入口 `/pages/tab-mixed-content-report`。使用本地DQE Sim，不证明真实DQE或Relay接入。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.32。结构真源为本册[schema.json](../schema.json)，SHA256 `27bfdd2acfe5234d356fe47db5c2e85e69426c15accc5652a96f18ef30987d9f`。字段表自动生成；可选不等于有默认值。

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

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f636f6e74656e744c61796f7574"></a>

### `@tabContainerComponent.props.contentLayout`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/contentLayout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="grid" | Schema未设默认；装配/运行时默认见语义说明 | 6.32：显式grid复用12列栅格；缺省保留旧纵向全宽。普通内容与组合卡可入Tab，页头与嵌套Tab禁止。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "grid" | 用于选择@tabContainerComponent.props.contentLayout分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@tabContainerComponent.props.variant`

Schema位置：`#/definitions/tabContainerComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["compact","analysisStack"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |
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

Schema位置：`#/definitions/tabItem/anyOf/0/properties/component`。目标：[#/definitions/tabContent](../components/tabContainer.md#schema-232f646566696e6974696f6e732f746162436f6e74656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tabContent | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 单个受控组件声明。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e74"></a>

### `@tabContent`

Schema位置：`#/definitions/tabContent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f30"></a>

### `@tabContent · oneOf[0]`

Schema位置：`#/definitions/tabContent/oneOf/0`。目标：[#/definitions/tableComponent](../components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f31"></a>

### `@tabContent · oneOf[1]`

Schema位置：`#/definitions/tabContent/oneOf/1`。目标：[#/definitions/metricCardComponent](../components/metricCard.md#schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f32"></a>

### `@tabContent · oneOf[2]`

Schema位置：`#/definitions/tabContent/oneOf/2`。目标：[#/definitions/barChartComponent](../components/barChart.md#schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/barChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f33"></a>

### `@tabContent · oneOf[3]`

Schema位置：`#/definitions/tabContent/oneOf/3`。目标：[#/definitions/lineChartComponent](../components/lineChart.md#schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/lineChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f34"></a>

### `@tabContent · oneOf[4]`

Schema位置：`#/definitions/tabContent/oneOf/4`。目标：[#/definitions/pieChartComponent](../components/pieChart.md#schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f35"></a>

### `@tabContent · oneOf[5]`

Schema位置：`#/definitions/tabContent/oneOf/5`。目标：[#/definitions/mapChartComponent](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f36"></a>

### `@tabContent · oneOf[6]`

Schema位置：`#/definitions/tabContent/oneOf/6`。目标：[#/definitions/gaugeComponent](../components/gauge.md#schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/gaugeComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f37"></a>

### `@tabContent · oneOf[7]`

Schema位置：`#/definitions/tabContent/oneOf/7`。目标：[#/definitions/compositeCardComponent](../components/compositeCard.md#schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compositeCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f38"></a>

### `@tabContent · oneOf[8]`

Schema位置：`#/definitions/tabContent/oneOf/8`。目标：[#/definitions/categoryBreakdownComponent](../components/categoryBreakdown.md#schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/categoryBreakdownComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f39"></a>

### `@tabContent · oneOf[9]`

Schema位置：`#/definitions/tabContent/oneOf/9`。目标：[#/definitions/rankingCardComponent](../components/rankingCard.md#schema-232f646566696e6974696f6e732f72616e6b696e6743617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rankingCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f3130"></a>

### `@tabContent · oneOf[10]`

Schema位置：`#/definitions/tabContent/oneOf/10`。目标：[#/definitions/rankingDetailCardComponent](../components/rankingDetailCard.md#schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rankingDetailCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f3131"></a>

### `@tabContent · oneOf[11]`

Schema位置：`#/definitions/tabContent/oneOf/11`。目标：[#/definitions/keyValuePanelComponent](../components/keyValuePanel.md#schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/keyValuePanelComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f3132"></a>

### `@tabContent · oneOf[12]`

Schema位置：`#/definitions/tabContent/oneOf/12`。目标：[#/definitions/textComponent](../components/text.md#schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f3133"></a>

### `@tabContent · oneOf[13]`

Schema位置：`#/definitions/tabContent/oneOf/13`。目标：[#/definitions/fieldTextComponent](../components/fieldText.md#schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldTextComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f746162436f6e74656e742f6f6e654f662f3134"></a>

### `@tabContent · oneOf[14]`

Schema位置：`#/definitions/tabContent/oneOf/14`。目标：[#/definitions/aiSummaryComponent](../components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

Schema位置：`#/definitions/tabItem/anyOf/1/properties/components/items`。目标：[#/definitions/tabContent](../components/tabContainer.md#schema-232f646566696e6974696f6e732f746162436f6e74656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tabContent | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `tab-container`：Tab id 唯一且 defaultTab 已声明。反例：[tab-id-duplicate](../errors/tab-id-duplicate.json)、[tab-default-unknown](../errors/tab-default-unknown.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `tab-content-boundary`：Tab混合内容禁止页头、嵌套Tab及子内容铺底，能力下限6.32。反例：[tab-content-header](../errors/tab-content-header.json)、[tab-content-nested-tab](../errors/tab-content-nested-tab.json)、[tab-content-backdrop](../errors/tab-content-backdrop.json)、[tab-content-version-floor](../errors/tab-content-version-floor.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-tabContainer.json)：独立完整页面，保留必要语义依赖。
- [compact](../examples/component-tabContainer-compact.json)：独立完整页面，保留必要语义依赖。
- [analysisStack](../examples/component-tabContainer-analysisStack.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [tab-mixed-content](../examples/tab-mixed-content.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-aisummary](../examples/tab-content-aisummary.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-barchart](../examples/tab-content-barchart.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-categorybreakdown](../examples/tab-content-categorybreakdown.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-compositecard](../examples/tab-content-compositecard.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-fieldtext](../examples/tab-content-fieldtext.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-gauge](../examples/tab-content-gauge.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-keyvaluepanel](../examples/tab-content-keyvaluepanel.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-linechart](../examples/tab-content-linechart.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-mapchart](../examples/tab-content-mapchart.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-metriccard](../examples/tab-content-metriccard.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-piechart](../examples/tab-content-piechart.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-rankingcard](../examples/tab-content-rankingcard.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-rankingdetailcard](../examples/tab-content-rankingdetailcard.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-table](../examples/tab-content-table.json)：完整合法页面；查询仅为静态契约证据。
- [tab-content-text](../examples/tab-content-text.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-tabContainer.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "content-tabs",
  "type": "tabContainer",
  "layout": {
    "span": 12
  },
  "props": {
    "contentLayout": "grid",
    "tabs": [
      {
        "id": "one",
        "label": "内容",
        "component": {
          "id": "explanation",
          "type": "text",
          "layout": {
            "span": 12
          },
          "props": {
            "title": "章节说明",
            "body": "这是页面中的静态说明正文。",
            "variant": "plain"
          }
        }
      }
    ]
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/tab-container.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/tabItem/anyOf/0`：[合法完整页面](../examples/component-tabContainer.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0`。
- `#/definitions/tabContent/oneOf/0`：[合法完整页面](../examples/composite-page.json)，JSON Pointer `#/sections/1/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/1`：[合法完整页面](../examples/tab-mixed-content.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/components/0`。
- `#/definitions/tabContent/oneOf/2`：[合法完整页面](../examples/tab-mixed-content.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/components/3`。
- `#/definitions/tabContent/oneOf/3`：[合法完整页面](../examples/tab-mixed-content.json)，JSON Pointer `#/sections/0/components/0/props/tabs/1/components/0`。
- `#/definitions/tabContent/oneOf/4`：[合法完整页面](../examples/tab-content-piechart.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/5`：[合法完整页面](../examples/tab-content-mapchart.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/6`：[合法完整页面](../examples/tab-content-gauge.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/7`：[合法完整页面](../examples/tab-mixed-content.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/components/1`。
- `#/definitions/tabContent/oneOf/8`：[合法完整页面](../examples/tab-content-categorybreakdown.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/9`：[合法完整页面](../examples/tab-content-rankingcard.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/10`：[合法完整页面](../examples/tab-content-rankingdetailcard.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/11`：[合法完整页面](../examples/tab-content-keyvaluepanel.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/12`：[合法完整页面](../examples/component-tabContainer.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/13`：[合法完整页面](../examples/tab-content-fieldtext.json)，JSON Pointer `#/sections/0/components/0/props/tabs/0/component`。
- `#/definitions/tabContent/oneOf/14`：[合法完整页面](../examples/tab-mixed-content.json)，JSON Pointer `#/sections/0/components/0/props/tabs/1/components/2`。
- `#/definitions/tabItem/anyOf/1`：[合法完整页面](../examples/composite-page.json)，JSON Pointer `#/sections/1/components/0/props/tabs/1`。
