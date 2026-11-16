# 全表文本搜索报错：源码修改指南

定位步骤见 local-authoring 的[全表文本搜索定位与修复](../../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/table-search-gateway-repair.md)。下面列出产品仓库中的实现和回归入口。

| 修改／检查目的 | 仓库位置与符号 |
|---|---|
| 页面选取搜索字段 | `packages/page/src/table/search.ts`：`tableSearchValue` |
| 单字段包含编码与多字段 OR 适配 | `packages/data-execution/src/dqe/dqe.ts`：`DqeGatewayConfig.encodeSearch`、`encodedObjectItem`、`encodeTableSearch`、`fetchData` |
| 对象查询的原生等值编码 | `packages/data-execution/src/dqe/object-query.ts`：`encodeObjectQuery` |
| 实际适配器注入 | 在集成应用搜索 `createDqeGateway`，核对 mount／update 最终使用的实例；只改产品默认导出不能证明部署已接入 |
| 已修页面对照 | `pages/business/dashboard/ioc/approval/region-auth-norms-detail.json`：审批人、评审组织人均采用 `options` |
| 请求前失败回归 | `packages/engine/runtime/tests/table-search.test.ts`：多字段搜索缺失 OR 编码器时 `fetchImpl` 不被调用 |
| 页面请求与多 Tab 回归 | `apps/playground/tests/region-auth-norms-search.browser.ts`：两个姓名搜索、多字段选择器、清空与空结果 |
