# 组件选型

- [报告页头 reportHeader](reportHeader.md)：表达页面标题、说明、时间点与标签；副标题可显式使用受控语义 HTML；不绑定页面数据源。
- [指标卡 metricCard](metricCard.md)：突出一个或少量核心指标的当前值、变化值与可选完成率；单行或少量行；至少一个 metric 字段，可选变化值和完成率 metric。
- [柱状图 barChart](barChart.md)：比较离散类别之间的大小或展示分类分布；一个 dimension 类别字段 + 一个或多个 metric 字段。
- [折线图 lineChart](lineChart.md)：展示指标随时间或有序维度的变化趋势；一个 date/datetime/dimension 横轴字段 + 一个或多个 metric 字段。
- [饼图 pieChart](pieChart.md)：展示少量类别对整体的占比或构成；一个 dimension 类别字段 + 一个 metric 数值字段。
- [明细表 table](table.md)：展示需要逐行核对、排序、筛选或通过单元格选择联动明细的记录；一个或多个 dimension/metric 字段组成的多行记录。
- [地图 mapChart](mapChart.md)：展示国家或省级地域分布，可按层级维度筛选器做三级下钻；地域名称 dimension 字段 + 一个 metric 数值字段。
- [仪表 gauge](gauge.md)：用环形刻度突出一个比率或完成度类 KPI；单行记录；一个 measure 数值字段。
- [Tab 容器 tabContainer](tabContainer.md)：在同一区域切换普通内容与组合卡；显式grid复用12列布局，首次进入按需取数，切换保活并同步URL。
- [组合卡 compositeCard](compositeCard.md)：把若干组件框进一张卡,并让这张卡作为一个组件进 12 列栅格横向并排；不绑定页面数据源；每个子组件自己声明数据槽与字段绑定。
- [排行卡 rankingCard](rankingCard.md)：突出 Top N 或按指标排序的类别；名称 dimension 字段 + 一个 metric 数值字段，查询应声明排序和限制。
- [详细排行卡 rankingDetailCard](rankingDetailCard.md)：按查询结果顺序展示对象、指标、变化、徽标与原因说明；名称 dimension + 数值 measure，可选变化 measure、最多两个徽标 dimension、普通说明 dimension、语义 HTML 说明 semanticHtml/detail，以及可展开 recordList/detail。
- [信息面板 keyValuePanel](keyValuePanel.md)：把一条记录的若干字段按「标签：取值」逐项列出；单行记录；每项绑定一个 dimension 或 measure 字段。
- [分类明细 categoryBreakdown](categoryBreakdown.md)：按类别逐行、按度量逐列列出少数几行带列头的紧凑明细；每行一个类别;一个 dimension 类别字段 + 一到多个 measure 字段。
- [字段长文本 fieldText](fieldText.md)：把数据源里的一段长文本按段落呈现，标题写在组件上；单行记录；绑定一个 string 字段，或一个 semanticHtml/detail 字段。
- [文本 text](text.md)：承载说明、口径提示或由后端返回的人工/AI 已确认分析结论；可显式使用受控语义 HTML 正文；不绑定页面数据源。
- [AI 总结 aiSummary](aiSummary.md)：Report 双模式摘要；不声明数据槽；relatedDataSources 直接引用数据源 ID，或 relatedSections 推导可见区域；异步调用由集成应用适配。

[总索引](../README.md)。字段requiredProps摘要不能替代每份组件参考的所有联合分支。
