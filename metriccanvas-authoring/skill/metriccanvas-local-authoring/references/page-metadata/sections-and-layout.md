# 内容分区与布局

sections组织有序内容分区，每个分区至少一个组件。默认12列等权网格；columnTracks声明正整数比例，span占轨道数量而非像素。组件自身layout不保存页面派生宽度。

plain去掉分区容器，由组件自带外观；panel为章节面板；card为小节卡片。容器样式只由section.container声明。layer区分content与backdrop；铺底层不占正常内容流，不能伪造一套绝对坐标画布。

## Report 与 Dashboard 标题

标题按页面 `layout` 分别呈现，不存在 `plain` 沿用的共用标题。Dashboard 的默认、plain、panel、card 分区标题统一使用黑色16px、500字重、24px行高、左对齐且无装饰；容器只改变外壳。Report 保留自己的分区层级：默认/plain 为20px蓝色方块标题，panel为32px居中图标标题，card为20px小节标题。`text.props.variant: heading` 在Dashboard使用16px黑色左对齐标题，在Report使用32px居中图标标题。未声明layout仍按Report处理，导出视图保留来源页面的布局形态。

对照入口：`/pages/dashboard-title-styles` 与 `/pages/report-title-styles`；指标卡示例`/pages/metric-card-equation`也使用Dashboard标题，无蓝色方块。

Tab和组合卡是受控容器组件，子项允许类型由各自Schema分支决定；不能据顶层组件目录推断任意嵌套都合法。

## 指标卡连接排布 6.34

`metricCard.layout.before` 由统一运行时派生内部连接排布盒，页面文档仍由内容分区直接包含组件。外层默认 12 列保持；整组占成员 span 之和，内部从文字与双侧间距之外的剩余宽度按 span 分配。连接整组铺满其 span 对应的可用宽度；外层不绘制边框，每张小卡保留独立白底灰边，连接文字两侧gap固定，卡片按span比例吸收剩余宽度。在 plain 分区内，连接排布盒保留白底、16px圆角与20px内边距；在显式 card 分区内，白底与内边距统一由分区承担，连接排布盒不再叠加外框或内边距。标题使用 section.title；filterGroup 作为分区内首个 span:12 组件，放在标题下方并左对齐，后接相邻的 Before 指标卡。无需新增容器字段，也不允许把标题、筛选器塞入 layout.before；筛选影响仍只由 filterBindings 决定。无 before 的页面继续采用原栅格规则。声明、限制与场景见[指标卡](components/metricCard.md#metric-card-before)。

## 页面搭建中的移动与删除

右侧“页面组件”列表也可上下拖动：按条目的垂直中点插入前后位置，沿用画布的内容分区定位与移动校验；跨分区拖入目标条目所属分区。拖动中仅提示落点，松手时提交一次改写；松手后保留列表，支持继续排序及撤销。点击条目仍进入组件配置，取消或落在列表外不改写文档。

页面搭建工作台采用画布就地操作：选中组件旁显示上移、下移与删除，属性面板只保留返回组件清单和展示/布局属性。蓝色微渐变选框与就地操作条只属于创作期，不受页面内容主题的强调色控制，也不写入页面文档。操作条随可见选中组件跟随和避让滚动边界，组件完全离开可见区域时隐藏。

页面搭建工作台通过搭建画布的手柄接收移动意图，组件在同分区或跨分区移动后只改变组件顺序与所属分区，宽度仍使用所属分区的列轨约束并经过完整页面校验。整行组件以垂直中点、同行组件以水平中点划分前后落点；手柄、选中状态、落点及删除按钮均不进入页面文档。

工作台删除顶层组件时保留共享数据源。移动或删除分区最后一个组件后，创作草稿保留空分区身份与顺序；交给查询、保存与统一运行时的正式投影过滤空分区并通过页面校验。正式页面仍至少有一个分区、一个组件；删除全页最后一个组件被明确拒绝，失败不改写当前草稿。受控容器组件随其顶层实体整体移动或删除，暂不提供嵌套子项的独立操作。

移动、宽度和删除共用工作台的本地保护、撤销和显式保存流程。整页预览与保存期间停止搭建操作；输入控件内的 Delete 仍是文字编辑。搭建画布只发出意图，工作台拥有文档改写和撤销。独立集成应用须显式启用 `allowDelete` 并处理 `delete_component` 才展示删除入口。搭建画布配置 `inlineControls: false` 时，标题与宽度交给外部属性面板，同时在选中组件旁提供上移/下移及已启用的删除操作；默认行内标题/宽度入口保留。

完整验收场景为 `pages/platform/platform-canvas-experience.json`，运行步骤及受控端口的证据边界见 `pages/README.md`。本次交互调整未改变 Schema 版本或运行时组件语义。

## 工作台中的保存与组件定位

页面搭建工作台修改页面标题、组件标题、宽度和展示属性时，均先更新同一工作副本并保护到本机，确认保存后才写入页面资产。管理页的独立基本信息表单保留直接保存接口；工作台不通过该接口单独保存标题。动态标题必须显式选择改为固定标题。保存确认和发布继续沿部署已配置的 Chat 或保存端口处理。

顶部“页面管理”复用对话框展示创作、发布及修订信息，不插入画布布局；右侧“页面属性”承载页面呈现规则与日期配置。内部页面/资源身份及未决操作门禁保持原语义。

组件目录选择后定位到目标并显示选框，属性面板的“切换组件”可继续选择其他组件；组件清单拖动排序仍通过原移动意图处理。查询组件的形态选项默认仅展示现有能力约束允许的形态，“查看不可用形态及原因”按需显示候选契约中的全部原因，不放宽数据要求，也不把内联数据转换为查询数据。

完整静态演示为 `pages/platform/platform-interaction-audit.json`，Platform/Playground 入口、合成数据及形态验收的查询页入口见 `pages/platform/README.md`。本批不改变单步撤销模型，也不改变编辑/预览切换的状态所有权。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

6.35新增的就地条件与层级状态语义见[条件显隐与动作资格](conditions.md)，旧页面原有行为保持。


页面协议 6.74。结构真源为本册[schema.json](schema.json)，SHA256 `d7527d07711d9f6d1ece4d65422d403b5b941a78fdb47a1484ace6a3f46d745d`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e744964"></a>

### `@componentId`

Schema位置：`#/definitions/componentId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 类型/分支 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574"></a>

### `@componentLayout`

Schema位置：`#/definitions/componentLayout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["span"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f75742f70726f706572746965732f7370616e"></a>

### `@componentLayout.span`

Schema位置：`#/definitions/componentLayout/properties/span`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=12 | Schema未设默认；装配/运行时默认见语义说明 | 占用列轨数量，不是百分比或像素。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f75742f70726f706572746965732f636f6e6e65637450726576696f7573"></a>

### `@componentLayout.connectPrevious`

Schema位置：`#/definitions/componentLayout/properties/connectPrevious`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 与前一个内容块的连接关系，删除须考虑该依赖。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f75742f70726f706572746965732f6c61796572"></a>

### `@componentLayout.layer`

Schema位置：`#/definitions/componentLayout/properties/layer`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | content正常内容层或backdrop铺底层。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f75742f70726f706572746965732f6c617965722f616c6c4f662f30"></a>

### `@componentLayout.layer · allOf[0]`

Schema位置：`#/definitions/componentLayout/properties/layer/allOf/0`。目标：[#/definitions/componentLayer](sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayer | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796572"></a>

### `@componentLayer`

Schema位置：`#/definitions/componentLayer`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 类型/分支 | enum=["backdrop"] | Schema未设默认；装配/运行时默认见语义说明 | backdrop 铺满分区并置于同分区其余组件之下；省略为普通流 |

| 允许值 | 解释与适用条件 |
|---|---|
| "backdrop" | 铺底层，不占正常内容流。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e"></a>

### `@section`

Schema位置：`#/definitions/section`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","components"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f6964"></a>

### `@section.id`

Schema位置：`#/definitions/section/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f76697369626c655768656e"></a>

### `@section.visibleWhen`

Schema位置：`#/definitions/section/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@section.visibleWhen · allOf[0]`

Schema位置：`#/definitions/section/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f7469746c65"></a>

### `@section.title`

Schema位置：`#/definitions/section/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `@section.title · allOf[0]`

Schema位置：`#/definitions/section/properties/title/allOf/0`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6e7461696e6572"></a>

### `@section.container`

Schema位置：`#/definitions/section/properties/container`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 内容分区容器呈现。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6e7461696e65722f616c6c4f662f30"></a>

### `@section.container · allOf[0]`

Schema位置：`#/definitions/section/properties/container/allOf/0`。目标：[#/definitions/sectionContainer](sections-and-layout.md#schema-232f646566696e6974696f6e732f73656374696f6e436f6e7461696e6572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/sectionContainer | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e436f6e7461696e6572"></a>

### `@sectionContainer`

Schema位置：`#/definitions/sectionContainer`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 类型/分支 | enum=["plain","panel","card"] | Schema未设默认；装配/运行时默认见语义说明 | plain 无容器组件自带外观；panel 渐变章节面板+居中图标标题+内层白底；card 白色小节卡片+左对齐小标题 |

| 允许值 | 解释与适用条件 |
|---|---|
| "plain" | 普通呈现；分区为无额外容器，文本/单元格按各模块普通样式解释。 |
| "panel" | 章节面板容器。 |
| "card" | 小节卡片容器。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6c756d6e547261636b73"></a>

### `@section.columnTracks`

Schema位置：`#/definitions/section/properties/columnTracks`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 分区列轨比例；正整数权重，不是像素宽度。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6c756d6e547261636b732f616c6c4f662f30"></a>

### `@section.columnTracks · allOf[0]`

Schema位置：`#/definitions/section/properties/columnTracks/allOf/0`。目标：[#/definitions/sectionColumnTracks](sections-and-layout.md#schema-232f646566696e6974696f6e732f73656374696f6e436f6c756d6e547261636b73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/sectionColumnTracks | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e436f6c756d6e547261636b73"></a>

### `@sectionColumnTracks`

Schema位置：`#/definitions/sectionColumnTracks`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 类型/分支 | minItems=1; maxItems=12 | Schema未设默认；装配/运行时默认见语义说明 | 内容分区的受控列轨权重；缺省为 12 条等权列 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e436f6c756d6e547261636b732f6974656d73"></a>

### `@sectionColumnTracks[]`

Schema位置：`#/definitions/sectionColumnTracks/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 每个数组项 | minimum=1; maximum=1000 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e7473"></a>

### `@section.components`

Schema位置：`#/definitions/section/properties/components`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 受控子组件集合；容器白名单与顶层集合不同。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d73"></a>

### `@section.components[]`

Schema位置：`#/definitions/section/properties/components/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f30"></a>

### `@section.components[] · oneOf[0]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/0`。目标：[#/definitions/reportHeaderComponent](components/reportHeader.md#schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/reportHeaderComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f31"></a>

### `@section.components[] · oneOf[1]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/1`。目标：[#/definitions/metricCardComponent](components/metricCard.md#schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f32"></a>

### `@section.components[] · oneOf[2]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/2`。目标：[#/definitions/barChartComponent](components/barChart.md#schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/barChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f33"></a>

### `@section.components[] · oneOf[3]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/3`。目标：[#/definitions/lineChartComponent](components/lineChart.md#schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/lineChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f34"></a>

### `@section.components[] · oneOf[4]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/4`。目标：[#/definitions/pieChartComponent](components/pieChart.md#schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f35"></a>

### `@section.components[] · oneOf[5]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/5`。目标：[#/definitions/tableComponent](components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f36"></a>

### `@section.components[] · oneOf[6]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/6`。目标：[#/definitions/mapChartComponent](components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f37"></a>

### `@section.components[] · oneOf[7]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/7`。目标：[#/definitions/gaugeComponent](components/gauge.md#schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/gaugeComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f38"></a>

### `@section.components[] · oneOf[8]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/8`。目标：[#/definitions/tabContainerComponent](components/tabContainer.md#schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tabContainerComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f39"></a>

### `@section.components[] · oneOf[9]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/9`。目标：[#/definitions/compositeCardComponent](components/compositeCard.md#schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compositeCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3130"></a>

### `@section.components[] · oneOf[10]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/10`。目标：[#/definitions/rankingCardComponent](components/rankingCard.md#schema-232f646566696e6974696f6e732f72616e6b696e6743617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rankingCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3131"></a>

### `@section.components[] · oneOf[11]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/11`。目标：[#/definitions/rankingDetailCardComponent](components/rankingDetailCard.md#schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rankingDetailCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3132"></a>

### `@section.components[] · oneOf[12]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/12`。目标：[#/definitions/keyValuePanelComponent](components/keyValuePanel.md#schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/keyValuePanelComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3133"></a>

### `@section.components[] · oneOf[13]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/13`。目标：[#/definitions/categoryBreakdownComponent](components/categoryBreakdown.md#schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/categoryBreakdownComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3134"></a>

### `@section.components[] · oneOf[14]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/14`。目标：[#/definitions/fieldTextComponent](components/fieldText.md#schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldTextComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3135"></a>

### `@section.components[] · oneOf[15]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/15`。目标：[#/definitions/textComponent](components/text.md#schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3136"></a>

### `@section.components[] · oneOf[16]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/16`。目标：[#/definitions/aiSummaryComponent](components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3137"></a>

### `@section.components[] · oneOf[17]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/17`。目标：[#/definitions/buttonComponent](components/button.md#schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/buttonComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656374696f6e2f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3138"></a>

### `@section.components[] · oneOf[18]`

Schema位置：`#/definitions/section/properties/components/items/oneOf/18`。目标：[#/definitions/filterGroupComponent](components/filterGroup.md#schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/filterGroupComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `section-id-unique`：内容分区 id 唯一。反例：[duplicate-section-id](errors/duplicate-section-id.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `component-id-unique`：组件 id 在整页（含容器内）唯一。反例：[duplicate-component-id](errors/duplicate-component-id.json)、[duplicate-component-id-in-container](errors/duplicate-component-id-in-container.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `layer-top-level-only`：layout.layer 只能声明在内容分区的顶层组件上。反例：[layer-inside-composite-card](errors/layer-inside-composite-card.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `single-backdrop-per-section`：一个分区最多一个 backdrop。反例：[two-backdrops](errors/two-backdrops.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `backdrop-needs-siblings`：声明 backdrop 的分区必须还有别的组件叠在其上。反例：[backdrop-only-section](errors/backdrop-only-section.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `backdrop-container-plain`：声明 backdrop 的分区必须使用 container: plain。反例：[backdrop-in-card-container](errors/backdrop-in-card-container.json)、[backdrop-without-container](errors/backdrop-without-container.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `column-track-span`：声明列轨的分区里顶层组件 span 不得超过轨数。反例：[span-exceeds-column-tracks](errors/span-exceeds-column-tracks.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [composite-page](examples/composite-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [dashboard-title-styles](examples/dashboard-title-styles.json)：完整合法页面；查询仅为静态契约证据。
- [report-title-styles](examples/report-title-styles.json)：完整合法页面；查询仅为静态契约证据。

## 联合分支见证（生成）

- `#/definitions/section/properties/components/items/oneOf/0`：[合法完整页面](examples/component-reportHeader.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/1`：[合法完整页面](examples/component-metricCard.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/2`：[合法完整页面](examples/component-barChart.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/3`：[合法完整页面](examples/component-lineChart.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/4`：[合法完整页面](examples/component-pieChart.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/5`：[合法完整页面](examples/component-table.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/6`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/7`：[合法完整页面](examples/component-gauge.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/8`：[合法完整页面](examples/component-tabContainer.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/9`：[合法完整页面](examples/component-compositeCard.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/10`：[合法完整页面](examples/component-rankingCard.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/11`：[合法完整页面](examples/component-rankingDetailCard.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/12`：[合法完整页面](examples/component-keyValuePanel.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/13`：[合法完整页面](examples/component-categoryBreakdown.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/14`：[合法完整页面](examples/component-fieldText.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/15`：[合法完整页面](examples/component-text.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/16`：[合法完整页面](examples/component-aiSummary.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/17`：[合法完整页面](examples/component-button.json)，JSON Pointer `#/sections/0/components/0`。
- `#/definitions/section/properties/components/items/oneOf/18`：[合法完整页面](examples/component-filterGroup.json)，JSON Pointer `#/sections/0/components/0`。
