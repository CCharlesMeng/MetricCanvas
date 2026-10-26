# 组合卡 compositeCard

把若干组件框进一张卡,并让这张卡作为一个组件进 12 列栅格横向并排。适用于需要若干张白卡横向并排,每张卡自带卡壳、可选标题与卡内分隔、要装的这组组件本身就是一个内容分区时改用 section.container: "card"、卡内是多张表格互斥切换时改用 Tab 容器。数据形状：不绑定页面数据源；每个子组件自己声明数据槽与字段绑定。

metricGrid、compactSummary、analysisStack等变体决定卡内结构；子组件仅使用各变体允许的类型与布局。组合卡拥有完整子树，删除时依赖清理由创作工具负责。

Dashboard中放入白底Tab或白底分区时，组合卡复用指标卡的1px黑色10%透明度实线外框，内部指标保持无框；无需新增页面字段。示例：[`tab-mixed-content`](../examples/tab-mixed-content.json)。

纯指标内容使用现有 `variant: "metricGrid"`，按内容自适应高度；默认组合卡仍保留280px最小高度，`compact` / `projectNorms` 沿用各自高度约束。示例中的指标组合使用 `metricGrid`，避免撑高同一行的普通指标卡。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

6.35条件呈现及相关限制见[条件显隐](../conditions.md)；子项全部隐藏不自动收起父容器。

组合卡允许独立 filterGroup 及柱、线、饼、地图四类图表作为叶子组件，用于筛选与内容的显式组合；仍禁止组合卡递归和任意子组件。筛选作用范围由查询绑定决定，卡内位置不自动限定数据范围。

6.58 增加 aiSummary 子组件（Report 限制仍适用）；摘要必须在卡内内容最前并占满 12 列，可显式 scope: "container" 总结本卡关联数据。正文、生成、缓存和导出复用同一 aiSummary；文字不进入分析输入。其他准入及嵌套规则不变。示例：[`report-ai-summary-regions`](../examples/report-ai-summary-regions.json)。

## 筛选工具栏（6.63）

`props.filterLayout:"toolbar"` 将开头连续的 filterGroup 排入卡顶工具栏：align:left（默认）靠左，align:right 作为一个紧凑组整体居右，组内间距 12px；短选项下拉使用现有 160px 控件宽度。宽度不足时先让右组整体换行，组内仅在自身也容纳不下时换行，保持右对齐。此时这些筛选组件的 span 不分配工具栏内部比例；它们仍分别拥有 filterId、候选、状态和查询绑定。遇到第一个非 filterGroup 后结束提取，其后所有组件仍沿用原栅格顺序、span 与分隔线。没有显式声明时保持原布局。

示例 `/pages/filter-group-parallel-selects`：左侧一个指标按钮组，右侧区域、渠道两个下拉；内容为趋势图与合计。只读和导出复用原筛选组件的禁用与选中标签投影。


页面协议 6.64。结构真源为本册[schema.json](../schema.json)，SHA256 `c0aed5e15e699271f4d50813b2e3e140123929c16bdb9b72e11a6555d12d669f`。字段表自动生成；可选不等于有默认值。

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

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@compositeCardComponent.visibleWhen`

Schema位置：`#/definitions/compositeCardComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@compositeCardComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/compositeCardComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |
| "projectNorms" | 项目规范呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "metricGrid" | 指标网格呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f66696c7465724c61796f7574"></a>

### `@compositeCardComponent.props.filterLayout`

Schema位置：`#/definitions/compositeCardComponent/properties/props/properties/filterLayout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="toolbar" | Schema未设默认；装配/运行时默认见语义说明 | 6.63显式工具栏：开头连续filterGroup按align组成左右两组；右组紧凑排列并整体贴右，窄屏回流，其余内容沿用栅格。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "toolbar" | 用于选择@compositeCardComponent.props.filterLayout分支；同分支其它约束同时成立。 |

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

Schema位置：`#/definitions/compositeCardChild/oneOf/0`。目标：[#/definitions/aiSummaryComponent](../components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f31"></a>

### `@compositeCardChild · oneOf[1]`

Schema位置：`#/definitions/compositeCardChild/oneOf/1`。目标：[#/definitions/filterGroupComponent](../components/filterGroup.md#schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/filterGroupComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f32"></a>

### `@compositeCardChild · oneOf[2]`

Schema位置：`#/definitions/compositeCardChild/oneOf/2`。目标：[#/definitions/barChartComponent](../components/barChart.md#schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/barChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f33"></a>

### `@compositeCardChild · oneOf[3]`

Schema位置：`#/definitions/compositeCardChild/oneOf/3`。目标：[#/definitions/lineChartComponent](../components/lineChart.md#schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/lineChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f34"></a>

### `@compositeCardChild · oneOf[4]`

Schema位置：`#/definitions/compositeCardChild/oneOf/4`。目标：[#/definitions/mapChartComponent](../components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f35"></a>

### `@compositeCardChild · oneOf[5]`

Schema位置：`#/definitions/compositeCardChild/oneOf/5`。目标：[#/definitions/metricCardComponent](../components/metricCard.md#schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f36"></a>

### `@compositeCardChild · oneOf[6]`

Schema位置：`#/definitions/compositeCardChild/oneOf/6`。目标：[#/definitions/pieChartComponent](../components/pieChart.md#schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f37"></a>

### `@compositeCardChild · oneOf[7]`

Schema位置：`#/definitions/compositeCardChild/oneOf/7`。目标：[#/definitions/gaugeComponent](../components/gauge.md#schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/gaugeComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f38"></a>

### `@compositeCardChild · oneOf[8]`

Schema位置：`#/definitions/compositeCardChild/oneOf/8`。目标：[#/definitions/keyValuePanelComponent](../components/keyValuePanel.md#schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/keyValuePanelComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f73697465436172644368696c642f6f6e654f662f39"></a>

### `@compositeCardChild · oneOf[9]`

Schema位置：`#/definitions/compositeCardChild/oneOf/9`。目标：[#/definitions/categoryBreakdownComponent](../components/categoryBreakdown.md#schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/categoryBreakdownComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `composite-card-pure-container`：组合卡是纯容器：不声明 data / actions、至少一个子组件、不嵌套容器、子组件在白名单内。反例：[composite-card-with-data](../errors/composite-card-with-data.json)、[composite-card-with-actions](../errors/composite-card-with-actions.json)、[composite-card-empty](../errors/composite-card-empty.json)、[composite-card-nested-container](../errors/composite-card-nested-container.json)、[composite-card-child-not-whitelisted](../errors/composite-card-child-not-whitelisted.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `ai-summary-regions`：AI 总结可进入组合卡，显式总结所属区域且位于区域或页面正文顶部。反例：[ai-summary-region-version](../errors/ai-summary-region-version.json)、[ai-summary-region-mixed-scope](../errors/ai-summary-region-mixed-scope.json)、[ai-summary-region-not-top](../errors/ai-summary-region-not-top.json)、[ai-summary-page-not-top](../errors/ai-summary-page-not-top.json)、[ai-summary-region-not-full-width](../errors/ai-summary-region-not-full-width.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-compositeCard.json)：独立完整页面，保留必要语义依赖。
- [compact](../examples/component-compositeCard-compact.json)：独立完整页面，保留必要语义依赖。
- [projectNorms](../examples/component-compositeCard-projectNorms.json)：独立完整页面，保留必要语义依赖。
- [metricGrid](../examples/component-compositeCard-metricGrid.json)：独立完整页面，保留必要语义依赖。
- [composite-page](../examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [report-ai-summary-regions](../examples/report-ai-summary-regions.json)：完整合法页面；查询仅为静态契约证据。
- [filter-group-parallel-selects](../examples/filter-group-parallel-selects.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-compositeCard.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "grouped",
  "type": "compositeCard",
  "layout": {
    "span": 6
  },
  "props": {
    "title": "组合卡",
    "components": [
      {
        "id": "grouped-total",
        "type": "metricCard",
        "layout": {
          "span": 12
        },
        "data": {
          "main": "metrics"
        },
        "props": {
          "title": "合成总额",
          "rows": [
            {
              "label": "总额",
              "valueField": "amount"
            }
          ]
        }
      }
    ]
  }
}
```


## 联合分支见证（生成）

- `#/definitions/compositeCardChild/oneOf/0`：[合法完整页面](../examples/report-ai-summary-regions.json)，JSON Pointer `#/sections/3/components/0/props/components/0`。
- `#/definitions/compositeCardChild/oneOf/1`：[合法完整页面](../examples/query-modes-page.json)，JSON Pointer `#/sections/1/components/0/props/components/0`。
- `#/definitions/compositeCardChild/oneOf/2`：[合法完整页面](../examples/chart-local-filter-page.json)，JSON Pointer `#/sections/0/components/0/props/components/1`。
- `#/definitions/compositeCardChild/oneOf/3`：[合法完整页面](../examples/query-modes-page.json)，JSON Pointer `#/sections/1/components/0/props/components/2`。
- `#/definitions/compositeCardChild/oneOf/4`：[合法完整页面](../examples/chart-local-filter-page.json)，JSON Pointer `#/sections/0/components/3/props/components/1`。
- `#/definitions/compositeCardChild/oneOf/5`：[合法完整页面](../examples/component-compositeCard.json)，JSON Pointer `#/sections/0/components/0/props/components/0`。
- `#/definitions/compositeCardChild/oneOf/6`：[合法完整页面](../examples/chart-local-filter-page.json)，JSON Pointer `#/sections/0/components/2/props/components/1`。
- `#/definitions/compositeCardChild/oneOf/7`：[合法完整页面](../examples/composite-page.json)，JSON Pointer `#/sections/0/components/1/props/components/2`。
- `#/definitions/compositeCardChild/oneOf/8`：[合法完整页面](../examples/composite-page.json)，JSON Pointer `#/sections/0/components/1/props/components/3`。
- `#/definitions/compositeCardChild/oneOf/9`：[合法完整页面](../examples/composite-page.json)，JSON Pointer `#/sections/0/components/1/props/components/4`。
