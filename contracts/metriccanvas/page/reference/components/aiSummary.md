# AI 总结 aiSummary

仅适用于 Report 布局。已有正文与按页头时间条件生成的区域分析使用同一个组件；普通说明继续使用 text。

## 正文与范围

从 6.54 起无需声明 mode：`body` 为非空字符串（去除首尾空白后判断）时，直接展示原正文，支持受控 semantic HTML 或纯文本。摘要不调用 AI、不触发关联取数，不需要 generate 配置；同时存在的生成配置不参与此时的取数、字段校验与生成。Report 其他组件照常运行。时间切换不会自动清空正文或重新生成。

```json
{
  "body": "<p>本期分析结论……</p>"
}
```

未声明 body、body 为空字符串或纯空白时，使用非空 `promptTemplate` 与 `relatedDataSources`、`relatedSections` 或 `scope: "container"` 生成摘要；缺少这些配置时报告配置错误。

```json
{
  "promptTemplate": "分析当前期间的用量变化。",
  "relatedDataSources": ["usage"]
}
```

`relatedDataSources: ["sales-summary", "regional-comparison"]`（6.53）直接引用页面数据源 ID，采用结果字段契约内全部非明细字段及原有标签、类型、单位等信息，不重复声明字段映射。生成时 ID 必须存在、列表非空且不能重复，顺序不影响生成输入与缓存；显式数据源优先于 relatedSections。

未声明显式数据源时，`relatedSections` 按内容分区 ID 收集当前可见组件的数据槽，包含活动 Tab 与组合卡子组件；去重后选择全部非明细结果字段，不跟随其他 AI 总结、其他分区或查询上游。显隐沿用统一 visibleWhen 投影。

旧 mode、initial 声明仅保留历史读取兼容，当前用法不需要首屏输入绑定参数；运行分支以 body 是否非空为准。6.52 单数 relatedDataSource 和旧 relatedData 字段白名单保留读取兼容；生成时新旧数据源声明不能同时配置。当前创作统一使用 relatedDataSources。

## 容器组合与顶部位置（6.58）

同一个 aiSummary 可独立摆放，也可作为组合卡的子组件，与原有准入的指标、图表等内容组合。内容分区支持整行区域，组合卡支持横向并排区域，Tab 沿用现有内容及嵌套规则；本能力不扩展其他组件准入或递归布局。

`scope: "container"` 显式总结直接拥有当前摘要的内容集合：内容分区的组件、组合卡的子组件，或当前摘要所属 Tab 页签的内容。动态生成时与 relatedDataSources、relatedSections 及旧范围声明互斥。未选择此选项时，摆放位置不会隐式改变显式范围。非空 body 仍优先直显并跳过生成配置。

```json
{
  "title": "本区域总结",
  "variant": "reportInline",
  "promptTemplate": "仅根据本区域的数据概括变化。",
  "scope": "container"
}
```

仅收集区域内可见组件引用的页面数据源，去重并采用全部非明细字段；嵌套 Tab 只收集活动页签。文字、标题及其他摘要正文不进入 datasource 请求或分析输入，不跟随查询上游，不额外查询。表格搜索、分页及行显隐仍沿用既有数据快照语义，不改成屏幕可见行总结。contextInfo 在此模式增加可选 region（kind、id、sectionId），准确绑定所在区域与缓存输入。

6.58 起，摘要必须连续排在所属区域的正文组件序列最前，Report 页头与区域标题仍在其之前；摘要的 layout.span 必须占满所在区域列轨（组合卡/Tab 为 12，内容分区按 columnTracks 数量或默认 12），且不能作为铺底层。独立摘要所在的纯摘要分区必须位于页面其他正文之前。校验失败报告摘要的精确路径，不在运行时偷偷重排。

旧版本继续按原声明顺序读取；normalizePageDocument 升级为当前写出版本时会检查顶部约束，位置不合规时返回错误，需作者先显式调整原文档。组合卡内摘要与 scope 字段的最低版本均为 6.58。连续多份顶部摘要允许，正文直显也须遵守位置规则。

场景 `/pages/report-ai-summary-regions` 使用合成 inline 数据与本地 Mock，覆盖页面摘要、内容分区、并排组合卡与 Tab 页签；卡内摘要复用既有 reportInline，页面摘要复用 ReportSummary。

## 查询与生成

Report 页头时间筛选由 filterBindings 控制既有查询。无正文时，关联查询退出 loading 后冻结实际查询条件、时间范围、字段含义、单位、结果范围、数据与状态，再提交生成任务。空结果与失败如实交给分析实现。数据按选定数据源的非明细结果字段投影，不静默截断或自动发起全量查询。

集成应用注入 `aiSummary: { generate(question, contextInfo): Promise<string> }`。question 由业务提示词和固定输出约束组成；contextInfo 含页面、修订、组件、区域、页头时间筛选与 dataSources。页面 JSON 不保存端点、鉴权、函数或 SSE 协议；SSE 构建和正文累积由 Adapter 负责，组件接收完整字符串。

## 会话与缓存

同一个 aiSummary 注入对象代表同一应用会话。无正文的摘要切换时间或卸载时只退订，已启动请求继续完成并缓存。缓存按页面文档/修订、摘要身份、实际范围、查询、字段、数据状态、提示词和输出约束精确匹配；相同输入复用已完成或执行中的任务。

默认每个摘要每秒最多启动一次、全局并发 2；待启动队列只保留每个区域最新输入，已启动任务不取消。默认保留最多 100 份未订阅完成结果，30 分钟过期；正在执行和展示的结果不因清理丢失。刷新浏览器清空缓存。

## 呈现与导出

默认完整复用 SDT“报告摘要”的 ReportSummary：渐变背景、白色内框、浅紫描边内容区三层结构；默认标题为“报告摘要”，可用 title 修改。显式 variant: reportInline 使用既有紧凑 TextBlock。

合规 HTML 按语义渲染；结构不合规时提取安全可读文字并保留换行，不执行脚本或加载资源。纯文本回退也可缓存和导出。无正文生成时，空响应或失败显示局部错误并支持重试。

非空 body 优先用于导出；动态结果冻结当前条件下的完整正文。未完成或失败显示状态占位，不额外调用 AI，不使用其他时间的结论。

## 本地示例与接入

Playground：`/pages/report-ai-summary`。直接正文、结构回退与双区域动态摘要都省略 mode；对照区域使用 relatedDataSources，用量区域使用 relatedSections。forecast-page 保留为旧 relatedData 读取兼容样例。

云宝实现在 ai-summary/adapters/yunbao-assistant.ts，通过 @metriccanvas/engine/ui/ai-summary/yunbao-assistant 独立注入。当前是本地 Mock；内网替换 generate 函数体即可。真实云宝、DQE/Relay 与身份联调独立验收。

## 查阅方式

字段与联合分支以生成结构表为准。完整页面用于结构/语义校验，渲染行为结合浏览器证据。返回[模块索引](../README.md)。


页面协议 6.70。结构真源为本册[schema.json](../schema.json)，SHA256 `67288605b6f6dd184ce097844c86c313d7d6e9ce0df1883c6a24f748a82da711`。字段表自动生成；可选不等于有默认值。

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
| "string" | 本分支可选 | enum=["provided","generated"] | Schema未设默认；装配/运行时默认见语义说明 | 旧声明读取兼容；当前由 body 是否非空决定直接展示或生成，无需 mode |

| 允许值 | 解释与适用条件 |
|---|---|
| "provided" | 历史值；当前按非空 body 直接展示，无需 mode。 |
| "generated" | 历史值；当前无正文时根据提示词和范围生成，无需 mode。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f626f6479"></a>

### `@aiSummaryComponent.props.body`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/body`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 非空时直接渲染且不调用 AI；省略、空字符串或纯空白时按提示词和关联范围生成 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f696e697469616c"></a>

### `@aiSummaryComponent.props.initial`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/initial`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["body","inputKey"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 历史动态首屏缓存声明，仅保留读取兼容；当前用法无需 initial 或 inputKey |

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
| "string" | 本分支可选 | minLength=1; pattern="\\S" | Schema未设默认；装配/运行时默认见语义说明 | 动态总结业务提示词；数据范围由 relatedDataSources 或 relatedSections 确定。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f73636f7065"></a>

### `@aiSummaryComponent.props.scope`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/scope`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="container" | Schema未设默认；装配/运行时默认见语义说明 | 显式总结直接拥有当前摘要的内容分区、组合卡或 Tab 页签；与其他范围声明互斥，文字不进入分析输入 |

| 允许值 | 解释与适用条件 |
|---|---|
| "container" | 当前容器作为交互/呈现作用域。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656444617461536f7572636573"></a>

### `@aiSummaryComponent.props.relatedDataSources`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedDataSources`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 页面数据源 ID 数组，采用其全部非明细结果字段；优先于 relatedSections |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656444617461536f75726365732f6974656d73"></a>

### `@aiSummaryComponent.props.relatedDataSources[]`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedDataSources/items`。目标：[#/definitions/aiSummaryDataSourceReference](../components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d61727944617461536f757263655265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryDataSourceReference | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d61727944617461536f757263655265666572656e6365"></a>

### `@aiSummaryDataSourceReference`

Schema位置：`#/definitions/aiSummaryDataSourceReference`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 类型/分支 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656444617461536f75726365"></a>

### `@aiSummaryComponent.props.relatedDataSource`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedDataSource`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 6.52 旧拼写，仅保留读取兼容；新页面使用 relatedDataSources |

<a id="schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f72656c6174656444617461536f757263652f6974656d73"></a>

### `@aiSummaryComponent.props.relatedDataSource[]`

Schema位置：`#/definitions/aiSummaryComponent/properties/props/properties/relatedDataSource/items`。目标：[#/definitions/aiSummaryDataSourceReference](../components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d61727944617461536f757263655265666572656e6365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryDataSourceReference | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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
| "object" | 本分支可选 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"}; minProperties=1 | Schema未设默认；装配/运行时默认见语义说明 | 旧声明读取兼容；新页面使用 relatedDataSources |

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
- `report-ai-summary`：AI 总结仅用于 Report，非空 body 直接展示，否则需要生成提示词与范围。反例：[ai-summary-dashboard](../errors/ai-summary-dashboard.json)、[ai-summary-unknown-section](../errors/ai-summary-unknown-section.json)、[ai-summary-blank-body-without-input](../errors/ai-summary-blank-body-without-input.json)、[ai-summary-body-routing-version](../errors/ai-summary-body-routing-version.json)、[ai-summary-scope-required](../errors/ai-summary-scope-required.json)、[ai-summary-version-floor](../errors/ai-summary-version-floor.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `ai-summary-regions`：AI 总结可进入组合卡，显式总结所属区域且位于区域或页面正文顶部。反例：[ai-summary-region-version](../errors/ai-summary-region-version.json)、[ai-summary-region-mixed-scope](../errors/ai-summary-region-mixed-scope.json)、[ai-summary-region-not-top](../errors/ai-summary-region-not-top.json)、[ai-summary-page-not-top](../errors/ai-summary-page-not-top.json)、[ai-summary-region-not-full-width](../errors/ai-summary-region-not-full-width.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-aiSummary.json)：独立完整页面，保留必要语义依赖。
- [reportInline](../examples/component-aiSummary-reportInline.json)：独立完整页面，保留必要语义依赖。
- [forecast-page](../examples/forecast-page.json)：完整合法页面；查询仅为静态契约证据。
- [report-ai-summary](../examples/report-ai-summary.json)：完整合法页面；查询仅为静态契约证据。
- [report-ai-summary-regions](../examples/report-ai-summary-regions.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-aiSummary.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "fallback-summary",
  "type": "aiSummary",
  "layout": {
    "span": 12
  },
  "props": {
    "title": "结构容错示例",
    "body": "<h3>可读结论</h3><p><strong>标签未闭合仍展示文字"
  }
}
```

- 源码/验证定位：`packages/page/src/schema/components/ai-summary.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/runtime-ui/tests/ai-summary-input.test.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/runtime-ui/tests/ai-summary-tasks.test.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/shared/ReportSummary.svelte`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/report-ai-summary.spec.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/ai-summary-region.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/tests/ai-summary-regions.test.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/ai-summary-regions.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）
