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

<a id="business-filters"></a>

## 业务筛选（6.36）

本增量适用于页级筛选，与根iocHeader的位置声明分开。普通看板、报表和详情独立消费，不批量改已有业务页。

- dimension.selection声明mode为single/multiple；缺省保持旧多选，tabs继续单选。single至多一个值；required恰好一个值，缺失时相关查询等待选择，非法整组写入拒绝。options是创作期确认的穷尽枚举，稳定value与label分开，可显式disabled；有options不请求候选网关，不允许同时配置动态依赖或hierarchy。disabled值不参与选择或默认值。
- allBehavior缺省values。只有multiple+显式options可用unrestricted：选中全部有效枚举后仅省略对应动态查询谓词，UI/URL保留实际值，查询体原有静态条件仍保留。禁用项不算必须选中。boolean与枚举分别处理：勾选走whenTrue，明确false走whenFalse；省略whenFalse仍为无条件。default:false仍保留旧的不加初始化条件行为；需要确定的否值谓词时，使用显式false输入或用户取消勾选，并声明whenFalse。
- display:tree带treeSelection:level为新结构树，必须有hierarchy。候选显式提供level和parent，不从业务码拆斜杠；不同层可使用相同value。当前只有一个level，可选父节点只选择自身，切层清掉旧值并保留新层级；其他层节点只展开。旧tree不带该字段仍按父节点批量选择叶子。
- candidateContext用filterIds列出维度/单点时间/范围时间依赖，reconcile为clear/intersection。与旧dependsOn、clearOnChangeOf合图查重、检环；旧dependsOn仍只支持单个维度上游。clear在上游变化时递归清值，等用户显式确认；intersection保留摘要，等新完整可信候选到达后取交集。空交集、未就绪、失败、拒绝和未配置不能自动查询全部。上游被阻断时，候选依赖后代同样阻断。
- 共用hint为TextValue，可引用不可变参数或已应用筛选，缺值省略；clearOnChangeOf是明确失效关系，不伪装成候选请求约束。普通只读不清合法条件。

V2 fetchFilterCandidates由宿主Adapter提供，与旧fetchDimensionValues并存。请求包含filterId/dimension/level和完整维度、时间约束；timePoint按原精度投影为同值from/to，timeRange保留已应用范围，绝不截成详情单月。新结构树或candidateContext缺V2时明确unavailable，不丢约束调用旧端口。结果保留ready/empty/unavailable/error并区分denied和unconfigured；失败重试当前依赖。首批要求完整候选，最多10000项，不接受部分列表做全选或交集。按语言组合网关存在多个不同V2 Adapter时返回unconfigured，不合并授权域。

浏览器协调器与SourceProgram使用同一无框架请求投影及结构校验。SourceProgram在复用seeds/initial或查询前校验绑定筛选和祖先；同步initialSnapshots对尚未核验的新动态候选返回loading。每个运行实例复用完整候选回执，重试失效旧代次，不跨实例/可信身份复用。独立源继续执行；相关导出使用同一门禁。

实际页面：ioc-header-business-options-demo（封闭单选、全选不限、boolean），ioc-header-business-tree-demo（新结构树、旧树及时间/区域交集），ioc-header-business-detail-demo（详情私有枚举与单月）。本地HTTP合成Adapter不代表真实DQE、CloudIOC、Relay或门户接线；Playground未接V2时应显示不可用。新字段不包括仍待审的Condition/displayInputs，复杂期间/latest/calendarWindow仍保留后续规划。

<a id="amount-range"></a>

## 金额范围（6.37）

numberRange可声明constraints的min/max（基本单位）和bounds:strict（双边from必须小于to）。单边允许；普通旧范围仍允许相等。全部是无端点的显式清空，不是无限大数字；拒绝负数约束冲突、NaN/Infinity及比例溢出。

units为`{filterId,cases:{RMB:{currency:"CNY",label:"万元",scale:10000},USD:{currency:"USD",label:"万美元",scale:10000}}}`，控制筛选必须为required单选options并穷尽有效枚举。scale为正安全整数。必须用clearOnChangeOf引用该币种，换币与清金额在同一事务；自动清空沿用等待用户显式确认的门禁。

presets为`{id,label,range:{from?,to?}}[]`，输入和预设使用显示单位，确定时乘一次scale。default、URL、restore、执行回执和FilterValue已经是基本单位，查询绑定不再次换算。新面板有草稿/取消/确定，预设只修改草稿；切币种、只读或页头折叠会关闭旧草稿。币种尚未选择时金额等待选择，不隐式按人民币处理。

范围绑定互斥metric与metricByFilter：`{target:"numberRange",metricByFilter:{filterId:"currency",cases:{RMB:"ioc_amount_base_cny",USD:"ioc_amount_base_usd"}}}`。每个case必须指向该源显式queryField映射的money字段，并与units同case货币相符。币种是查询隐式依赖，即使没有独立currency绑定也参与重查、默认初始数据复用与执行门禁。SourceProgram在seed/initial复用前校验范围和控制币种。

验收页[ioc-header-currency-demo](examples/currency-selection-page.json)使用两种独立静态货币字段、本地合成HTTP与已有XLSX出口。没有真实USD或汇率证据，不声称生产换币可用，不做前端汇率换算。

## 6.38 复杂时间与候选

`timeRange.display:"modes"` 声明 `required:true`、`defaultMode` 和 `modes:[{id:"day"|"month"|"isoWeek",default:TimeRangeValue|RelativeTimeExpression}]`。普通 default/precision、period、initialParam/initialMode 与 modes 互斥。日为 YYYY-MM-DD，月为 YYYY-MM，ISO周保存同周周一至周日并计算ISO所属年。模式、from、to原子提交，每个模式记忆最近合法范围；失效时尝试合法默认值，不能沿用旧查询。URL使用 `<id>.mode`、`<id>.from`、`<id>.to` 完整整组；未知/缺项/重复/错周拒绝。

`timeRange.presets:[{id,label,range:RelativeTimeExpression}]` 点击才提交。近N天含锚点日、起点减N-1；月份按日历月计算，includeCurrent明确，显式anchor同时控制起止。旧period近一年仍是当前月之前12个完整月，不被预设替换。

`timePoint/timeRange` 可声明 min/max、blockedRanges 和 `availability:{fact,initial?:"latest"|"latestComplete",max:"latest"|"latestComplete",blockMissing?:true}`。initial与普通default/initialParam互斥，合法URL优先；max始终独立校验。latest不是完成状态；缺complete不回退latest。完整年/季/周越界拒绝，不截短自然期。缺数默认可查询空，仅显式blockMissing才禁选。所有边界取交集，输入错误不提交。disableFuture默认沿旧行为，可显式false。

动态平面 dimension 的 `candidateWindow:{unit:"month",n:12,includeCurrent:boolean,anchorFact?:string}` 通过V2候选接口传 `calendarWindow:{granularity:"month",from,to}`；anchorFact消费可信latest，省略按同次时钟。不能与options/hierarchy混用。V2缺失、事实未就绪或结果失败时阻断相关查询，不降级旧端口。真实年月值按维度集合绑定，选1/3月不补2月；仅dtime的多区间查询不在本批支持范围。candidateContext时间/模式/维度及窗口/事实上下文共同决定缓存键；intersection等待当前完整候选后才取交集。

场景：time-modes-page、time-presets-page、availability-page、calendar-window-page；对应 `pages/ioc-header-*-demo.json` 可交互验收。
