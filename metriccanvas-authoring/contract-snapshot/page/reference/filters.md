# 筛选声明与运行状态

六类筛选为dimension、timeRange、timePoint、boolean、numberRange、search。声明描述输入能力，当前值由页内FilterState保存。URL只在初始化时读；重复维度键表示多值，不拆逗号。boolean的false是显式值，不能被默认true覆盖。

## 时间选择的默认上限

所有时间选择控件（含表头日期范围）默认禁止未来时间：月到本地当前月，日期到今天，精确时间到当前分钟。普通范围的结束值受同一上限约束；面板、键盘、手工提交、URL 恢复、初值和外部筛选状态写入共用边界。未来 URL 值被忽略，保留页面的合法初值；非法写入保留已应用状态，不触发查询。声明或参数提供未来初值时，运行时拒绝初始化，不静默截断查询。

Dashboard 的年、季、月按所选自然期间判断：当前年／当前季／当前月可选，更晚期间不可选；查询仍保留该期间完整起止，不裁剪为截至今天。近一年继续取当前月之前十二个完整月份。普通 timeRange 与上述期间选择的口径不同，不以范围终点检查当前自然期间。

时间点省略 `disableFuture` 按 true 处理；已有显式 `disableFuture: false` 保持放开上限的含义，min 仍有效。普通范围和 Dashboard 期间选择统一采用默认上限，不新增页面字段或协议版本。静态校验继续检查结构、公历及已有显式规则，运行时按执行环境当前时间检查所有选择值。

页面试验场统一入口：`report-date-filter-example` 覆盖单月、月份范围、日期、日期范围和精确时间范围；`dashboard-period-filter` 展示统一页头仅选年份；完整年／季／月／近一年保留于期间契约夹具。合成数据与控件验收不证明真实 DQE 接入。

## Dashboard 期间选择（6.27）

`timeRange` 可声明 `display: "period"`，在 Dashboard 通用顶部 FilterBar 中作为一个筛选器显示「年／季／月／近一年」。省略 display 仍为原有范围编辑器。`precision` 只允许 month/date，分别决定实际范围编码，不改变查询的 period/is_aggregate。季度输入显示「2026 年 Q4」，四个面板选项为 Q1—Q4。

6.41 可声明 `periodModes:["year"]`，搭配 `default:{"mode":"year"}` 只显示年份选择框。`periodModes` 是 year／quarter／month／last12Months 的非空不重复列表，省略保持四种模式；单模式隐藏切换栏，默认与参数初始化模式必须在列表内。URL、初值、程序写入共用模式限制，不允许的模式保留已应用值。自然年仍为完整 01-01 至 12-31，当前年可选、未来年禁止。它属于共享期间筛选，不属于某个页头；不要与 `display:"modes"` 的日/月/ISO周对象列表混用。完整页面复用 `dashboard-period-filter`，不新增年份演示页。

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

## 独立筛选按钮组

固定单选选项由独立 `filterGroup` 组件声明（6.47 支持按钮或下拉及左右对齐），筛选状态仍归页面 filters，查询范围仍归 filterBindings。一个控件可以控制多个查询及其组件消费者，并复用统一 visibleWhen 策略。完整声明、显隐与状态语义、限制、旧图表声明迁移和验收场景见[筛选按钮组](components/filterGroup.md)。

原图表 `props.filter` 已移除；原锚点保留为本文档跳转入口，不代表旧协议继续可读。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

<a id="business-filters"></a>

## 业务筛选（6.37）

本增量适用于页级筛选，与根iocHeader的位置声明分开。普通看板、报表和详情独立消费，不批量改已有业务页。

- dimension.selection声明mode为single/multiple；缺省保持旧多选，tabs交互继续单选。旧页未声明selection时，initialParam仍可用多值数组初始化tabs的已应用条件；后续点选替换为单值。显式selection.mode=single始终严格校验初值及后续写入。single至多一个值；required要求非空，single与required组合恰好一个值，6.46起multiple与required组合允许非空多值，缺失时相关查询等待选择，非法整组写入拒绝。options是创作期确认的穷尽枚举，稳定value与label分开，可显式disabled；有options不请求候选网关，不允许同时配置动态依赖或hierarchy。disabled值不参与选择或默认值。
- allBehavior缺省values。只有multiple+显式options可用unrestricted：选中全部有效枚举后仅省略对应动态查询谓词，UI/URL保留实际值，查询体原有静态条件仍保留。禁用项不算必须选中。boolean与枚举分别处理：勾选走whenTrue，明确false走whenFalse；省略whenFalse仍为无条件。default:false仍保留旧的不加初始化条件行为；需要确定的否值谓词时，使用显式false输入或用户取消勾选，并声明whenFalse。
- display:tree带treeSelection:level为新结构树，必须有hierarchy。候选显式提供level和parent，不从业务码拆斜杠；不同层可使用相同value。当前只有一个level，可选父节点只选择自身，切层清掉旧值并保留新层级；其他层节点只展开。旧tree不带该字段仍按父节点批量选择叶子。
- candidateContext用filterIds列出维度/单点时间/范围时间依赖，reconcile为clear/intersection。与旧dependsOn、clearOnChangeOf合图查重、检环；旧dependsOn仍只支持单个维度上游。clear在上游变化时递归清值，等用户显式确认；intersection保留摘要，等新完整可信候选到达后取交集。空交集、未就绪、失败、拒绝和未配置不能自动查询全部。上游被阻断时，候选依赖后代同样阻断。
- 共用hint为TextValue，可引用不可变参数或已应用筛选，缺值省略；clearOnChangeOf是明确失效关系，不伪装成候选请求约束。普通只读不清合法条件。

V2 fetchFilterCandidates由宿主Adapter提供，与旧fetchDimensionValues并存。请求包含filterId/dimension/level和完整维度、时间约束；timePoint按原精度投影为同值from/to，timeRange保留已应用范围，绝不截成详情单月。新结构树或candidateContext缺V2时明确unavailable，不丢约束调用旧端口。结果保留ready/empty/unavailable/error并区分denied和unconfigured；失败重试当前依赖。首批要求完整候选，最多10000项，不接受部分列表做全选或交集。按语言组合网关存在多个不同V2 Adapter时返回unconfigured，不合并授权域。

浏览器协调器与SourceProgram使用同一无框架请求投影及结构校验。SourceProgram在复用seeds/initial或查询前校验绑定筛选和祖先；同步initialSnapshots对尚未核验的新动态候选返回loading。每个运行实例复用完整候选回执，重试失效旧代次，不跨实例/可信身份复用。独立源继续执行；相关导出使用同一门禁。

实际页面：ioc-header-business-options-demo（封闭单选、全选不限、boolean），ioc-header-business-tree-demo（新结构树、旧树及时间/区域交集），ioc-header-business-detail-demo（详情私有枚举与单月）。本地HTTP合成Adapter不代表真实DQE、CloudIOC、Relay或门户接线；Playground未接V2时应显示不可用。新字段不包括仍待审的Condition/displayInputs，复杂期间/latest/calendarWindow仍保留后续规划。

<a id="amount-range"></a>

## 金额范围（6.38）

numberRange可声明constraints的min/max（基本单位）和bounds:strict（双边from必须小于to）。单边允许；普通旧范围仍允许相等。全部是无端点的显式清空，不是无限大数字；拒绝负数约束冲突、NaN/Infinity及比例溢出。

units为`{filterId,cases:{RMB:{currency:"CNY",label:"万元",scale:10000},USD:{currency:"USD",label:"万美元",scale:10000}}}`，控制筛选必须为required单选options并穷尽有效枚举。scale为正安全整数。必须用clearOnChangeOf引用该币种，换币与清金额在同一事务；自动清空沿用等待用户显式确认的门禁。

presets为`{id,label,range:{from?,to?}}[]`，输入和预设使用显示单位，确定时乘一次scale。default、URL、restore、执行回执和FilterValue已经是基本单位，查询绑定不再次换算。新面板有草稿/取消/确定，预设只修改草稿；切币种、只读或页头折叠会关闭旧草稿。币种尚未选择时金额等待选择，不隐式按人民币处理。

范围绑定互斥metric与metricByFilter：`{target:"numberRange",metricByFilter:{filterId:"currency",cases:{RMB:"ioc_amount_base_cny",USD:"ioc_amount_base_usd"}}}`。每个case必须指向该源显式queryField映射的money字段，并与units同case货币相符。币种是查询隐式依赖，即使没有独立currency绑定也参与重查、默认初始数据复用与执行门禁。SourceProgram在seed/initial复用前校验范围和控制币种。

验收页[ioc-header-currency-demo](examples/currency-selection-page.json)使用两种独立静态货币字段、本地合成HTTP与已有XLSX出口。没有真实USD或汇率证据，不声称生产换币可用，不做前端汇率换算。

## 6.39 复杂时间与候选

`timeRange.display:"modes"` 声明 `required:true`、`defaultMode` 和 `modes:[{id:"day"|"month"|"isoWeek",default:TimeRangeValue|RelativeTimeExpression}]`。普通 default/precision、period、initialParam/initialMode 与 modes 互斥。日为 YYYY-MM-DD，月为 YYYY-MM，ISO周保存同周周一至周日并计算ISO所属年。模式、from、to原子提交，每个模式记忆最近合法范围；失效时尝试合法默认值，不能沿用旧查询。URL使用 `<id>.mode`、`<id>.from`、`<id>.to` 完整整组；未知/缺项/重复/错周拒绝。

`timeRange.presets:[{id,label,range:RelativeTimeExpression}]` 点击才提交。近N天含锚点日、起点减N-1；月份按日历月计算，includeCurrent明确，显式anchor同时控制起止。旧period近一年仍是当前月之前12个完整月，不被预设替换。

`timePoint/timeRange` 可声明 min/max、blockedRanges 和 `availability:{fact,initial?:"latest"|"latestComplete",max:"latest"|"latestComplete",blockMissing?:true}`。initial与普通default/initialParam互斥，合法URL优先；max始终独立校验。latest不是完成状态；缺complete不回退latest。完整年/季/周越界拒绝，不截短自然期。缺数默认可查询空，仅显式blockMissing才禁选。所有边界取交集，输入错误不提交。disableFuture默认沿旧行为，可显式false。

动态平面 dimension 的 `candidateWindow:{unit:"month",n:12,includeCurrent:boolean,anchorFact?:string}` 通过V2候选接口传 `calendarWindow:{granularity:"month",from,to}`；anchorFact消费可信latest，省略按同次时钟。不能与options/hierarchy混用。V2缺失、事实未就绪或结果失败时阻断相关查询，不降级旧端口。真实年月值按维度集合绑定，选1/3月不补2月；仅dtime的多区间查询不在本批支持范围。candidateContext时间/模式/维度及窗口/事实上下文共同决定缓存键；intersection等待当前完整候选后才取交集。

场景：time-modes-page、time-presets-page、availability-page、calendar-window-page；对应 `pages/ioc-header-*-demo.json` 可交互验收。
6.35新增的就地条件与层级状态语义见[条件显隐与动作资格](conditions.md)，旧页面原有行为保持。


## 下拉搜索与普通树（6.43）

`dimension.selection`沿用对象`{mode:"single"|"multiple",required?,allBehavior?}`；不可写字符串。所有维度下拉默认本地搜索，`searchable:false`关闭。名称、稳定代码及完整祖先路径参与过滤，搜索和展开不提交筛选。

`treeSelection:"level"`继续使用6.37的显式层级树、`hierarchy`和候选`parent:{level,value}`，仅当前层级候选可选；不改变其必选、权限、回执或联动校验。普通同维树另有`descendants`（父选后代，默认存量行为）、`independent`（父子独立）、`leaf`（仅叶子）三种规则；仅用于`display:"tree"`。普通树候选可提供`parentValue`，引用同一完整批次内的稳定value；重复、缺失父或循环显示层级错误。未提供父关系保留旧`/`路径约定，不从显示名生成业务代码。

单选值替换后关闭；多选保持32px单行标签并横向滚动。未知已选值保留代码，可移除；required仍恰好一个，不提供清空。树内容左侧16px、带框加减号及浅灰连接线使用冻结OpenTiny样式。

验收场景：[ioc-header-selection](examples/dimension-selection-page.json)，仅本地合成候选与表格查询；不代表真实服务验收。


<a id="ioc-业务批量场景与必选多选646"></a>

## IOC 业务批量场景与必选多选（6.46）

`selection.mode` 与 `required` 分别约束基数上限和是否允许空值。`{mode:"multiple",required:true}` 允许一个或多个合法且不重复的候选；控件保留多选和单项移除，最后一项不能移除。程序写入、URL恢复、默认值、查询门禁均使用相同规则；不存在默认值时只阻断相关查询。6.45及更早文档不能声明这一组合。`single` 原有最多一个值的规则保持，单选必选仍只允许一个。月份使用普通维度与重复 URL 键保存离散 YYYYMM 集合，不能补齐中间月或改成连续期间。

主线迁移示例统一使用 `iocHeader.identity`、`selection.mode`、`candidateContext`、`clearOnChangeOf` 和 `FilterCandidatesGateway` / `DisplayInputs`，不接受旧的 `inputResources`、`multiple` 或 `presetGroups` 页面字段。地区部和代表处显式 single，结构树逐级绑定各自 queryField；它们的生产谓词和权限含义需 Adapter 确认。模型候选只依赖 range，重试读取当前日期，其他筛选不进入候选约束。

[币种档位页](examples/ioc-header-currency.json)复用单个 numberRange 与主线 units.cases / metricByFilter；每个单位 case 可声明 presets，分别冻结 RMB 五档和 USD 四档，金额 clearOnChangeOf currency。按币种预设必须覆盖全部单位case，且与公共presets互斥；每个case的范围按其自己的scale与约束校验。币种变化在同一事务清除旧范围；自动清空继续沿主线等待用户确认的门禁，选择新档位或“全部”并确定后继续。RangePicker 预设填入草稿，确定才应用，取消保留已应用值；自定义双边严格递增。不换汇，不把两个币种的业务字段当作已接通。

[业务组合](examples/ioc-header-business.json)、[模型联动](examples/ioc-header-models.json)、[协同小组](examples/ioc-header-groups.json)、[激励策略](examples/ioc-header-incentives.json)、[币种金额](examples/ioc-header-currency.json)、[最近月份](examples/ioc-header-months.json)、[缺配置](examples/ioc-header-unconfigured.json)均可从 Playground `/ioc-header-review` 打开。协同小组只加工明确完整的组织权限输入；不完整在 Adapter 归一为 unconfigured，不提供全量授权兜底。激励候选固定演示日历月2026-10，正文选择月2026-08变化不重取；是否改变生产行为待定。月份固定锚点2026-10，清空回退10/12个月的生产差异仍未裁决。

正常/慢请求/失败重试/空/拒绝/缺配置/不完整/只读均为本地合成输入。只读使用主线 `filterEditing` 统一限制编辑，没有恢复旧版每个筛选器的 readOnly 字段。局部查询门禁不影响无关 inline。真实候选字典、组织 payload、逐源查询字段、金额单位、导出及 IOC/DQE/Relay 尚未接通或验收。

6.46起 `candidateContext:{filterIds:[],reconcile:"clear"}` 显式声明无筛选依赖的外部候选，仍走完整 `FilterCandidatesGateway` 状态、重试及门禁。适用于权限组织加工、日历月预拉等；月份选择或无关筛选变化不重取。未声明 candidateContext 的旧页面继续既有候选端口，不自动改变路由。

普通可选维度在空选且没有candidateContext/结构树/窗口要求时，不因显式selection而禁用既有合法嵌入初始行复用；一旦有动态选值，仍须通过候选校验。显式无依赖candidateContext即使空选也须取得可信回执，缺配置不能借初始行绕过门禁。


页面协议 6.47。结构真源为本册[schema.json](schema.json)，SHA256 `aca00179dd0494b52471e6d3a8d89883611b2102c4502c60676dbd3489e2847b`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c746572"></a>

### `@dimensionFilter`

Schema位置：`#/definitions/dimensionFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type","dimension"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f68696e74"></a>

### `@dimensionFilter.hint`

Schema位置：`#/definitions/dimensionFilter/properties/hint`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | TextValue筛选提示，可引用参数和已应用筛选，缺值省略。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f68696e742f616c6c4f662f30"></a>

### `@dimensionFilter.hint · allOf[0]`

Schema位置：`#/definitions/dimensionFilter/properties/hint/allOf/0`。目标：[#/definitions/textValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f66"></a>

### `@dimensionFilter.clearOnChangeOf`

Schema位置：`#/definitions/dimensionFilter/properties/clearOnChangeOf`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 依赖变化的原子失效清理；不添加候选端口约束。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f662f6974656d73"></a>

### `@dimensionFilter.clearOnChangeOf[]`

Schema位置：`#/definitions/dimensionFilter/properties/clearOnChangeOf/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f73656c656374696f6e"></a>

### `@dimensionFilter.selection`

Schema位置：`#/definitions/dimensionFilter/properties/selection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["mode"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 单/多选及必选基数；required恰好一个值。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f6d6f6465"></a>

### `@dimensionFilter.selection.mode`

Schema位置：`#/definitions/dimensionFilter/properties/selection/properties/mode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["single","multiple"] | Schema未设默认；装配/运行时默认见语义说明 | 分页或其它受控结构的模式判别。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "single" | 至多选择一个值。 |
| "multiple" | 保留多个显式值，required仍要求恰好一个。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f7265717569726564"></a>

### `@dimensionFilter.selection.required`

Schema位置：`#/definitions/dimensionFilter/properties/selection/properties/required`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 参数是否必需；缺值时是否阻止初始化。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f73656c656374696f6e2f70726f706572746965732f616c6c4265686176696f72"></a>

### `@dimensionFilter.selection.allBehavior`

Schema位置：`#/definitions/dimensionFilter/properties/selection/properties/allBehavior`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["values","unrestricted"] | Schema未设默认；装配/运行时默认见语义说明 | 全选保留实际选择；仅穷尽封闭多选枚举可省动态谓词。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "values" | 完整传递已选值集合。 |
| "unrestricted" | 穷尽有效封闭枚举全部选中时省略动态维度谓词。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6f7074696f6e73"></a>

### `@dimensionFilter.options`

Schema位置：`#/definitions/dimensionFilter/properties/options`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; maxItems=1000 | Schema未设默认；装配/运行时默认见语义说明 | 创作期确认的穷尽枚举；不请求候选网关，不作权限失败回退。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6f7074696f6e732f6974656d73"></a>

### `@dimensionFilter.options[]`

Schema位置：`#/definitions/dimensionFilter/properties/options/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["value","label"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f76616c7565"></a>

### `@dimensionFilter.options[].value`

Schema位置：`#/definitions/dimensionFilter/properties/options/items/properties/value`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 当前分支的固定值或绑定取值。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@dimensionFilter.options[].label`

Schema位置：`#/definitions/dimensionFilter/properties/options/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f6f7074696f6e732f6974656d732f70726f706572746965732f64697361626c6564"></a>

### `@dimensionFilter.options[].disabled`

Schema位置：`#/definitions/dimensionFilter/properties/options/items/properties/disabled`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 不可选且不能作为默认值，不计入全选集合。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f7472656553656c656374696f6e"></a>

### `@dimensionFilter.treeSelection`

Schema位置：`#/definitions/dimensionFilter/properties/treeSelection`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["level","descendants","independent","leaf"] | Schema未设默认；装配/运行时默认见语义说明 | level保留6.37层级树；6.43普通树支持descendants、independent、leaf。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "level" | 层级维度的层级部分。 |
| "descendants" | 普通树父节点选择自身及可选后代；保留旧路径树默认行为。 |
| "independent" | 普通树父子分别选择，单选替换一个稳定值。 |
| "leaf" | 普通树只选择叶子；多选父节点批量作用于叶子。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f73656172636861626c65"></a>

### `@dimensionFilter.searchable`

Schema位置：`#/definitions/dimensionFilter/properties/searchable`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 6.43本地搜索开关，默认true；不提交筛选。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e64696461746557696e646f77"></a>

### `@dimensionFilter.candidateWindow`

Schema位置：`#/definitions/dimensionFilter/properties/candidateWindow`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["unit","n","includeCurrent"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | V2候选必须携带12个日历月闭区间及完整上下文，不能降级旧维度端口。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e64696461746557696e646f772f70726f706572746965732f756e6974"></a>

### `@dimensionFilter.candidateWindow.unit`

Schema位置：`#/definitions/dimensionFilter/properties/candidateWindow/properties/unit`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | const="month" | Schema未设默认；装配/运行时默认见语义说明 | 展示单位，不自动改变数值刻度。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "month" | 月粒度；timePoint使用YYYY-MM。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e64696461746557696e646f772f70726f706572746965732f6e"></a>

### `@dimensionFilter.candidateWindow.n`

Schema位置：`#/definitions/dimensionFilter/properties/candidateWindow/properties/n`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支必填 | const=12 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间的周期数量。 |

| 允许值 | 解释与适用条件 |
|---|---|
| 12 | 用于选择@dimensionFilter.candidateWindow.n分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e64696461746557696e646f772f70726f706572746965732f696e636c75646543757272656e74"></a>

### `@dimensionFilter.candidateWindow.includeCurrent`

Schema位置：`#/definitions/dimensionFilter/properties/candidateWindow/properties/includeCurrent`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 相对时间范围是否包含当前周期。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e64696461746557696e646f772f70726f706572746965732f616e63686f7246616374"></a>

### `@dimensionFilter.candidateWindow.anchorFact`

Schema位置：`#/definitions/dimensionFilter/properties/candidateWindow/properties/anchorFact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 可信具名期间事实的latest作为月份锚点；省略使用同次时钟。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e646964617465436f6e74657874"></a>

### `@dimensionFilter.candidateContext`

Schema位置：`#/definitions/dimensionFilter/properties/candidateContext`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["filterIds","reconcile"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 候选依赖与可信候选到达后的协调策略。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e646964617465436f6e746578742f70726f706572746965732f66696c746572496473"></a>

### `@dimensionFilter.candidateContext.filterIds`

Schema位置：`#/definitions/dimensionFilter/properties/candidateContext/properties/filterIds`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 维度及已应用期间依赖，合并旧dependsOn后检环。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e646964617465436f6e746578742f70726f706572746965732f66696c7465724964732f6974656d73"></a>

### `@dimensionFilter.candidateContext.filterIds[]`

Schema位置：`#/definitions/dimensionFilter/properties/candidateContext/properties/filterIds/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f64696d656e73696f6e46696c7465722f70726f706572746965732f63616e646964617465436f6e746578742f70726f706572746965732f7265636f6e63696c65"></a>

### `@dimensionFilter.candidateContext.reconcile`

Schema位置：`#/definitions/dimensionFilter/properties/candidateContext/properties/reconcile`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["clear","intersection"] | Schema未设默认；装配/运行时默认见语义说明 | clear递归清理；intersection等待新完整可信候选再取交集。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "clear" | 上游变化递归清值并等待显式确认。 |
| "intersection" | 新完整可信候选就绪后保留交集；空交集保持门禁。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c746572"></a>

### `@timeRangeFilter`

Schema位置：`#/definitions/timeRangeFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f68696e74"></a>

### `@timeRangeFilter.hint`

Schema位置：`#/definitions/timeRangeFilter/properties/hint`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | TextValue筛选提示，可引用参数和已应用筛选，缺值省略。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f68696e742f616c6c4f662f30"></a>

### `@timeRangeFilter.hint · allOf[0]`

Schema位置：`#/definitions/timeRangeFilter/properties/hint/allOf/0`。目标：[#/definitions/textValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f66"></a>

### `@timeRangeFilter.clearOnChangeOf`

Schema位置：`#/definitions/timeRangeFilter/properties/clearOnChangeOf`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 依赖变化的原子失效清理；不添加候选端口约束。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f662f6974656d73"></a>

### `@timeRangeFilter.clearOnChangeOf[]`

Schema位置：`#/definitions/timeRangeFilter/properties/clearOnChangeOf/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d696e"></a>

### `@timeRangeFilter.min`

Schema位置：`#/definitions/timeRangeFilter/properties/min`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 量表下界。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6178"></a>

### `@timeRangeFilter.max`

Schema位置：`#/definitions/timeRangeFilter/properties/max`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 时间上限与min/disableFuture/禁选范围取交集；完整自然期不能截短。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f626c6f636b656452616e676573"></a>

### `@timeRangeFilter.blockedRanges`

Schema位置：`#/definitions/timeRangeFilter/properties/blockedRanges`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 完整范围与任一禁选区间相交即拒绝，不静默截断。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f626c6f636b656452616e6765732f6974656d73"></a>

### `@timeRangeFilter.blockedRanges[]`

Schema位置：`#/definitions/timeRangeFilter/properties/blockedRanges/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["from","to"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f626c6f636b656452616e6765732f6974656d732f70726f706572746965732f66726f6d"></a>

### `@timeRangeFilter.blockedRanges[].from`

Schema位置：`#/definitions/timeRangeFilter/properties/blockedRanges/items/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f626c6f636b656452616e6765732f6974656d732f70726f706572746965732f746f"></a>

### `@timeRangeFilter.blockedRanges[].to`

Schema位置：`#/definitions/timeRangeFilter/properties/blockedRanges/items/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f617661696c6162696c697479"></a>

### `@timeRangeFilter.availability`

Schema位置：`#/definitions/timeRangeFilter/properties/availability`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["fact","max"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 具名可信期间事实；initial与default/initialParam互斥，max独立校验。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f617661696c6162696c6974792f70726f706572746965732f66616374"></a>

### `@timeRangeFilter.availability.fact`

Schema位置：`#/definitions/timeRangeFilter/properties/availability/properties/fact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 只用于IOC facts.value及availability；从可信displayInputs源读取，不从URL或Page数据推断。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f617661696c6162696c6974792f70726f706572746965732f696e697469616c"></a>

### `@timeRangeFilter.availability.initial`

Schema位置：`#/definitions/timeRangeFilter/properties/availability/properties/initial`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["latest","latestComplete"] | Schema未设默认；装配/运行时默认见语义说明 | 与声明查询条件匹配的内嵌初始行。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "latest" | 事实粒度下最新有数据期间，不隐含完成。 |
| "latestComplete" | 事实粒度下最新完成期间；缺少时不可回退latest。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f617661696c6162696c6974792f70726f706572746965732f6d6178"></a>

### `@timeRangeFilter.availability.max`

Schema位置：`#/definitions/timeRangeFilter/properties/availability/properties/max`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["latest","latestComplete"] | Schema未设默认；装配/运行时默认见语义说明 | 时间上限与min/disableFuture/禁选范围取交集；完整自然期不能截短。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "latest" | 事实粒度下最新有数据期间，不隐含完成。 |
| "latestComplete" | 事实粒度下最新完成期间；缺少时不可回退latest。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f617661696c6162696c6974792f70726f706572746965732f626c6f636b4d697373696e67"></a>

### `@timeRangeFilter.availability.blockMissing`

Schema位置：`#/definitions/timeRangeFilter/properties/availability/properties/blockMissing`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | const=true | Schema未设默认；装配/运行时默认见语义说明 | 仅显式true时禁选missingRanges；缺数默认仍可查询空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| true | 用于选择@timeRangeFilter.availability.blockMissing分支；同分支其它约束同时成立。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64697361626c65467574757265"></a>

### `@timeRangeFilter.disableFuture`

Schema位置：`#/definitions/timeRangeFilter/properties/disableFuture`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 默认保持禁止未来期间；显式false取消该项限制，仍受min/max/可信期间及禁选范围约束。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f646973706c6179"></a>

### `@timeRangeFilter.display`

Schema位置：`#/definitions/timeRangeFilter/properties/display`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["period","modes"] | Schema未设默认；装配/运行时默认见语义说明 | 当前筛选器的受控输入显示方式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "period" | 时间窗口：基准所在完整周期；offset按指定unit移动周期。 |
| "modes" | 显式日/月/ISO周模式范围，不与period或initialParam混用。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f706572696f644d6f646573"></a>

### `@timeRangeFilter.periodModes`

Schema位置：`#/definitions/timeRangeFilter/properties/periodModes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 6.41：自然期间可选模式，非空且不重复；默认和参数初始模式须在列表内；单模式隐藏切换栏。与 display=modes 的日/月/ISO周列表无关。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f706572696f644d6f6465732f6974656d73"></a>

### `@timeRangeFilter.periodModes[]`

Schema位置：`#/definitions/timeRangeFilter/properties/periodModes/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | enum=["year","quarter","month","last12Months"] | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "year" | 年粒度。 |
| "quarter" | 季度粒度。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "last12Months" | 当前月之前十二个完整月份，显示只读范围。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6f646573"></a>

### `@timeRangeFilter.modes`

Schema位置：`#/definitions/timeRangeFilter/properties/modes`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1; maxItems=3 | Schema未设默认；装配/运行时默认见语义说明 | day/month/isoWeek有序闭集，各模式必须有合法默认范围，运行时原子保存mode/from/to。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6f6465732f6974656d73"></a>

### `@timeRangeFilter.modes[]`

Schema位置：`#/definitions/timeRangeFilter/properties/modes/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","default"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6f6465732f6974656d732f70726f706572746965732f6964"></a>

### `@timeRangeFilter.modes[].id`

Schema位置：`#/definitions/timeRangeFilter/properties/modes/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["day","month","isoWeek"] | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "day" | YYYY-MM-DD日范围及匹配静态day查询。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "isoWeek" | 同一ISO周的周一至周日，ISO所属年由日历计算；未知私有周码拒绝。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6f6465732f6974656d732f70726f706572746965732f64656661756c74"></a>

### `@timeRangeFilter.modes[].default`

Schema位置：`#/definitions/timeRangeFilter/properties/modes/items/properties/default`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| anyOf联合 | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 作者声明的初始默认；不是运行时随状态变化重新应用的值。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6f6465732f6974656d732f70726f706572746965732f64656661756c742f616e794f662f30"></a>

### `@timeRangeFilter.modes[].default · anyOf[0]`

Schema位置：`#/definitions/timeRangeFilter/properties/modes/items/properties/default/anyOf/0`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 独立分支（不合并required） | required=["from","to"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6f6465732f6974656d732f70726f706572746965732f64656661756c742f616e794f662f302f70726f706572746965732f66726f6d"></a>

### `@timeRangeFilter.modes[].default · anyOf[0].from`

Schema位置：`#/definitions/timeRangeFilter/properties/modes/items/properties/default/anyOf/0/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6f6465732f6974656d732f70726f706572746965732f64656661756c742f616e794f662f302f70726f706572746965732f746f"></a>

### `@timeRangeFilter.modes[].default · anyOf[0].to`

Schema位置：`#/definitions/timeRangeFilter/properties/modes/items/properties/default/anyOf/0/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f6d6f6465732f6974656d732f70726f706572746965732f64656661756c742f616e794f662f31"></a>

### `@timeRangeFilter.modes[].default · anyOf[1]`

Schema位置：`#/definitions/timeRangeFilter/properties/modes/items/properties/default/anyOf/1`。目标：[#/definitions/relativeTimeExpression](filters.md#schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e)。

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
| "day" | YYYY-MM-DD日范围及匹配静态day查询。 |
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

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f64656661756c744d6f6465"></a>

### `@timeRangeFilter.defaultMode`

Schema位置：`#/definitions/timeRangeFilter/properties/defaultMode`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["day","month","isoWeek"] | Schema未设默认；装配/运行时默认见语义说明 | 首次无URL输入时使用的已配置模式。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "day" | YYYY-MM-DD日范围及匹配静态day查询。 |
| "month" | 月粒度；timePoint使用YYYY-MM。 |
| "isoWeek" | 同一ISO周的周一至周日，ISO所属年由日历计算；未知私有周码拒绝。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f70726573657473"></a>

### `@timeRangeFilter.presets`

Schema位置：`#/definitions/timeRangeFilter/properties/presets`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 快捷范围按同次时钟或显式anchor解析，不改变已应用值直至合法提交。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f707265736574732f6974656d73"></a>

### `@timeRangeFilter.presets[]`

Schema位置：`#/definitions/timeRangeFilter/properties/presets/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","label","range"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f6964"></a>

### `@timeRangeFilter.presets[].id`

Schema位置：`#/definitions/timeRangeFilter/properties/presets/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@timeRangeFilter.presets[].label`

Schema位置：`#/definitions/timeRangeFilter/properties/presets/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f74696d6552616e676546696c7465722f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f72616e6765"></a>

### `@timeRangeFilter.presets[].range`

Schema位置：`#/definitions/timeRangeFilter/properties/presets/items/properties/range`。目标：[#/definitions/relativeTimeExpression](filters.md#schema-232f646566696e6974696f6e732f72656c617469766554696d6545787072657373696f6e)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/relativeTimeExpression | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 受控范围结构。 |

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

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f68696e74"></a>

### `@timePointFilter.hint`

Schema位置：`#/definitions/timePointFilter/properties/hint`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | TextValue筛选提示，可引用参数和已应用筛选，缺值省略。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f68696e742f616c6c4f662f30"></a>

### `@timePointFilter.hint · allOf[0]`

Schema位置：`#/definitions/timePointFilter/properties/hint/allOf/0`。目标：[#/definitions/textValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f66"></a>

### `@timePointFilter.clearOnChangeOf`

Schema位置：`#/definitions/timePointFilter/properties/clearOnChangeOf`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 依赖变化的原子失效清理；不添加候选端口约束。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f662f6974656d73"></a>

### `@timePointFilter.clearOnChangeOf[]`

Schema位置：`#/definitions/timePointFilter/properties/clearOnChangeOf/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6d696e"></a>

### `@timePointFilter.min`

Schema位置：`#/definitions/timePointFilter/properties/min`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 量表下界。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f6d6178"></a>

### `@timePointFilter.max`

Schema位置：`#/definitions/timePointFilter/properties/max`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 时间上限与min/disableFuture/禁选范围取交集；完整自然期不能截短。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f626c6f636b656452616e676573"></a>

### `@timePointFilter.blockedRanges`

Schema位置：`#/definitions/timePointFilter/properties/blockedRanges`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 完整范围与任一禁选区间相交即拒绝，不静默截断。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f626c6f636b656452616e6765732f6974656d73"></a>

### `@timePointFilter.blockedRanges[]`

Schema位置：`#/definitions/timePointFilter/properties/blockedRanges/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["from","to"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f626c6f636b656452616e6765732f6974656d732f70726f706572746965732f66726f6d"></a>

### `@timePointFilter.blockedRanges[].from`

Schema位置：`#/definitions/timePointFilter/properties/blockedRanges/items/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f626c6f636b656452616e6765732f6974656d732f70726f706572746965732f746f"></a>

### `@timePointFilter.blockedRanges[].to`

Schema位置：`#/definitions/timePointFilter/properties/blockedRanges/items/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f617661696c6162696c697479"></a>

### `@timePointFilter.availability`

Schema位置：`#/definitions/timePointFilter/properties/availability`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["fact","max"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 具名可信期间事实；initial与default/initialParam互斥，max独立校验。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f617661696c6162696c6974792f70726f706572746965732f66616374"></a>

### `@timePointFilter.availability.fact`

Schema位置：`#/definitions/timePointFilter/properties/availability/properties/fact`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 只用于IOC facts.value及availability；从可信displayInputs源读取，不从URL或Page数据推断。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f617661696c6162696c6974792f70726f706572746965732f696e697469616c"></a>

### `@timePointFilter.availability.initial`

Schema位置：`#/definitions/timePointFilter/properties/availability/properties/initial`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["latest","latestComplete"] | Schema未设默认；装配/运行时默认见语义说明 | 与声明查询条件匹配的内嵌初始行。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "latest" | 事实粒度下最新有数据期间，不隐含完成。 |
| "latestComplete" | 事实粒度下最新完成期间；缺少时不可回退latest。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f617661696c6162696c6974792f70726f706572746965732f6d6178"></a>

### `@timePointFilter.availability.max`

Schema位置：`#/definitions/timePointFilter/properties/availability/properties/max`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["latest","latestComplete"] | Schema未设默认；装配/运行时默认见语义说明 | 时间上限与min/disableFuture/禁选范围取交集；完整自然期不能截短。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "latest" | 事实粒度下最新有数据期间，不隐含完成。 |
| "latestComplete" | 事实粒度下最新完成期间；缺少时不可回退latest。 |

<a id="schema-232f646566696e6974696f6e732f74696d65506f696e7446696c7465722f70726f706572746965732f617661696c6162696c6974792f70726f706572746965732f626c6f636b4d697373696e67"></a>

### `@timePointFilter.availability.blockMissing`

Schema位置：`#/definitions/timePointFilter/properties/availability/properties/blockMissing`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "boolean" | 本分支可选 | const=true | Schema未设默认；装配/运行时默认见语义说明 | 仅显式true时禁选missingRanges；缺数默认仍可查询空结果。 |

| 允许值 | 解释与适用条件 |
|---|---|
| true | 用于选择@timePointFilter.availability.blockMissing分支；同分支其它约束同时成立。 |

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

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f68696e74"></a>

### `@booleanFilter.hint`

Schema位置：`#/definitions/booleanFilter/properties/hint`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | TextValue筛选提示，可引用参数和已应用筛选，缺值省略。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f68696e742f616c6c4f662f30"></a>

### `@booleanFilter.hint · allOf[0]`

Schema位置：`#/definitions/booleanFilter/properties/hint/allOf/0`。目标：[#/definitions/textValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f66"></a>

### `@booleanFilter.clearOnChangeOf`

Schema位置：`#/definitions/booleanFilter/properties/clearOnChangeOf`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 依赖变化的原子失效清理；不添加候选端口约束。 |

<a id="schema-232f646566696e6974696f6e732f626f6f6c65616e46696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f662f6974656d73"></a>

### `@booleanFilter.clearOnChangeOf[]`

Schema位置：`#/definitions/booleanFilter/properties/clearOnChangeOf/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f68696e74"></a>

### `@numberRangeFilter.hint`

Schema位置：`#/definitions/numberRangeFilter/properties/hint`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | TextValue筛选提示，可引用参数和已应用筛选，缺值省略。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f68696e742f616c6c4f662f30"></a>

### `@numberRangeFilter.hint · allOf[0]`

Schema位置：`#/definitions/numberRangeFilter/properties/hint/allOf/0`。目标：[#/definitions/textValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f66"></a>

### `@numberRangeFilter.clearOnChangeOf`

Schema位置：`#/definitions/numberRangeFilter/properties/clearOnChangeOf`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 依赖变化的原子失效清理；不添加候选端口约束。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f662f6974656d73"></a>

### `@numberRangeFilter.clearOnChangeOf[]`

Schema位置：`#/definitions/numberRangeFilter/properties/clearOnChangeOf/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f636f6e73747261696e7473"></a>

### `@numberRangeFilter.constraints`

Schema位置：`#/definitions/numberRangeFilter/properties/constraints`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 基本单位上下限及双边严格/允许相等规则。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f636f6e73747261696e74732f70726f706572746965732f6d696e"></a>

### `@numberRangeFilter.constraints.min`

Schema位置：`#/definitions/numberRangeFilter/properties/constraints/properties/min`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 量表下界。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f636f6e73747261696e74732f70726f706572746965732f6d6178"></a>

### `@numberRangeFilter.constraints.max`

Schema位置：`#/definitions/numberRangeFilter/properties/constraints/properties/max`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 时间上限与min/disableFuture/禁选范围取交集；完整自然期不能截短。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f636f6e73747261696e74732f70726f706572746965732f626f756e6473"></a>

### `@numberRangeFilter.constraints.bounds`

Schema位置：`#/definitions/numberRangeFilter/properties/constraints/properties/bounds`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支可选 | enum=["strict","inclusive"] | Schema未设默认；装配/运行时默认见语义说明 | strict拒绝双边相等，inclusive允许相等；新金额units/presets缺省严格，旧范围缺省兼容。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "strict" | 双边范围必须from<to，不改变下推>=/<=语义。 |
| "inclusive" | 双边范围允许相等，仍校验上下限。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e697473"></a>

### `@numberRangeFilter.units`

Schema位置：`#/definitions/numberRangeFilter/properties/units`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支可选 | required=["filterId","cases"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 币种required单选穷尽case；显示单位按scale换算一次，状态与URL为基本单位。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f66696c7465724964"></a>

### `@numberRangeFilter.units.filterId`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/filterId`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 引用required单选封闭枚举，金额clearOnChangeOf必须包含该选择器。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f6361736573"></a>

### `@numberRangeFilter.units.cases`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | propertyNames={"type":"string","minLength":1} | Schema未设默认；装配/运行时默认见语义说明 | 穷尽启用枚举项，每项声明静态货币、显示单位与正安全整数scale；状态始终为基本单位。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f70657274696573"></a>

### `@numberRangeFilter.units.cases{key}`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 动态键的值 | required=["currency","label","scale"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f63757272656e6379"></a>

### `@numberRangeFilter.units.cases{key}.currency`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/currency`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | enum=["CNY","USD"] | Schema未设默认；装配/运行时默认见语义说明 | 货币语义声明，不负责汇率换算。 |

| 允许值 | 解释与适用条件 |
|---|---|
| "CNY" | 静态人民币金额，基本单位元。 |
| "USD" | 静态美元金额，基本单位美元；没有隐式汇率换算。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f6c6162656c"></a>

### `@numberRangeFilter.units.cases{key}.label`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f7363616c65"></a>

### `@numberRangeFilter.units.cases{key}.scale`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/scale`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "integer" | 本分支必填 | exclusiveMinimum=0; maximum=9007199254740991 | Schema未设默认；装配/运行时默认见语义说明 | ratio输出刻度；显式100转换为百分刻度。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f70726573657473"></a>

### `@numberRangeFilter.units.cases{key}.presets`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/presets`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 6.46按该币种显示单位定义预设；全部case必须声明，不能与公共presets混用。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f707265736574732f6974656d73"></a>

### `@numberRangeFilter.units.cases{key}.presets[]`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/presets/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","label","range"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f6964"></a>

### `@numberRangeFilter.units.cases{key}.presets[].id`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/presets/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@numberRangeFilter.units.cases{key}.presets[].label`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/presets/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f72616e6765"></a>

### `@numberRangeFilter.units.cases{key}.presets[].range`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/presets/items/properties/range`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 受控范围结构。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f72616e67652f70726f706572746965732f66726f6d"></a>

### `@numberRangeFilter.units.cases{key}.presets[].range.from`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/presets/items/properties/range/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f6164646974696f6e616c50726f706572746965732f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f72616e67652f70726f706572746965732f746f"></a>

### `@numberRangeFilter.units.cases{key}.presets[].range.to`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/additionalProperties/properties/presets/items/properties/range/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f756e6974732f70726f706572746965732f63617365732f70726f70657274794e616d6573"></a>

### `@numberRangeFilter.units.cases · propertyNames`

Schema位置：`#/definitions/numberRangeFilter/properties/units/properties/cases/propertyNames`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 条件结构 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f70726573657473"></a>

### `@numberRangeFilter.presets`

Schema位置：`#/definitions/numberRangeFilter/properties/presets`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 显示单位范围草稿；确定时换算，全部为空范围。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f707265736574732f6974656d73"></a>

### `@numberRangeFilter.presets[]`

Schema位置：`#/definitions/numberRangeFilter/properties/presets/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 每个数组项 | required=["id","label","range"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f6964"></a>

### `@numberRangeFilter.presets[].id`

Schema位置：`#/definitions/numberRangeFilter/properties/presets/items/properties/id`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 稳定标识符；唯一性范围由所属页面、分区、组件或字段空间决定。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f6c6162656c"></a>

### `@numberRangeFilter.presets[].label`

Schema位置：`#/definitions/numberRangeFilter/properties/presets/items/properties/label`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 本分支必填 | minLength=1 | Schema未设默认；装配/运行时默认见语义说明 | 人类可读标签，不代替稳定id。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f72616e6765"></a>

### `@numberRangeFilter.presets[].range`

Schema位置：`#/definitions/numberRangeFilter/properties/presets/items/properties/range`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 本分支必填 | additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 受控范围结构。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f72616e67652f70726f706572746965732f66726f6d"></a>

### `@numberRangeFilter.presets[].range.from`

Schema位置：`#/definitions/numberRangeFilter/properties/presets/items/properties/range/properties/from`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围起点；与to的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f6e756d62657252616e676546696c7465722f70726f706572746965732f707265736574732f6974656d732f70726f706572746965732f72616e67652f70726f706572746965732f746f"></a>

### `@numberRangeFilter.presets[].range.to`

Schema位置：`#/definitions/numberRangeFilter/properties/presets/items/properties/range/properties/to`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "number" | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 范围终点；与from的顺序和精度须匹配。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c746572"></a>

### `@searchFilter`

Schema位置：`#/definitions/searchFilter`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "object" | 类型/分支 | required=["id","type"]; additionalProperties=false | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f68696e74"></a>

### `@searchFilter.hint`

Schema位置：`#/definitions/searchFilter/properties/hint`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| allOf交集 | 本分支可选 | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | TextValue筛选提示，可引用参数和已应用筛选，缺值省略。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f68696e742f616c6c4f662f30"></a>

### `@searchFilter.hint · allOf[0]`

Schema位置：`#/definitions/searchFilter/properties/hint/allOf/0`。目标：[#/definitions/textValue](params-and-text-values.md#schema-232f646566696e6974696f6e732f7465787456616c7565)。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| 引用 #/definitions/textValue | 独立分支（不合并required） | 无额外结构约束 | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f66"></a>

### `@searchFilter.clearOnChangeOf`

Schema位置：`#/definitions/searchFilter/properties/clearOnChangeOf`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "array" | 本分支可选 | minItems=1 | Schema未设默认；装配/运行时默认见语义说明 | 依赖变化的原子失效清理；不添加候选端口约束。 |

<a id="schema-232f646566696e6974696f6e732f73656172636846696c7465722f70726f706572746965732f636c6561724f6e4368616e67654f662f6974656d73"></a>

### `@searchFilter.clearOnChangeOf[]`

Schema位置：`#/definitions/searchFilter/properties/clearOnChangeOf/items`。

| 类型 | 必填性 | 允许值与约束 | 缺省行为 | 含义 |
|---|---|---|---|---|
| "string" | 每个数组项 | pattern="^[a-z0-9][a-z0-9-]*$" | Schema未设默认；装配/运行时默认见语义说明 | 结合本节用途与所在结构解释；引用节点见目标类型。 |

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
- `filter-group`：6.45 Dashboard 独立固定单选筛选按钮组、多查询与统一显隐。反例：[filter-group-version](errors/filter-group-version.json)、[filter-group-report](errors/filter-group-report.json)、[filter-group-detail](errors/filter-group-detail.json)、[filter-group-invalid-default](errors/filter-group-invalid-default.json)、[filter-group-duplicate-options](errors/filter-group-duplicate-options.json)、[filter-group-duplicate-control](errors/filter-group-duplicate-control.json)、[filter-group-no-binding](errors/filter-group-no-binding.json)、[filter-group-removed-chart-filter](errors/filter-group-removed-chart-filter.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `business-filters`：6.37 封闭枚举与业务选择语义。反例：[business-filter-before-6.37](errors/business-filter-before-6.37.json)、[business-filter-single-many](errors/business-filter-single-many.json)、[business-filter-disabled-default](errors/business-filter-disabled-default.json)、[business-filter-options-dependent](errors/business-filter-options-dependent.json)、[business-filter-unrestricted-without-options](errors/business-filter-unrestricted-without-options.json)、[business-filter-cycle](errors/business-filter-cycle.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `currency-selection`：6.38金额范围和静态货币字段选择。反例：[currency-before-6.38](errors/currency-before-6.38.json)、[currency-case-missing](errors/currency-case-missing.json)、[currency-metric-mismatch](errors/currency-metric-mismatch.json)、[currency-negative-default](errors/currency-negative-default.json)、[currency-equal-default](errors/currency-equal-default.json)、[currency-compute-mixed](errors/currency-compute-mixed.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `time-extensions`：6.39 显式时间模式、可信期间事实、快捷范围及V2月份窗口。反例：[time-before-6.39](errors/time-before-6.39.json)、[time-case-missing](errors/time-case-missing.json)、[time-query-xor](errors/time-query-xor.json)、[time-period-mismatch](errors/time-period-mismatch.json)、[time-output-mismatch](errors/time-output-mismatch.json)、[time-default-week](errors/time-default-week.json)、[time-availability-default](errors/time-availability-default.json)、[time-fact-kind](errors/time-fact-kind.json)、[time-window-static-options](errors/time-window-static-options.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `unified-page-header`：6.41 唯一页头及自然年选择。反例：[unified-header-version](errors/unified-header-version.json)、[unified-header-conflict](errors/unified-header-conflict.json)、[period-modes-empty](errors/period-modes-empty.json)、[period-modes-duplicate](errors/period-modes-duplicate.json)、[period-modes-default](errors/period-modes-default.json)、[period-modes-plain-range](errors/period-modes-plain-range.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `required-multiple-selection`：6.46必选多选保持非空离散集合。反例：[required-multiple-version](errors/required-multiple-version.json)、[required-multiple-empty](errors/required-multiple-empty.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `independent-filter-candidates`：6.46显式无依赖候选使用V2及局部门禁。反例：[independent-candidates-version](errors/independent-candidates-version.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。
- `currency-range-presets`：6.46单位case内的币种预设保持单一金额状态。反例：[currency-presets-version](errors/currency-presets-version.json)、[currency-presets-missing](errors/currency-presets-missing.json)、[currency-presets-shared](errors/currency-presets-shared.json)、[currency-presets-invalid](errors/currency-presets-invalid.json)。反例文件给出触发点片段与预期type/path，完整页面见其fullInput指向的契约夹具；修复后须重新完整校验。

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
- [business-filter-page](examples/business-filter-page.json)：完整合法页面；查询仅为静态契约证据。
- [currency-selection-page](examples/currency-selection-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-modes-page](examples/time-modes-page.json)：完整合法页面；查询仅为静态契约证据。
- [time-presets-page](examples/time-presets-page.json)：完整合法页面；查询仅为静态契约证据。
- [availability-page](examples/availability-page.json)：完整合法页面；查询仅为静态契约证据。
- [calendar-window-page](examples/calendar-window-page.json)：完整合法页面；查询仅为静态契约证据。
- [unified-year-header](examples/unified-year-header.json)：完整合法页面；查询仅为静态契约证据。
- [dimension-selection-page](examples/dimension-selection-page.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-business](examples/ioc-header-business.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-currency](examples/ioc-header-currency.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-groups](examples/ioc-header-groups.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-incentives](examples/ioc-header-incentives.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-models](examples/ioc-header-models.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-months](examples/ioc-header-months.json)：完整合法页面；查询仅为静态契约证据。
- [ioc-header-unconfigured](examples/ioc-header-unconfigured.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/filter.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/period-filter.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/report-date-filters.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/filter-group.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/components/filter-group.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/time-filter-boundary.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/filter-dependencies.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/amount-filter.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/amount-validation.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/field-selection.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/time-mode.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/period-facts.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/time-extension-validation.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

- `#/definitions/timeRangeFilter/properties/modes/items/properties/default/anyOf/0`：[合法完整页面](examples/time-modes-page.json)，JSON Pointer `#/filters/0/modes/1/default`。
- `#/definitions/timeRangeFilter/properties/modes/items/properties/default/anyOf/1`：[合法完整页面](examples/time-modes-page.json)，JSON Pointer `#/filters/0/modes/0/default`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/0`：[合法完整页面](examples/time-modes-page.json)，JSON Pointer `#/filters/0/modes/0/default/range`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/1`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/2/default/range`。
- `#/definitions/relativeTimeExpression/properties/range/oneOf/2`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/3/default/range`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/0`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/1/default`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/1`：[合法完整页面](examples/time-presets-page.json)，JSON Pointer `#/filters/0/default`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/2`：[合法完整页面](examples/reference-branches-page.json)，JSON Pointer `#/filters/2/default`。
- `#/definitions/timeRangeFilter/properties/default/anyOf/3`：[合法完整页面](examples/ioc-header-page.json)，JSON Pointer `#/filters/0/default`。
- `#/definitions/periodSelection/anyOf/0`：[合法完整页面](examples/ioc-header-page.json)，JSON Pointer `#/filters/0/default`。
- `#/definitions/periodSelection/anyOf/1`：[合法完整页面](examples/period-filter-last12-months-page.json)，JSON Pointer `#/filters/0/default`。
