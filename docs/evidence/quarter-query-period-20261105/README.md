# 季度时间过滤编码（2026-11-05）

用户确认季度 DQE 请求为 `filter.time:{period:"quarter",start:"2026-Q3",end:"2026-Q3"}`。期间选择继续保存公历范围，查询期间策略负责季度传输编码，原始页面与 is_aggregate 保持不变。

## 协议、页面与分发

- Schema 6.86 扩展既有 periodPolicy.period/supportedPeriods 的 quarter 枚举；页面字段净增减 0。固定按季和按选择的季度策略均有 6.86 能力下限，旧声明继续可读。
- 按选择声明为 `{target:"time",periodPolicy:{kind:"selection",supportedPeriods:["year","quarter","month"]}}`。固定日/月策略仍按原声明执行，未声明支持 quarter 时仍拒绝季度选择。
- `period-query.ts` 生成 YYYY-Qn，`query-time.ts` 在发送前校验季度、年份和起止顺序。工作台支持固定按季、季度能力选择和实际请求预览。
- 完整 Dashboard 页面 `/pages/quarter-query-period` 默认 2026-Q3，首分区首组件为 iocHeader。文档为 PAGE-METADATA.md、docs/page-metadata/queries-and-bindings.md 与页面目录 README。
- local-authoring 1.25.1、MC 与产品契约均由当前产品真源生成。

## 集成基线与验证

本批源文件重放到远端 main `7d06bea02657c18f820e5b60d689de61ab1d8e02` 后重新生成。远端 IOC 重点国代覆盖逻辑保持原状。源码与 pnpm-lock 摘要见 delivery-source-inputs.json。

- 产品回归：`pnpm test` 指定季度、版本、请求、工作台及期间运行时 11 文件，134 条通过。
- Chrome：从本页 JSON 驱动真实控件，默认发送 quarter / 2026-Q3 / 2026-Q3，年/月切换与季度恢复、表格渲染通过。合成 HTTP 回执，原始请求见 browser-result.json。
- Page、Embed、Platform 类型检查通过；Svelte 0 errors / 0 warnings。
- local-authoring 5 文件共 207 条检查：初次有一项参考逐字读取触发 5 秒超时，单独复跑该文件 8 条全部通过；其余 4 文件通过。repair 与独立归档入口 16 条通过。安装目录另复制到仓库外，独立校验季度页通过。
- MC 52 条测试通过；产品契约一致性、来源覆盖与 MC 诊断夹具分别核验。没有把历史跨 Bundle 导出隔离整套回归标记为通过。
- 全量根 tests 类型检查存在 main 原有失败：partner-health-http.test.ts 和 partner-health-scope.test.ts 仍导入已移走的 `pages/temporary/partner-health.json`，当前文件为 `pages/partner-health.json`。两测试与季度提交无差异，未混入本批修复。原始错误见 baseline-tests-type-error.log。

## Embed 分发

集成基线重新构建，build、check:dist、check 通过。原生 ES/global、复制目录与 Webpack 等全部 273 条浏览器检查通过。完整 dist 打包并回读归档，16 个 JS 均不超过 1,000,000 字节；最大 exceljs 分块 929,901 字节。入口分别为 ES 3,092 字节、global 1,059 字节，精确值以 embed-receipt.json 为准。验证归档保存在工作树外 `/tmp/quarter-delivery-artifacts/metriccanvas-embed-quarter.tar.gz`；未发布到生产环境。

## 复杂度

metriccanvas-ts-ast/1 / TypeScript 5.9.3：selectedPeriod 5→4，resolvePeriodQuery 4→5，endpoint 9→11，periodPolicyPreview 7→8；新增 quarterBounds 2、内部 quarter 1，quarterQueryCapabilityPaths 1、filter 回调 4、reduce 回调 1。Svelte 只改模板枚举，无脚本函数变更。修改与新增函数均 ≤15，本批无未关闭超限，原始记录见 complexity 与 version-complexity JSON。

## 交付边界

用户明确要求合入 main 并 skip ci，本批提交使用 [skip ci]；远端提交与清理结果以交付消息为准。主工作区的并行未提交修改保持原状。静态、行为测试与合成浏览器证据不代表真实 DQE、Relay 或门户部署验收。
