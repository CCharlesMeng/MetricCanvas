# Report 范式

仅在用户确认 Report 后读取。选最接近阅读目的的一张卡，再读其结构摘要与对应协议模块。摘要从维护仓库的成型页面提炼，保留结构与来源哈希，不含业务行或查询体；它不是可直接运行的页面 JSON。业务月份、指标、分类、排名和总结文字以本次输入为准。

Report 定宽居中，以章节顺序组织阅读；仍然可以有日期选择、查询、导航和多个图表。阅读目的与数据是否动态分别判断。确认 Dashboard 的需求即使包含月度指标和结论文字，也继续按 Dashboard 组织。

新建、重组章节、选择本章排法，或用户反馈区域／卡片边界不清时先读[PC章节组合](page-patterns/report-composition.md)：按其容器基本原则简列信息组、卡面提供者与内部内容，再选表达和组合，核对当前协议后装配；自行预览并修复实际卡面与主辅层级问题。局部字段修改沿用现有结构。

| 范式 | 适用目的 | 阅读骨架 | 结构摘要 |
|---|---|---|---|
| 经营月报 | 同一基准期下依次分析管理层级、效率与重点对象 | 报告页头／期间 → 总览与趋势 → 组织层级分析 → 重点对象排名 | [report-monthly](page-patterns/report-monthly.json) |
| 分析简报 | 用主指标、推演、风险及多个业务视角形成阅读链 | 页头 → 总览／趋势 → 推演与风险 → 客户／赛道／产业分析 | [report-briefing](page-patterns/report-briefing.json) |

## 经营月报

源页面 `business-sdt-report-monthly`：一个报告页头关联报告月份；总览分区先排三张 `compactSummary` 指标卡，再排三个趋势图；后续 panel 分区按代表处、地区部、项目、决策人展开表格。借鉴“先总体、后分层、再重点对象”，不固定复制其章节数量或 span。

报告基准期与查询时间窗口分别定义，同一页面可以有本月和近六月查询。期间标题应消费已应用值；源页面的固定摘要不是可随月份重新计算的总结。用户未要求自动总结时保留事实性说明即可。读[报告页头](page-metadata/components/reportHeader.md)、[筛选](page-metadata/filters.md)、[查询绑定](page-metadata/queries-and-bindings.md)、[期间文字](page-metadata/params-and-text-values.md)，完整可校验日期页见[日期筛选示例](page-metadata/examples/report-date-filters-page.json)。

## 分析简报

源页面 `flow-analysis-report`：总览用三张 `compactSummary` 和通栏趋势；后续 `dualSummary` 区分多个业务口径，风险说明承接趋势与推演；客户视角将增长／下降排行并列，赛道和产业各保留说明及明细。它体现“结论与证据相邻”，不能把所有图堆在上方、正文和明细挪到末尾。

推演、变化与排名只能使用有来源的字段。既有文字不等于已实现动态 AI 总结，未核验口径不能因为范式而获得业务依据。读[指标卡](page-metadata/components/metricCard.md)、[排行明细](page-metadata/components/rankingDetailCard.md)、[文字](page-metadata/components/text.md)、[表格](page-metadata/components/table.md)，基础完整页见[内联报表](page-metadata/examples/inline-report.json)。

## 输出核对

新页面显式 `layout: "report"`；标题、期间、章节与数据范围符合确认后的需求。日期控件位置由 reportHeader 声明，查询消费由 filterBindings 声明。需要下载时按当前[页头协议](page-metadata/components/reportHeader.md)配置，不能从历史源页面复制旧版下载字段。结构校验、实际视觉、业务口径和真实取数分别验收。
