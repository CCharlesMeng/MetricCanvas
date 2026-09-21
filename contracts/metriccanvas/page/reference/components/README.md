# 组件选型

- [报告页头 reportHeader](reportHeader.md)：表达页面标题、说明、时间点与标签；副标题可显式使用受控语义 HTML；不绑定页面数据源。
- [指标卡 metricCard](metricCard.md)：突出一个或少量核心指标的当前值、变化值与可选完成率；单行或少量行；至少一个 metric 字段，可选变化值和完成率 metric。
- [柱状图 barChart](barChart.md)：比较离散类别之间的大小或展示分类分布；一个 dimension 类别字段 + 一个或多个 metric 字段。
- [折线图 lineChart](lineChart.md)：展示指标随时间或有序维度的变化趋势；一个 date/datetime/dimension 横轴字段 + 一个或多个 metric 字段。
- [饼图 pieChart](pieChart.md)：展示少量类别对整体的占比或构成；一个 dimension 类别字段 + 一个 metric 数值字段。
- [明细表 table](table.md)：展示需要逐行核对、排序、筛选或通过单元格选择联动明细的记录；一个或多个 dimension/metric 字段组成的多行记录。
- [地图 mapChart](mapChart.md)：展示国家或省级地域分布，可按层级维度筛选器做三级下钻；地域名称 dimension 字段 + 一个 metric 数值字段。
- [仪表 gauge](gauge.md)：用环形刻度突出一个比率或完成度类 KPI；单行记录；一个 measure 数值字段。
- [Tab 容器 tabContainer](tabContainer.md)：在同一卡位切换多张表格,不占用额外栅格行；不绑定页面数据源；每个 Tab 内的表格自己声明数据槽。
- [组合卡 compositeCard](compositeCard.md)：把若干组件框进一张卡,并让这张卡作为一个组件进 12 列栅格横向并排；不绑定页面数据源；每个子组件自己声明数据槽与字段绑定。
- [排行卡 rankingCard](rankingCard.md)：突出 Top N 或按指标排序的类别；名称 dimension 字段 + 一个 metric 数值字段，查询应声明排序和限制。
- [详细排行卡 rankingDetailCard](rankingDetailCard.md)：按查询结果顺序展示对象、指标、变化、徽标与原因说明；名称 dimension + 数值 measure，可选变化 measure、最多两个徽标 dimension、普通说明 dimension、语义 HTML 说明 semanticHtml/detail，以及可展开 recordList/detail。
- [信息面板 keyValuePanel](keyValuePanel.md)：把一条记录的若干字段按「标签：取值」逐项列出；单行记录；每项绑定一个 dimension 或 measure 字段。
- [分类明细 categoryBreakdown](categoryBreakdown.md)：按类别逐行、按度量逐列列出少数几行带列头的紧凑明细；每行一个类别;一个 dimension 类别字段 + 一到多个 measure 字段。
- [字段长文本 fieldText](fieldText.md)：把数据源里的一段长文本按段落呈现，标题写在组件上；单行记录；绑定一个 string 字段，或一个 semanticHtml/detail 字段。
- [文本 text](text.md)：承载说明、口径提示或由后端返回的人工/AI 已确认分析结论；可显式使用受控语义 HTML 正文；不绑定页面数据源。
- [AI 总结 aiSummary](aiSummary.md)：仅在需求明确声明时，基于关联数据通过 SSE 流式生成 AI 总结；不声明数据槽；relatedData 显式引用页面数据源字段。

[总索引](../README.md)。字段requiredProps摘要不能替代每份组件参考的所有联合分支。

## Schema、确定性装配和运行证据

17类是产品类型闭集，不表示公开工具开放全部属性组合。`create_content_page`自动生成reportHeader，只接收六类显式add recipe：text、fieldText、mapChart、tabContainer、compositeCard、aiSummary。十类数据组件（metricCard、barChart、lineChart、pieChart、table、gauge、keyValuePanel、categoryBreakdown、rankingCard、rankingDetailCard）由既有推荐/装配链或`change_component_type`消费；后者只转换已有单main源、拒绝compute，按字段和行证据重建默认props。不能把它说成任意props保留或任意类型新建接口。

| 能力 | 当前content构造边界 | 已有运行证据及限制 |
|---|---|---|
| 静态/字段文本 | text无需源；fieldText需单行非空string或semanticHtml，compute源拒绝 | t09两形态真实Chrome；受控行证据，不是外部DQE实连 |
| 地图 | china/world，可显式nameMap；string维度+number/money度量、非空可映射有限行；plain/card宿主拒绝，panel/缺省支持 | t09地图几何及浙江省18悬浮；Schema合法不代表任意宿主能装配 |
| 组合卡 | 子recipe只metricCard/pieChart/gauge/keyValuePanel/categoryBreakdown | t10复合指标与完整子树删除；不是任意嵌套编辑器 |
| Tab | 每Tab的子recipe只table，非空子树，id/defaultTab整页校验 | t10两形态切换与表格数据；产品Schema的表达面仍独立 |
| 动态总结 | generation=runtime_sse、非空promptTemplate/relatedData、部署侧AiSummaryConfig | t10真实本地HTTP/SSE，出站只白名单字段；不证明生产端点、认证或权限 |

删除操作仅覆盖允许的顶层文本、地图、容器及总结，容器完整子树一起删除，共享数据源保留；connectPrevious后继依赖阻止删除。内容工具不保存/发布，不在创作期调用总结服务；标题含“AI”不自动升级动态总结。

溯源（仓库路径）：`metriccanvas-authoring/tool/metriccanvas_authoring/domain/component_editing.py`、`page_building.py`、`text_map_building.py`、`container_building.py`；公开闭集测试`metriccanvas-authoring/test-harness/tests/test_content_containers.py`。t08/t09/t10/t11证据位于`docs/archive/authoring-tickets-126/`，它们分别记录本仓静态、实际本地协议与外部待验收边界。
