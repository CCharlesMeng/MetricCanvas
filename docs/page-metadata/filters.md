# 筛选声明与运行状态

六类筛选为dimension、timeRange、timePoint、boolean、numberRange、search。声明描述输入能力，当前值由页内FilterState保存。URL只在初始化时读；重复维度键表示多值，不拆逗号。boolean的false是显式值，不能被默认true覆盖。

## Dashboard 期间选择（6.27）

`timeRange` 可声明 `display: "period"`，在 Dashboard 通用顶部 FilterBar 中作为一个筛选器显示「年／季／月／近一年」。省略 display 仍为原有范围编辑器。`precision` 只允许 month/date，分别决定实际范围编码，不改变查询的 period/is_aggregate。季度输入显示「2026 年 Q4」，四个面板选项为 Q1—Q4。

默认选择使用 `default: {mode:"month"}`（当前月），也可写 `{mode:"year",value:"2026"}`、`{mode:"quarter",value:"2026-Q4"}`、`{mode:"month",value:"2026-10"}` 或 `{mode:"last12Months"}`。年季月省略 value 时按本次初始化的当前日期选择完整自然期间。近一年固定取当前月之前十二个完整月份；2026-10 显示 `25年10月~26年9月`，date 查询为 2025-10-01 至 2026-09-30，month 查询为 2025-10 至 2026-09；右侧只有只读文本，不提供截止月份输入。

初始化、显式重新选择近一年共用期间解析；长驻页面不定时刷新，导出使用已应用快照。切回年季月保留会话内历史锚点。URL 的 value 分量编码 `month:2026-10`、`quarter:2026-Q4`、`year:2026` 或 `last12Months`，使用显式 `urlParams.value` 或筛选器 ID；恢复近一年时重新物化范围，非法选择不覆盖已有合法状态。导航可显式传筛选 value 分量保留模式，也可用 from/to 将实际范围传给普通日期输入。

参数初始化改用互斥的 `initialParam` 与 `initialMode:"year"|"quarter"|"month"`，实际参数区间必须完整覆盖声明的自然期间；选择变化不反写页面参数。相对选择不提取成固定参数。新形态仅用于 Dashboard 顶部筛选，不用于报告页头、datetime 或图表独立筛选。查询使用现有 `{target:"time"}` 绑定，不能同时保存固定 start/end/param。

完整验收页面为 `dashboard-period-filter`（日期精度）与 `dashboard-period-filter-month`（月份精度），见下方生成的完整示例入口。它们声明合成验收查询；实际 DQE 数据和部署验收另行报告。

维度display选择select、tabs或tree；层级维度显式声明层级和初始层；6.11起层级维度与timePoint筛选器也可用initialParam取页面参数作初值。时间范围支持绝对from/to和受控相对时间；timePoint限定month/date粒度。numberRange允许单边界，两边空视为无条件；search为普通文本。

urlParams仅映射该类允许的value/from/to/level键，不能与本页其它参数或筛选输入冲突。候选值来自受控数据能力，业务维度值不是协议枚举。

6.13 的 timeRange.precision=month 使用 YYYY-MM 两端；date 使用 YYYY-MM-DD，datetime 保留 YYYY-MM-DDTHH:mm。timeRange.initialParam 与 default 互斥，接受精度匹配的必需 times 参数；timePoint 仅接受单点 times。required 日期筛选器保留已应用值，完整合法的输入才提交；页头引用只改变位置。

## 时间点下限（6.24）

`timePoint.min` 是可选的包含式下限，month 使用真实公历 `YYYY-MM`，date 使用 `YYYY-MM-DD`；未声明则保留原有无业务下限行为。timeRange 边界保持原有规则。`min` 与筛选粒度不匹配、日历无效或 default 早于 min 时拒绝页面；initialParam 实际值越界时拒绝初始化，不截断或伪造实际输入。

共享日期选择器禁用更早的年/月/日期，手工提交越界草稿显示错误并保留已应用值。筛选状态绑定页面声明后，write/writeMany 同样拒绝越界、粒度不符及必选筛选的清空。URL 初始化忽略非法/越界值，使用页面合法默认值；必选有下限筛选在 fromURL 恢复时保留当前合法值或默认值。执行回执中的越界筛选拒绝接收。下限约束筛选值，不裁剪由该值派生的查询窗口。

完整协议示例 `time-point-min-page` 同时覆盖月份和日期下限；业务页面 `business-sdt-report-monthly` 使用 `min: "2020-06"`，全部呈现查询与报告主标题、统计月份联动，3个趋势窗口含所选月共6个月。原页摘要是明确标记的2026年10月固定摘要，不作为切月后的分析结论。业务查询接入与真实数据另行验收。

<a id="禁止未来时间625"></a>

## 禁止未来时间（6.25）

`timePoint.disableFuture: true` 禁止晚于执行环境本地当前月份／日期的时间点，当前期间本身可选；省略或 false 不限制未来。month 以当前 `YYYY-MM` 为上限，date 以当前 `YYYY-MM-DD` 为上限。上限在打开选择器及提交时重新求值，不保存为固定日期，跨月后新月份自动可用。

月份／日期／年份面板禁用越界单元格、向未来翻页和键盘移动；手工输入越界显示错误并保留已应用值。URL恢复、筛选状态写入、执行回执和参数初始化同样检查，不能通过跳过控件写入未来值；非法初始参数拒绝初始化，不截断为当前期间。可与 `min` 同时声明；该限制只约束选中的时间点，不裁剪近N期查询窗口，也不更改未声明限制的页面。

完整场景 `time-point-no-future` 无业务查询；商务SDT终极版 `pages/sdt/commercial-sdt-efficiency-ultimate-monthly.json` 默认2026-10，月份选择不能进入未来。真实DQE接入与业务数据另行验收。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。
