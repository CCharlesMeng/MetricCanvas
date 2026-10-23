# 页面、版本与布局

页面元数据是统一运行时消费的声明式文档；数据上下文、会话、修订和执行身份由宿主管理。页面id、字段id、组件id分别属于自己的命名空间，组件id在整页唯一。

作者版本以本册 [index.json](index.json) 的 schemaVersion 为准，可读版本以 [schema.json](schema.json) 的 schemaVersion 分支为准。能力下限由独立校验脚本检查。历史页面先校验，再按明确需求修改；不得只改版本号假装完成迁移。5.x在读取边界转换为6.x运行态文档。6.0使用layoutForm，6.1起允许layout。双字段同时出现即拒绝；缺布局默认report。normalizePageDocument只进行已声明的兼容规范化并保留文档原始字段，不将运行时参数替换结果保存。历史修订先核验原文hash再规范化。

report定宽居中，dashboard占满宿主宽度。页面页头统一由 IocHeader 呈现。dashboardToolbar 仅兼容读取：缺省／visible 自动适配行内页头，hidden 不生成默认页头，compact 对象适配紧凑呈现及只读说明；不保留旧工具栏实现。新页面使用 iocHeader。meta.title是页面级标题，缺席时消费方可回退页头再回退页面id。

## 创作时显式选择布局形态

新页面建议显式声明 `layout: "dashboard"` 或 `layout: "report"`，便于核对用户选择；这是创作要求，读取边界继续接受省略布局并默认 report。布局形态描述外框，不按组件名称、query／inline、图表数量或是否带日期筛选自动推断。`reportHeader` 也可用于 Dashboard 对象详情；Report 专用工具带仍受其组件约束。

完整结构对照使用 `ioc-project-overview`、`ioc-opportunity-analysis`、`ioc-opportunity-list`、`ioc-project-detail`、`business-sdt-report-monthly`、`flow-analysis-report` 六个成型页面；独立本地创作 Skill 从这些页面提炼结构范式，先识别、取得明确形态确认，再分流生成。确认是创作会话行为，不新增页面字段，不由 Schema 校验器判断。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

<a id="ioc-公共页头632"></a>

## IOC 公共页头（6.36）

根级 `iocHeader` 独立于 `layout`，用于 IOC 身份与页级筛选归属。普通/密集看板和详情报表共用同一个呈现 Module；meta.title仍是目录标题。6.41 新页面声明 iocHeader 时无需同时写 dashboardToolbar；显式声明 visible/compact 与 iocHeader 仍为冲突。旧版本的显式 hidden 继续读取，没有 IOC 声明的旧页面通过同一呈现 Module 保持原布局。正文独立章节页头可保留，首个业务reportHeader或projectDetail不能重复承担页面身份。

`identity`可省略；title不声明就没有标题占位，不回退meta.title。title显式参数引用缺值显示“未命名”；code、description、tags、facts缺值整体省略。编码用label/value；标签有唯一id及显式neutral/info/success/warning/danger色调，数组决定顺序。说明为纯文本，inline或键盘可达tooltip；不接受任意HTML。facts区分queryPeriod/latestDataPeriod/refreshedAt/generatedAt；value显式TextValue，不根据kind生成当前时间。统计期间应引用已应用filter。B1尚无HeaderFactReference/displayInputs，可信时间可通过已声明参数传入。

`filterIds`依序认领已声明且静态可见的页级筛选。重复、不存在、隐藏、图表独立或详情私有筛选，以及与reportHeader重复认领均拒绝。已认领项从通用FilterBar排除，其余可见项保留。期间筛选原有Dashboard位置继续有效；report中的period须由IOC认领，期间语义和查询精度不变。详情单月仍用timePoint，不截断年季月来伪造单月；离散月份仍用dimension绑定，不能扩成连续区间。

`presentation.density`为normal/compact；`collapse`为none/firstRow，缺省normal/none。firstRow按直接容器实际换行测量，折叠保留首行，隐藏项inert并关闭弹层；展开不改值、不查询。日期复用DatePicker/PeriodFilter；月→季→年→月保留月份锚点，近一年为当前月之前12完整月。锚点与展开是实例局部状态，不写入Page。

`back:true`只表达返回意图。集成应用须同时提供非空`navigation.returnContext.entryId`与back函数才显示；直接打开无来源隐藏。B1没有完整视图快照或导航栈恢复。可选actions、有限枚举/单选、条件启用、V2候选、最新期上限和全页操作分别保留B2–B6规划，6.36不接受这些尚未交付字段。

共用筛选协调对write/writeMany/控件/action/地图/URL恢复执行整组类型与边界校验；非法组整次拒绝。依赖变化一次清理所有后代，自动清空进入待确认门禁；用户显式选择或清空才解除。非空维度初值须经当前候选验证；loading/error/unavailable或不合法候选只暂停消费它的查询及下游，无关查询继续。候选重试读取当前依赖；成功和失败都检查代次，缓存按本实例、filterId、层级、完整规范化依赖隔离。只读拦截全部用户写入口，初始化/restore仍校验，静态隐藏不意味着停止查询。门禁同时约束目标表导出和整页静态准备。

验收直接加载 `ioc-header-overview-demo`、`ioc-header-dense-filter-demo`、`ioc-header-detail-demo`、`ioc-header-month-set-demo`；查询使用本地DQE仿真条件回显，明确是合成验收。真实DQE、CloudIOC权限、Relay、门户和业务字段均需单独验证。

## 可信期间事实输入（6.39）

`RuntimeView` / JS `mount` 可传稳定的 `displayInputs:{getSnapshot,subscribe}`，订阅返回unsubscribe。snapshot为 `{permissionRevision,permissions,values,timeZone,periods:{[fact]:DataPeriodFact}}`；不使用标量权限/展示事实时仍传`permissions:{},values:{}`。ready事实含granularity(month/date)、latest，可选latestComplete、missingRanges、refreshedAt/generatedAt；其他状态为loading/empty/unavailable/error。时间戳必须带时区、按集成应用timeZone显示，不替换为浏览器当前时间。依赖筛选的事实携带filterRevision，与filter-change事件返回的修订匹配；独立数据域事实可省略。具名事实不能由Page/URL参数覆盖。

同permissionRevision事实更新保留已应用选择并重验相关候选/查询/导出；事实就绪时只初始化从未提供值的availability.initial，不能覆盖用户选择或合法URL。permissionRevision改变立即停止旧实例、清除旧展示，集成应用必须destroy/remount。原输入源及所有订阅随实例销毁清理。此接口只接期间事实，不启用待审Condition。

IOC `identity.facts[].value:{fact,part}` 只允许固定part latest/latestComplete/refreshedAt/generatedAt，并与kind匹配。状态仅影响该信息项；availability引用同一事实时才影响查询。身份标题与其他无关查询可继续显示。

期间事实沿统一`displayInputs`提供：`DisplaySnapshot`保留`permissionRevision/permissions/values`，扩展可选`timeZone/periods`具名分支；期间事实不直接当作标量Condition输入。单一订阅同步更新，两种事实共用身份撤销边界；同身份只改变展示values不触发时间查询。组合场景见`ioc-header-availability-demo`的期间说明开关。

## 唯一页头（6.41）

新页面统一声明根级 `iocHeader`，布局形态不决定业务身份。`presentation.layout` 为 `stacked`（缺省）或 `inline`；前者保留身份与筛选上下排，后者承接旧 Dashboard 标题与筛选同行。`presentation.collapse` 为 `none`、按实际首行测量的 `firstRow` 或按数量收纳的 `overflow`：不超过五项全部常驻，密集时搜索回正文，其余前四项常驻、剩余进“更多筛选”。`density:"compact"` 不执行数量收纳；搭配 inline 时为 56px 紧凑吸顶行；窄容器内筛选行自行横向滚动，说明换行，不撑开页面。

页头组件自身统一提供 **16px 底部外间距**，适用于普通行内、上下排、紧凑及静态呈现。该间距位于页头外框与后续正文之间，不是页头内部padding；不需页面JSON声明。旧工具栏适配与导出正文不再叠加另一份页头间距。未渲染页头时没有此占位。当前可观察入口为 `ioc-header-demo`、`ioc-header-standard` 与旧紧凑入口 `ioc-opportunity-analysis`。

`readOnly:true` 统一限制用户筛选写入，包括更多面板与组件动作；初始化与合法恢复保持原有机制。`note` 是页头纯文本说明。只读不阻止合法返回；显式 `back:true` 仍要求集成应用提供合法 returnContext 和 back。未声明 back 的新页头不接管返回，避免隐藏集成应用的返回入口。

所有筛选通过同一 FilterBar 接收候选重试、只读和时间事实；没有 IOC 专属筛选状态。未认领的筛选留在内容区，已被 reportHeader 或图表认领的筛选不会再次进入页头。静态呈现复用 IocHeader，移除交互而保留身份与已应用条件。B6 的主题、全屏和附加操作仍未启用。

实际页面复用既有 `ioc-project-overview`、`ioc-opportunity-list`、`ioc-opportunity-analysis`：分别验证普通、更多筛选及紧凑呈现。`dashboard-period-filter` 使用同一页头且仅保留一个年份入口。旧文档回归使用完整兼容夹具，不再新增演示入口。筛选声明见[筛选模块](filters.md)。


普通行内页头（`layout:"inline"`、`density:"normal"`、`collapse:"none"`）按小箭头 `<`、标题、可选灰色标签、筛选依次进入同一个换行流；窄容器不固定两栏。标准/密集/详情合成页不自动添加说明、编码或期间事实。compact、firstRow、overflow和stacked继续各自原有呈现。返回仍要求可信 returnContext/back。完整场景见 `ioc-header-standard`、`ioc-header-dense`、`ioc-header-detail` 与 `/ioc-header-review`。


页面协议 6.51。结构真源为本册[schema.json](schema.json)，SHA256 `9302c984389196b0d7d4476ad3ea11cca480ea3d9a7b7292aff4ecdbf71f44b5`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-23"></a>

### `$`

Schema位置：`#`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 页面根 | required=["schemaVersion","id","dataSources","sections"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f736368656d6156657273696f6e"></a>

### `$.schemaVersion`

Schema位置：`#/properties/schemaVersion`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["5.0","5.1","5.2","5.3","5.4","6.5","6.11","6.12","6.13","6.14","6.15","6.16","6.17","6.18","6.19","6.20","6.21","6.22","6.23","6.24","6.25","6.26","6.27","6.28","6.29","6.30","6.31","6.32","6.33","6.34","6.35","6.36","6.37","6.38","6.39","6.40","6.41","6.42","6.43","6.44","6.45","6.46","6.47","6.48","6.49","6.50","6.51"] | Schema未设默认；装配/运行时默认见语义说明 | 页面文档契约版本；当前支持 5.0 / 5.1 / 5.2 / 5.3 / 5.4 / 6.5 / 6.11 / 6.12 / 6.13 / 6.14 / 6.15 / 6.16 / 6.17 / 6.18 / 6.19 / 6.20 / 6.21 / 6.22 / 6.23 / 6.24 / 6.25 / 6.26 / 6.27 / 6.28 / 6.29 / 6.30 / 6.31 / 6.32 / 6.33 / 6.34 / 6.35 / 6.36 / 6.37 / 6.38 / 6.39 / 6.40 / 6.41 / 6.42 / 6.43 / 6.44 / 6.45 / 6.46 / 6.47 / 6.48 / 6.49 / 6.50 / 6.51 |

| 允许值 | 解释与适用条件 |
|---|---|
| "5.0" | 历史5.0文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "5.1" | 历史5.1文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "5.2" | 历史5.2文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "5.3" | 历史5.3文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "5.4" | 历史5.4文档兼容读取；新创作输出当前6.x版本，能力仍按引入版本检查。 |
| "6.5" | 新增按百万呈现的0/1/2位小数格式。 |
| "6.11" | 当前作者写出版本，新增时间点与层级维度筛选器的参数初值。 |
| "6.12" | 增加跨源计算、内容导航、详情视图和展示字段；保留 6.11 读取。 |
| "6.13" | 增加页头日期筛选、月份范围、范围参数初值及时间点查询窗口。 |
| "6.14" | 增加查询结果集合绑定、多度量透视和有限主集合左关联；保留6.13读取。 |
| "6.15" | 6.15 增加显式筛选文本引用与统一 period 期间格式。 |
| "6.16" | 新增显式数字颜色、全部类别标签及常驻数值标签。 |
| "6.17" | 新增带符号普通数值格式，按展示精度统一符号、正负颜色与变化箭头。 |
| "6.18" | 补齐普通数值格式族的两位小数及千分位带符号版本；保留6.17读取。 |
| "6.19" | 新增查询结果绑定where：下游按原始字段独立筛行后提取维度集合，上游完整结果保持不变。 |
| "6.20" | 查询分页窗口可作为结果绑定输入；任意可排序列驱动依赖更新，排序回到第一页，下游仍只接收字段集合。 |
| "6.21" | 表格独立搜索与完整Excel导出工具区；查询搜索字段必须映射，搜索编码由数据网关提供。 |
| "6.22" | 组合查询源和数值表头范围；保留读取。 |
| "6.23" | 显式文本片段组合的兼容读取版本。 |
| "6.24" | 时间点包含式下限的兼容读取版本。 |
| "6.25" | 时间点禁止未来月份／日期引入版本。 |
| "6.26" | 兼容读取版本；本次分发未引入该版本专属能力，具体能力以能力表为准。 |
| "6.27" | Dashboard 年季月与近一年期间筛选引入版本。 |
| "6.28" | Report页头内置PDF下载及可配置按钮文字、文件名的兼容读取版本。 |
| "6.29" | Dashboard图表独立筛选：黑色圆角单选按钮组及自定义候选项。 |
| "6.30" | Report导出图片：独立文档、3/4倍高清、始终一张完整PNG。 |
| "6.31" | Report统一exportButtons，按按钮配置PDF/PNG格式、名称、文件名与渲染倍数，点击直接下载。 |
| "6.32" | 柱/线/饼图隐含echartsOption呈现扩展，保护数据结构，单次降级与console诊断。 |
| "6.33" | Tab 容器通过显式 URL 参数初始化活动页签。 |
| "6.34" | Dashboard 指标卡前置连接文字与双侧受控间距。 |
| "6.35" | 统一条件显隐、行投影、按钮及条件正文片段；父级约束后代，子项不反推父级。 |
| "6.36" | IOC根级页头增量；保持独立详情单月与原有页面兼容。 |
| "6.37" | 业务筛选选择规则、封闭枚举、结构树和依赖候选。 |
| "6.38" | USD、金额范围和静态货币字段选择独立能力增量。 |
| "6.39" | 复杂时间模式、可信期间事实及月份候选窗口。 |
| "6.40" | 显式跨页传值与目标输入契约校验。 |
| "6.41" | 统一页头呈现与自然期间可选模式；旧工具栏兼容读取。 |
| "6.42" | 表格静态搜索选项：每项单文本字段精确匹配、placeholder切换、切换即搜索。 |
| "6.43" | 维度下拉默认搜索、可关闭，普通树显式父子策略。 |
| "6.44" | 增加行内子表格及私有查询分页。 |
| "6.45" | Dashboard 独立固定单选筛选按钮组、一控多及统一显隐；旧图表筛选声明按明确批准的受控迁移例外移除。 |
| "6.46" | 必选多选、显式无依赖候选和单位case中的币种档位。 |
| "6.47" | 独立固定单选筛选支持下拉呈现和左右对齐。 |
| "6.48" | 普通表格和子表格支持独立的自动序号列。 |
| "6.49" | Tab 混合普通内容与组合卡、显式12列栅格、按需取数及保活恢复。 |
| "6.50" | 固定单选选择不同数据对象的完整静态DQE查询分支，共享结果字段契约与SourceProgram执行。 |
| "6.51" | Report 双模式 AI 总结、区域范围与异步会话缓存。 |

<a id="schema-232f70726f706572746965732f6964"></a>

### `$.id`

Schema位置：`#/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f70726f706572746965732f6d657461"></a>

### `$.meta`

Schema位置：`#/properties/meta`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 页面标题和说明等元信息。 |

<a id="schema-232f70726f706572746965732f6d6574612f70726f706572746965732f7469746c65"></a>

### `$.meta.title`

Schema位置：`#/properties/meta/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f70726f706572746965732f6d6574612f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `$.meta.title · allOf[0]`

Schema位置：`#/properties/meta/properties/title/allOf/0`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f6d6574612f70726f706572746965732f6465736372697074696f6e"></a>

### `$.meta.description`

Schema位置：`#/properties/meta/properties/description`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 说明文本。 |

<a id="schema-232f70726f706572746965732f6c61796f7574"></a>

### `$.layout`

Schema位置：`#/properties/layout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控布局声明。 |

<a id="schema-232f70726f706572746965732f6c61796f75742f616c6c4f662f30"></a>

### `$.layout · allOf[0]`

Schema位置：`#/properties/layout/allOf/0`。目标：[#/definitions/pageLayoutForm](page.md#schema-232f646566696e6974696f6e732f706167654c61796f7574466f726d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageLayoutForm | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f706167654c61796f7574466f726d"></a>

### `@pageLayoutForm`

Schema位置：`#/definitions/pageLayoutForm`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 类型/分支 | enum=["report","dashboard"] | Schema未设默认；装配/运行时默认见语义说明 | report 定宽居中报表外框（缺省）；dashboard 满宽看板外框，中性画布、无外层留白 |

| 允许值 | 解释与适用条件 |
|---|---|
| "report" | 定宽居中报表外框，未声明布局时采用。 |
| "dashboard" | 满宽看板外框。 |

<a id="schema-232f70726f706572746965732f6c61796f7574466f726d"></a>

### `$.layoutForm`

Schema位置：`#/properties/layoutForm`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 旧布局字段，仅兼容输入；新作者写layout。 |

<a id="schema-232f70726f706572746965732f6c61796f7574466f726d2f616c6c4f662f30"></a>

### `$.layoutForm · allOf[0]`

Schema位置：`#/properties/layoutForm/allOf/0`。目标：[#/definitions/pageLayoutForm](page.md#schema-232f646566696e6974696f6e732f706167654c61796f7574466f726d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageLayoutForm | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64617368626f617264546f6f6c626172"></a>

### `$.dashboardToolbar`

Schema位置：`#/properties/dashboardToolbar`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 旧文档兼容读取字段；渲染统一适配至 IocHeader，新页面使用 iocHeader。 |

<a id="schema-232f70726f706572746965732f64617368626f617264546f6f6c6261722f616c6c4f662f30"></a>

### `$.dashboardToolbar · allOf[0]`

Schema位置：`#/properties/dashboardToolbar/allOf/0`。目标：[#/definitions/dashboardToolbar](page.md#schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c626172)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/dashboardToolbar | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c626172"></a>

### `@dashboardToolbar`

Schema位置：`#/definitions/dashboardToolbar`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 类型/分支 | deprecated=true | Schema未设默认；装配/运行时默认见语义说明 | 旧页面兼容字段；统一由 IocHeader 呈现，新页面配置 iocHeader |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f30"></a>

### `@dashboardToolbar · anyOf[0]`

Schema位置：`#/definitions/dashboardToolbar/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 独立分支（不合并required） | enum=["visible","hidden"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "visible" | 显示统一工具栏。 |
| "hidden" | 隐藏统一工具栏，适用于页面已有自有页头。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f31"></a>

### `@dashboardToolbar · anyOf[1]`

Schema位置：`#/definitions/dashboardToolbar/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["variant"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f312f70726f706572746965732f76617269616e74"></a>

### `@dashboardToolbar · anyOf[1].variant`

Schema位置：`#/definitions/dashboardToolbar/anyOf/1/properties/variant`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="compact" | Schema未设默认；装配/运行时默认见语义说明 | 此组件支持的受控呈现变体，不能跨类型复用枚举。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "compact" | 时间点去掉分隔符后送出，例如 202604。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f312f70726f706572746965732f726561644f6e6c79"></a>

### `@dashboardToolbar · anyOf[1].readOnly`

Schema位置：`#/definitions/dashboardToolbar/anyOf/1/properties/readOnly`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 只读呈现标记，不是服务端权限保证。 |

<a id="schema-232f646566696e6974696f6e732f64617368626f617264546f6f6c6261722f616e794f662f312f70726f706572746965732f6e6f7465"></a>

### `@dashboardToolbar · anyOf[1].note`

Schema位置：`#/definitions/dashboardToolbar/anyOf/1/properties/note`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 补充说明文本。 |

<a id="schema-232f70726f706572746965732f696f63486561646572"></a>

### `$.iocHeader`

Schema位置：`#/properties/iocHeader`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | IOC页级身份与筛选位置声明；不承担查询编排，见page.md的IOC公共页头。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e74697479"></a>

### `$.iocHeader.identity`

Schema位置：`#/properties/iocHeader/properties/identity`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 可选身份行；省略不自动使用目录标题。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f7469746c65"></a>

### `$.iocHeader.identity.title`

Schema位置：`#/properties/iocHeader/properties/identity/properties/title`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 展示标题；是否必需由此处Schema分支决定，不能推断为空时的行为。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f7469746c652f616c6c4f662f30"></a>

### `$.iocHeader.identity.title · allOf[0]`

Schema位置：`#/properties/iocHeader/properties/identity/properties/title/allOf/0`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f636f6465"></a>

### `$.iocHeader.identity.code`

Schema位置：`#/properties/iocHeader/properties/identity/properties/code`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["label","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 标签与业务编码整体显示；缺值整体省略。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f636f64652f70726f706572746965732f6c6162656c"></a>

### `$.iocHeader.identity.code.label`

Schema位置：`#/properties/iocHeader/properties/identity/properties/code/properties/label`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f636f64652f70726f706572746965732f76616c7565"></a>

### `$.iocHeader.identity.code.value`

Schema位置：`#/properties/iocHeader/properties/identity/properties/code/properties/value`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f6465736372697074696f6e"></a>

### `$.iocHeader.identity.description`

Schema位置：`#/properties/iocHeader/properties/identity/properties/description`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["text"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 说明文本。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f6465736372697074696f6e2f70726f706572746965732f74657874"></a>

### `$.iocHeader.identity.description.text`

Schema位置：`#/properties/iocHeader/properties/identity/properties/description/properties/text`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 纯文本说明，沿用TextValue引用。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f6465736372697074696f6e2f70726f706572746965732f70726573656e746174696f6e"></a>

### `$.iocHeader.identity.description.presentation`

Schema位置：`#/properties/iocHeader/properties/identity/properties/description/properties/presentation`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["inline","tooltip"] | Schema未设默认；装配/运行时默认见语义说明 | 说明直接显示或通过键盘可达说明入口展开。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "inline" | 在身份区直接显示说明。 |
| "tooltip" | 通过可聚焦说明入口展开完整文字。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f74616773"></a>

### `$.iocHeader.identity.tags`

Schema位置：`#/properties/iocHeader/properties/identity/properties/tags`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 标签集合。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f746167732f6974656d73"></a>

### `$.iocHeader.identity.tags[]`

Schema位置：`#/properties/iocHeader/properties/identity/properties/tags/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","text"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f746167732f6974656d732f70726f706572746965732f6964"></a>

### `$.iocHeader.identity.tags[].id`

Schema位置：`#/properties/iocHeader/properties/identity/properties/tags/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f746167732f6974656d732f70726f706572746965732f74657874"></a>

### `$.iocHeader.identity.tags[].text`

Schema位置：`#/properties/iocHeader/properties/identity/properties/tags/items/properties/text`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 业务标签文字；缺值不产生空色块。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f746167732f6974656d732f70726f706572746965732f746f6e65"></a>

### `$.iocHeader.identity.tags[].tone`

Schema位置：`#/properties/iocHeader/properties/identity/properties/tags/items/properties/tone`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["neutral","info","success","warning","danger"] | Schema未设默认；装配/运行时默认见语义说明 | 受控内容语气/正负语义。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "neutral" | 中性标签，不推断业务含义。 |
| "info" | 提示信息标签。 |
| "success" | 显式成功语义标签。 |
| "warning" | 显式提醒语义标签。 |
| "danger" | 显式危险语义标签。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f6661637473"></a>

### `$.iocHeader.identity.facts`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 显式期间/时间事实；不根据类别自动生成当前时间。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d73"></a>

### `$.iocHeader.identity.facts[]`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","kind","label","value"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f6964"></a>

### `$.iocHeader.identity.facts[].id`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f6b696e64"></a>

### `$.iocHeader.identity.facts[].kind`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items/properties/kind`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["queryPeriod","latestDataPeriod","refreshedAt","generatedAt"] | Schema未设默认；装配/运行时默认见语义说明 | 判别结构分支。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "queryPeriod" | 显式已应用查询期间。 |
| "latestDataPeriod" | 由可信输入给出的最新数据期。 |
| "refreshedAt" | 可信数据刷新时间，缺值省略。 |
| "generatedAt" | 可信页面生成时间，缺值省略。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `$.iocHeader.identity.facts[].label`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items/properties/label`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c7565"></a>

### `$.iocHeader.identity.facts[].value`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c75652f616e794f662f30"></a>

### `$.iocHeader.identity.facts[].value · anyOf[0]`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items/properties/value/anyOf/0`。目标：[#/definitions/nonEmptyTextValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f6e6f6e456d7074795465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/nonEmptyTextValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c75652f616e794f662f31"></a>

### `$.iocHeader.identity.facts[].value · anyOf[1]`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items/properties/value/anyOf/1`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["fact","part"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c75652f616e794f662f312f70726f706572746965732f66616374"></a>

### `$.iocHeader.identity.facts[].value · anyOf[1].fact`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items/properties/value/anyOf/1/properties/fact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 只用于IOC facts.value及availability；从可信displayInputs源读取，不从URL或Page数据推断。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6964656e746974792f70726f706572746965732f66616374732f6974656d732f70726f706572746965732f76616c75652f616e794f662f312f70726f706572746965732f70617274"></a>

### `$.iocHeader.identity.facts[].value · anyOf[1].part`

Schema位置：`#/properties/iocHeader/properties/identity/properties/facts/items/properties/value/anyOf/1/properties/part`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["latest","latestComplete","refreshedAt","generatedAt"] | Schema未设默认；装配/运行时默认见语义说明 | 引用分量；导航支持value/from/to/level及modes的mode，期间事实只接受固定事实part并按kind校验。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "latest" | 事实粒度下最新有数据期间，不隐含完成。 |
| "latestComplete" | 事实粒度下最新完成期间；缺少时不可回退latest。 |
| "refreshedAt" | 可信服务实际刷新时间，使用带时区ISO输入；不取浏览器当前时间。 |
| "generatedAt" | 可信产物生成时间，使用带时区ISO输入；不取浏览器当前时间。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6261636b"></a>

### `$.iocHeader.back`

Schema位置：`#/properties/iocHeader/properties/back`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | const=true | Schema未设默认；装配/运行时默认见语义说明 | 返回意图；必须同时有合法returnContext和back处理函数。 |

| 允许值 | 解释与适用条件 |
|---|---|
| true | 用于选择$.iocHeader.back分支；同分支其它约束同时成立。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f726561644f6e6c79"></a>

### `$.iocHeader.readOnly`

Schema位置：`#/properties/iocHeader/properties/readOnly`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.41：页内筛选只读，所有用户筛选写入共用只读门禁；不是服务权限。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f6e6f7465"></a>

### `$.iocHeader.note`

Schema位置：`#/properties/iocHeader/properties/note`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 页头说明；可用于只读原因，纯文本。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f66696c746572496473"></a>

### `$.iocHeader.filterIds`

Schema位置：`#/properties/iocHeader/properties/filterIds`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 按序唯一认领静态可见的页级筛选；不含图表独立或详情私有筛选。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f66696c7465724964732f6974656d73"></a>

### `$.iocHeader.filterIds[]`

Schema位置：`#/properties/iocHeader/properties/filterIds/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f70726573656e746174696f6e"></a>

### `$.iocHeader.presentation`

Schema位置：`#/properties/iocHeader/properties/presentation`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 仅改变密度和折叠，不改变筛选语义。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f70726573656e746174696f6e2f70726f706572746965732f64656e73697479"></a>

### `$.iocHeader.presentation.density`

Schema位置：`#/properties/iocHeader/properties/presentation/properties/density`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["normal","compact"] | Schema未设默认；装配/运行时默认见语义说明 | 普通或紧凑页头。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "normal" | 正常密度（缺省）。 |
| "compact" | 紧凑密度，不改查询。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f70726573656e746174696f6e2f70726f706572746965732f636f6c6c61707365"></a>

### `$.iocHeader.presentation.collapse`

Schema位置：`#/properties/iocHeader/properties/presentation/properties/collapse`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["none","firstRow","overflow"] | Schema未设默认；装配/运行时默认见语义说明 | 保持全部筛选或按实测首行折叠；隐藏项退出焦点序列。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "none" | 全部展开（缺省）。 |
| "firstRow" | 按实际换行收起到首行。 |
| "overflow" | 按数量组织筛选；密集时前四项常驻，其余进入更多筛选，搜索放回内容区。compact 不收纳。 |

<a id="schema-232f70726f706572746965732f696f634865616465722f70726f706572746965732f70726573656e746174696f6e2f70726f706572746965732f6c61796f7574"></a>

### `$.iocHeader.presentation.layout`

Schema位置：`#/properties/iocHeader/properties/presentation/properties/layout`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["stacked","inline"] | Schema未设默认；装配/运行时默认见语义说明 | 6.41：stacked 身份与筛选上下排，inline 身份与筛选行内排布；按宿主容器响应。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "stacked" | 身份区与筛选区上下排布；缺省。 |
| "inline" | 标题与筛选行内排布；窄容器换行。 |

<a id="schema-232f70726f706572746965732f73747269637455524c496e70757473"></a>

### `$.strictURLInputs`

Schema位置：`#/properties/strictURLInputs`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | const=true | Schema未设默认；装配/运行时默认见语义说明 | 显式开启目标页URL输入严格校验；省略保留兼容读取，文档规范化升版本不会自动开启。 |

| 允许值 | 解释与适用条件 |
|---|---|
| true | 用于选择$.strictURLInputs分支；同分支其它约束同时成立。 |

<a id="schema-232f70726f706572746965732f706172616d73"></a>

### `$.params`

Schema位置：`#/properties/params`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 一次初始化的不可变页面参数声明。 |

<a id="schema-232f70726f706572746965732f706172616d732f616e794f662f30"></a>

### `$.params · anyOf[0]`

Schema位置：`#/properties/params/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 独立分支（不合并required） | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f706172616d732f616e794f662f302f6974656d73"></a>

### `$.params · anyOf[0][]`

Schema位置：`#/properties/params/anyOf/0/items`。目标：[#/definitions/pageParam](params-and-text-values.md#schema-232f646566696e6974696f6e732f70616765506172616d)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pageParam | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f706172616d732f616e794f662f31"></a>

### `$.params · anyOf[1]`

Schema位置：`#/properties/params/anyOf/1`。目标：[#/definitions/groupedPageParams](params-and-text-values.md#schema-232f646566696e6974696f6e732f67726f7570656450616765506172616d73)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/groupedPageParams | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64617461536f7572636573"></a>

### `$.dataSources`

Schema位置：`#/properties/dataSources`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"} | Schema未设默认；装配/运行时默认见语义说明 | 命名页面数据源集合，键为源id。 |

<a id="schema-232f70726f706572746965732f64617461536f75726365732f6164646974696f6e616c50726f70657274696573"></a>

### `$.dataSources{key}`

Schema位置：`#/properties/dataSources/additionalProperties`。目标：[#/definitions/dataSource](data-sources.md#schema-232f646566696e6974696f6e732f64617461536f75726365)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/dataSource | 动态键的值 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64617461536f75726365732f70726f70657274794e616d6573"></a>

### `$.dataSources · propertyNames`

Schema位置：`#/properties/dataSources/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c74657273"></a>

### `$.filters`

Schema位置：`#/properties/filters`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 页面筛选器声明集合。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d73"></a>

### `$.filters[]`

Schema位置：`#/properties/filters/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f30"></a>

### `$.filters[] · oneOf[0]`

Schema位置：`#/properties/filters/items/oneOf/0`。目标：[#/definitions/dimensionFilter](filters.md#schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/dimensionFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f31"></a>

### `$.filters[] · oneOf[1]`

Schema位置：`#/properties/filters/items/oneOf/1`。目标：[#/definitions/timeRangeFilter](filters.md#schema-232f646566696e6974696f6e732f74696d6552616e676546696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/timeRangeFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f32"></a>

### `$.filters[] · oneOf[2]`

Schema位置：`#/properties/filters/items/oneOf/2`。目标：[#/definitions/timePointFilter](filters.md#schema-232f646566696e6974696f6e732f74696d65506f696e7446696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/timePointFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f33"></a>

### `$.filters[] · oneOf[3]`

Schema位置：`#/properties/filters/items/oneOf/3`。目标：[#/definitions/booleanFilter](filters.md#schema-232f646566696e6974696f6e732f626f6f6c65616e46696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/booleanFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f34"></a>

### `$.filters[] · oneOf[4]`

Schema位置：`#/properties/filters/items/oneOf/4`。目标：[#/definitions/numberRangeFilter](filters.md#schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/numberRangeFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f66696c746572732f6974656d732f6f6e654f662f35"></a>

### `$.filters[] · oneOf[5]`

Schema位置：`#/properties/filters/items/oneOf/5`。目标：[#/definitions/searchFilter](filters.md#schema-232f646566696e6974696f6e732f73656172636846696c746572)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/searchFilter | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c5669657773"></a>

### `$.detailViews`

Schema位置：`#/properties/detailViews`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 按 id 声明快照或独立查询详情；导出页面不包含详情浮层。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d73"></a>

### `$.detailViews[]`

Schema位置：`#/properties/detailViews/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","mode","components"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f6964"></a>

### `$.detailViews[].id`

Schema位置：`#/properties/detailViews/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f6d6f6465"></a>

### `$.detailViews[].mode`

Schema位置：`#/properties/detailViews/items/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["snapshot","query"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "snapshot" | 消费主页面同一份快照，不另查详情数据。 |
| "query" | 详情显式独立参数和查询，打开时执行。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f66696c74657273"></a>

### `$.detailViews[].filters`

Schema位置：`#/properties/detailViews/items/properties/filters`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 页面筛选器声明集合。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f66696c746572732f6974656d73"></a>

### `$.detailViews[].filters[]`

Schema位置：`#/properties/detailViews/items/properties/filters/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e7473"></a>

### `$.detailViews[].components`

Schema位置：`#/properties/detailViews/items/properties/components`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 受控子组件集合；容器白名单与顶层集合不同。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d73"></a>

### `$.detailViews[].components[]`

Schema位置：`#/properties/detailViews/items/properties/components/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| oneOf联合 | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f30"></a>

### `$.detailViews[].components[] · oneOf[0]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/0`。目标：[#/definitions/reportHeaderComponent](components/reportHeader.md#schema-232f646566696e6974696f6e732f7265706f7274486561646572436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/reportHeaderComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f31"></a>

### `$.detailViews[].components[] · oneOf[1]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/1`。目标：[#/definitions/metricCardComponent](components/metricCard.md#schema-232f646566696e6974696f6e732f6d657472696343617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/metricCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f32"></a>

### `$.detailViews[].components[] · oneOf[2]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/2`。目标：[#/definitions/barChartComponent](components/barChart.md#schema-232f646566696e6974696f6e732f6261724368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/barChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f33"></a>

### `$.detailViews[].components[] · oneOf[3]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/3`。目标：[#/definitions/lineChartComponent](components/lineChart.md#schema-232f646566696e6974696f6e732f6c696e654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/lineChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f34"></a>

### `$.detailViews[].components[] · oneOf[4]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/4`。目标：[#/definitions/pieChartComponent](components/pieChart.md#schema-232f646566696e6974696f6e732f7069654368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/pieChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f35"></a>

### `$.detailViews[].components[] · oneOf[5]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/5`。目标：[#/definitions/tableComponent](components/table.md#schema-232f646566696e6974696f6e732f7461626c65436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tableComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f36"></a>

### `$.detailViews[].components[] · oneOf[6]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/6`。目标：[#/definitions/mapChartComponent](components/mapChart.md#schema-232f646566696e6974696f6e732f6d61704368617274436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/mapChartComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f37"></a>

### `$.detailViews[].components[] · oneOf[7]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/7`。目标：[#/definitions/gaugeComponent](components/gauge.md#schema-232f646566696e6974696f6e732f6761756765436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/gaugeComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f38"></a>

### `$.detailViews[].components[] · oneOf[8]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/8`。目标：[#/definitions/tabContainerComponent](components/tabContainer.md#schema-232f646566696e6974696f6e732f746162436f6e7461696e6572436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/tabContainerComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f39"></a>

### `$.detailViews[].components[] · oneOf[9]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/9`。目标：[#/definitions/compositeCardComponent](components/compositeCard.md#schema-232f646566696e6974696f6e732f636f6d706f7369746543617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/compositeCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3130"></a>

### `$.detailViews[].components[] · oneOf[10]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/10`。目标：[#/definitions/rankingCardComponent](components/rankingCard.md#schema-232f646566696e6974696f6e732f72616e6b696e6743617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rankingCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3131"></a>

### `$.detailViews[].components[] · oneOf[11]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/11`。目标：[#/definitions/rankingDetailCardComponent](components/rankingDetailCard.md#schema-232f646566696e6974696f6e732f72616e6b696e6744657461696c43617264436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/rankingDetailCardComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3132"></a>

### `$.detailViews[].components[] · oneOf[12]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/12`。目标：[#/definitions/keyValuePanelComponent](components/keyValuePanel.md#schema-232f646566696e6974696f6e732f6b657956616c756550616e656c436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/keyValuePanelComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3133"></a>

### `$.detailViews[].components[] · oneOf[13]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/13`。目标：[#/definitions/categoryBreakdownComponent](components/categoryBreakdown.md#schema-232f646566696e6974696f6e732f63617465676f7279427265616b646f776e436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/categoryBreakdownComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3134"></a>

### `$.detailViews[].components[] · oneOf[14]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/14`。目标：[#/definitions/fieldTextComponent](components/fieldText.md#schema-232f646566696e6974696f6e732f6669656c6454657874436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/fieldTextComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3135"></a>

### `$.detailViews[].components[] · oneOf[15]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/15`。目标：[#/definitions/textComponent](components/text.md#schema-232f646566696e6974696f6e732f74657874436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3136"></a>

### `$.detailViews[].components[] · oneOf[16]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/16`。目标：[#/definitions/aiSummaryComponent](components/aiSummary.md#schema-232f646566696e6974696f6e732f616953756d6d617279436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/aiSummaryComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3137"></a>

### `$.detailViews[].components[] · oneOf[17]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/17`。目标：[#/definitions/buttonComponent](components/button.md#schema-232f646566696e6974696f6e732f627574746f6e436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/buttonComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64657461696c56696577732f6974656d732f70726f706572746965732f636f6d706f6e656e74732f6974656d732f6f6e654f662f3138"></a>

### `$.detailViews[].components[] · oneOf[18]`

Schema位置：`#/properties/detailViews/items/properties/components/items/oneOf/18`。目标：[#/definitions/filterGroupComponent](components/filterGroup.md#schema-232f646566696e6974696f6e732f66696c74657247726f7570436f6d706f6e656e74)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/filterGroupComponent | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f757073"></a>

### `$.sectionGroups`

Schema位置：`#/properties/sectionGroups`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 声明互斥内容分区组；导出展开全部分区。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d73"></a>

### `$.sectionGroups[]`

Schema位置：`#/properties/sectionGroups/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","label","sectionIds"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f6964"></a>

### `$.sectionGroups[].id`

Schema位置：`#/properties/sectionGroups/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f76697369626c655768656e"></a>

### `$.sectionGroups[].visibleWhen`

Schema位置：`#/properties/sectionGroups/items/properties/visibleWhen`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 节点展示条件；只受自身与祖先约束，子项不反推父级。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f76697369626c655768656e2f616c6c4f662f30"></a>

### `$.sectionGroups[].visibleWhen · allOf[0]`

Schema位置：`#/properties/sectionGroups/items/properties/visibleWhen/allOf/0`。目标：[#/definitions/condition](conditions.md#schema-232f646566696e6974696f6e732f636f6e646974696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/condition | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `$.sectionGroups[].label`

Schema位置：`#/properties/sectionGroups/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f73656374696f6e496473"></a>

### `$.sectionGroups[].sectionIds`

Schema位置：`#/properties/sectionGroups/items/properties/sectionIds`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1; uniqueItems=true | Schema未设默认；装配/运行时默认见语义说明 | 该组包含的分区 id 有序列表。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570732f6974656d732f70726f706572746965732f73656374696f6e4964732f6974656d73"></a>

### `$.sectionGroups[].sectionIds[]`

Schema位置：`#/properties/sectionGroups/items/properties/sectionIds/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f64656661756c7453656374696f6e47726f7570"></a>

### `$.defaultSectionGroup`

Schema位置：`#/properties/defaultSectionGroup`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 默认内容分区组 id。 |

<a id="schema-232f70726f706572746965732f73656374696f6e47726f7570506172616d"></a>

### `$.sectionGroupParam`

Schema位置：`#/properties/sectionGroupParam`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 初始化内容分区组的 URL 参数名。 |

<a id="schema-232f70726f706572746965732f73656374696f6e416e63686f7273"></a>

### `$.sectionAnchors`

Schema位置：`#/properties/sectionAnchors`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 章节定位项；不隐式改变日期筛选。 |

<a id="schema-232f70726f706572746965732f73656374696f6e416e63686f72732f6974656d73"></a>

### `$.sectionAnchors[]`

Schema位置：`#/properties/sectionAnchors/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["sectionId","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f70726f706572746965732f73656374696f6e416e63686f72732f6974656d732f70726f706572746965732f73656374696f6e4964"></a>

### `$.sectionAnchors[].sectionId`

Schema位置：`#/properties/sectionAnchors/items/properties/sectionId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 定位目标内容分区 id。 |

<a id="schema-232f70726f706572746965732f73656374696f6e416e63686f72732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `$.sectionAnchors[].label`

Schema位置：`#/properties/sectionAnchors/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f70726f706572746965732f73656374696f6e73"></a>

### `$.sections`

Schema位置：`#/properties/sections`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 有序内容分区集合。 |

<a id="schema-232f70726f706572746965732f73656374696f6e732f6974656d73"></a>

### `$.sections[]`

Schema位置：`#/properties/sections/items`。目标：[#/definitions/section](sections-and-layout.md#schema-232f646566696e6974696f6e732f73656374696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/section | 每个数组项 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

## 语义规则与反例（生成）

- `page-layout-compatibility`：6.1 layout 能力下限与单布局真源；6.0 layoutForm 仍可读取。反例：[layout-before-6.1](errors/layout-before-6.1.json)、[layout-dual-equal](errors/layout-dual-equal.json)、[layout-dual-conflict](errors/layout-dual-conflict.json)、[layout-invalid-value](errors/layout-invalid-value.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](errors/missing-schema-version.json)、[unknown-top-level-field](errors/unknown-top-level-field.json)、[layout-span-out-of-range](errors/layout-span-out-of-range.json)、[field-id-pattern](errors/field-id-pattern.json)、[sections-empty](errors/sections-empty.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `schema-version-supported`：schemaVersion 必须是当前主版本内的受支持次版本。反例：[version-major-unsupported](errors/version-major-unsupported.json)、[version-minor-ahead](errors/version-minor-ahead.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `detail-view-component-types`：详情只允许说明、图表和表格；共享 Schema 其它组件分支有显式拒绝见证。反例：[detail-component-reject-reportheader](errors/detail-component-reject-reportheader.json)、[detail-component-reject-metriccard](errors/detail-component-reject-metriccard.json)、[detail-component-reject-mapchart](errors/detail-component-reject-mapchart.json)、[detail-component-reject-tabcontainer](errors/detail-component-reject-tabcontainer.json)、[detail-component-reject-compositecard](errors/detail-component-reject-compositecard.json)、[detail-component-reject-rankingcard](errors/detail-component-reject-rankingcard.json)、[detail-component-reject-rankingdetailcard](errors/detail-component-reject-rankingdetailcard.json)、[detail-component-reject-keyvaluepanel](errors/detail-component-reject-keyvaluepanel.json)、[detail-component-reject-categorybreakdown](errors/detail-component-reject-categorybreakdown.json)、[detail-component-reject-fieldtext](errors/detail-component-reject-fieldtext.json)、[detail-component-reject-aisummary](errors/detail-component-reject-aisummary.json)、[detail-component-reject-button](errors/detail-component-reject-button.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `ioc-header`：6.36 页级IOC身份与唯一筛选归属。反例：[ioc-header-before-6.36](errors/ioc-header-before-6.36.json)、[ioc-header-empty](errors/ioc-header-empty.json)、[ioc-header-toolbar-conflict](errors/ioc-header-toolbar-conflict.json)、[ioc-header-hidden-filter](errors/ioc-header-hidden-filter.json)、[ioc-header-missing-filter](errors/ioc-header-missing-filter.json)、[ioc-header-duplicate-identity](errors/ioc-header-duplicate-identity.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `time-extensions`：6.39 显式时间模式、可信期间事实、快捷范围及V2月份窗口。反例：[time-before-6.39](errors/time-before-6.39.json)、[time-case-missing](errors/time-case-missing.json)、[time-query-xor](errors/time-query-xor.json)、[time-period-mismatch](errors/time-period-mismatch.json)、[time-output-mismatch](errors/time-output-mismatch.json)、[time-default-week](errors/time-default-week.json)、[time-availability-default](errors/time-availability-default.json)、[time-fact-kind](errors/time-fact-kind.json)、[time-window-static-options](errors/time-window-static-options.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `unified-page-header`：6.41 唯一页头及自然年选择。反例：[unified-header-version](errors/unified-header-version.json)、[unified-header-conflict](errors/unified-header-conflict.json)、[period-modes-empty](errors/period-modes-empty.json)、[period-modes-duplicate](errors/period-modes-duplicate.json)、[period-modes-default](errors/period-modes-default.json)、[period-modes-plain-range](errors/period-modes-plain-range.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `required-multiple-selection`：6.46必选多选保持非空离散集合。反例：[required-multiple-version](errors/required-multiple-version.json)、[required-multiple-empty](errors/required-multiple-empty.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `independent-filter-candidates`：6.46显式无依赖候选使用V2及局部门禁。反例：[independent-candidates-version](errors/independent-candidates-version.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `currency-range-presets`：6.46单位case内的币种预设保持单一金额状态。反例：[currency-presets-version](errors/currency-presets-version.json)、[currency-presets-missing](errors/currency-presets-missing.json)、[currency-presets-shared](errors/currency-presets-shared.json)、[currency-presets-invalid](errors/currency-presets-invalid.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

## 示例与溯源（生成）

- [inline-report](examples/inline-report.json)：完整合法页面；查询仅为静态契约证据。
- [reference-branches-page](examples/reference-branches-page.json)：完整合法页面；查询仅为静态契约证据。
- [detail-views](examples/detail-views.json)：完整合法页面；查询仅为静态契约证据。
- [report-date-filters-page](examples/report-date-filters-page.json)：完整合法页面；查询仅为静态契约证据。
- [reference-export-detail-branches](examples/reference-export-detail-branches.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-page](examples/ioc-header-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-modes-page](examples/time-modes-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-presets-page](examples/time-presets-page.json)：完整合法页面；查询仅为静态契约证据。
- [availability-page](examples/availability-page.json)：完整合法页面；查询仅为静态契约证据。
- [calendar-window-page](examples/calendar-window-page.json)：完整合法页面；查询仅为静态契约证据。
- [unified-year-header](examples/unified-year-header.json)：完整合法页面；查询仅为静态契约证据。
- [unified-overflow-header](examples/unified-overflow-header.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-business](examples/ioc-header-business.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-currency](examples/ioc-header-currency.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-groups](examples/ioc-header-groups.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-incentives](examples/ioc-header-incentives.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-models](examples/ioc-header-models.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-months](examples/ioc-header-months.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-unconfigured](examples/ioc-header-unconfigured.json)：完整合法页面；查询仅为静态契约证据。
- [tab-mixed-content](examples/tab-mixed-content.json)：完整合法页面；查询仅为静态契约证据。

## 联合分支见证（生成）

- `#/definitions/dashboardToolbar/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/dashboardToolbar`。
- `#/definitions/dashboardToolbar/anyOf/1`：[合法完整页面](examples/component-pieChart.json)，JSON Pointer `#/dashboardToolbar`。
- `#/properties/iocHeader/properties/identity/properties/facts/items/properties/value/anyOf/0`：[合法完整页面](examples/ioc-header-page.json)，JSON Pointer `#/iocHeader/identity/facts/0/value`。
- `#/properties/iocHeader/properties/identity/properties/facts/items/properties/value/anyOf/1`：[合法完整页面](examples/availability-page.json)，JSON Pointer `#/iocHeader/identity/facts/1/value`。
- `#/properties/params/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/params`。
- `#/properties/params/anyOf/1`：[合法完整页面](examples/report-date-filters-page.json)，JSON Pointer `#/params`。
- `#/properties/filters/items/oneOf/0`：[合法完整页面](examples/component-mapChart.json)，JSON Pointer `#/filters/0`。
- `#/properties/filters/items/oneOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/1`。
- `#/properties/filters/items/oneOf/2`：[合法完整页面](examples/availability-page.json)，JSON Pointer `#/filters/0`。
- `#/properties/filters/items/oneOf/3`：[合法完整页面](examples/unified-overflow-header.json)，JSON Pointer `#/filters/1`。
- `#/properties/filters/items/oneOf/4`：[合法完整页面](examples/unified-overflow-header.json)，JSON Pointer `#/filters/9`。
- `#/properties/filters/items/oneOf/5`：[合法完整页面](examples/detail-views.json)，JSON Pointer `#/filters/0`。
- `#/properties/detailViews/items/properties/components/items/oneOf/0`：[语义拒绝反例](errors/detail-component-reject-reportheader.json)：详情的展示闭集拒绝 reportHeader；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/1`：[语义拒绝反例](errors/detail-component-reject-metriccard.json)：详情的展示闭集拒绝 metricCard；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/2`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/2`。
- `#/properties/detailViews/items/properties/components/items/oneOf/3`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/3`。
- `#/properties/detailViews/items/properties/components/items/oneOf/4`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/4`。
- `#/properties/detailViews/items/properties/components/items/oneOf/5`：[合法完整页面](examples/detail-views.json)，JSON Pointer `#/detailViews/0/components/0`。
- `#/properties/detailViews/items/properties/components/items/oneOf/6`：[语义拒绝反例](errors/detail-component-reject-mapchart.json)：详情的展示闭集拒绝 mapChart；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/7`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/5`。
- `#/properties/detailViews/items/properties/components/items/oneOf/8`：[语义拒绝反例](errors/detail-component-reject-tabcontainer.json)：详情的展示闭集拒绝 tabContainer；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/9`：[语义拒绝反例](errors/detail-component-reject-compositecard.json)：详情的展示闭集拒绝 compositeCard；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/10`：[语义拒绝反例](errors/detail-component-reject-rankingcard.json)：详情的展示闭集拒绝 rankingCard；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/11`：[语义拒绝反例](errors/detail-component-reject-rankingdetailcard.json)：详情的展示闭集拒绝 rankingDetailCard；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/12`：[语义拒绝反例](errors/detail-component-reject-keyvaluepanel.json)：详情的展示闭集拒绝 keyValuePanel；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/13`：[语义拒绝反例](errors/detail-component-reject-categorybreakdown.json)：详情的展示闭集拒绝 categoryBreakdown；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/14`：[语义拒绝反例](errors/detail-component-reject-fieldtext.json)：详情的展示闭集拒绝 fieldText；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/15`：[合法完整页面](examples/reference-export-detail-branches.json)，JSON Pointer `#/detailViews/0/components/0`。
- `#/properties/detailViews/items/properties/components/items/oneOf/16`：[语义拒绝反例](errors/detail-component-reject-aisummary.json)：详情的展示闭集拒绝 aiSummary；共享组件 Schema 分支只存在语义反例。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/17`：[语义拒绝反例](errors/detail-component-reject-button.json)：详情展示闭集不开放独立按钮和递归动作，只有语义拒绝见证。（规则 `detail-view-component-types`）。此项不计入合法示例覆盖。
- `#/properties/detailViews/items/properties/components/items/oneOf/18`：[语义拒绝反例](errors/filter-group-detail.json)：独立固定筛选按钮组首批仅用于Dashboard正文或组合卡；共享组件Schema的详情分支由语义校验拒绝。（规则 `filter-group`）。此项不计入合法示例覆盖。
