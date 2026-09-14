# 页面元数据模块参考

按任务或JSON路径查阅；当前6.2，支持读取6.0/6.1/6.2。结构来自Schema，语义来自模块作者。页面协议可表达、确定性工具可装配、外部服务已接通是三份独立证据。

- [页面、版本与布局](page.md)：page
- [页面参数与文本取值](params-and-text-values.md)：params-and-text-values
- [页面数据源与初始行](data-sources.md)：data-sources
- [结果字段契约](fields.md)：fields
- [查询定义与显式绑定](queries-and-bindings.md)：queries-and-bindings
- [具名算子](compute.md)：compute
- [筛选声明与运行状态](filters.md)：filters
- [内容分区与布局](sections-and-layout.md)：sections-and-layout
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

机器检索使用[index.json](../../contracts/metriccanvas/page/reference/index.json)，完整结构使用[schema.json](../../contracts/metriccanvas/page/reference/schema.json)。作者仓库中的结构表在导出时生成；独立Bundle/Skill直接阅读生成Markdown。
