# AI 总结 aiSummary

仅适用于 Report 布局。后端已生成的 AI 正文与按页头时间条件生成的区域分析使用同一个组件；普通说明继续使用 text。

## 模式与范围

`mode: provided` 必须提供非空 `body`，不声明生成提示词、范围或 initial；无需 AI 接口。`body` 支持现有受控 semantic HTML。

`mode: generated` 必须提供非空 `promptTemplate`，并声明 `relatedDataSource` 或 `relatedSections`。`relatedDataSource: ["sales-summary", "regional-comparison"]`（6.52）直接引用页面数据源 ID，不再重复声明 source、description、fields 或 field/term 映射；采用结果字段契约内全部非明细字段及原有标签、类型、单位等信息。ID 必须存在、列表非空且不能重复，顺序不影响生成输入和缓存。显式数据源优先于 relatedSections。

未声明显式数据源时，`relatedSections` 按内容分区 id 收集当前可见组件的数据槽，包含活动 Tab 与组合卡子组件；去重后选择结果字段契约内全部非明细字段，不跟随其他 AI 总结、其他分区或查询上游。显隐沿用统一 visibleWhen 投影。

省略 mode 的旧动态声明按 generated 读取。旧 `relatedData` 保留读取兼容及原字段白名单、术语映射规则；新页面使用 relatedDataSource，两者不能同时声明。旧显式声明仍优先于 relatedSections。需要缩小分析字段范围时，引用专门提供该范围的页面数据源。

可选 `initial: { body, inputKey }` 提供动态模式首屏正文。inputKey 必须等于 `aiSummaryInputKey(question, contextInfo)` 的结果；条件、范围或数据变化后不复用不匹配的正文。不要将只有正文、没有输入绑定的结果用作动态首屏缓存。

## 查询与生成

Report 页头时间筛选仍由 filterBindings 控制既有查询。关联查询退出 loading 后冻结实际查询条件、时间范围、字段含义、单位、结果范围、数据与状态，再提交生成任务。空结果与失败如实交给分析实现，不由引擎决定业务分析是否可行。数据按选定数据源的非明细结果字段投影（旧声明沿用字段白名单），不静默截断或自动发起全量查询。

集成应用注入 `aiSummary: { generate(question, contextInfo): Promise<string> }`。question 由业务提示词和固定输出约束组成；contextInfo 含页面/修订/组件、区域、页头时间筛选与 dataSources。每份数据源含 id、业务说明、字段、实际生效查询、结果范围和查询快照。页面 JSON 不得保存地址、鉴权、函数或 SSE 协议。SSE 构建与流累积由 Adapter 独占，组件只接收完整字符串。

## 会话与缓存

同一个 aiSummary 注入对象代表同一应用会话，跨报表复用。组件卸载或切换时间只取消订阅，已启动请求继续完成并缓存。缓存按页面文档/修订、摘要身份、实际分析范围、查询条件、字段、数据状态、提示词与输出约束版本精确匹配。相同输入复用已完成结果或正在执行的任务；重试显式重新调用。

默认每个摘要每秒最多启动一次、全局并发 2；窗口/队列内只保留每个区域最新待启动任务，已启动任务不取消。throttleMs、concurrency、maxEntries、ttlMs 属于集成应用配置。默认保留最多 100 份未订阅完成结果，30 分钟过期；执行中和正在展示的结果不因缓存清理而丢失。身份/环境变化时更换注入对象。刷新浏览器清空缓存，不使用持久存储。

## 呈现与导出

默认完整摘要直接复用 SDT 页头“报告摘要”的 ReportSummary 呈现：渐变面板、居中双侧装饰标题、白色内框、浅紫描边正文、18px 字号与 32px 行高；默认标题为“报告摘要”，可用 title 修改。显式 variant: reportInline 保留紧凑行内形态，复用 TextBlock 的对应呈现。

只展示完整结果。合规 HTML 由共享 SemanticHtml 渲染；标签、属性、语义类或闭合结构不合规时提取可读纯文字，保留段落与换行，不执行 HTML、脚本或加载资源。纯文字降级结果也属于可缓存、可导出的成功正文。空响应或调用失败显示组件局部错误，可手动重试。此容错不改变其他 semanticHtml 消费者的严格契约。

导出冻结当前条件下已完成正文及其呈现格式；未完成或失败显示状态占位，不调用 AI，不导出半截内容或其他时间的结论。

## 本地示例与接入

Playground：`/pages/report-ai-summary`。双区域、直接正文与结构降级共用既有 Report 呈现；对照区域使用 relatedDataSource，业务用量区域使用 relatedSections。forecast-page 仅保留为旧 relatedData 读取兼容样例。

云宝助手 Adapter 集中在 ai-summary/adapters/yunbao-assistant.ts，通过 @metriccanvas/engine/ui/ai-summary/yunbao-assistant 独立入口注入；当前明确为本地 Mock。具体替换位置见集成应用的接入说明。内网替换 generate 函数体，保持两参数和 Promise<string>；自行构建 SSE、消费事件并累积正文。Playground 与 Platform 共用该实现。真实云宝、DQE/Relay 与内网身份联调独立验收。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.52。结构真源为本册[schema.json](../schema.json)，SHA256 `935df063e0ef892c7a908ca0e4a93ec17c54f74662db2b3b761817199c83e5d0`。字段表自动生成；可选不等于有默认值。

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

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@aiSummaryComponent.visibleWhen`

Schema位置：`#/definitions/aiSummaryComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@aiSummaryComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/aiSummaryComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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
| "object" | 本分支必填 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

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

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6d6f6465"></a>

### `@aiSummaryComponent.props.mode`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["provided","generated"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "provided" | 直接展示后端已生成正文，不调用 AI。 |
| "generated" | 根据提示词和区域输入异步生成，支持绑定首屏正文。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f626f6479"></a>

### `@aiSummaryComponent.props.body`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/body`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 静态正文或页面参数文本取值；bodyFormat决定是否走受控语义HTML。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f696e697469616c"></a>

### `@aiSummaryComponent.props.initial`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/initial`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["body","inputKey"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 与声明查询条件匹配的内嵌初始行。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f696e697469616c2f70726f706572746965732f626f6479"></a>

### `@aiSummaryComponent.props.initial.body`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/initial/properties/body`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 静态正文或页面参数文本取值；bodyFormat决定是否走受控语义HTML。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f696e697469616c2f70726f706572746965732f696e7075744b6579"></a>

### `@aiSummaryComponent.props.initial.inputKey`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/initial/properties/inputKey`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1; pattern="\\S" | Schema未设默认；装配/运行时默认见语义说明 | 与生成输入精确匹配的 aiSummaryInputKey(question, contextInfo) 标识 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f70726f6d707454656d706c617465"></a>

### `@aiSummaryComponent.props.promptTemplate`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/promptTemplate`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1; pattern="\\S" | Schema未设默认；装配/运行时默认见语义说明 | 动态总结业务提示词；数据范围由 relatedDataSource 或 relatedSections 确定。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656444617461536f75726365"></a>

### `@aiSummaryComponent.props.relatedDataSource`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedDataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 直接引用页面数据源 ID，采用其全部非明细结果字段；优先于 relatedSections |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656444617461536f757263652f6974656d73"></a>

### `@aiSummaryComponent.props.relatedDataSource[]`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedDataSource/items`。目标：[#/definitions/aiSummaryDataSourceReference](../components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d61727944617461536f757263655265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryDataSourceReference | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727944617461536f757263655265666572656e6365"></a>

### `@aiSummaryDataSourceReference`

Schema位置：`#/definitions/aiSummaryDataSourceReference`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 类型/分支 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656453656374696f6e73"></a>

### `@aiSummaryComponent.props.relatedSections`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedSections`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 未显式声明数据源时，收集指定内容分区的可见组件所引用的非明细数据 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656453656374696f6e732f6974656d73"></a>

### `@aiSummaryComponent.props.relatedSections[]`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedSections/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656444617461"></a>

### `@aiSummaryComponent.props.relatedData`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedData`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 旧声明读取兼容；新页面使用 relatedDataSource |

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

- `ai-summary-related-data`：AI 总结关联数据引用已声明数据源中的非明细字段，不重复且术语一致。反例：[ai-summary-unknown-source](../errors/ai-summary-unknown-source.json)、[ai-summary-unknown-field](../errors/ai-summary-unknown-field.json)、[ai-summary-detail-field](../errors/ai-summary-detail-field.json)、[ai-summary-duplicate-field](../errors/ai-summary-duplicate-field.json)、[ai-summary-term-conflict](../errors/ai-summary-term-conflict.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `report-ai-summary`：AI 总结仅用于 Report，模式与区域引用必须明确。反例：[ai-summary-dashboard](../errors/ai-summary-dashboard.json)、[ai-summary-unknown-section](../errors/ai-summary-unknown-section.json)、[ai-summary-mixed-mode](../errors/ai-summary-mixed-mode.json)、[ai-summary-scope-required](../errors/ai-summary-scope-required.json)、[ai-summary-version-floor](../errors/ai-summary-version-floor.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-aiSummary.json)：独立完整页面，保留必要语义依赖。
- [reportInline](../examples/component-aiSummary-reportInline.json)：独立完整页面，保留必要语义依赖。
- [forecast-page](../examples/forecast-page.json)：完整合法页面；查询仅为静态契约证据。
- [report-ai-summary](../examples/report-ai-summary.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-aiSummary.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "fallback-summary",
  "type": "aiSummary",
  "layout": {
    "span": 12
  },
  "props": {
    "mode": "provided",
    "title": "结构容错示例",
    "body": "<h3>可读结论</h3><p><strong>标签未闭合仍展示文字"
  }
}
```


## 联合分支见证（生成）
