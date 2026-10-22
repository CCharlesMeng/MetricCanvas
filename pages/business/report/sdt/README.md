# pages/business/report/sdt

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 商务 SDT 固定月份报告

入口：`/pages/business-sdt-report`；[页面 JSON](business-sdt-report.json)。

启动：`pnpm dev:playground`，并在集成环境接入匹配的网关、数据集和权限。

查看经营总览、趋势和阶段明细；报告期间固定为 2026 年 10 月。

业务查询

业务查询需对应服务

1. 按总览、趋势、阶段明细阅读报告，比较不同组件的展示方式。
2. 需更换月份时，从关联入口打开单月筛选版。

固定内容不随当前日期更新；本地 DQE Sim 不覆盖全部业务查询。

关键声明：`sections[].components[].type`, `dataSources.*.source.query`。

关联：[business-sdt-report-monthly](business-sdt-report-monthly.json)。

## 单月筛选与业务月报｜商务 SDT

入口：`/pages/business-sdt-report-monthly`；[页面 JSON](business-sdt-report-monthly.json)。

启动：`pnpm dev:playground`，并在集成环境接入匹配的网关、数据集和权限。

提交报告月份后，同步图表查询、报告标题和统计月份；趋势取截至所选月的近 6 个月。

业务查询

业务查询需对应服务

1. 选择报告月份并提交，观察标题与统计月份同步变化。
2. 查看趋势窗口；尝试早于 2020-06 的月份，已应用状态应保持不变。

固定摘要不会随月份更新；本地 DQE Sim 不覆盖全部业务查询。

关键声明：`filters`, `dataSources.*.source.query.filterBindings`。

关联：[report-date-filter-example](../../../capabilities/filters/report-date-filter-example.json)。

关联：[business-sdt-report](business-sdt-report.json)。

## 查询结果绑定与两条级联链｜SDT

入口：`/pages/business-sdt-cascade-example`；[页面 JSON](business-sdt-cascade-example.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

用 Top5 项目的商务编号驱动阶段明细，两条独立链分别保留各自上下文。

合成演示

仅支持 2026-09／10 仿真

1. 启动本地 DQE Sim，观察 Top5 项目和阶段明细。
2. 对照两条级联链的商务编号及下游结果绑定配置。

只证明合成查询链路；本地夹具不支持任意月份，也不覆盖业务月报全部查询。

关键声明：`dataSources.*.source.query.resultBindings`。

关联：[query-result-where-page](../../../capabilities/query/query-result-where-page.json)。

关联：[business-sdt-report-monthly](business-sdt-report-monthly.json)。
