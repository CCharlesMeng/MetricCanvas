# 指标卡 metricCard

突出一个或少量核心指标的当前值、变化值与可选完成率。适用于总额、数量、完成率、KPI、核心指标、年度活动进展。数据形状：单行或少量行；至少一个 metric 字段，可选变化值和完成率 metric。

数据槽和字段绑定声明取哪行哪列；不同variant改变摘要结构，不能把列清单当任意HTML模板。

Dashboard 白底内容容器（Tab、`container: "card"` / `"panel"` 分区）中的指标卡自动使用 1px、黑色10%透明度的实线边框和16px圆角，与连接指标卡同样保留独立卡面；无需新增页面字段。灰底画布保持既有呈现，Report保留原有边框。普通卡的外框包住完整内容，紧凑型卡的每个指标面板分别带框；组合卡只绘制外层边框，内部指标不重复套框。可观察场景：[`tab-mixed-content`](../examples/tab-mixed-content.json)。
<a id="metric-card-before"></a>

## 前置连接文字 6.34

Dashboard 的 plain/card 内容分区可以在顶层相邻指标卡的 `layout.before` 声明 `{ "text": "+", "gap": 8 }`。text 复用文本取值，按纯文本呈现；gap 缺省 8，只接受 4/8/12/16/24（CSS px），分别表示连接文字内容盒到两侧卡片外框的间距。缺失可选文本参数时整个连接声明不参与排布。

连接文字不占 span。连续连接指标卡整体占成员 span 之和，最多 12；内部先扣除文字宽度及双侧间距，再按成员 span 比例分配卡片空间。四卡各 span 3，扣除连接空间后仍等宽。文字使用固有宽度，长文字单行省略且保留完整可访问名称，不能撑宽页面。卡片空间预算不足或命中既有窄屏规则时改为单列，文字位于两卡之间，纵向双侧使用相同 gap。

连接整组自动拉宽至成员 span 对应的可用宽度，首尾卡片对齐组内左右边缘；合计 span 12 时占满分区一行。整组指标卡与连接文字的外层不绘制边框。plain 分区中的独立连接排布盒保留 border-box、白底、16px圆角和20px内边距；显式 card 分区统一承担白底与内边距，内部连接排布盒不再叠加外框。每张指标卡保留独立的白色卡面、1px灰边和12px圆角；连接文字到左右小卡片外框的距离各为声明的gap（本示例均为8px），不会通过拉大文字两侧空隙对齐。卡片自身按span比例吸收剩余宽度，等宽或比例分配基于扣除所属容器内边距、文字及双侧 gap 后的内容空间；这些呈现规则由连接排布统一拥有，无需页面 CSS 或新增容器声明。

原文档第一张卡的 before 保留声明但不显示；其他位置的前项必须是相邻指标卡。只有原相邻两项均呈现时显示连接文字，不跨隐藏项重连，也不以查询加载或错误代替可见性判断。页面搭建移动或删除打断相邻关系时清除失效前缀，撤销会一起恢复。

第一版仅支持 Dashboard、plain/card、默认 12 列的顶层指标卡；不支持 Report、columnTracks、panel、backdrop、connectPrevious、嵌套及 after。非法组合由页面校验明确拒绝。连接只表达展示关系，不执行等式计算。完整验收入口为 `pages/capabilities/layout/metric-card-equation.json`，包括 `=`、`+` 和“其中”，第一组使用DQE Sim合成区域查询，第二组为静态对照。

在白底无边框的同一分区里放置小标题、筛选按钮及连接指标卡时，使用 section.container:card 与 section.title，先声明占满12列的 filterGroup，再声明相邻指标卡。分区负责外观，连接行只负责排布；详见[内容分区](../sections-and-layout.md)。演示 `/pages/metric-card-equation` 的区域按钮通过显式查询绑定联动四卡，第二组静态指标保持不变。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.51。结构真源为本册[schema.json](../schema.json)，SHA256 `9302c984389196b0d7d4476ad3ea11cca480ea3d9a7b7292aff4ecdbf71f44b5`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e74"></a>

### `@metricCardComponent`

Schema位置：`#/definitions/metricCardComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","data","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@metricCardComponent.id`

Schema位置：`#/definitions/metricCardComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@metricCardComponent.visibleWhen`

Schema位置：`#/definitions/metricCardComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@metricCardComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@metricCardComponent.type`

Schema位置：`#/definitions/metricCardComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="metricCard" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "metricCard" | 用于选择@metricCardComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@metricCardComponent.layout`

Schema位置：`#/definitions/metricCardComponent/properties/layout`。目标：[#/definitions/metricCardLayout](../components/metricCard.md#schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricCardLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f7574"></a>

### `@metricCardLayout`

Schema位置：`#/definitions/metricCardLayout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["span"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f75742f70726f706572746965732f7370616e"></a>

### `@metricCardLayout.span`

Schema位置：`#/definitions/metricCardLayout/properties/span`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=12 | Schema未设默认；装配/运行时默认见语义说明 | 占用列轨数量，不是百分比或像素。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f75742f70726f706572746965732f636f6e6e65637450726576696f7573"></a>

### `@metricCardLayout.connectPrevious`

Schema位置：`#/definitions/metricCardLayout/properties/connectPrevious`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 与前一个内容块的连接关系，删除须考虑该依赖。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f75742f70726f706572746965732f6c61796572"></a>

### `@metricCardLayout.layer`

Schema位置：`#/definitions/metricCardLayout/properties/layer`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | content正常内容层或backdrop铺底层。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f75742f70726f706572746965732f6c617965722f616c6c4f662f30"></a>

### `@metricCardLayout.layer · allOf[0]`

Schema位置：`#/definitions/metricCardLayout/properties/layer/allOf/0`。目标：[#/definitions/componentLayer](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayer | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f75742f70726f706572746965732f6265666f7265"></a>

### `@metricCardLayout.before`

Schema位置：`#/definitions/metricCardLayout/properties/before`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["text"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 与原文档前一张相邻指标卡之间的前置连接文字；仅 Dashboard 顶层默认12列的plain/card分区支持。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f75742f70726f706572746965732f6265666f72652f70726f706572746965732f74657874"></a>

### `@metricCardLayout.before.text`

Schema位置：`#/definitions/metricCardLayout/properties/before/properties/text`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 按纯文本呈现的连接文字，复用文本取值；缺失可选参数时整个连接缺席。 |

<a id="schema-232f646566696e6974696f6e732f6d6574726963436172644c61796f75742f70726f706572746965732f6265666f72652f70726f706572746965732f676170"></a>

### `@metricCardLayout.before.gap`

Schema位置：`#/definitions/metricCardLayout/properties/before/properties/gap`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | enum=[4,8,12,16,24] | Schema未设默认；装配/运行时默认见语义说明 | 文字内容盒到两侧卡片的间距，单位CSS px，缺省8；不是卡片内部padding。 |

| 允许值 | 解释与适用条件 |
|---|---|
| 4 | 连接文字两侧各留4 CSS px。 |
| 8 | 连接文字两侧各留8 CSS px。 |
| 12 | 连接文字两侧各留12 CSS px。 |
| 16 | 连接文字两侧各留16 CSS px。 |
| 24 | 连接文字两侧各留24 CSS px。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f64617461"></a>

### `@metricCardComponent.data`

Schema位置：`#/definitions/metricCardComponent/properties/data`。目标：[#/definitions/metricData](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6d657472696344617461)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricData | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件数据槽与页面数据源的显式关联。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@metricCardComponent.props`

Schema位置：`#/definitions/metricCardComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["rows"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@metricCardComponent.props.title`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@metricCardComponent.props.title · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/title/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@metricCardComponent.props.variant`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["summary","activityProgress","compactSummary","dualSummary","compactStrip","compactStack"] | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "summary" | 摘要呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "activityProgress" | 活动进展呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "compactSummary" | 紧凑摘要呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "dualSummary" | 双摘要呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "compactStrip" | 紧凑横条呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |
| "compactStack" | 紧凑纵向堆叠呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e646172795469746c65"></a>

### `@metricCardComponent.props.secondaryTitle`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryTitle`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 次要标题文本。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e646172795469746c652f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryTitle · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryTitle/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f7773"></a>

### `@metricCardComponent.props.rows`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 按结果字段契约命名和校验的数据行。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d73"></a>

### `@metricCardComponent.props.rows[]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.rows[].label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f636f6e74657874"></a>

### `@metricCardComponent.props.rows[].context`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/context`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 上下文说明字段或结构。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f636f6e746578742f616c6c4f662f30"></a>

### `@metricCardComponent.props.rows[].context · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/context/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f76616c75654669656c64"></a>

### `@metricCardComponent.props.rows[].valueField`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6c696e6b"></a>

### `@metricCardComponent.props.rows[].link`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/link`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 把当前列/指标行作为导航入口，需对应navigate。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f756e6974"></a>

### `@metricCardComponent.props.rows[].unit`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@metricCardComponent.props.rows[].unit · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e676573"></a>

### `@metricCardComponent.props.rows[].changes`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 变化项集合，具体形状由所属分支约束。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d73"></a>

### `@metricCardComponent.props.rows[].changes[]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.rows[].changes[].label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@metricCardComponent.props.rows[].changes[].field`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f756e6974"></a>

### `@metricCardComponent.props.rows[].changes[].unit`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@metricCardComponent.props.rows[].changes[].unit · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f746f6e65"></a>

### `@metricCardComponent.props.rows[].changes[].tone`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/tone`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["auto","neutral","positive","danger"] | Schema未设默认；装配/运行时默认见语义说明 | 受控内容语气/正负语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "auto" | 由当前组件既有自动规则选择。 |
| "neutral" | 中性语义。 |
| "positive" | 正向语义。 |
| "danger" | 危险/异常语义。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f636f6c6f7252756c65"></a>

### `@metricCardComponent.props.rows[].changes[].colorRule`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/colorRule`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 数字展示位置的显式颜色规则，只支持number/money；与旧染色声明互斥。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f726f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f636f6c6f7252756c652f616c6c4f662f30"></a>

### `@metricCardComponent.props.rows[].changes[].colorRule · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/rows/items/properties/changes/items/properties/colorRule/allOf/0`。目标：[#/definitions/colorRule](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f636f6c6f7252756c65)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/colorRule | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f7773"></a>

### `@metricCardComponent.props.secondaryRows`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 次要指标行集合。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d73"></a>

### `@metricCardComponent.props.secondaryRows[]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.secondaryRows[].label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f636f6e74657874"></a>

### `@metricCardComponent.props.secondaryRows[].context`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/context`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 上下文说明字段或结构。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f636f6e746578742f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryRows[].context · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/context/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f76616c75654669656c64"></a>

### `@metricCardComponent.props.secondaryRows[].valueField`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6c696e6b"></a>

### `@metricCardComponent.props.secondaryRows[].link`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/link`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 把当前列/指标行作为导航入口，需对应navigate。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f756e6974"></a>

### `@metricCardComponent.props.secondaryRows[].unit`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryRows[].unit · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e676573"></a>

### `@metricCardComponent.props.secondaryRows[].changes`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 变化项集合，具体形状由所属分支约束。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d73"></a>

### `@metricCardComponent.props.secondaryRows[].changes[]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","field"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f6669656c64"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].field`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/field`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面字段引用或字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f756e6974"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].unit`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f756e69742f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].unit · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/unit/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f746f6e65"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].tone`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/tone`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["auto","neutral","positive","danger"] | Schema未设默认；装配/运行时默认见语义说明 | 受控内容语气/正负语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "auto" | 由当前组件既有自动规则选择。 |
| "neutral" | 中性语义。 |
| "positive" | 正向语义。 |
| "danger" | 危险/异常语义。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f636f6c6f7252756c65"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].colorRule`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/colorRule`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 数字展示位置的显式颜色规则，只支持number/money；与旧染色声明互斥。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7365636f6e64617279526f77732f6974656d732f70726f706572746965732f6368616e6765732f6974656d732f70726f706572746965732f636f6c6f7252756c652f616c6c4f662f30"></a>

### `@metricCardComponent.props.secondaryRows[].changes[].colorRule · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/secondaryRows/items/properties/changes/items/properties/colorRule/allOf/0`。目标：[#/definitions/colorRule](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f636f6c6f7252756c65)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/colorRule | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70616e656c4c61796f7574"></a>

### `@metricCardComponent.props.panelLayout`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/panelLayout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["stacked","twoColumn"] | Schema未设默认；装配/运行时默认见语义说明 | 面板内的受控布局。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "stacked" | 堆叠结构。 |
| "twoColumn" | 双列呈现；仅适用于声明该枚举的组件/字段分支，不改变数据契约。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73686f775472656e644172726f7773"></a>

### `@metricCardComponent.props.showTrendArrows`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/showTrendArrows`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示趋势箭头。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f6772657373"></a>

### `@metricCardComponent.props.progress`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["valueField"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 进度呈现相关结构。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f67726573732f70726f706572746965732f76616c75654669656c64"></a>

### `@metricCardComponent.props.progress.valueField`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress/properties/valueField`。目标：[#/definitions/fieldBinding](../field-bindings-and-formats.md#schema-232f646566696e6974696f6e732f6669656c6442696e64696e67)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldBinding | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 主要数值字段绑定。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f67726573732f70726f706572746965732f6c6162656c"></a>

### `@metricCardComponent.props.progress.label`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f67726573732f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@metricCardComponent.props.progress.label · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress/properties/label/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f67726573732f70726f706572746965732f72696e6750657263656e74"></a>

### `@metricCardComponent.props.progress.ringPercent`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/progress/properties/ringPercent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | minimum=0; maximum=100 | Schema未设默认；装配/运行时默认见语义说明 | 环形占比呈现声明。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e73"></a>

### `@metricCardComponent.props.actions`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/actions`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 组件受控交互动作集合。 |

<a id="schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f616374696f6e732f616c6c4f662f30"></a>

### `@metricCardComponent.props.actions · allOf[0]`

Schema位置：`#/definitions/metricCardComponent/properties/props/properties/actions/allOf/0`。目标：[#/definitions/actions](../actions-and-navigation.md#schema-232f646566696e6974696f6e732f616374696f6e73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/actions | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `metric-card-before`：6.34 Dashboard 顶层指标卡前置文字、受控间距与整组跨度。反例：[metric-before-version](../errors/metric-before-version.json)、[metric-before-report](../errors/metric-before-report.json)、[metric-before-tracks](../errors/metric-before-tracks.json)、[metric-before-span](../errors/metric-before-span.json)、[metric-before-empty](../errors/metric-before-empty.json)、[metric-before-gap](../errors/metric-before-gap.json)、[metric-before-nested](../errors/metric-before-nested.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-metricCard.json)：独立完整页面，保留必要语义依赖。
- [summary](../examples/component-metricCard-summary.json)：独立完整页面，保留必要语义依赖。
- [activityProgress](../examples/component-metricCard-activityProgress.json)：独立完整页面，保留必要语义依赖。
- [compactSummary](../examples/component-metricCard-compactSummary.json)：独立完整页面，保留必要语义依赖。
- [dualSummary](../examples/component-metricCard-dualSummary.json)：独立完整页面，保留必要语义依赖。
- [compactStrip](../examples/component-metricCard-compactStrip.json)：独立完整页面，保留必要语义依赖。
- [compactStack](../examples/component-metricCard-compactStack.json)：独立完整页面，保留必要语义依赖。
- [inline-report](../examples/inline-report.json)：完整合法页面；查询仅为静态契约证据。
- [metric-card-equation](../examples/metric-card-equation.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-metricCard.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "total",
  "type": "metricCard",
  "layout": {
    "span": 6
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
```


## 联合分支见证（生成）
