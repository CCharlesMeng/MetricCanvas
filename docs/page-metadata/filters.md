# 筛选声明与运行状态

## 期间选择与查询消费

6.67 的新期间查询绑定读取已应用的 selection 和窗口：组件表达 year/quarter/month/last12Months，查询各自声明 periodPolicy。筛选器 precision 在旧绑定上保留原意；它不决定新策略的粒度。同一个期间可以同时驱动日趋势与月度数据。交互、URL恢复、公历/未来边界仍由现有筛选状态流程管理；取消草稿不改变已应用选择。

展示条件可通过 `{filter:"statistics-period",part:"mode",op:"eq",value:"quarter"}` 读取期间模式。它来自 selection.mode，不是查询策略转换后的 period，也不是控件尚未应用的草稿。新旧期间筛选声明均可被读取；未应用时条件等待，不能经 not 转成允许。示例：`period-query-columns-demo`。

六类筛选为dimension、timeRange、timePoint、boolean、numberRange、search。声明描述输入能力，当前值由页内FilterState保存。URL只在初始化时读；重复维度键表示多值，不拆逗号。boolean的false是显式值，不能被默认true覆盖。

## 时间选择的默认上限

所有时间选择控件（含表头日期范围）默认禁止未来时间：月到本地当前月，日期到今天，精确时间到当前分钟。普通范围的结束值受同一上限约束；面板、键盘、手工提交、URL 恢复、初值和外部筛选状态写入共用边界。未来 URL 值被忽略，保留页面的合法初值；非法写入保留已应用状态，不触发查询。声明或参数提供未来初值时，运行时拒绝初始化，不静默截断查询。

Dashboard 的年、季、月按所选自然期间判断：当前年／当前季／当前月可选，更晚期间不可选；查询仍保留该期间完整起止，不裁剪为截至今天。近一年继续取当前月之前十二个完整月份。普通 timeRange 与上述期间选择的口径不同，不以范围终点检查当前自然期间。

时间点省略 `disableFuture` 按 true 处理；已有显式 `disableFuture: false` 保持放开上限的含义，min 仍有效。普通范围和 Dashboard 期间选择统一采用默认上限，不新增页面字段或协议版本。静态校验继续检查结构、公历及已有显式规则，运行时按执行环境当前时间检查所有选择值。

页面试验场统一入口：`report-date-filter-example` 覆盖单月、月份范围、日期、日期范围和精确时间范围；`dashboard-period-filter` 展示统一页头仅选年份；完整年／季／月／近一年保留于期间契约夹具。合成数据与控件验收不证明真实 DQE 接入。

## Dashboard 期间选择（6.27）

6.67 新绑定由查询 periodPolicy 决定粒度，旧绑定继续按原 precision 配对；同一选择可驱动不同查询粒度。具体策略见 query.period-policy 主题。

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

页面试验场统一在 `report-date-filter-example` 的“月份与日期禁止未来时间”分区演示；完整契约示例 `time-point-no-future` 继续覆盖独立边界，无业务查询。商务SDT终极版 `pages/business/report/sdt/commercial-sdt-efficiency-ultimate-monthly.json` 默认2026-10，月份选择不能进入未来。真实DQE接入与业务数据另行验收。

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
- display:tree带treeSelection:level为结构树，必须有hierarchy。候选显式提供level和parent，不从业务码拆斜杠；不同层可使用相同value。`selection.mode:"single"` 且省略 `hierarchyPicker` 时，默认仅呈现一个树形下拉，不附加地区部／代表处按钮或返回按钮。在树内直接选择任意有效层级的节点，原子提交该节点的level与原始业务值，替换旧选择并关闭弹层；父节点只选择自身，不批量选择子节点。清空保留当前level，不写入UI内部节点标识。各层完整候选均就绪且一致后才展示可选树，失败／拒绝／未配置不降级为部分树；重复同码以level区分，禁用节点不可选。显式 `hierarchyPicker:"tabs"` 保留层级按钮，`"hidden"` 保留由地图等交互切层及原有返回入口；多选结构树仍只选择当前层级，其他层只展开。旧tree不带该字段仍按父节点批量选择叶子。

层级维度只要声明 `hierarchy`、`selection.mode:"single"`，且 `display` 省略或为 `select`／`tree`，省略 `hierarchyPicker` 就默认使用单个树形下拉。旧候选端口仅提供各层平面值时，按已声明的层级展示不可选择的分组节点；各业务节点直接提交所属层级与原始值，不虚构跨层父子归属，也不强制旧页切换到V2候选端口。显式 `hierarchyPicker`、多选和 `display:"tabs"` 保留既有行为。旧页入口 `ioc-opportunity-list` 与 `contract-maturity-score` 同样没有前置层级按钮；`ioc-project-overview` 显式 hidden 仍由地图接管切层。

IOC Region 新页面默认采用单选树形下拉：`{id:"region",type:"dimension",dimension:"地区部编码",display:"tree",treeSelection:"level",selection:{mode:"single"},hierarchy:[{id:"region-dept",dimension:"地区部编码",label:"地区部"},{id:"office",dimension:"代表处编码",label:"代表处"}],defaultLevel:"region-dept"}`。字段名及业务值须按实际数据契约替换，候选必须由集成应用提供显式父子关系；不因需要树形外观伪造归属，不把 `hierarchyPicker:"hidden"` 当作单树替代。完整联动验收入口为 `ioc-header-standard`；同码样例为 `ioc-header-business-tree-demo`。`table-hierarchy-selection` 补充验证同一个树形下拉内选择代表处后，通过独立父级定位查询联动父子表格；其候选父子关系来自明确标注的合成夹具。本次修复不新增页面字段或版本，显式按钮、地图切层及旧多选行为保留。
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

`treeSelection:"level"`继续使用6.37的显式层级树、`hierarchy`和候选`parent:{level,value}`；单选默认在树内提交节点层级，显式切层器及多选仅当前层级候选可选。不改变其必选、权限、回执或联动校验。普通同维树另有`descendants`（父选后代，默认存量行为）、`independent`（父子独立）、`leaf`（仅叶子）三种规则；仅用于`display:"tree"`。普通树候选可提供`parentValue`，引用同一完整批次内的稳定value；重复、缺失父或循环显示层级错误。未提供父关系保留旧`/`路径约定，不从显示名生成业务代码。

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
