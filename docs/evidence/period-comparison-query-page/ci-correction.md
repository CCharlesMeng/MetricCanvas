# 交付 CI：预览环境与页面 ID 中立性

2026-11-02。首轮提交 `9dcb7b674695eaffa634aeb8dad864a2aa7f9343` 的 [CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/41378858711) 中，完整 tests 为 421 文件通过、1 文件失败；3847 项通过、1 项失败、5 项跳过。失败为 `apps/playground/tests/page-id-neutrality.test.ts`，authoring、构建、类型与兼容性任务已通过。

## 原因与修正

产品源码中使用的预览环境标识和 fixture 导入文件名与正式页面 ID 同名，违反产品源码保持页面 ID 中立的约束。真实页面 ID 仍只在 fixture 映射中定位预览环境，页面路由和元数据不变；环境标识改为 `query-comparison`，合成网关文件改为 `query-comparison-gateway.ts`，消费者及使用说明同步。

原失败用例先独立复现；只改环境标识仍因导入路径失败，重命名 fixture 并更新导入后通过。不修改扫描器、白名单、超时或断言，不改变 DQE、Schema、计算及分页语义。

## 本地验证

- 原门禁与三层按页比较回归：4 文件、33 项通过。
- Playground 全部测试：21 文件、130 项通过。
- Playground 类型检查：0 错误、0 警告。
- 同一完整页面的浏览器回归通过：有界首屏、本页键补查、四种期间、数值筛选范围、完整导出、十万对象、失败重试，无 pageerror。
- 产品真源重新生成 MC 来源摘要与诊断夹具；最终生成一致性与夹具检查通过。
- AST 复杂度仍使用 metriccanvas-ts-ast/1、TypeScript 5.9.3，对比首轮提交和修正后的全部六个相关脚本（含全部辅助与回调，Svelte 只测脚本）：所有函数 selfCC 前后相同，均≤15。完整结果见 [neutrality-complexity.json](neutrality-complexity.json)。

首轮本地 authoring 全组的旧升级示例断言失败已用产品升级器修正，最终 112 项通过；隔离导出 status:null 不计通过。首轮干净 CI authoring 完整通过且未放宽预算。修正提交的全部 CI 以其完整 SHA 的新运行结果为准，不能用首轮部分通过替代。
