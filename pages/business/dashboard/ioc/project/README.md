# pages/business/dashboard/ioc/project

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 地图概览与业务组合｜IOC

入口：`/pages/ioc-project-overview`；[页面 JSON](ioc-project-overview.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

在地图、指标与分类明细之间建立区域经营概览，参考 Dashboard 页面结构。

合成演示

初始行可预览；动态交互需仿真

1. 先查看地图、指标和业务分类的布局关系。
2. 启动本地 DQE Sim 后体验已绑定的筛选，比较局部查询变化。

查询页面数据源带合成内嵌初始行；真实编码、身份、权限与业务服务另行接入。

关键声明：`filters`, `dataSources.*.source.query`, `sections[].components[].type`。

关联：[ioc-opportunity-analysis](../opportunity/ioc-opportunity-analysis.json)。

关联：[ioc-opportunity-list](../opportunity/ioc-opportunity-list.json)。

关联：[region-map](../../../../capabilities/chart/region-map.json)。

## 对象详情与页面参数｜IOC

入口：`/pages/ioc-project-detail`；[页面 JSON](ioc-project-detail.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

从来源页接收对象参数，展示项目概况、规范性、销售预测与叙事。

合成演示

初始行可预览；动态交互需仿真

1. 建议先从机会点清单点击进入，再查看项目标题和标识。
2. 对照基本信息、规范性双卡及销售预测表的组织方式。

单独打开使用页面默认演示参数；合成初始数据不构成真实结果字段契约。

关键声明：`params`, `dashboardToolbar`, `sections[].components[].type`。

关联：[ioc-opportunity-list](../opportunity/ioc-opportunity-list.json)。

关联：[flow-analysis-report-params](../../../report/flow/flow-analysis-report-params.json)。
