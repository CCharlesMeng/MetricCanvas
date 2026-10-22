# pages/capabilities/filters

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## Report 时间选择、查询与标题联动

入口：`/pages/report-date-filter-example`；[页面 JSON](report-date-filter-example.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

提交单月或范围后同步期间文字；范围查询独立联动，非法未来时间保持已应用状态。

合成演示

文字联动可直接体验；范围查询需仿真

1. 在第一节提交报告月份，观察主标题和期间文字；清除后显示全部期间。
2. 在范围查询一节修改期间，观察明细；在最后一节尝试未来日期或早于下限的值。

三节控件相互独立；文字联动不等于该筛选已绑定所有查询。

关键声明：`filters`, `params`, `dataSources.*.source.query.filterBindings`, `sections[].components[].props.filterIds`。

关联：[dashboard-period-filter](dashboard-period-filter.json)。

关联：[business-sdt-report-monthly](../../business/report/sdt/business-sdt-report-monthly.json)。

## 统一页头 · 仅选年份

入口：`/pages/dashboard-period-filter`；[页面 JSON](dashboard-period-filter.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

统一页头仅选年份，绑定查询使用完整自然年，未绑定对照表保持不变。

合成演示

交互取数需本地仿真

1. 启动本地 DQE Sim 或注入合成验收网关，打开年份框选择历史年份。
2. 观察经营明细使用完整自然年，未绑定查询保持不变；尝试 URL 恢复和未来年份。

只显示一个年份框；完整年季月切换保留于契约夹具，页面不重复放两套时间条件。

关键声明：`iocHeader`, `filters`, `dataSources.*.source.query.filterBindings`。

关联：[report-date-filter-example](report-date-filter-example.json)。

关联：[chart-local-filter-page](../chart/chart-local-filter-page.json)。

## 图表筛选：左侧按钮与右侧下拉

入口：`/pages/filter-group-page`；[页面 JSON](filter-group-page.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

同一张图表卡左上切换营业收入/订单量，右上按区域筛选；图表与合计共同刷新。

合成演示

交互取数需本地仿真

1. 左上切换营业收入/订单量，观察图表、单位和合计更新。
2. 右上选择华东/华南，图表与合计只显示所选区域。
3. 刷新页面确认两项选择从 URL 恢复；窄屏控件可换行。



关键声明：`filters`, `sections[].components[].props.components[].props.display`, `sections[].components[].props.components[].props.align`, `dataSources.*.source.query.filterBindings`。

关联：[filter-group-state-page](filter-group-state-page.json)。

关联：[chart-local-filter-page](../chart/chart-local-filter-page.json)。

## 独立筛选：指标卡、一控多与条件显隐

入口：`/pages/filter-group-state-page`；[页面 JSON](filter-group-state-page.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

固定按钮组控制多个查询和带符号指标卡；页头条件控制筛选组件与内容各自显隐。

合成演示

交互取数需本地仿真

1. 切换直营/加盟，观察两张带符号指标卡和趋势同步更新，对照图不变。
2. 业务范围切到海外，按钮组与趋势隐藏，指标卡保留已选口径；切回国内恢复原选择。
3. 切换组合卡内区域，确认只改变卡内指标。



关键声明：`filters`, `sections[].components[].visibleWhen`, `sections[].components[].props.filterId`, `dataSources.*.source.query.filterBindings`。

关联：[chart-local-filter-page](../chart/chart-local-filter-page.json)。

关联：[page-visibility-region-linkage](page-visibility-region-linkage.json)。

## 统一条件显隐与地区层级联动

入口：`/pages/page-visibility-region-linkage`；[页面 JSON](page-visibility-region-linkage.json)。

启动：`pnpm dev:playground`。

层级空选、分区与子项条件、父容器保留、Tab回退、行投影、按钮和文字片段。内联演示数据。

内联演示数据

无需 DQE；只验证本地条件规则与呈现

1. 切换地区部，观察地区部行权规范分区隐藏、父容器保留，Tab及表格行同步变化。
2. 切回全球，点击显示扩展内容和恢复基础内容，刷新后检查 URL 层级恢复。

本地演示不代表真实 CloudIOC、Java、DQE 或 Relay 接入验收。

关键声明：`filters`, `sections[].visibleWhen`, `sections[].components[].props`。

关联：[page-visibility-inputs](page-visibility-inputs.json)。

关联：[page-visibility-report](page-visibility-report.json)。

## 已有权限与业务事实显隐

入口：`/pages/page-visibility-inputs`；[页面 JSON](page-visibility-inputs.json)。

启动：`pnpm dev:playground`。

已有权限与业务事实的就绪、拒绝及错误输入；本地Sim事实验收。

内联演示数据；权限与事实使用本地 Sim

无需 DQE；只验证本地条件规则与呈现

1. 使用页面外的 Sim 事实控制切换允许、拒绝、等待与错误，观察内容变化。
2. 更换权限会话后旧实例停用；重新初始化后按当前权限显示。

本地演示不代表真实 CloudIOC、Java、DQE 或 Relay 接入验收。

关键声明：`sections[].visibleWhen`。

关联：[page-visibility-region-linkage](page-visibility-region-linkage.json)。

关联：[page-visibility-report](page-visibility-report.json)。

## 条件显隐报告与导出

入口：`/pages/page-visibility-report`；[页面 JSON](page-visibility-report.json)。

启动：`pnpm dev:playground`。

报告导出使用相同条件：整块隐藏、父容器保留、全部允许Tab展开、行投影与PDF/PNG/XLSX。

内联演示数据

无需 DQE；只验证本地条件规则与呈现

1. 切换地区部后下载 PDF、PNG 和表格 XLSX。
2. 核对地区部分区缺席、允许的空父容器保留、Tab 展开及两行代表处记录。

本地演示不代表真实 CloudIOC、Java、DQE 或 Relay 接入验收。

关键声明：`filters`, `sections[].visibleWhen`, `sections[].components[].props`。

关联：[page-visibility-region-linkage](page-visibility-region-linkage.json)。

关联：[page-visibility-inputs](page-visibility-inputs.json)。

## 筛选选择跨表查询 · 签约与商机

入口：`/pages/query-mode-chart-demo`；[页面 JSON](query-mode-chart-demo.json)。

启动：`pnpm dev:dqe`（已有服务时直接打开页面）。隔离工作区演示使用 `DQE_SIM_PORT=18231 pnpm sim:dqe` 与 `DQE_SIM_PORT=18231 pnpm --filter playground dev --host 127.0.0.1 --port 5174 --strictPort`。

数据环境：本地 DQE 仿真，`query-modes.json` 中 `sales_contracts` 和 `sales_opportunities` 是两张独立合成表。DQE 中业务指标 `签约金额` / `商机金额` 分别解析到对应表，输出统一的 `月份` 和 `金额` 别名；真实数据网关继续负责实际业务指标到数据对象的解析。

1. 默认“签约金额 / 华东”：一至六月为110,000、120,000、130,000、140,000、150,000、160,000元，合计810,000元。
2. 选择“商机金额”：同一张折线图更新为330,000至480,000元，合计2,430,000元；明细同步变化。
3. 选择“华南”：商机金额变为240,000至390,000元，合计1,890,000元；切回签约金额保留华南，合计630,000元。
4. 刷新保留URL业务与区域选择。非法URL值 `?business=unknown` 恢复默认签约；合法值 `?business=opportunities&region=south` 直接请求商机华南。
5. 在浏览器 Network 的 DQE 请求中核对指标名由签约金额变为商机金额，区域谓词字段由签约区域变为商机区域。两个数据源分别请求趋势与合计；Chart和明细共用趋势结果，没有第三条明细请求。

同一 Chart 的组件 id、`data.main`、字段绑定不变。页面可在目录的“筛选”主题中发现。缺少 case、输出不一致、旧版本、未知选择、多值及旧捕获查询由契约夹具与执行测试覆盖，迟到/失败由运行时测试覆盖。

证据范围：本地页面协议、HTTP仿真、浏览器请求及呈现；不代表真实数据库、DQE、Relay或业务口径验收。
