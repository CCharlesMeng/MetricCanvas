# 当前页补列空关联编码兼容交付

基线为 `485faa0a0f81f0e882e2ff23f1de5ec672884f88`，在独立工作树实施并集成最新 main；锁文件 SHA-256 为 `1a33c68c0755b6d9bf6d05bbf45438b9b5e2b9bc574a6f41908944dfe5fc2f4f`。本批只交付按需组合分页兼容、对应回归、Playground 场景、协议语义文档及官方生成的创作工具投影。120 秒 DQE 默认请求超时已经由基线中的 `7ccb34316` 提交交付，本批复用并验证。

## 结果与边界

补充来源返回 null、缺失或空白关联编码时忽略该行，保留有效主行、分页总数和现有查询条件；缺项沿既有投影策略显示，并携带来源、字段与数量的 TABLE_RESULT_RECOVERED 告警。完整导出跨页累计告警，带告警结果不写组合 initial。原始数量和预算先校验；选页成员、主行域身份、错误类型、重复和范围外编码、截断及请求失败仍严格拒绝。Schema 字段净增减 0。

Playground `/pages/paged-join-on-demand?supplementKey=empty` 展示第 11 条空编码被忽略；all-empty、failure、truncated 参数覆盖其余边界。用户页面通过构建后的公开 embed ES 入口及原生 DQE 网关合成回放：保留 10 行，discount 忽略 1 行，3 条指标查询均保留单个华为云账号和 limit 10；另有原页面独立分类候选请求。未取得真实完整响应，未执行公司 DQE 或部署验收。

## 本地验证

- `pnpm test packages/data-execution/tests packages/engine/data-gateway/tests packages/engine/runtime/tests/query-cascade.test.ts`：51 文件、493 项通过，包含 23 项空补列编码专项及既有 120 秒超时边界。
- data-execution、Playground、embed 类型检查通过；168 个页面校验通过。
- 页面浏览器五种合成状态通过，正常/兼容场景每两页共 4 次单源查询，失败场景 2 次且不全量重试。
- embed build、独立 check:dist、实际包归档逐文件摘要/体积复核通过：14 个 JS 文件，最大 excel~exceljs.min-CSE3Njtv.js 为 929901 字节，两种公共入口和引用闭合通过。归档 SHA-256：2d2736ee3e7ad52cc23d06b669f66656abfddb031fd25372f7da489f2b3f4d9c。
- `MC_EMBED_EXAMPLE_PORT=4198 pnpm --filter @metriccanvas/embed exec playwright test --workers=4`：246 项通过，包括 ES/global、复制完整目录、模块共享及加载失败边界。
- local-authoring 五套件 203 项通过；官方生成一致性、MC 覆盖、52 项 MC 测试与布局夹具一致性通过。Skill 1.19.2 / Schema 6.82 独立归档及仓外验证通过；未追加真实 DS 模型验收。

复杂度按 metriccanvas-ts-ast/1、TypeScript 5.9.3 的 selfCC 测量：memberRows 8→8，fillMember 6→6，executeQueryPagedJoin 8→9，exportPagedJoin 14→14；新 withoutEmptySupplementKeys 5、joinWarningSnapshot 2、mergeJoinWarnings 4。queryTableGateway 抽取 Svelte script 测量为 6→7；所有新增辅助函数及回调 ≤15，无本批超限未关闭项。

本地日志、浏览器截图、源码测量和归档回执保存在主检出 artifacts/cloud-service-null-key-20261103 的 delivery-evidence 副本。首次浏览器运行与归档重建重叠并中止，不计为通过；最终浏览器验收使用重建完成后的固定产物。远端 CI 与部署结论另按实际运行记录报告。
