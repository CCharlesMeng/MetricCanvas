# DQE object 查询 main 交付准备

2026-10-23。用户授权提交并 push main。本次在独立工作树完成交付，主工作区并行修改未纳入；保留工作树供当前5175 Playground及本地证据链接使用。

原实施基线 `ea40f6641e41e974dd3f1801c4613c5a1a7fcd45`，交付基线为 `3103f985eb22da4693b3d4ebe404a4b0afe6b260`。main 的 AI 总结能力已占用6.52/6.53/6.54，对象查询按同一版本策略顺延至6.55；AI 总结源码、版本能力与场景保持，契约和分发均从合并后的产品真源重新生成。

复验发现对象关联测试仍使用旧版本，已调整为6.55；补齐 main 新增 `aiSummarySourceReferences`、`hasAiSummaryBody` 的内部公开面快照。无新增业务行为或呈现方案。

## 合并后验证

local-authoring 初始本地73项已通过；交付基线变更后重新启动独立校验，最终结论由本次提交的CI authoring任务复核。

- `pnpm test packages/page/tests packages/data-execution/tests packages/engine/runtime/tests packages/engine/runtime-ui/tests tools/dqe-sim/tests apps/playground/tests tests/public-api.test.ts`：222文件1685项通过。
- `pnpm check`：通过，各 Svelte 检查0错误0警告。
- `pnpm validate`：87个页面全部通过。
- `pnpm authoring:contracts:check`：1116产品、4authoring、1interface产物一致。
- `pnpm build:packages`、`pnpm build:playground`、`pnpm packages:check`：通过。
- 本次版本合并的AST复测与初始实施采用相同 metriccanvas-ts-ast/1、TypeScript5.9.3口径：`usesObjectQuery` 自身CC4→4，`queryContractErrors`10→10。回调分别单列，报告为 `delivery-complexity.json`。初始实施新增函数均≤15及存量未关闭项见 `result.md`。
- 浏览器复验实际Sim HTTP：二月、金额≥2700显示R027/R028，完整表预算差额675/700，关联金额14000；点击B014后URL写入business=B014，窗口指标为B014/14000。见 `delivery-browser.txt`、`delivery-browser.png`。其余初始分页/排序/导出证据仍见 `browser.json` 等文件。

上述结果对应交付工作树合并后的源码和未变化的 `pnpm-lock.yaml`。具体日志以同目录 `delivery-*.log` 为准。真实 DQE/Relay 尚未验收；本记录为推送前证据，最终提交和远端 CI 结论由 Git 及对应提交的 GitHub Actions 记录确定。
