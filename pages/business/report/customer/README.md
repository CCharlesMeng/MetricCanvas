# pages/business/report/customer

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 客户风险简报与分析文字

入口：`/pages/customer-activity-risk-briefing`；[页面 JSON](customer-activity-risk-briefing.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

结合客户概况、活动数据和风险分析文字，阅读完整业务简报。

合成演示

本地仿真；非真实业务验收

1. 启动本地 DQE Sim 后打开简报，查看客户概况与明细。
2. 对照数据组件和分析文字，区分固定内容与查询结果。

本地仿真返回合成数据；不证明真实业务口径或模型分析质量。

关键声明：`dataSources.*.source.query`, `sections[].components[].type`。

关联：[flow-analysis-report](../flow/flow-analysis-report.json)。
