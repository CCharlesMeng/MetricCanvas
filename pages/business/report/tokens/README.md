# pages/business/report/tokens

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 运营简报布局｜Tokens 固定快照

入口：`/pages/tokens-report`；[页面 JSON](tokens-report.json)。

启动：`pnpm dev:playground`。

查看固定采集时点的运营快照，参考概况、趋势与分析文字的组织。

固定运营快照

可直接预览

1. 按报告章节阅读指标与分析文字。
2. 下载完整 JSON，查看内联页面数据源与组件的绑定。

固定快照不随当前时间更新，也不代表实时运营数据。

关键声明：`dataSources.*.source.type`, `sections[].components[].type`。

关联：[tokens-monthly-trend](tokens-monthly-trend.json)。

## 运营月报与查询分页｜Tokens 趋势

入口：`/pages/tokens-monthly-trend`；[页面 JSON](tokens-monthly-trend.json)。

启动：`pnpm dev:playground`，并在集成环境接入匹配的网关、数据集和权限。

查看上半年运营趋势和月度明细，对照图表与表格的数据组织。

业务查询与初始快照

初始行可预览；查询需对应服务

1. 查看趋势与月度明细，注意总数和当前展示行数。
2. 查询服务可用时操作表格分页，核对后续查询窗口。

内嵌初始行只供首屏展示；分页取数需对应查询服务。

关键声明：`dataSources.*.source.query`, `sections[].components[].type`。

关联：[tokens-report](tokens-report.json)。

关联：[query-result-where-page](../../../capabilities/query/query-result-where-page.json)。
