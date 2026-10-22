# pages/business/report/flow

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 分析简报布局｜代表处流水

入口：`/pages/flow-analysis-report`；[页面 JSON](flow-analysis-report.json)。

启动：`pnpm dev:playground`，并在集成环境接入匹配的网关、数据集和权限。

按概况、趋势和结构阅读流水分析，参考指标、图表与文字的章节组合。

业务查询与初始快照

初始行可预览；查询需对应服务

1. 先阅读概况，再查看趋势与客户、赛道、产业结构。
2. 打开参数版，对照报告期间与代表处如何成为显式输入。

首屏内嵌初始行不证明后续查询已接通；业务结果需单独核验。

关键声明：`sections[].components[].type`, `dataSources.*.source.query`。

关联：[flow-analysis-report-params](flow-analysis-report-params.json)。

关联：[business-sdt-report-monthly](../sdt/business-sdt-report-monthly.json)。

## 页面参数与查询时间窗口｜流水分析

入口：`/pages/flow-analysis-report-params`；[页面 JSON](flow-analysis-report-params.json)。

启动：`pnpm dev:playground`，并在集成环境接入匹配的网关、数据集和权限。

打开时确定代表处和报告月份，再显式绑定月度、全年及近 12 月等查询窗口。

业务查询与初始快照

初始行可预览；查询需对应服务

1. 展开关键配置，查看 params.query 中的代表处和报告月份。
2. 比较不同查询对同一报告月份的时间窗口声明。

页面参数是打开时确定的输入；查询仍需数据服务支持对应字段与口径。

关键声明：`params`, `dataSources.*.source.query`。

关联：[flow-analysis-report](flow-analysis-report.json)。

关联：[report-date-filter-example](../../../capabilities/filters/report-date-filter-example.json)。
