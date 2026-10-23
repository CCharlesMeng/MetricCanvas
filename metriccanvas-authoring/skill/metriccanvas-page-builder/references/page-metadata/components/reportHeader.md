# 报告页头 reportHeader

表达页面标题、说明、时间点与标签；副标题可显式使用受控语义 HTML。适用于任何完整页面的开头。数据形状：不绑定页面数据源。

页面内容页头；title为必需文本取值，可引用必需页面参数或当前已应用筛选；6.23 起可用 `{parts:[{filter:"report-month",format:"period"}," 经营分析报告"]}` 组合动态期间与固定名称，规则见[文本片段组合](../params-and-text-values.md#文本片段组合623)。页面meta.title是另一个页面级声明，不替代该组件必填title。

dashboard 的筛选器由统一工具栏呈现，reportHeader 禁止配置 filterIds；下述日期工具带只用于 report。

filterIds（6.13）按序引用页面 timePoint/timeRange 筛选器，采用封面上方独立工具带；宽容器右对齐，窄容器换行。控件使用运行时筛选状态，不拥有查询。6.15 起 filterIds 仅决定控件位置，不自动创建或覆盖 asOf。期间文字使用 asOf.value: {filter: 筛选器id, format: "period"} 显式引用当前已应用值；字面量保持静态，param 引用保持打开时的参数值。6.13/6.14 继续按旧的期间派生规则读取。导出保留捕获时已经解析的静态文字。

## 导出按钮（6.31）

统一声明 `exportButtons` 数组，按数组顺序显示按钮。一项显示一个按钮，两项显示两个按钮；每种格式最多一项。不声明即不显示。只允许Report顶层页头，不能与旧 `pdfExport` / `pngExport` 混用。

```json
{
  "exportButtons": [
    { "format": "pdf", "label": "导出 PDF", "scale": 2 },
    { "format": "png", "label": "导出图片", "scale": 3 }
  ]
}
```

每一项都是相同的导出按钮配置：

| 字段 | 声明与行为 |
|---|---|
| `format` | 必需，只允许 `pdf` 或 `png`；图片只能输出一张PNG。 |
| `label` | 可选非空文本取值；默认PDF为“导出 PDF”，PNG为“导出图片”。 |
| `filename` | 可选非空文本取值，默认触发页头标题；清理非法字符并规范为格式对应的单一扩展名。 |
| `scale` | 渲染倍数，PDF有效值2、3、4，默认2；PNG有效值3、4，默认3。任何不支持的值（包括字符串、空值和其他类型）按未配置处理，读取时移除该项scale，使用对应默认值，不阻止页面打开或下载。图表、渐变文字和截图同步消费，不叠加设备DPR，不改变布局CSS宽度。 |

`label`、`filename`复用参数、已应用筛选及parts文本取值，点击同步捕获；之后的筛选变化不改变本次文件名与报告内容。配置决定按钮名称、格式和清晰度，运行时不再弹出格式菜单或清晰度设置。点击直接准备、编码并下载；无二次“生成/保存”步骤。PDF与PNG使用同一种按钮和实例任务状态，生成期间禁用本实例重复导出，在触发按钮显示进度；失败显示“导出失败，重试”及具体原因。成功后恢复名称。工具带和进度不进入文件。

已有6.28 `pdfExport: {label?, filename?}` 和6.30 `pngExport: {filename?, scale?}` 继续读取，并转换为同一种直接下载按钮；旧PDF默认文字“下载 PDF”保留，旧PNG的有效scale作为直接导出的倍率，无效值同样回退3倍，不再提供运行时选择。编辑器修改导出配置时写入 `exportButtons` 并升级至6.31。

完整作者页面见 `report-png-export`：首个页头同时启用PDF 2倍和PNG 3倍，第二个页头展示PDF与PNG 4倍，普通页头为未启用对照；长图见 `report-png-long-export`，PNG 3倍。它们使用本地合成数据。既有 `report-pdf-export` 覆盖旧PDF兼容读取。`report-export-scale-fallback` 覆盖PDF的99、PNG的2及旧PNG字符串倍率，分别回退2/3/3倍。

PDF默认A4竖向，存在引擎标记的宽内容时整份横向；零额外外边距，按原有排布连续切片，不按章节强制换页、不重复表头或添加页码。单页像素超过截图块预算时进一步分块并写入同一纸张，保持配置倍率。主线程按时间预算让出执行权，Worker无损编码，全部成功才下载。

## 单张高清 PNG

PNG内部按有界块截图、Worker持续行流式编码，结果始终是一张完整图片，不创建整图画布。整图宽≤8192、高≤32767、面积≤134217728像素，单截图块面积≤16777216像素、最长边≤8192，编码结果≤128MiB。超限明确失败，不降倍率、不下载部分图，也不回退到其他格式。编码后直接下载并释放任务资源，不保留待保存的结果。

引擎在独立iframe文档内重新挂载正式静态视图，仅带入引擎自有组件样式、受限主题值及字体资源，不复制父文档样式表、伪元素或背景图片。原页面水印不会被删除或临时隐藏。同源脚本若主动向iframe注入水印，仍需集成应用提供干净运行环境；真实门户与浏览器扩展单列实测，图片素材自身水印不在此机制处理范围。

长报告按有界块截图，Worker使用持续的行流式PNG编码，最终仍是一张完整图片；不创建整图大小的画布。当前整图宽≤8192、高≤32767、面积≤134217728像素，单截图块面积≤16777216像素，编码结果≤128MiB；超限明确失败，不降倍率或更换格式。准备60秒、编码60秒无进展、更新/销毁清理、每结果10000行及现有部分数据规则与PDF共用。下载成功不证明数据完整或磁盘写入。

编码依赖随npm与HTML ES/IIFE分发，无需集成应用安装。实际解码、像素清晰度、水印隔离与数据范围由浏览器验收证明，静态页面校验只证明协议。部署侧需核验Worker/CSP、字体图片访问和真实水印注入方式。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

后台导出需要浏览器支持Worker、ImageBitmap和OffscreenCanvas，宿主CSP允许`worker-src blob:`。这些属于引擎运行环境，不新增页面字段。线程调度与资源清理由引擎负责。


页面协议 6.58。结构真源为本册[schema.json](../schema.json)，SHA256 `ddcd6a83446832b44a1d276b53c46dbf297ea5736d9e66ede5bdbef38053fe35`。字段表自动生成；可选不等于有默认值。

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

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e"></a>

### `@reportHeaderComponent.visibleWhen`

Schema位置：`#/definitions/reportHeaderComponent/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@reportHeaderComponent.visibleWhen · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](../conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e73"></a>

### `@reportHeaderComponent.props.exportButtons`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; maxItems=2 | Schema未设默认；装配/运行时默认见语义说明 | 6.31统一导出按钮数组，1至2项，每种格式最多一项，顺序即显示顺序；不能混用旧导出字段。每项声明format、可选label/filename/scale，点击直接下载。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d73"></a>

### `@reportHeaderComponent.props.exportButtons[]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f30"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["format"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f302f70726f706572746965732f666f726d6174"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[0].format`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/0/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="pdf" | Schema未设默认；装配/运行时默认见语义说明 | 显示格式，不修改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "pdf" | 用于选择@reportHeaderComponent.props.exportButtons[] · oneOf[0].format分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f302f70726f706572746965732f6c6162656c"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[0].label`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/0/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f302f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[0].label · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/0/properties/label/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f302f70726f706572746965732f66696c656e616d65"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[0].filename`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/0/properties/filename`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可选非空文本取值，支持参数、已应用筛选和parts；点击时捕获，默认页头标题，清理非法字符后规范为对应格式的单一扩展名。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f302f70726f706572746965732f66696c656e616d652f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[0].filename · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/0/properties/filename/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f302f70726f706572746965732f7363616c65"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[0].scale`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/0/properties/scale`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | ratio输出刻度；显式100转换为百分刻度。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f31"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[1]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["format"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f312f70726f706572746965732f666f726d6174"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[1].format`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/1/properties/format`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="png" | Schema未设默认；装配/运行时默认见语义说明 | 显示格式，不修改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "png" | 用于选择@reportHeaderComponent.props.exportButtons[] · oneOf[1].format分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f312f70726f706572746965732f6c6162656c"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[1].label`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/1/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f312f70726f706572746965732f6c6162656c2f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[1].label · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/1/properties/label/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f312f70726f706572746965732f66696c656e616d65"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[1].filename`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/1/properties/filename`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可选非空文本取值，支持参数、已应用筛选和parts；点击时捕获，默认页头标题，清理非法字符后规范为对应格式的单一扩展名。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f312f70726f706572746965732f66696c656e616d652f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[1].filename · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/1/properties/filename/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f6578706f7274427574746f6e732f6974656d732f6f6e654f662f312f70726f706572746965732f7363616c65"></a>

### `@reportHeaderComponent.props.exportButtons[] · oneOf[1].scale`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/1/properties/scale`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | ratio输出刻度；显式100转换为百分刻度。 |

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

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706e674578706f7274"></a>

### `@reportHeaderComponent.props.pngExport`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pngExport`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 6.30兼容读取；新页面使用exportButtons，旧配置转换为直接下载PNG按钮。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706e674578706f72742f70726f706572746965732f66696c656e616d65"></a>

### `@reportHeaderComponent.props.pngExport.filename`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pngExport/properties/filename`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 可选非空文本取值；生成时捕获，默认页头标题，清理非法字符并规范为.png。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706e674578706f72742f70726f706572746965732f66696c656e616d652f616c6c4f662f30"></a>

### `@reportHeaderComponent.props.pngExport.filename · allOf[0]`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pngExport/properties/filename/allOf/0`。目标：[#/definitions/nonEmptyTextValue](../params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e742f70726f706572746965732f70726f70732f70726f706572746965732f706e674578706f72742f70726f706572746965732f7363616c65"></a>

### `@reportHeaderComponent.props.pngExport.scale`

Schema位置：`#/definitions/reportHeaderComponent/properties/props/properties/pngExport/properties/scale`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 开放JSON | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 有效数值PDF为2/3/4，PNG为3/4；其他值按未配置处理，读取时移除scale，分别使用默认2/3倍。字符串不转换为数值。 |

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
- `report-header-png-export`：6.30 Report导出图片，只输出一张PNG，固定名称与3/4倍倍率。反例：[report-png-before-6.30](../errors/report-png-before-6.30.json)、[report-png-dashboard](../errors/report-png-dashboard.json)、[report-png-empty-filename](../errors/report-png-empty-filename.json)、[report-png-fixed-label](../errors/report-png-fixed-label.json)、[report-png-other-format](../errors/report-png-other-format.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `report-header-export-buttons`：6.31 同一种导出按钮按格式配置名称、文件名和清晰度，直接下载。反例：[report-export-before-6.31](../errors/report-export-before-6.31.json)、[report-export-dashboard](../errors/report-export-dashboard.json)、[report-export-other-format](../errors/report-export-other-format.json)、[report-export-duplicate-format](../errors/report-export-duplicate-format.json)、[report-export-mixed-legacy](../errors/report-export-mixed-legacy.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [最小组件](../examples/component-reportHeader.json)：独立完整页面，保留必要语义依赖。
- [projectDetail](../examples/component-reportHeader-projectDetail.json)：独立完整页面，保留必要语义依赖。
- [inline-report](../examples/inline-report.json)：完整合法页面；查询仅为静态契约证据。
- [text-composition-page](../examples/text-composition-page.json)：完整合法页面；查询仅为静态契约证据。
- [report-pdf-export](../examples/report-pdf-export.json)：完整合法页面；查询仅为静态契约证据。
- [report-png-export](../examples/report-png-export.json)：完整合法页面；查询仅为静态契约证据。
- [report-export-buttons](../examples/report-export-buttons.json)：完整合法页面；查询仅为静态契约证据。
- [report-export-scale-fallback](../examples/report-export-scale-fallback.json)：完整合法页面；查询仅为静态契约证据。

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

- 源码/验证定位：`packages/page/src/schema/components/report-header.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/embed.spec.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/report-image.spec.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/report-export.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/engine/widgets/src/shared/ReportSummary.svelte`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/embed/tests/browser/report-ai-summary.spec.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/0`：[合法完整页面](../examples/report-export-buttons.json)，JSON Pointer `#/sections/0/components/0/props/exportButtons/0`。
- `#/definitions/reportHeaderComponent/properties/props/properties/exportButtons/items/oneOf/1`：[合法完整页面](../examples/report-export-buttons.json)，JSON Pointer `#/sections/0/components/0/props/exportButtons/1`。
