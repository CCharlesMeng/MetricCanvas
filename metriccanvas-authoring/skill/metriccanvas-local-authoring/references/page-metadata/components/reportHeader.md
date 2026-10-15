# 报告页头 reportHeader

表达页面标题、说明、时间点与标签；副标题可显式使用受控语义 HTML。适用于任何完整页面的开头。数据形状：不绑定页面数据源。

页面内容页头；title为必需文本取值，可引用必需页面参数或当前已应用筛选；6.23 起可用 `{parts:[{filter:"report-month",format:"period"}," 经营分析报告"]}` 组合动态期间与固定名称，规则见[文本片段组合](../params-and-text-values.md#文本片段组合623)。页面meta.title是另一个页面级声明，不替代该组件必填title。

dashboard 的筛选器由统一工具栏呈现，reportHeader 禁止配置 filterIds；下述日期工具带只用于 report。

filterIds（6.13）按序引用页面 timePoint/timeRange 筛选器，采用封面上方独立工具带；宽容器右对齐，窄容器换行。控件使用运行时筛选状态，不拥有查询。6.15 起 filterIds 仅决定控件位置，不自动创建或覆盖 asOf。期间文字使用 asOf.value: {filter: 筛选器id, format: "period"} 显式引用当前已应用值；字面量保持静态，param 引用保持打开时的参数值。6.13/6.14 继续按旧的期间派生规则读取。导出保留捕获时已经解析的静态文字。

## 内置 PDF 下载（6.28）

`pdfExport: {label?, filename?}` 对象存在即显示下载按钮；省略时不显示。label默认“下载 PDF”，filename默认触发页头标题。两项都是非空文本取值，支持参数、已应用筛选引用和显式parts；点击时捕获，后续筛选变化不改变本次文件名。文件名自动清理不合法字符并补`.pdf`，不执行模板表达式。

只允许Report顶层页头。下载按钮与filterIds共用封面上方工具带，无日期控件也可单独显示；下载范围是整份报告。按钮为白底描边；准备和生成状态在按钮文字中切换，生成中禁用重复点击并显示取消。成功或取消后恢复配置名称，不保留成功提示；失败显示“下载失败，重试”，悬停提示具体原因。导出不包含工具带。内置编码由引擎负责，集成应用不需安装PDF库；原withExportView自定义入口保留。

A4默认竖向，存在引擎标记的宽内容时整份横向；采用零外边距，保持页面自身样式和间距，按原有排布连续切片；不按章节强制换页，不重复插入表头或添加页码。图片正文以有界批次截图并快速无损编码，全部成功才发起文件下载。整页沿用部分取数失败时保留可用内容、每结果10000行和准备60秒的现行策略；取消、页面文档更新或实例销毁时中止并清理。超页高的图表、卡片或正文块跨纸张连续承接，不移动内容或丢弃中间像素。完整作者页面见`report-pdf-export`示例（本地合成数据）；静态校验不证明查询完整性、浏览器下载效果或真实部署联通。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。


页面协议 6.28。结构真源为本册[schema.json](../schema.json)，SHA256 `e4ef9aa696ed7bd39653228254b69104052b30215c458fffd42d6b987af71fc0`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e74"></a>

### `@reportHeaderComponent`

Schema位置：`#/definitions/reportHeaderComponent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","layout","props"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f6964"></a>

### `@reportHeaderComponent.id`

Schema位置：`#/definitions/reportHeaderComponent/properties/id`。目标：[#/definitions/componentId](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744964)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentId | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f74797065"></a>

### `@reportHeaderComponent.type`

Schema位置：`#/definitions/reportHeaderComponent/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="reportHeader" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "reportHeader" | 用于选择@reportHeaderComponent.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f6c61796f7574"></a>

### `@reportHeaderComponent.layout`

Schema位置：`#/definitions/reportHeaderComponent/properties/layout`。目标：[#/definitions/componentLayout](../sections-and-layout.md#schema-232f646566696e6974696f6e732f636f6d706f6e656e744c61796f7574)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/componentLayout | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f7073"></a>

### `@reportHeaderComponent.props`

Schema位置：`#/definitions/reportHeaderComponent/properties/props`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | required=["title"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 组件的受控呈现配置。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7469746c65"></a>

### `@reportHeaderComponent.props.title`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/title`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f66696c746572496473"></a>

### `@reportHeaderComponent.props.filterIds`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/filterIds`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 页头按序引用已声明的日期筛选器；同一控件只出现一次，期间文字使用当前已应用筛选。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f66696c7465724964732f6974656d73"></a>

### `@reportHeaderComponent.props.filterIds[]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/filterIds/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7064664578706f7274"></a>

### `@reportHeaderComponent.props.pdfExport`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pdfExport`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 6.28：对象存在即启用引擎内置PDF下载；仅用于Report顶层页头，与日期控件共用工具带。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7064664578706f72742f70726f706572746965732f6c6162656c"></a>

### `@reportHeaderComponent.props.pdfExport.label`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pdfExport/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 下载按钮名称；默认“下载 PDF”，支持参数、已应用筛选引用与文本片段组合。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7064664578706f72742f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.pdfExport.label · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pdfExport/properties/label/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7064664578706f72742f70726f706572746965732f66696c656e616d65"></a>

### `@reportHeaderComponent.props.pdfExport.filename`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pdfExport/properties/filename`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 下载文件名；默认触发页头标题，自动清理文件名并补.pdf；点击时捕获文本值。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7064664578706f72742f70726f706572746965732f66696c656e616d652f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.pdfExport.filename · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pdfExport/properties/filename/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7375627469746c65"></a>

### `@reportHeaderComponent.props.subtitle`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/subtitle`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 副标题文本取值。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7375627469746c652f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.subtitle · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/subtitle/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f7375627469746c65466f726d6174"></a>

### `@reportHeaderComponent.props.subtitleFormat`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/subtitleFormat`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="semanticHtml" | Schema未设默认；装配/运行时默认见语义说明 | 副标题显式受控语义HTML分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "semanticHtml" | 用于选择@reportHeaderComponent.props.subtitleFormat分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f67656e6572617465644279"></a>

### `@reportHeaderComponent.props.generatedBy`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/generatedBy`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 生成来源标识，不能替代可信服务身份。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f67656e65726174656442792f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.generatedBy · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/generatedBy/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6261646765"></a>

### `@reportHeaderComponent.props.badge`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/badge`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 徽标呈现声明。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f62616467652f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.badge · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/badge/allOf/0`。目标：[#/definitions/textValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f61734f66"></a>

### `@reportHeaderComponent.props.asOf`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/asOf`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["label","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 数据采集截止时间，用于区分实际与预测。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f61734f662f70726f706572746965732f6c6162656c"></a>

### `@reportHeaderComponent.props.asOf.label`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/asOf/properties/label`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f61734f662f70726f706572746965732f76616c7565"></a>

### `@reportHeaderComponent.props.asOf.value`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/asOf/properties/value`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f74616773"></a>

### `@reportHeaderComponent.props.tags`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/tags`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 标签集合。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f746167732f6974656d73"></a>

### `@reportHeaderComponent.props.tags[]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/tags/items`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f76617269616e74"></a>

### `@reportHeaderComponent.props.variant`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="projectDetail" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "projectDetail" | 用于选择@reportHeaderComponent.props.variant分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6465636f726174696f6e"></a>

### `@reportHeaderComponent.props.decoration`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/decoration`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="shortBar" | Schema未设默认；装配/运行时默认见语义说明 | 受控装饰呈现，不是任意CSS。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "shortBar" | 用于选择@reportHeaderComponent.props.decoration分支；同分支其它约束同时成立。 |

## 语义规则与反例（生成）

- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](../errors/missing-schema-version.json)、[unknown-top-level-field](../errors/unknown-top-level-field.json)、[layout-span-out-of-range](../errors/layout-span-out-of-range.json)、[field-id-pattern](../errors/field-id-pattern.json)、[sections-empty](../errors/sections-empty.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](../errors/data-slot-unknown-source.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](../errors/field-binding-undeclared-slot.json)、[unknown-component-field](../errors/unknown-component-field.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](../errors/field-binding-role-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](../errors/match-field-unknown.json)、[match-field-not-dimension](../errors/match-field-not-dimension.json)、[match-value-type-mismatch](../errors/match-value-type-mismatch.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `report-header-pdf-export`：Report PDF下载由6.28引入，仅允许Report顶层页头，按钮文字和文件名为非空文本取值。反例：[report-pdf-before-6.28](../errors/report-pdf-before-6.28.json)、[report-pdf-on-dashboard](../errors/report-pdf-on-dashboard.json)、[report-pdf-empty-label](../errors/report-pdf-empty-label.json)、[report-pdf-empty-filename](../errors/report-pdf-empty-filename.json)、[report-pdf-unknown-option](../errors/report-pdf-unknown-option.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-reportHeader.json)：独立完整页面，保留必要语义依赖。
- [projectDetail](../examples/component-reportHeader-projectDetail.json)：独立完整页面，保留必要语义依赖。
- [inline-report](../examples/inline-report.json)：完整合法页面；查询仅为静态契约证据。
- [text-composition-page](../examples/text-composition-page.json)：完整合法页面；查询仅为静态契约证据。
- [report-pdf-export](../examples/report-pdf-export.json)：完整合法页面；查询仅为静态契约证据。

局部片段提取自[完整页面](../examples/component-reportHeader.json)的`#/sections/0/components/0`；此片段依赖完整页面的数据源/字段，不能单独作为页面校验。

```json
{
  "id": "header",
  "type": "reportHeader",
  "layout": {
    "span": 12
  },
  "props": {
    "title": "查询数值容错 · 合成数据验收"
  }
}
```


## 联合分支见证（生成）
