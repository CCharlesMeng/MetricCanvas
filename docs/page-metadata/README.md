# 页面元数据模块参考

独立本地创作支持 read-knowledge.mjs 按主题和精确 Schema Pointer 查阅；常用主题如 table.width、fields.format、data.query、query.core。输出保留当前节点、父级分支条件和未展开引用，子节点可继续按指针读取；它是局部参考，最终仍须完整页面校验。页面 JSON 与指标说明的识别不等于真实 DQE 验真。

按任务或JSON路径查阅；作者协议版本、可读范围与能力下限以[页面、版本与布局](page.md)及本册[index.json](../../contracts/metriccanvas/page/reference/index.json)、[schema.json](../../contracts/metriccanvas/page/reference/schema.json)为准。结构来自Schema，语义来自模块作者。页面协议可表达、确定性工具可装配、外部服务已接通是三份独立证据。

## 按使用场景查阅

仓库中的协议总入口为根目录 `PAGE-METADATA.md`；参数与顶部筛选用法由 `PAGE-PARAMETERS.md` 维护，级联查询与导出接入由各自专题维护。本模块索引提供字段语义与结构定位，并分发到独立Bundle/Skill；下表中的模块与完整页面示例均随本册提供。

| 使用场景 | 需要连起来配置的声明 | 完整页面示例 |
|---|---|---|
| 顶部切换时间并同步期间文字 | [报告页头](components/reportHeader.md)的 `filterIds` → [时间筛选](filters.md) → [查询绑定](queries-and-bindings.md)；[文本取值](params-and-text-values.md)显式引用已应用筛选 | [报告日期筛选](../../contracts/metriccanvas/page/reference/examples/report-date-filters-page.json)、[显式期间文字](../../contracts/metriccanvas/page/reference/examples/report-filter-text-page.json) |
| 上游查询结果驱动下游明细 | [查询结果绑定](queries-and-bindings.md)的 `resultBindings` → [具名算子](compute.md) → 组件数据槽 | [级联查询](../../contracts/metriccanvas/page/reference/examples/query-cascade-page.json) |
| 多个普通查询组成可全局排序、过滤、分页的表格 | [组合查询源](data-sources.md)的 `pagedJoin` → [表格](components/table.md)的查询分页、数值范围与工具区 | [多查询组合表](../../contracts/metriccanvas/page/reference/examples/paged-join-page.json) |
| 固定指标排名跟随业务行，切换表格排序后保留名次 | [数据源](data-sources.md)的普通查询排名字段 → `projection`；当前序号另用 `ordinalField` | [固定业务排名](../../contracts/metriccanvas/page/reference/examples/paged-join-fixed-rank-page.json) |

IOC 业务批量场景见 [筛选声明](filters.md#ioc-业务批量场景与必选多选646)：模型、协同小组、策略、币种档位、离散月份和缺配置共用主线输入契约。

## 按模块查阅

- [页面、版本与布局](page.md)：page
- [页面参数与文本取值](params-and-text-values.md)：params-and-text-values
- [页面数据源与初始行](data-sources.md)：data-sources
- [结果字段契约](fields.md)：fields
- [查询定义与显式绑定](queries-and-bindings.md)：queries-and-bindings
- [具名算子](compute.md)：compute
- [筛选声明与运行状态](filters.md)：filters
- [内容分区与布局](sections-and-layout.md)：sections-and-layout
- [图表高级 ECharts 呈现扩展](chart-option.md)：chart-option（仅明确高级需求时查阅）
- [数据槽、字段绑定与格式](field-bindings-and-formats.md)：field-bindings-and-formats
- [交互与导航](actions-and-navigation.md)：actions-and-navigation
- [受控语义HTML](semantic-html.md)：semantic-html
- [校验、错误与修复](validation.md)：validation
- [报告页头 reportHeader](components/reportHeader.md)：components/reportHeader
- [指标卡 metricCard](components/metricCard.md)：components/metricCard
- [柱状图 barChart](components/barChart.md)：components/barChart
- [折线图 lineChart](components/lineChart.md)：components/lineChart
- [饼图 pieChart](components/pieChart.md)：components/pieChart
- [明细表 table](components/table.md)：components/table
- [地图 mapChart](components/mapChart.md)：components/mapChart
- [仪表 gauge](components/gauge.md)：components/gauge
- [Tab 容器 tabContainer](components/tabContainer.md)：components/tabContainer
- [组合卡 compositeCard](components/compositeCard.md)：components/compositeCard
- [排行卡 rankingCard](components/rankingCard.md)：components/rankingCard
- [详细排行卡 rankingDetailCard](components/rankingDetailCard.md)：components/rankingDetailCard
- [信息面板 keyValuePanel](components/keyValuePanel.md)：components/keyValuePanel
- [分类明细 categoryBreakdown](components/categoryBreakdown.md)：components/categoryBreakdown
- [字段长文本 fieldText](components/fieldText.md)：components/fieldText
- [文本 text](components/text.md)：components/text
- [AI 总结 aiSummary](components/aiSummary.md)：components/aiSummary

机器检索使用[index.json](../../contracts/metriccanvas/page/reference/index.json)定位Schema位置与所属模块，类型和结构约束查[schema.json](../../contracts/metriccanvas/page/reference/schema.json)或对应模块的结构表。作者仓库中的结构表在导出时生成；独立Bundle/Skill直接阅读生成Markdown。

- [条件显隐与动作资格](conditions.md)：节点条件、容器单向约束、层级空选、表格行与导出。
