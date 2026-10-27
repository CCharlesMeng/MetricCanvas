# 原型、实验与剩余工作区保留清单

2026-10-27。产品增量按B1/B2交付；以下内容按已确认计划保留，不将视觉原型或合成页面当成新引擎能力。

| 材料 | 处理 | 理由 |
|---|---|---|
| 饼图原型分支 f6fd243c0（9文件） | 保留分支和原始设计证据，不重复合并 | 正式图例已在main；原型补丁仍为独有提交 |
| IOC Select样式研究 | 保留，AT-5人工视觉验收待完成 | 原acceptance.md明确未完成视觉判断，不改变已交付控件 |
| Platform创作流程、Report布局原型 | 保留独立原型与需求记录 | 未被确认为正式产品能力的交互不进入运行时 |
| Report设计/评分/版式实验 | 原目录及可恢复快照保留，标注历史实验 | 未统一关闭的实验不强行归档或批量成为能力示例 |
| ioc-data-dev调研与压缩包 | 保留为研究材料 | 不属于两批引擎能力与分发物 |

## 可恢复性与工作树

主工作区912个现存变更文件、tracked删除patch，以及两个开发工作树1077/1051个文件的快照在主工作区out/local-capability-integration-20261027，含tar.gz、patch.gz和SHA256清单。快照未包含依赖缓存或凭据；原工作区和分支也保持。此目录不计入产品发行物。

主工作区仍有并行编辑，不能整体reset/clean；char-constant-values、dqe-sort-contract、metric-primary-details均已在main，但有其他任务/活动服务保留。period-query-policy及rejection-time-pushdown保留源开发副本与历史验证。集成工作树承载本次最终预览，暂不移除。后续清理需重新核对活动任务和忽略证据，不能用脏路径数判断还有未交付能力。

## 分类路径（审计时点）

### 原型与样式研究

- `apps/platform/prototypes/agent-authoring-flow/README.md`
- `apps/platform/prototypes/agent-authoring-flow/evidence/artifact-sha256.json`
- `apps/platform/prototypes/agent-authoring-flow/evidence/browser-console.json`
- `apps/platform/prototypes/agent-authoring-flow/evidence/complexity.json`
- `apps/platform/prototypes/agent-authoring-flow/evidence/info-form.jpg`
- `apps/platform/prototypes/agent-authoring-flow/evidence/management.jpg`
- `apps/platform/prototypes/agent-authoring-flow/evidence/title-direct-api.jpg`
- `apps/platform/prototypes/agent-authoring-flow/evidence/workbench.jpg`
- `apps/platform/prototypes/agent-authoring-flow/prototype.html`
- `apps/playground/src/lib/prototypes/PrototypeSwitcher.svelte`
- `apps/playground/src/lib/prototypes/report-layout-review/CandidatePreview.svelte`
- `apps/playground/src/lib/prototypes/report-layout-review/README.md`
- `apps/playground/src/lib/prototypes/report-layout-review/browser.json`
- `apps/playground/src/lib/prototypes/report-layout-review/complexity.json`
- `apps/playground/src/lib/prototypes/report-layout-review/model.ts`
- `apps/playground/src/lib/prototypes/report-layout-review/verification.md`
- `apps/playground/src/routes/(viewer)/prototypes/pie-table-legend/+page.svelte`
- `apps/playground/src/routes/(viewer)/prototypes/pie-table-legend/+page.ts`
- `apps/playground/src/routes/(viewer)/prototypes/report-layout-review/+page.svelte`
- `apps/playground/src/routes/(viewer)/prototypes/report-layout-review/+page.ts`
- `packages/engine/widgets/src/components/pie-chart/prototype/LegendChart.svelte`
- `packages/engine/widgets/src/components/pie-chart/prototype/README.md`
- `packages/engine/widgets/src/components/pie-chart/prototype/evidence/complexity.json`
- `packages/engine/widgets/src/components/pie-chart/prototype/evidence/default.png`
- `packages/engine/widgets/src/components/pie-chart/prototype/evidence/narrow.png`
- `packages/engine/widgets/src/components/pie-chart/prototype/model.ts`
- `packages/ui/prototypes/ioc-header/SelectionControl.svelte`
- `packages/ui/prototypes/ioc-header/SelectionPlayground.svelte`
- `packages/ui/prototypes/ioc-header/evidence/selection-tree-preview.jpg`
- `packages/ui/prototypes/ioc-header/evidence/selection-verification.md`
- `packages/ui/prototypes/ioc-header/extract-selection-theme.mjs`
- `packages/ui/prototypes/ioc-header/selection-opentiny.css`
- `packages/ui/prototypes/ioc-header/selection-study.css`
- `packages/ui/prototypes/ioc-header/style-review/.work/SelectionControl.svelte`
- `packages/ui/prototypes/ioc-header/style-review/.work/SelectionPlayground.svelte`
- `packages/ui/prototypes/ioc-header/style-review/.work/before-sha.json`
- `packages/ui/prototypes/ioc-header/style-review/.work/diff-facts.json`
- `packages/ui/prototypes/ioc-header/style-review/.work/review-convention-request.json`
- `packages/ui/prototypes/ioc-header/style-review/.work/review-layout-request.json`
- `packages/ui/prototypes/ioc-header/style-review/.work/scoped.diff`
- `packages/ui/prototypes/ioc-header/style-review/.work/selection-study.css`
- `packages/ui/prototypes/ioc-header/style-review/acceptance.md`
- `packages/ui/prototypes/ioc-header/style-review/alpha-tests.md`
- `packages/ui/prototypes/ioc-header/style-review/dev-baseline.md`
- `packages/ui/prototypes/ioc-header/style-review/evidence/browser-observations.json`
- `packages/ui/prototypes/ioc-header/style-review/evidence/fingerprint-normalization.json`
- `packages/ui/prototypes/ioc-header/style-review/evidence/opentiny-tree-preview.jpg`
- `packages/ui/prototypes/ioc-header/style-review/evidence/portfolio.json`
- `packages/ui/prototypes/ioc-header/style-review/evidence/review-convention.json`
- `packages/ui/prototypes/ioc-header/style-review/evidence/review-evidence.json`
- `packages/ui/prototypes/ioc-header/style-review/evidence/review-layout.json`
- `packages/ui/prototypes/ioc-header/style-review/evidence/review-results.json`
- `packages/ui/prototypes/ioc-header/style-review/evidence/tree-single-example.jpg`
- `packages/ui/prototypes/ioc-header/style-review/evidence/user-tree-reference.jpg`
- `packages/ui/prototypes/ioc-header/style-review/tasks.md`

### 报表实验页

- `pages/temporary/report-design-20261022-controlled/README.md`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp01.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp02.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp03.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp04.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp05.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp06.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp07.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp08.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp09.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp10.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp11.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp12.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp13.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp14.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp15.json`
- `pages/temporary/report-design-20261022-controlled/report-eval-1022-cp16.json`
- `pages/temporary/report-design-20261022/README.md`
- `pages/temporary/report-design-20261022/report-eval-1022-p06.json`
- `pages/temporary/report-layout-patterns-20261026/README.md`
- `pages/temporary/report-layout-patterns-20261026/report-layout-patterns-1026.json`
- `pages/temporary/report-layout-v2-20261022/README.md`
- `pages/temporary/report-layout-v2-20261022/report-layout-1022-np01.json`
- `pages/temporary/report-layout-v2-20261022/report-layout-1022-np02.json`
- `pages/temporary/report-layout-v2-20261022/report-layout-1022-np03.json`
- `pages/temporary/report-layout-v2-20261022/report-layout-1022-np04.json`
- `pages/temporary/report-layout-v2-20261022/report-layout-1022-np05.json`
- `pages/temporary/report-layout-v2-20261022/report-layout-1022-np06.json`
- `pages/temporary/report-layout-v2-20261022/report-layout-1022-np07.json`
- `pages/temporary/report-layout-v2-20261022/report-layout-1022-np08.json`

### 调研与过程材料

- `ioc-data-dev/html-style.css`
- `ioc-data-dev/index.html`
- `ioc-data-dev/友商洞察/00-整体对比.html`
- `ioc-data-dev/友商洞察/00-整体对比.md`
- `ioc-data-dev/友商洞察/01-dbt-Labs.html`
- `ioc-data-dev/友商洞察/01-dbt-Labs.md`
- `ioc-data-dev/友商洞察/02-Snowflake.html`
- `ioc-data-dev/友商洞察/02-Snowflake.md`
- `ioc-data-dev/友商洞察/03-Databricks.html`
- `ioc-data-dev/友商洞察/03-Databricks.md`
- `ioc-data-dev/友商洞察/04-Cube.html`
- `ioc-data-dev/友商洞察/04-Cube.md`
- `ioc-data-dev/友商洞察/05-Google-Looker与Malloy.html`
- `ioc-data-dev/友商洞察/05-Google-Looker与Malloy.md`
- `ioc-data-dev/友商洞察/06-Microsoft-Fabric.html`
- `ioc-data-dev/友商洞察/06-Microsoft-Fabric.md`
- `ioc-data-dev/友商洞察/07-Palantir.html`
- `ioc-data-dev/友商洞察/07-Palantir.md`
- `ioc-data-dev/友商洞察/08-Aloudata.html`
- `ioc-data-dev/友商洞察/08-Aloudata.md`
- `ioc-data-dev/友商洞察/09-阿里云.html`
- `ioc-data-dev/友商洞察/09-阿里云.md`
- `ioc-data-dev/友商洞察/10-腾讯云-WeData.html`
- `ioc-data-dev/友商洞察/10-腾讯云-WeData.md`
- `ioc-data-dev/友商洞察/11-数势科技.html`
- `ioc-data-dev/友商洞察/11-数势科技.md`
- `ioc-data-dev/四库分析报告.html`
- `ioc-data-dev/四库分析报告.md`
- `ioc-data-dev/语义模型结构定义.html`
- `ioc-data-dev/语义模型结构定义.md`
