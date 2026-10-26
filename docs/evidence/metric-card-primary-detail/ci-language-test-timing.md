# CI异步用例等待屏障修正

`52970d58164eb8de04fc4243f059e4373bc205f9`的[CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/40335333175)中，compatibility、authoring、types和build全部通过。tests唯一失败是既有`apps/platform/tests/workbench/authoring-language.test.ts`的“取消→确认未应用→新轮次→拒绝旧通知”用例，3152项通过、5项既有跳过。

## 可重复反馈

单独运行原用例通过，但它在新轮次启动后只等待固定10ms便发送旧通知，再等10ms断言RESPONSE_MISMATCH。准备过程包含异步文档摘要计算；新轮次准备完成前的通知无法等同于“新轮次已运行时收到旧通知”。

临时副本仅将第二次prepare增加15ms延迟，运行同一用例，在不足1秒内稳定出现与CI完全相同的错误：`expected '语言修改处理中，暂不能手工修改当前页面。' to contain 'RESPONSE_MISMATCH'`。随后只把新轮次等待改为provider.run已经调用第二次，延迟副本立即通过，确认缺失的是新轮次就绪屏障。临时副本已删除。

## 修正与验证

- 在正式用例中保留15ms准备延迟，使该时序回归能再次检出错误的固定等待。
- 等待run调用次数为2后再发旧通知，明确“新轮次已启动”的原验收前提；随后等待RESPONSE_MISMATCH真实出现再断言页面引用未变。
- 原有旧回执拒绝、opaque ID不排序、新合法回执最终保存成功的断言均保留；AbortSignal继续转交原prepare。
- 没有修改语言创作的产品实现、指标卡呈现、页面协议或执行超时预算。
- `pnpm test apps/platform/tests/workbench/authoring-language.test.ts`：55项通过，耗时1.78秒。
- `pnpm --filter platform check`：通过，Svelte零错误、零警告。

复杂度口径：`metriccanvas-ts-ast/1` / TypeScript5.9.3。修改测试回调selfCC为1→1；新增prepare、定时Promise及状态等待回调均为1，本次无新增超限项。后续完整CI按修正后的精确提交SHA核对。
