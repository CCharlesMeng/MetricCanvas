# 条件目录：下拉弹层宽度与多个下拉并排

> 后续用户澄清需要“左侧按钮组、右侧两个下拉整体居右”，本页双下拉栅格示例不代表最终布局验收。最终协议、截图与验收见[筛选工具栏收口](../2026-10-26-filter-toolbar/README.md)。

2026-10-26。用户确认修复短选项弹层宽度，并补多个下拉并排示例；沿用 Dashboard、共享选择控件和现有合成查询。

## 改动与验收入口

- `packages/ui/src/components/select/Selection.svelte`：普通无搜索、非树、单选弹层的最小宽度跟随触发框；搜索、树形和多选保留原 240px 最小展开空间。原有选项间距修订属于工作区已有修改，本批原样保留。
- 原场景 `/pages/filter-group-page`：修复前输入框 160px、弹层 240px，边缘避让导致左偏约 44.28px；修复后两者均为 160px，水平偏移为 0，垂直间距仍为 4px。
- 新场景 `/pages/filter-group-parallel-selects`：指标和区域两个固定单选下拉各占 6 列，查询同时消费两项条件。原来的按钮加下拉示例保留。
- 目录入口 `/catalog/data/conditions?scene=local-filter&example=filter-group-parallel-selects&layout=dashboard&feature=local-query-filter`，在“局部筛选与查询订阅”的功能演示中可选择新页面。

## 浏览器结果

使用正在运行的主工作区 Playground（5173）与本地 DQE 仿真，没有重启其他服务。目录可发现新页面，独立页面与目录嵌入均已访问。

| 操作 | 实际合计 |
| --- | ---: |
| 默认营业收入、全部区域 | 1,710 万元 |
| 切换订单量、全部区域 | 5,579 笔 |
| 订单量选择华东 | 3,095 笔 |
| 保留华东切回营业收入 | 951 万元 |
| 窄屏下订单量选择华南 | 2,484 笔 |

独立页面 `?metric=orders&region=east` 刷新后恢复订单量、华东和 3,095；`?metric=unknown&region=east` 与 `?metric=orders&metric=revenue&region=east` 均回退营业收入并保留华东，合计 951。

实际 390 CSS 像素视口下，两个下拉继续可操作，区域控件随栅格缩到约 125.53px，弹层等宽且右边界约 330.02px；Escape 返回触发框。截图见[原场景修复后](original-fixed.jpg)、[双下拉联动](parallel-desktop.jpg)、[窄屏弹层](parallel-narrow.jpg)。原始几何与复杂度结果见 [verification.json](verification.json)。

## 自动检查与复杂度

- `pnpm --filter @metriccanvas/ui exec playwright test selection.spec.ts --project=chrome`：9 项通过。新增的普通 DOM / ShadowRoot 宽度回归在修复前均以“期望 160、实际 240”失败，修复后通过；同时检查水平对齐、视口边界、内边距和焦点返回。
- `pnpm --filter @metriccanvas/ui check`、`pnpm --filter playground check`：零错误、零警告。
- `pnpm exec vitest run tools/dqe-sim/tests/chart-local-filter.test.ts packages/engine/runtime/tests/filter-group-presentation.test.ts packages/engine/runtime/tests/filter-group-export.test.ts packages/engine/runtime-ui/tests/dashboard-filter-groups.test.ts`：4 文件、9 项通过。
- 独立 local-authoring 校验器验证新页面：通过。完整 Skill 复制到仓外后再次验证新页面：通过，无断链。
- 从隔离副本执行产品导出，仅回写本批产生变化的 10 项派生输出；回写前逐字节确认主工作区对应输出仍等于生成基线，保留其他任务的内容。`pnpm authoring:contracts:check`：通过。
- `pnpm authoring:check`：68/73 项通过，5 项失败；3 项本地 Skill 漂移检查和 1 项版本再生成检查在 30 秒子进程边界处未返回预期诊断，另 1 项旧入口场景超过 30 秒测试预算。详见 [完整日志](authoring-tests.log)。本批未修改这些导出或测试逻辑；单独复跑本地 Skill 相关 3 项后全部通过（67.16 秒，未放宽预算），见 [复跑日志](authoring-local-retry.log)。完整套件仍保留旧入口兼容、包版本再生成两项超时未关闭，不标为全绿；这些导出行为不是本次修复范围。

复杂度口径为 `metriccanvas-ts-ast/1`、TypeScript 5.9.3。Selection 的 26 个脚本函数前后测量结果完全一致；改动只在模板的呈现宽度条件。新增回归测试回调的自身 CC 为 2，低于 15；两个目录模块仅改页面引用数组，没有新增或修改函数。测量未将 Svelte 模板伪装成 TypeScript 函数。当前范围没有新增复杂度超限或待关闭项。

## 文档、Skill 与证据边界

`PAGE-METADATA.md`、`docs/page-metadata/components/filterGroup.md`、页面目录说明与 local-authoring 的参考、精确知识及哈希清单同步。页面协议未新增字段或版本；新页面显式使用当前写出版本 6.51 和 `layout:"dashboard"`。

这些结果覆盖本地呈现、交互、状态、校验和合成查询。真实 DQE、Relay、生产服务、真实模型及 CI 未运行。本批没有提交或推送。
