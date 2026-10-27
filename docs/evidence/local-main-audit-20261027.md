# 本地代码与 main 交付盘点

- 核对时间：2026-10-27 16:52:05 +08:00
- 基线：已执行 `git fetch origin --prune`，`origin/main=1955324fe7392957c5663996a1e076842ad19efe`；收尾 `git ls-remote origin refs/heads/main` 返回同一 SHA。
- 范围：全部 6 个工作树、全部 2 个本地分支及 origin 远端引用；读取未提交及未跟踪路径，按内容和三方合并结果对照。
- 本次只做盘点，没有提交、合并、推送或清理；没有修改产品可执行函数，无需函数复杂度测量。

## 明确仍未交付的代码批次

### 1. 期间模式显隐与查询独立期间策略

- 位置：`/Users/moon/.codex/worktrees/period-query-policy/DataDashboard`。
- HEAD `cc2ae9155528cf7387683bc3bbf7feee97085af5` 已在 main；下面这些能力是其后的未提交修改。
- `ConditionRef.part` 新增 `mode`，从已应用的 `selection.mode` 读取 year/quarter/month/last12Months，供 KPI、表格列组等统一显隐使用。此项就是本次内部 Schema 报错涉及的能力，最新 main 尚未包含。
- 新增查询 `periodPolicy`：各查询固定粒度或跟随期间选择、声明支持的粒度；归一化查询时间范围与粒度，不支持的选择拒绝执行。
- 工作台日期配置、条件编辑器、测试、Playground 场景与 local-authoring/契约生成物配套修改也尚未交付。
- 修改了版本能力表，局部声明 6.66；main 的 6.66 已含其他能力，交付前需基于最新真源协调版本，重新生成派生文件。

### 2. 审批明细的显式时间字段下推

- 位置：`/Users/moon/.codex/worktrees/rejection-time-pushdown/DataDashboard`。
- HEAD `54021ab6776c37c8e7e5f669e6c76cc88a3d7a48` 已在 main；未提交修改集中在普通 DQE 的字段时间绑定。
- 普通 DQE 时间绑定显式使用 `queryField + valueFormat`，将选择的日/月区间编码为该字段的维度范围谓词；同步日期校验、时间模式匹配、审批明细仿真适配及回归测试。
- 新能力暂标 6.67（metric-field-time-binding），尚未提交；需要与期间策略批次协调版本和共享文件。
- 与期间批次共享 `packages/data-execution/src/dqe/dqe.ts`、`packages/page/src/report-date-filters.ts`、版本表及生成物，不能整目录覆盖交付。

## 已提交但未合入的本地分支

- 唯一发现：`codex/pie-table-legend-prototype` 的 `f6fd243c0d2fd1f2844aaf67a73555d0305179f3`，提交标题 `prototype(pie): capture approved stable table legend design`。
- 祖先检查未包含，`git cherry -v origin/main codex/pie-table-legend-prototype` 返回 `+`；9 个文件，属于原型页面、原型组件及截图证据。
- 这不是正式饼图表格图例能力未交付的证据，不应把原型分支与产品能力混为一谈。

## 主工作区残留差异的性质

- 主工作区 HEAD 仍为 `ea40f6641`，与远端间隔较大；不能把 git status 中的全部文件理解为未交付功能。
- 本次扫描的 1835 个状态路径中，1084 个经内容/三方对照已经被 main 包含。另有 582 个路径与 main 重叠，5 个可机械合并的差异，164 个没有远端竞争修改的差异。后面三类也不等于独立未完成产品功能。
- 逐项查看剩余源代码重叠：条件编辑界面、决策意见预览、Playground 目录、知识压缩等能力已有更新实现进入 main，主工作区保留了较旧的实现或版本号。例如筛选工具栏本地仍写 6.52，而 main 已落为 6.63；知识 gzip 的跨平台头部归一化修复也仅 main 较新。
- local-authoring 的 data-analysis.md/local-workflow.md 中仍有本地使用问题回灌文字，与 main 已更新的创作流程交织；这是文档差异，需要按段核对后交付。
- 尚未交付的页面与素材包括：本次成熟度得分页、伙伴健康度、治理合规临时页、多批报表设计实验、输入附件副本；另有 Platform 创作流程、报表布局、IOC Select 等原型与样式研究，以及 ioc-data-dev 调研材料。它们不单列为引擎新功能。
- 生成契约、知识与校验器、MC 内容等大量派生差异应从最新真源重新生成；不按文件总数估算功能数量。

## 工作树逐项结论

| 工作树 | HEAD 已被 main 包含 | 脏路径数 | 已被 main 内容包含 | pending | pending_mergeable | overlap |
|---|---|---:|---:|---:|---:|---:|
| 主工作区 | 是 | 1835 | 1084 | 164 | 5 | 582 |
| chart-constant-values | 是 | 0 | 0 | 0 | 0 | 0 |
| dqe-sort-contract | 是 | 0 | 0 | 0 | 0 | 0 |
| metric-primary-details | 是 | 0 | 0 | 0 | 0 | 0 |
| period-query-policy | 是 | 1077 | 780 | 49 | 50 | 198 |
| rejection-time-pushdown | 是 | 1051 | 0 | 993 | 28 | 30 |

上表是路径内容的机械分类，不是待交付功能数：pending 表示本地修改的基线内容与 main 相同；pending_mergeable 表示三方合并无文本冲突且仍有差异；overlap 表示并行内容重叠或删除/新增冲突，需要语义核对；already_on_main 包括本地内容相同或本地补丁已被 main 吸收。生成物与页面/证据一并计入，未重复累加各工作树同名路径。

## 明确已在 main 的相关提交

- 图表常量：`fea823fc7458f47fa9d803d6d26da89f151c82eb`，干净工作树，祖先检查通过。
- KPI 主指标与次级信息：`7c97fb7e69cdd23f1ac18f23171f3565ffd10c1e`，干净工作树，祖先检查通过。
- DQE 排序修复：`1955324fe7392957c5663996a1e076842ad19efe`，干净工作树，正是当前远端 main。
- 表格列条件显隐 `85144cb3`、Platform 交互修复 `a812e940` 均通过最新 main 的祖先检查；不能因为主工作区有重复文件就称为未合入。

## 两批未提交实现的源代码和测试清单

### period-query-policy

- `apps/platform/src/lib/workbench/ReportDateProperties.svelte` — pending
- `apps/platform/src/lib/workbench/condition-editor.ts` — pending
- `apps/platform/src/lib/workbench/report-date-edit.ts` — pending
- `apps/platform/tests/browser/ReportDateEditorHarness.svelte` — pending
- `packages/data-execution/src/dqe/dqe.ts` — pending_mergeable
- `packages/data-execution/src/effective-query.ts` — pending
- `packages/data-execution/src/intersect-filters.ts` — pending
- `packages/page/src/condition.ts` — pending
- `packages/page/src/internal.ts` — pending
- `packages/page/src/presentation-policy.ts` — pending_mergeable
- `packages/page/src/query.ts` — pending
- `packages/page/src/report-date-filters.ts` — pending
- `packages/page/src/schema/condition.ts` — pending
- `packages/page/src/schema/data-source.ts` — pending
- `packages/page/src/version.ts` — overlap
- `packages/page/tests/version.test.ts` — overlap
- `apps/platform/src/lib/workbench/period-policy-edit.ts` — pending
- `apps/platform/src/lib/workbench/report-date-bindings.ts` — pending
- `apps/platform/tests/workbench/period-policy-edit.test.ts` — pending
- `apps/playground/tests/period-query-policy-browser.mjs` — pending
- `packages/data-execution/tests/period-query.test.ts` — pending
- `packages/page/fixtures/contract-valid/period-query-branches.json` — pending
- `packages/page/fixtures/contract-valid/period-query-columns-demo.json` — pending
- `packages/page/src/period-capability.ts` — pending
- `packages/page/src/period-query.ts` — pending
- `packages/page/tests/period-query.test.ts` — pending

### rejection-time-pushdown

- `apps/playground/fixtures/rejection-details/gateway.ts` — pending
- `packages/data-execution/src/dqe/dqe.ts` — overlap
- `packages/data-execution/tests/record-join.test.ts` — pending
- `packages/page/src/query-selection-validation.ts` — pending
- `packages/page/src/report-date-filters.ts` — pending
- `packages/page/src/validate-object-query.ts` — pending
- `packages/page/src/version.ts` — pending
- `packages/page/tests/record-join.test.ts` — pending
- `packages/page/tests/version.test.ts` — pending
- `packages/data-execution/tests/rejection-time-pushdown.test.ts` — pending
- `packages/page/tests/metric-field-time.test.ts` — pending

## 边界与保留项

- 全路径原始分类：`out/unmerged-main-audit-20261027/analysis.json`，含全部扫描路径、状态、分类和分支证据。
- 检查是静态交付盘点，未重新运行业务回归、CI 或内部部署；“代码在 main”不等于内部已部署该版本。
- 6 个工作树均保留。主工作区和两个脏工作树包含本地工作；其他干净工作树仍有活动预览服务或属于其他任务，本次没有清理授权。
- 忽略文件中的缓存与验收截图不视为 Git 交付代码；本报告与中间盘点 JSON 是本次新建的本地审计产物。
