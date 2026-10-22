# pages/capabilities/query

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 查询数值容错与缺失值呈现

入口：`/pages/query-numeric-tolerance`；[页面 JSON](query-numeric-tolerance.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

将占位符、空值和非法数值显示为缺失，保留真实零；比较表格、折线和指标卡。

合成演示

首屏可预览；动态查询需仿真

1. 检查八行数值依次为 10.0、—、—、12.5、0.0、-4.0、—、—。
2. 排序后检查八行仍保留，比较缺失指标卡与真实 0% 的区别。

容错仅针对查询数值度量；字段缺失、维度类型错误和 inline 数据仍受严格校验。HTTP 异常注入由回归测试覆盖。

关键声明：`dataSources.*.fields`, `dataSources.*.source.initial`。

关联：[empty-state-showcase](../layout/empty-state-showcase.json)。

## 查询分页、排序与级联取数｜项目评估

入口：`/pages/query-result-where-page`；[页面 JSON](query-result-where-page.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

改变主表排序或翻页后，下游分别筛选当前查询窗口中的大额和小额项目再取评估明细。

合成演示

交互取数需本地仿真

1. 启动本地 DQE Sim，切换主表任意列排序，观察回到第一页。
2. 翻到下一页，比较主表项目与两张下游评估表的编号。

下游使用当前查询窗口，不是全部 80 个项目；两个下游条件彼此独立。

关键声明：`dataSources.*.source.query.resultBindings`, `sections[].components[].props.pagination`。

关联：[business-sdt-cascade-example](../../business/report/sdt/business-sdt-cascade-example.json)。

关联：[multi-query-table](../table/multi-query-table.json)。
