# US1980 · Alpha Tests

## L4 单元测试记录

| 证据 | 命令 | 结果 |
| --- | --- | --- |
| UT-1 | `pnpm exec vitest run packages/runtime-ui/tests/project-detail-responsive.test.ts packages/widgets/tests/composite-card-surface.test.ts` | 2 files、17 tests 全通过；静态禁止共享运行时与 Widget 使用 `@media (max-width)` 决定宽度 |
| UT-2 | `pnpm test` | 169 files 通过、7 skipped；1375 tests 通过、49 skipped |
| QG-1 | `pnpm check` | 16 个 workspace project 全通过，Svelte diagnostics 0 error / 0 warning |
| QG-2 | `pnpm validate` | 11/11 Page Metadata 通过，含四个 IOC Page |

## L3 单服务单接口集成测试记录

| 证据 | 场景 | 结果 |
| --- | --- | --- |
| BE-1 | 四个真实 IOC Page 在 1980×1080 依次装入 Embed | Page 布局盒与宿主宽差 ≤1px，页面级横向溢出 ≤1px |
| BE-2 | `ioc-project-detail` 固定 900px 宿主，外部视口依次为 1980、1200、700 | 三次列轨、五类组件根宽与内部布局签名逐项相同；组件根与运行时布局盒宽差 ≤1px；预测表仅内部横向滚动；最小内容宽度由列声明汇总，短叙事卡无裁切 |
| REG-1 | `pnpm test:embed` | 构建成功，Playwright 27/27 通过 |

## 还原证据记录

| 阶段 | 工件 | 结果 |
| --- | --- | --- |
| 契约冻结 | `restore-contract.json`，contract SHA `78162def2cb560d7ea821504c344f41ab9a12bd5b5f417f13fb8859cb4e35c90` | R5/R6 共 7 条机器判据 |
| RED | `restore-report-red.json`，file SHA `29962edf4249f77bcb65b0b6f18dd157c7a2a55a1985389583090fe28b614ac4` | 6 red / 1 green |
| GREEN | `restore-report-green.json`，file SHA `634d0d87d4d9a783ebe79307121a0daa7179b481851410565b80511b776ef969` | 7 green / 0 red |
| 独立复审 | `restore-report-review.json`（file SHA `801b7349fb8861a8c56d9539c388b0480c3cd00452c3bb81b4bc5a6c834c6685`）+ `review-restore.json` | 7 green / 0 red；R5、R6 均 clear |

## 计划外承接

| 文件 | Task | 原因 |
| --- | --- | --- |
| `packages/runtime-ui/src/RuntimeView.svelte` | Task 2 | 建立宿主级 `mc-runtime` inline-size 容器 |
| `packages/runtime-ui/src/dashboard/DashboardToolbar.svelte` | Task 2 | IOC compact 工具栏从 viewport 迁移到宿主容器 |
| `packages/widgets/src/components/metric-card/MetricCard.svelte` | Task 2 | IOC 复用指标卡从 viewport 迁移到运行时组件布局盒 |
| `packages/widgets/src/components/map-chart/MapChart.svelte` | Task 2 | IOC 项目概览地图从 viewport 迁移到运行时组件布局盒 |
| `packages/runtime-ui/tests/project-detail-responsive.test.ts` | Task 2 | 旧测试冻结父网格读取子 variant，改为两级命名容器契约 |
| `packages/widgets/tests/composite-card-surface.test.ts` | Task 2、Task 3、Task 4 | 旧测试冻结页面派生宽度，改为 Widget 组件布局盒契约 |

## AC ↔ 证据映射

| AC / AT | 声明 | 状态 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AC-2 / AT-1 | IOC 四页在 1980px 下占满宿主且无页面级横向滚动 | PROVEN | BE-1、UT-2、QG-2、review-layout L1/L3 | review-4 | 四页真实 Page Metadata 均通过 |
| AC-1、AC-4 / AT-2 | 相同容器宽度在不同视口下产生相同组件布局结果 | PROVEN | BE-2、UT-1、review-layout L4、review-quality Q7 | review-4 | 同时覆盖冻结的 1200px 样本与跨旧阈值的 700px 样本 |
| AC-1、AC-3、AC-4 / AT-3 | 项目详情页头、档案卡、规范卡服从组件布局盒 | PROVEN | BE-2、restore-review、review-restore R6、review-layout L4 | review-4 | 三类根宽与所属运行时布局盒误差 ≤1px |
| AC-1、AC-3、AC-4 / AT-4 | 项目详情预测表、叙事卡服从组件布局盒，宽表仅内部滚动 | PROVEN | BE-2、restore-review、review-restore R5/R6、review-layout L2/L6 | review-4 | 页面无横向溢出，预测表滚动层 `overflow-x:auto`，短叙事卡无内容裁切 |

## Deferred

无。

## Self-check

- AC-1～AC-4 全部为 `PROVEN`，无 `UNVERIFIED` / `DEFERRED`。
- 最终代码指纹：`33d1b50cd1b38434b9c2b07aa5700fc7334274533ab39e6efaebbe3cbf6d0e93`。
- 四个独立检视角色均在 `review-4` 执行，无 blocker、suggestion、open question 或 known gap。
