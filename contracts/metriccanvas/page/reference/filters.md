# 筛选声明与运行状态

六类筛选为dimension、timeRange、timePoint、boolean、numberRange、search。声明描述输入能力，当前值由页内FilterState保存。URL只在初始化时读；重复维度键表示多值，不拆逗号。boolean的false是显式值，不能被默认true覆盖。

## 时间选择的默认上限

所有时间选择控件（含表头日期范围）默认禁止未来时间：月到本地当前月，日期到今天，精确时间到当前分钟。普通范围的结束值受同一上限约束；面板、键盘、手工提交、URL 恢复、初值和外部筛选状态写入共用边界。未来 URL 值被忽略，保留页面的合法初值；非法写入保留已应用状态，不触发查询。声明或参数提供未来初值时，运行时拒绝初始化，不静默截断查询。

Dashboard 的年、季、月按所选自然期间判断：当前年／当前季／当前月可选，更晚期间不可选；查询仍保留该期间完整起止，不裁剪为截至今天。近一年继续取当前月之前十二个完整月份。普通 timeRange 与上述期间选择的口径不同，不以范围终点检查当前自然期间。

时间点省略 `disableFuture` 按 true 处理；已有显式 `disableFuture: false` 保持放开上限的含义，min 仍有效。普通范围和 Dashboard 期间选择统一采用默认上限，不新增页面字段或协议版本。静态校验继续检查结构、公历及已有显式规则，运行时按执行环境当前时间检查所有选择值。

页面试验场统一入口：`report-date-filter-example` 覆盖单月、月份范围、日期、日期范围和精确时间范围；`dashboard-period-filter` 覆盖年／季／月／近一年。合成数据与控件验收不证明真实 DQE 接入。

## Dashboard 期间选择（6.27）

`timeRange` 可声明 `display: "period"`，在 Dashboard 通用顶部 FilterBar 中作为一个筛选器显示「年／季／月／近一年」。省略 display 仍为原有范围编辑器。`precision` 只允许 month/date，分别决定实际范围编码，不改变查询的 period/is_aggregate。季度输入显示「2026 年 Q4」，四个面板选项为 Q1—Q4。

默认选择使用 `default: {mode:"month"}`（当前月），也可写 `{mode:"year",value:"2026"}`、`{mode:"quarter",value:"2026-Q4"}`、`{mode:"month",value:"2026-10"}` 或 `{mode:"last12Months"}`。年季月省略 value 时按本次初始化的当前日期选择完整自然期间。近一年固定取当前月之前十二个完整月份；2026-10 显示 `25年10月~26年9月`，date 查询为 2025-10-01 至 2026-09-30，month 查询为 2025-10 至 2026-09；右侧只有只读文本，不提供截止月份输入。

初始化、显式重新选择近一年共用期间解析；长驻页面不定时刷新，导出使用已应用快照。切回年季月保留会话内历史锚点。URL 的 value 分量编码 `month:2026-10`、`quarter:2026-Q4`、`year:2026` 或 `last12Months`，使用显式 `urlParams.value` 或筛选器 ID；恢复近一年时重新物化范围，非法选择不覆盖已有合法状态。导航可显式传筛选 value 分量保留模式，也可用 from/to 将实际范围传给普通日期输入。

参数初始化改用互斥的 `initialParam` 与 `initialMode:"year"|"quarter"|"month"`，实际参数区间必须完整覆盖声明的自然期间；选择变化不反写页面参数。相对选择不提取成固定参数。新形态仅用于 Dashboard 顶部筛选，不用于报告页头、datetime 或图表独立筛选。查询使用现有 `{target:"time"}` 绑定，不能同时保存固定 start/end/param。

页面试验场的统一入口为 `dashboard-period-filter`（日期精度）。月份精度、更多筛选和只读变体仅作为完整契约夹具及本册示例保留，不再重复注册演示页面，见下方生成的完整示例入口。它们声明合成验收查询；实际 DQE 数据和部署验收另行报告。

维度display选择select、tabs或tree；层级维度显式声明层级和初始层；6.11起层级维度与timePoint筛选器也可用initialParam取页面参数作初值。时间范围支持绝对from/to和受控相对时间；timePoint限定month/date粒度。numberRange允许单边界，两边空视为无条件；search为普通文本。

urlParams仅映射该类允许的value/from/to/level键，不能与本页其它参数或筛选输入冲突。候选值来自受控数据能力，业务维度值不是协议枚举。

6.13 的 timeRange.precision=month 使用 YYYY-MM 两端；date 使用 YYYY-MM-DD，datetime 保留 YYYY-MM-DDTHH:mm。timeRange.initialParam 与 default 互斥，接受精度匹配的必需 times 参数；timePoint 仅接受单点 times。required 日期筛选器保留已应用值，完整合法的输入才提交；页头引用只改变位置。

## 时间点下限（6.24）

`timePoint.min` 是可选的包含式下限，month 使用真实公历 `YYYY-MM`，date 使用 `YYYY-MM-DD`；未声明则保留原有无业务下限行为。timeRange 边界保持原有规则。`min` 与筛选粒度不匹配、日历无效或 default 早于 min 时拒绝页面；initialParam 实际值越界时拒绝初始化，不截断或伪造实际输入。

共享日期选择器禁用更早的年/月/日期，手工提交越界草稿显示错误并保留已应用值。筛选状态绑定页面声明后，write/writeMany 同样拒绝越界、粒度不符及必选筛选的清空。URL 初始化忽略非法/越界值，使用页面合法默认值；必选有下限筛选在 fromURL 恢复时保留当前合法值或默认值。执行回执中的越界筛选拒绝接收。下限约束筛选值，不裁剪由该值派生的查询窗口。

完整协议示例 `time-point-min-page` 同时覆盖月份和日期下限；业务页面 `business-sdt-report-monthly` 使用 `min: "2020-06"`，全部呈现查询与报告主标题、统计月份联动，3个趋势窗口含所选月共6个月。原页摘要是明确标记的2026年10月固定摘要，不作为切月后的分析结论。业务查询接入与真实数据另行验收。

<a id="禁止未来时间625"></a>

## 禁止未来时间（6.25）

`timePoint.disableFuture: true` 禁止晚于执行环境本地当前月份／日期的时间点，当前期间本身可选；省略默认启用；false 显式放开未来上限。month 以当前 `YYYY-MM` 为上限，date 以当前 `YYYY-MM-DD` 为上限。上限在打开选择器及提交时重新求值，不保存为固定日期，跨月后新月份自动可用。

月份／日期／年份面板禁用越界单元格、向未来翻页和键盘移动；手工输入越界显示错误并保留已应用值。URL恢复、筛选状态写入、执行回执和参数初始化同样检查，不能通过跳过控件写入未来值；非法初始参数拒绝初始化，不截断为当前期间。可与 `min` 同时声明；该限制只约束选中的时间点，不裁剪近N期查询窗口，省略 disableFuture 的历史页面同样采用默认上限，显式 false 仍保留原语义。

页面试验场统一在 `report-date-filter-example` 的“月份与日期禁止未来时间”分区演示；完整契约示例 `time-point-no-future` 继续覆盖独立边界，无业务查询。商务SDT终极版 `pages/sdt/commercial-sdt-efficiency-ultimate-monthly.json` 默认2026-10，月份选择不能进入未来。真实DQE接入与业务数据另行验收。

<a id="图表独立筛选629"></a>

<a id="chart-local-filter"></a>

## 图表独立筛选（6.29）

Dashboard 正文的 `barChart`、`lineChart`、`pieChart`、`mapChart` 可在 `props.filter` 声明一个左上角紧凑圆角单选按钮组。`filterId` 引用页面的普通维度筛选器；`options` 是创作时配置的非空 `{label,value}` 数组。label 是显示名称，value 是实际查询值，各 value 唯一。该筛选器的 `default` 必须包含候选项中的恰好一个值，不使用 initialParam、层级、级联或隐藏声明。每张图分别声明 filterId，即使筛选同一业务维度也彼此独立。未配置的图表保留原有呈现。

```json
{
  "filterId": "orders-region",
  "options": [
    {"label": "中国区", "value": "CN"},
    {"label": "海外", "value": "OVERSEAS"}
  ]
}
```

例子中的页面筛选声明为 `{"id":"orders-region","type":"dimension","dimension":"region","default":["CN"]}`，本图普通查询以 `filterBindings.orders-region={"target":"dimension","queryField":"region"}` 绑定。所有候选项直接显示为圆角按钮，选中项黑底白字，其他项浅灰底深字，窄容器自然换行。控件只负责位置与选项，查询条件仍由筛选绑定管理；不在页面工具栏重复呈现，也不请求维度候选值。

校验检查整个查询依赖图：绑定只能位于本图的查询依赖中，筛选影响的结果不能被另一组件（包括 AI 总结）消费，也不能驱动其他筛选器级联。需要独立图表时，分别声明查询数据源；共享完整结果、组合查询源、inline 图表、报表及详情视图不在本能力范围。切换只更新本图依赖的查询，页面公共筛选仍可与其共同作用。

当前值进入同一筛选状态和 URL。非法或多值 URL 输入忽略，使用声明的默认项；运行中的清空、多选或域外写入被拒绝，保留已应用选择。执行快照含非法图表筛选值时拒绝打开。加载、空结果及查询失败保留筛选控件，允许继续切换。静态导出捕获当前选择和对应查询，并以所选 label 替代交互控件。

验收页面 `chart-local-filter-page` 与同名协议夹具覆盖四种图表、独立默认项、自定义名称/值、空结果和未筛选对照图；浏览器验收直接消费此页面。数据是本地 Sim 的合成数据，不能证明真实 DQE、Relay 或线上部署结果。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

6.34新增的就地条件与层级状态语义见[条件显隐与动作资格](conditions.md)，旧页面原有行为保持。


页面协议 6.34。结构真源为本册[schema.json](schema.json)，SHA256 `82654beca54f3cc5e0039b54382cb05bc16b3e972b9a4fca40faad2d147238b3`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c746572"></a>

### `@dimensionFilter`

Schema位置：`#/definitions/dimensionFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","dimension"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6964"></a>

### `@dimensionFilter.id`

Schema位置：`#/definitions/dimensionFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@dimensionFilter.urlParams`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@dimensionFilter.urlParams.value`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@dimensionFilter.urlParams.from`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@dimensionFilter.urlParams.to`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@dimensionFilter.urlParams.level`

Schema位置：`#/definitions/dimensionFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f74797065"></a>

### `@dimensionFilter.type`

Schema位置：`#/definitions/dimensionFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="dimension" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "dimension" | 分类维度或维度目标；不是数值度量。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f64696d656e73696f6e"></a>

### `@dimensionFilter.dimension`

Schema位置：`#/definitions/dimensionFilter/properties/dimension`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 筛选维度语义或维度字段绑定；不隐式等于queryField。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6c6162656c"></a>

### `@dimensionFilter.label`

Schema位置：`#/definitions/dimensionFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f656d7074794c6162656c"></a>

### `@dimensionFilter.emptyLabel`

Schema位置：`#/definitions/dimensionFilter/properties/emptyLabel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 空值状态的展示文案。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368795069636b6572"></a>

### `@dimensionFilter.hierarchyPicker`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchyPicker`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["tabs","hidden"] | Schema未设默认；装配/运行时默认见语义说明 | 层级选择器显示方式；隐藏时须有地图承担下钻。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "tabs" | 平铺Tab选项。 |
| "hidden" | 隐藏统一工具栏，适用于页面已有自有页头。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f646973706c6179"></a>

### `@dimensionFilter.display`

Schema位置：`#/definitions/dimensionFilter/properties/display`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["select","tabs","tree","search"] | Schema未设默认；装配/运行时默认见语义说明 | 当前筛选器的受控输入显示方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "select" | 下拉候选选择。 |
| "tabs" | 平铺Tab选项。 |
| "tree" | 层级树选择。 |
| "search" | 普通文本搜索输入。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f76697369626c65"></a>

### `@dimensionFilter.visible`

Schema位置：`#/definitions/dimensionFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f76697369626c655768656e"></a>

### `@dimensionFilter.visibleWhen`

Schema位置：`#/definitions/dimensionFilter/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@dimensionFilter.visibleWhen · allOf[0]`

Schema位置：`#/definitions/dimensionFilter/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f64656661756c74"></a>

### `@dimensionFilter.default`

Schema位置：`#/definitions/dimensionFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f64656661756c742f6974656d73"></a>

### `@dimensionFilter.default[]`

Schema位置：`#/definitions/dimensionFilter/properties/default/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f696e697469616c506172616d"></a>

### `@dimensionFilter.initialParam`

Schema位置：`#/definitions/dimensionFilter/properties/initialParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 只初始化筛选状态的维度参数id。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f686965726172636879"></a>

### `@dimensionFilter.hierarchy`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=2 | Schema未设默认；装配/运行时默认见语义说明 | 显式层级维度定义。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368792f6974656d73"></a>

### `@dimensionFilter.hierarchy[]`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","dimension"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368792f6974656d732f70726f706572746965732f6964"></a>

### `@dimensionFilter.hierarchy[].id`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368792f6974656d732f70726f706572746965732f64696d656e73696f6e"></a>

### `@dimensionFilter.hierarchy[].dimension`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy/items/properties/dimension`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[A-Za-z_][A-Za-z0-9_-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 筛选维度语义或维度字段绑定；不隐式等于queryField。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6869657261726368792f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@dimensionFilter.hierarchy[].label`

Schema位置：`#/definitions/dimensionFilter/properties/hierarchy/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f64656661756c744c6576656c"></a>

### `@dimensionFilter.defaultLevel`

Schema位置：`#/definitions/dimensionFilter/properties/defaultLevel`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 初始层级id，须存在于hierarchy。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f646570656e64734f6e"></a>

### `@dimensionFilter.dependsOn`

Schema位置：`#/definitions/dimensionFilter/properties/dependsOn`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 级联依赖的维度筛选器id，不能形成环。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c746572"></a>

### `@timeRangeFilter`

Schema位置：`#/definitions/timeRangeFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6964"></a>

### `@timeRangeFilter.id`

Schema位置：`#/definitions/timeRangeFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@timeRangeFilter.urlParams`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@timeRangeFilter.urlParams.value`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@timeRangeFilter.urlParams.from`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@timeRangeFilter.urlParams.to`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@timeRangeFilter.urlParams.level`

Schema位置：`#/definitions/timeRangeFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f74797065"></a>

### `@timeRangeFilter.type`

Schema位置：`#/definitions/timeRangeFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timeRange" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timeRange" | 用于选择@timeRangeFilter.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f646973706c6179"></a>

### `@timeRangeFilter.display`

Schema位置：`#/definitions/timeRangeFilter/properties/display`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | const="period" | Schema未设默认；装配/运行时默认见语义说明 | 当前筛选器的受控输入显示方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "period" | 时间窗口：基准所在完整周期；offset按指定unit移动周期。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f696e697469616c4d6f6465"></a>

### `@timeRangeFilter.initialMode`

Schema位置：`#/definitions/timeRangeFilter/properties/initialMode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["year","quarter","month"] | Schema未设默认；装配/运行时默认见语义说明 | 参数初始化期间筛选时显式选择自然年、自然季度或自然月；参数区间必须恰好覆盖该完整期间。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "year" | 年粒度。 |
| "quarter" | 季度粒度。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6c6162656c"></a>

### `@timeRangeFilter.label`

Schema位置：`#/definitions/timeRangeFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f707265636973696f6e"></a>

### `@timeRangeFilter.precision`

Schema位置：`#/definitions/timeRangeFilter/properties/precision`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["month","date","datetime"] | Schema未设默认；装配/运行时默认见语义说明 | 显示精度，不改原始数据。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |
| "datetime" | 带时间部分的日期时间字段。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f696e697469616c506172616d"></a>

### `@timeRangeFilter.initialParam`

Schema位置：`#/definitions/timeRangeFilter/properties/initialParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 只初始化筛选状态的维度参数id。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f7265717569726564"></a>

### `@timeRangeFilter.required`

Schema位置：`#/definitions/timeRangeFilter/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f76697369626c65"></a>

### `@timeRangeFilter.visible`

Schema位置：`#/definitions/timeRangeFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f76697369626c655768656e"></a>

### `@timeRangeFilter.visibleWhen`

Schema位置：`#/definitions/timeRangeFilter/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@timeRangeFilter.visibleWhen · allOf[0]`

Schema位置：`#/definitions/timeRangeFilter/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c74"></a>

### `@timeRangeFilter.default`

Schema位置：`#/definitions/timeRangeFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f30"></a>

### `@timeRangeFilter.default · anyOf[0]`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | enum=["today","last7d","last30d","last90d"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "today" | 以当前日为锚的今天范围。 |
| "last7d" | 受控最近7日快捷范围。 |
| "last30d" | 受控最近30日快捷范围。 |
| "last90d" | 受控最近90日快捷范围。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f31"></a>

### `@timeRangeFilter.default · anyOf[1]`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["from","to"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f312f70726f706572746965732f66726f6d"></a>

### `@timeRangeFilter.default · anyOf[1].from`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/1/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f312f70726f706572746965732f746f"></a>

### `@timeRangeFilter.default · anyOf[1].to`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/1/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f32"></a>

### `@timeRangeFilter.default · anyOf[2]`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/2`。目标：[#/definitions/relativeTimeExpression](filters.md#schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/relativeTimeExpression | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e"></a>

### `@relativeTimeExpression`

Schema位置：`#/definitions/relativeTimeExpression`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["unit","range","includeCurrent"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f756e6974"></a>

### `@relativeTimeExpression.unit`

Schema位置：`#/definitions/relativeTimeExpression/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["day","week","month","quarter","year"] | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "day" | 日粒度。 |
| "week" | 周粒度。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "quarter" | 季度粒度。 |
| "year" | 年粒度。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e6765"></a>

### `@relativeTimeExpression.range`

Schema位置：`#/definitions/relativeTimeExpression/properties/range`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控范围结构。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f30"></a>

### `@relativeTimeExpression.range · oneOf[0]`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind","n"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f302f70726f706572746965732f6b696e64"></a>

### `@relativeTimeExpression.range · oneOf[0].kind`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/0/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="lastN" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "lastN" | 含基准期的最近N期；时间参数窗口按自身日期/月精度计数。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f302f70726f706572746965732f6e"></a>

### `@relativeTimeExpression.range · oneOf[0].n`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/0/properties/n`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | minimum=1; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间的周期数量。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f31"></a>

### `@relativeTimeExpression.range · oneOf[1]`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f312f70726f706572746965732f6b696e64"></a>

### `@relativeTimeExpression.range · oneOf[1].kind`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/1/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="previousComplete" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "previousComplete" | 用于选择@relativeTimeExpression.range · oneOf[1].kind分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f32"></a>

### `@relativeTimeExpression.range · oneOf[2]`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/2`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["kind"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f72616e67652f6f6e654f662f322f70726f706572746965732f6b696e64"></a>

### `@relativeTimeExpression.range · oneOf[2].kind`

Schema位置：`#/definitions/relativeTimeExpression/properties/range/oneOf/2/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="currentToDate" | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "currentToDate" | 用于选择@relativeTimeExpression.range · oneOf[2].kind分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f696e636c75646543757272656e74"></a>

### `@relativeTimeExpression.includeCurrent`

Schema位置：`#/definitions/relativeTimeExpression/properties/includeCurrent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间范围是否包含当前周期。 |

<a id="schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e2f70726f706572746965732f616e63686f72"></a>

### `@relativeTimeExpression.anchor`

Schema位置：`#/definitions/relativeTimeExpression/properties/anchor`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间计算所用的日历锚点。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c742f616e794f662f33"></a>

### `@timeRangeFilter.default · anyOf[3]`

Schema位置：`#/definitions/timeRangeFilter/properties/default/anyOf/3`。目标：[#/definitions/periodSelection](filters.md#schema-232f646566696e6974696f6e732f706572696f6453656c656374696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/periodSelection | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f706572696f6453656c656374696f6e"></a>

### `@periodSelection`

Schema位置：`#/definitions/periodSelection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f706572696f6453656c656374696f6e2f616e794f662f30"></a>

### `@periodSelection · anyOf[0]`

Schema位置：`#/definitions/periodSelection/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f706572696f6453656c656374696f6e2f616e794f662f302f70726f706572746965732f6d6f6465"></a>

### `@periodSelection · anyOf[0].mode`

Schema位置：`#/definitions/periodSelection/anyOf/0/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["year","quarter","month"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "year" | 年粒度。 |
| "quarter" | 季度粒度。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |

<a id="schema-232f646566696e6974696f6e732f706572696f6453656c656374696f6e2f616e794f662f302f70726f706572746965732f76616c7565"></a>

### `@periodSelection · anyOf[0].value`

Schema位置：`#/definitions/periodSelection/anyOf/0/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f706572696f6453656c656374696f6e2f616e794f662f31"></a>

### `@periodSelection · anyOf[1]`

Schema位置：`#/definitions/periodSelection/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f706572696f6453656c656374696f6e2f616e794f662f312f70726f706572746965732f6d6f6465"></a>

### `@periodSelection · anyOf[1].mode`

Schema位置：`#/definitions/periodSelection/anyOf/1/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="last12Months" | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "last12Months" | 用于选择@periodSelection · anyOf[1].mode分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c746572"></a>

### `@timePointFilter`

Schema位置：`#/definitions/timePointFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","granularity"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6964"></a>

### `@timePointFilter.id`

Schema位置：`#/definitions/timePointFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@timePointFilter.urlParams`

Schema位置：`#/definitions/timePointFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@timePointFilter.urlParams.value`

Schema位置：`#/definitions/timePointFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@timePointFilter.urlParams.from`

Schema位置：`#/definitions/timePointFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@timePointFilter.urlParams.to`

Schema位置：`#/definitions/timePointFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@timePointFilter.urlParams.level`

Schema位置：`#/definitions/timePointFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f74797065"></a>

### `@timePointFilter.type`

Schema位置：`#/definitions/timePointFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="timePoint" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "timePoint" | 用于选择@timePointFilter.type分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6c6162656c"></a>

### `@timePointFilter.label`

Schema位置：`#/definitions/timePointFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f76697369626c65"></a>

### `@timePointFilter.visible`

Schema位置：`#/definitions/timePointFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f76697369626c655768656e"></a>

### `@timePointFilter.visibleWhen`

Schema位置：`#/definitions/timePointFilter/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@timePointFilter.visibleWhen · allOf[0]`

Schema位置：`#/definitions/timePointFilter/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6772616e756c6172697479"></a>

### `@timePointFilter.granularity`

Schema位置：`#/definitions/timePointFilter/properties/granularity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["month","date"] | Schema未设默认；装配/运行时默认见语义说明 | 时间值的粒度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "date" | 日期值或日期格式；timePoint中表示YYYY-MM-DD粒度。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6d696e"></a>

### `@timePointFilter.min`

Schema位置：`#/definitions/timePointFilter/properties/min`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 量表下界。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f64697361626c65467574757265"></a>

### `@timePointFilter.disableFuture`

Schema位置：`#/definitions/timePointFilter/properties/disableFuture`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 为true时，按本地当前月份／日期限制选择、输入及初始化；当前期间包含在内。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f7265717569726564"></a>

### `@timePointFilter.required`

Schema位置：`#/definitions/timePointFilter/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f64656661756c74"></a>

### `@timePointFilter.default`

Schema位置：`#/definitions/timePointFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f696e697469616c506172616d"></a>

### `@timePointFilter.initialParam`

Schema位置：`#/definitions/timePointFilter/properties/initialParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 初值取自一个单点 times 参数；与 default 互斥，打开后仍可在页内改。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c746572"></a>

### `@booleanFilter`

Schema位置：`#/definitions/booleanFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f6964"></a>

### `@booleanFilter.id`

Schema位置：`#/definitions/booleanFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@booleanFilter.urlParams`

Schema位置：`#/definitions/booleanFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@booleanFilter.urlParams.value`

Schema位置：`#/definitions/booleanFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@booleanFilter.urlParams.from`

Schema位置：`#/definitions/booleanFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@booleanFilter.urlParams.to`

Schema位置：`#/definitions/booleanFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@booleanFilter.urlParams.level`

Schema位置：`#/definitions/booleanFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f74797065"></a>

### `@booleanFilter.type`

Schema位置：`#/definitions/booleanFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="boolean" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "boolean" | 布尔值；false是显式取值。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f6c6162656c"></a>

### `@booleanFilter.label`

Schema位置：`#/definitions/booleanFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f76697369626c65"></a>

### `@booleanFilter.visible`

Schema位置：`#/definitions/booleanFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f76697369626c655768656e"></a>

### `@booleanFilter.visibleWhen`

Schema位置：`#/definitions/booleanFilter/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@booleanFilter.visibleWhen · allOf[0]`

Schema位置：`#/definitions/booleanFilter/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f64656661756c74"></a>

### `@booleanFilter.default`

Schema位置：`#/definitions/booleanFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c746572"></a>

### `@numberRangeFilter`

Schema位置：`#/definitions/numberRangeFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f6964"></a>

### `@numberRangeFilter.id`

Schema位置：`#/definitions/numberRangeFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@numberRangeFilter.urlParams`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@numberRangeFilter.urlParams.value`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@numberRangeFilter.urlParams.from`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@numberRangeFilter.urlParams.to`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@numberRangeFilter.urlParams.level`

Schema位置：`#/definitions/numberRangeFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f74797065"></a>

### `@numberRangeFilter.type`

Schema位置：`#/definitions/numberRangeFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="numberRange" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "numberRange" | 数值度量的包含端点范围；按原始单位比较，一端可缺省。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f6c6162656c"></a>

### `@numberRangeFilter.label`

Schema位置：`#/definitions/numberRangeFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f76697369626c65"></a>

### `@numberRangeFilter.visible`

Schema位置：`#/definitions/numberRangeFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f76697369626c655768656e"></a>

### `@numberRangeFilter.visibleWhen`

Schema位置：`#/definitions/numberRangeFilter/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@numberRangeFilter.visibleWhen · allOf[0]`

Schema位置：`#/definitions/numberRangeFilter/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f64656661756c74"></a>

### `@numberRangeFilter.default`

Schema位置：`#/definitions/numberRangeFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f64656661756c742f70726f706572746965732f66726f6d"></a>

### `@numberRangeFilter.default.from`

Schema位置：`#/definitions/numberRangeFilter/properties/default/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f64656661756c742f70726f706572746965732f746f"></a>

### `@numberRangeFilter.default.to`

Schema位置：`#/definitions/numberRangeFilter/properties/default/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c746572"></a>

### `@searchFilter`

Schema位置：`#/definitions/searchFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f6964"></a>

### `@searchFilter.id`

Schema位置：`#/definitions/searchFilter/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d73"></a>

### `@searchFilter.urlParams`

Schema位置：`#/definitions/searchFilter/properties/urlParams`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面参数/筛选输入对应的公开URL键映射。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f76616c7565"></a>

### `@searchFilter.urlParams.value`

Schema位置：`#/definitions/searchFilter/properties/urlParams/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f66726f6d"></a>

### `@searchFilter.urlParams.from`

Schema位置：`#/definitions/searchFilter/properties/urlParams/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f746f"></a>

### `@searchFilter.urlParams.to`

Schema位置：`#/definitions/searchFilter/properties/urlParams/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f75726c506172616d732f70726f706572746965732f6c6576656c"></a>

### `@searchFilter.urlParams.level`

Schema位置：`#/definitions/searchFilter/properties/urlParams/properties/level`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前层级或层级绑定部分。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f74797065"></a>

### `@searchFilter.type`

Schema位置：`#/definitions/searchFilter/properties/type`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="search" | Schema未设默认；装配/运行时默认见语义说明 | 选择所属结构的类型分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "search" | 普通文本搜索输入。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f6c6162656c"></a>

### `@searchFilter.label`

Schema位置：`#/definitions/searchFilter/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f76697369626c65"></a>

### `@searchFilter.visible`

Schema位置：`#/definitions/searchFilter/properties/visible`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 显示状态声明。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f76697369626c655768656e"></a>

### `@searchFilter.visibleWhen`

Schema位置：`#/definitions/searchFilter/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `@searchFilter.visibleWhen · allOf[0]`

Schema位置：`#/definitions/searchFilter/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f64656661756c74"></a>

### `@searchFilter.default`

Schema位置：`#/definitions/searchFilter/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f636861727446696c746572"></a>

### `@chartFilter`

Schema位置：`#/definitions/chartFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["filterId","options"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636861727446696c7465722f70726f706572746965732f66696c7465724964"></a>

### `@chartFilter.filterId`

Schema位置：`#/definitions/chartFilter/properties/filterId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 引用本页独立的维度筛选器id，由该筛选器声明初值和查询绑定。 |

<a id="schema-232f646566696e6974696f6e732f636861727446696c7465722f70726f706572746965732f6f7074696f6e73"></a>

### `@chartFilter.options`

Schema位置：`#/definitions/chartFilter/properties/options`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 选择器固定候选项；每项显式声明展示标签和实际维度值。 |

<a id="schema-232f646566696e6974696f6e732f636861727446696c7465722f70726f706572746965732f6f7074696f6e732f6974656d73"></a>

### `@chartFilter.options[]`

Schema位置：`#/definitions/chartFilter/properties/options/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["label","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f636861727446696c7465722f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@chartFilter.options[].label`

Schema位置：`#/definitions/chartFilter/properties/options/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1; pattern="\\S" | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f636861727446696c7465722f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f76616c7565"></a>

### `@chartFilter.options[].value`

Schema位置：`#/definitions/chartFilter/properties/options/items/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

## 语义规则与反例（生成）

- `filter-id-unique`：筛选器 id 唯一。反例：[duplicate-filter-id](errors/duplicate-filter-id.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `time-range-default-calendar`：timeRange 绝对默认值须为合法公历值、精度一致且 from 不晚于 to。反例：[time-range-from-format](errors/time-range-from-format.json)、[time-range-to-calendar](errors/time-range-to-calendar.json)、[time-range-datetime-without-precision](errors/time-range-datetime-without-precision.json)、[time-range-from-after-to](errors/time-range-from-after-to.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `relative-time-anchor`：结构化相对时间的 anchor 须为合法公历日期。反例：[relative-time-anchor-invalid](errors/relative-time-anchor-invalid.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `time-point-default`：timePoint 默认值符合其粒度的格式与日历。反例：[time-point-month-format](errors/time-point-month-format.json)、[time-point-month-range](errors/time-point-month-range.json)、[time-point-date-format](errors/time-point-date-format.json)、[time-point-date-calendar](errors/time-point-date-calendar.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `number-range-default`：numberRange 默认值至少有一端且 from 不大于 to。反例：[number-range-empty](errors/number-range-empty.json)、[number-range-inverted](errors/number-range-inverted.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `hierarchy-level-id-unique`：层级 id 在同一筛选器内唯一。反例：[duplicate-hierarchy-level-id](errors/duplicate-hierarchy-level-id.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `default-level-declared`：defaultLevel 只能用于声明了 hierarchy 的筛选器并引用已声明层级。反例：[default-level-without-hierarchy](errors/default-level-without-hierarchy.json)、[default-level-unknown](errors/default-level-unknown.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `hierarchy-picker-requires-hierarchy`：hierarchyPicker 只能用于声明了 hierarchy 的维度筛选器。反例：[hierarchy-picker-without-hierarchy](errors/hierarchy-picker-without-hierarchy.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `filter-depends-on`：级联只能依赖另一个已声明的 dimension 筛选器且不成环。反例：[depends-on-self](errors/depends-on-self.json)、[depends-on-undeclared](errors/depends-on-undeclared.json)、[depends-on-non-dimension](errors/depends-on-non-dimension.json)、[depends-on-cycle](errors/depends-on-cycle.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `hidden-hierarchy-picker-needs-map`：隐藏层级切换器时必须有地图通过 hierarchyFilter 承担下钻。反例：[hidden-hierarchy-picker-without-map](errors/hidden-hierarchy-picker-without-map.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `time-point-min`：6.24 时间点下限与默认值日历语义。反例：[time-point-min-before-6.24](errors/time-point-min-before-6.24.json)、[time-point-min-invalid-month](errors/time-point-min-invalid-month.json)、[time-point-min-wrong-precision](errors/time-point-min-wrong-precision.json)、[time-point-min-default-before](errors/time-point-min-default-before.json)、[time-point-min-invalid-date](errors/time-point-min-invalid-date.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `time-point-disable-future`：6.25 时间点禁止未来月份与日期。反例：[time-point-disable-future-before-6.25](errors/time-point-disable-future-before-6.25.json)、[time-point-disable-future-default-month](errors/time-point-disable-future-default-month.json)、[time-point-disable-future-default-date](errors/time-point-disable-future-default-date.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `period-filter`：6.27 Dashboard 年季月与近一年期间筛选。反例：[period-filter-before-6.27](errors/period-filter-before-6.27.json)、[period-filter-quarter-invalid](errors/period-filter-quarter-invalid.json)、[period-filter-report](errors/period-filter-report.json)、[period-filter-datetime](errors/period-filter-datetime.json)、[period-filter-no-default](errors/period-filter-no-default.json)、[period-filter-static-time](errors/period-filter-static-time.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `chart-local-filter`：6.29 Dashboard 图表独立筛选及查询消费范围。反例：[chart-filter-before-6.29](errors/chart-filter-before-6.29.json)、[chart-filter-report](errors/chart-filter-report.json)、[chart-filter-invalid-default](errors/chart-filter-invalid-default.json)、[chart-filter-duplicate-options](errors/chart-filter-duplicate-options.json)、[chart-filter-shared-source](errors/chart-filter-shared-source.json)、[chart-filter-no-binding](errors/chart-filter-no-binding.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [filters-page](examples/filters-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-point-min-page](examples/time-point-min-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-point-no-future](examples/time-point-no-future.json)：完整合法页面；查询仅为静态契约证据。
- [dashboard-period-filter](examples/dashboard-period-filter.json)：完整合法页面；查询仅为静态契约证据。
- [dashboard-period-filter-month](examples/dashboard-period-filter-month.json)：完整合法页面；查询仅为静态契约证据。
- [period-filter-year-page](examples/period-filter-year-page.json)：完整合法页面；查询仅为静态契约证据。
- [period-filter-quarter-page](examples/period-filter-quarter-page.json)：完整合法页面；查询仅为静态契约证据。
- [period-filter-last12-months-page](examples/period-filter-last12-months-page.json)：完整合法页面；查询仅为静态契约证据。
- [period-filter-parameter-page](examples/period-filter-parameter-page.json)：完整合法页面；查询仅为静态契约证据。
- [dashboard-period-filter-more](examples/dashboard-period-filter-more.json)：完整合法页面；查询仅为静态契约证据。
- [dashboard-period-filter-readonly](examples/dashboard-period-filter-readonly.json)：完整合法页面；查询仅为静态契约证据。
- [chart-local-filter-page](examples/chart-local-filter-page.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/filter.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/period-filter.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/report-date-filters.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/chart-filter.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/chart-filter.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/time-filter-boundary.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/timeRangeFilter/properties/default/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/1/default`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/1`：[合法完整页面](examples/text-composition-page.json)，JSON Pointer `#/filters/1/default`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/2`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/2/default`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/0`：[合法完整页面](examples/filters-page.json)，JSON Pointer `#/filters/3/default/range`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/2/default/range`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/2`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/3/default/range`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/3`：[合法完整页面](examples/dashboard-period-filter.json)，JSON Pointer `#/filters/0/default`。
- `#/definitions/periodSelection/anyOf/0`：[合法完整页面](examples/dashboard-period-filter.json)，JSON Pointer `#/filters/0/default`。
- `#/definitions/periodSelection/anyOf/1`：[合法完整页面](examples/period-filter-last12-months-page.json)，JSON Pointer `#/filters/0/default`。
