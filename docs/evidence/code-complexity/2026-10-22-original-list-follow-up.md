# 原始 259 条清单：main 交付复测与剩余欠项

交付基线：`670a81071fd27b4a1df581510091b2ddb018b1b1`。原工作区基线为 `952b3a27`；main 已包含后续协议及功能，因此必须重新定位和测量。固定口径仍为 `metriccanvas-ts-ast/1`（TypeScript 5.9.3），每个函数自身 CC≤15，嵌套函数单列。没有原扫描器版本或源码 SHA，不能称为外部 CodeCheck 复扫。

原工作区的“剩余82、44条无法定位”是历史快照，见[前批实施记录](2026-10-22-priority-query-chain.md)。最新 main 上多数原缺失文件已经存在；本页更新为交付检出的实际结果。

## 当前准确口径

| 原清单条目状态 | main 基线 | 交付代码 |
|---|---:|---:|
| 自身仍超限 | 115 | 88 |
| 自身达标但内部函数超限 | 30 | 22 |
| 当前函数及内部函数均达标 | 110 | 145 |
| 文件不存在 | 3 | 3 |
| 同名函数未找到 | 1 | 1 |
| 合计 | 259 | 259 |

原清单对应的 167 个现存文件中，超限函数从 **175 降为 125，关闭 50 个**。交付后仍有 110 条可定位原条目未关闭，另有 4 条定位待核；达标条目包含原本就达标者。当前口径不能与旧工作区的82直接相减。全部函数与逐条对照如下，实施和验收见[main交付记录](2026-10-22-main-delivery.md)。

## 本批修改源码内仍超限的主线存量

下表均为 main 已有决策，迁移后自身 CC 不增长；本批新增辅助函数全部 ≤15。它们仍计入下方总欠项，未以工厂低分或移动代码关闭。

| 文件 | 函数 | main 基线 → 交付 |
|---|---|---:|
| [packages/engine/runtime/src/filter-state.ts:55](../../../packages/engine/runtime/src/filter-state.ts#L55) | `createFilterState` | 17 → 17 |
| [packages/engine/runtime/src/filter-state.ts:89](../../../packages/engine/runtime/src/filter-state.ts#L89) | `createFilterState/blocked` | 29 → 29 |
| [packages/engine/runtime/src/filter-state.ts:114](../../../packages/engine/runtime/src/filter-state.ts#L114) | `createFilterState/commit` | 42 → 42 |
| [packages/engine/runtime/src/filter-state.ts:428](../../../packages/engine/runtime/src/filter-state.ts#L428) | `validShape` | 18 → 18 |
| [packages/engine/runtime/src/filter-state.ts:447](../../../packages/engine/runtime/src/filter-state.ts#L447) | `matchesDeclaration` | 17 → 17 |
| [packages/page/src/validate.ts:103](../../../packages/page/src/validate.ts#L103) | `parsePage` | 32 → 32 |

## 全部 125 个剩余超限函数

| 文件 | 函数归属 | 自身 CC |
|---|---|---:|
| [packages/page/src/time-extension-validation.ts:6](../../../packages/page/src/time-extension-validation.ts#L6) | `timeExtensionErrors` | 97 |
| [tools/scripts/page-reference.ts:245](../../../tools/scripts/page-reference.ts#L245) | `buildPageReference` | 60 |
| [tools/scripts/export-authoring-contracts.ts:578](../../../tools/scripts/export-authoring-contracts.ts#L578) | `buildSkillProjections` | 53 |
| [tools/dqe-sim/src/query-result-where.ts:9](../../../tools/dqe-sim/src/query-result-where.ts#L9) | `executeQueryResultWhere` | 51 |
| [apps/platform/src/lib/workbench/report-date-edit.ts:24](../../../apps/platform/src/lib/workbench/report-date-edit.ts#L24) | `editReportDate` | 50 |
| [tools/dqe-sim/src/multi-query-table.ts:11](../../../tools/dqe-sim/src/multi-query-table.ts#L11) | `executeMultiQueryTable` | 49 |
| [tools/scripts/verify-paged-join-real.ts:8](../../../tools/scripts/verify-paged-join-real.ts#L8) | `main` | 46 |
| [packages/page/src/migrate-param-bindings.ts:10](../../../packages/page/src/migrate-param-bindings.ts#L10) | `migrateParamBindings` | 43 |
| [packages/engine/runtime/src/filter-state.ts:114](../../../packages/engine/runtime/src/filter-state.ts#L114) | `createFilterState/commit` | 42 |
| [apps/platform/scripts/dev-page-assets.ts:97](../../../apps/platform/scripts/dev-page-assets.ts#L97) | `<anonymous@78:29>/handle` | 41 |
| [tools/design-facts/src/extract.ts:179](../../../tools/design-facts/src/extract.ts#L179) | `extractDesignFacts` | 41 |
| [packages/engine/runtime/src/page-params.ts:12](../../../packages/engine/runtime/src/page-params.ts#L12) | `resolvePageParams` | 40 |
| [packages/page/src/amount-validation.ts:5](../../../packages/page/src/amount-validation.ts#L5) | `amountErrors` | 40 |
| [apps/platform/src/lib/integration/routes.ts:19](../../../apps/platform/src/lib/integration/routes.ts#L19) | `resolvePlatformRoute` | 39 |
| [tools/dqe-sim/src/execute.ts:453](../../../tools/dqe-sim/src/execute.ts#L453) | `executeFlowAnalysisReport` | 39 |
| [metriccanvas-authoring/contracts/authored/authoring-turn-contract.ts:17](../../../metriccanvas-authoring/contracts/authored/authoring-turn-contract.ts#L17) | `matches` | 38 |
| [tools/dqe-sim/src/business-sdt.ts:14](../../../tools/dqe-sim/src/business-sdt.ts#L14) | `executeBusinessSdt` | 38 |
| [packages/engine/runtime/src/detail-view.ts:22](../../../packages/engine/runtime/src/detail-view.ts#L22) | `scopedFilterValues` | 36 |
| [packages/page/src/period-facts.ts:21](../../../packages/page/src/period-facts.ts#L21) | `timeAvailabilityIssue` | 36 |
| [packages/engine/widgets/src/shared/semantic-html.ts:72](../../../packages/engine/widgets/src/shared/semantic-html.ts#L72) | `parseSemanticHtml` | 35 |
| [packages/page/src/resolve-page-params.ts:25](../../../packages/page/src/resolve-page-params.ts#L25) | `resolvePageParams` | 35 |
| [packages/page/src/period-facts.ts:6](../../../packages/page/src/period-facts.ts#L6) | `periodFact` | 34 |
| [packages/page/src/presentation-policy.ts:96](../../../packages/page/src/presentation-policy.ts#L96) | `presentationPolicyErrors/checkComponent` | 34 |
| [packages/engine/widgets/src/shared/value-format.ts:12](../../../packages/engine/widgets/src/shared/value-format.ts#L12) | `formatValue` | 32 |
| [packages/page/src/validate.ts:103](../../../packages/page/src/validate.ts#L103) | `parsePage` | 32 |
| [packages/engine/runtime/src/navigate.ts:47](../../../packages/engine/runtime/src/navigate.ts#L47) | `resolveNavigationTarget` | 31 |
| [packages/page/src/navigate.ts:23](../../../packages/page/src/navigate.ts#L23) | `navigationErrors/<anonymous@23:28>` | 31 |
| [packages/data-execution/src/candidate-validation.ts:50](../../../packages/data-execution/src/candidate-validation.ts#L50) | `createCandidateValidator/verify/verifyFilter` | 30 |
| [packages/data-execution/src/page-params.ts:15](../../../packages/data-execution/src/page-params.ts#L15) | `seedPageParamFilters` | 30 |
| [packages/page/src/field-selection.ts:23](../../../packages/page/src/field-selection.ts#L23) | `projectComponentFields/project` | 30 |
| [packages/page/src/query-param-references.ts:14](../../../packages/page/src/query-param-references.ts#L14) | `queryParamReferenceErrors` | 30 |
| [tools/package-build/surface.ts:62](../../../tools/package-build/surface.ts#L62) | `exportedNames` | 30 |
| [packages/engine/runtime/src/filter-state.ts:89](../../../packages/engine/runtime/src/filter-state.ts#L89) | `createFilterState/blocked` | 29 |
| [packages/page/src/presentation-policy.ts:64](../../../packages/page/src/presentation-policy.ts#L64) | `presentationPolicyErrors` | 29 |
| [packages/data-execution/src/filter-values.ts:86](../../../packages/data-execution/src/filter-values.ts#L86) | `initialValue` | 28 |
| [packages/engine/widgets/src/components/bar-chart/options.ts:95](../../../packages/engine/widgets/src/components/bar-chart/options.ts#L95) | `barOption/<anonymous@95:31>` | 28 |
| [packages/page/src/condition.ts:71](../../../packages/page/src/condition.ts#L71) | `testConditionValue` | 28 |
| [packages/page/src/filter-dependencies.ts:21](../../../packages/page/src/filter-dependencies.ts#L21) | `filterExtensionErrors` | 28 |
| [packages/data-execution/src/compute/snapshots.ts:16](../../../packages/data-execution/src/compute/snapshots.ts#L16) | `computedSnapshots/visit` | 27 |
| [packages/engine/widgets/src/components/map-chart/options.ts:65](../../../packages/engine/widgets/src/components/map-chart/options.ts#L65) | `mapOption` | 27 |
| [packages/page/src/chart-option.ts:77](../../../packages/page/src/chart-option.ts#L77) | `chartOptionErrorsFor/visit` | 27 |
| [packages/page/src/resolve-page-params.ts:70](../../../packages/page/src/resolve-page-params.ts#L70) | `materializePageParams` | 27 |
| [tools/dqe-sim/src/table-search-options.ts:10](../../../tools/dqe-sim/src/table-search-options.ts#L10) | `executeTableSearchOptions` | 27 |
| [packages/engine/runtime/src/orchestrator.ts:39](../../../packages/engine/runtime/src/orchestrator.ts#L39) | `orchestrate/start` | 26 |
| [packages/engine/runtime-ui/src/report-pdf-png.ts:10](../../../packages/engine/runtime-ui/src/report-pdf-png.ts#L10) | `opaquePngStream` | 25 |
| [packages/page/src/page.ts:368](../../../packages/page/src/page.ts#L368) | `deriveComponentCapabilities` | 25 |
| [packages/page/src/period-filter.ts:18](../../../packages/page/src/period-filter.ts#L18) | `resolvePeriodSelection` | 25 |
| [packages/page/src/time-filter-boundary.ts:19](../../../packages/page/src/time-filter-boundary.ts#L19) | `timeFilterBoundaryError` | 25 |
| [packages/engine/runtime/src/navigate.ts:7](../../../packages/engine/runtime/src/navigate.ts#L7) | `navigationHref` | 24 |
| [packages/page/src/presentation-edit.ts:11](../../../packages/page/src/presentation-edit.ts#L11) | `presentationTarget` | 24 |
| [apps/platform/src/lib/page-assets/management.ts:15](../../../apps/platform/src/lib/page-assets/management.ts#L15) | `createAssetManagement/run` | 23 |
| [packages/engine/runtime-ui/src/export-render-state.ts:39](../../../packages/engine/runtime-ui/src/export-render-state.ts#L39) | `exportComponentData` | 23 |
| [packages/engine/runtime/src/dimension-values.ts:78](../../../packages/engine/runtime/src/dimension-values.ts#L78) | `createDimensionValuesLoader/start` | 23 |
| [packages/page/src/chart-option.ts:43](../../../packages/page/src/chart-option.ts#L43) | `chartOptionErrorsFor` | 23 |
| [apps/platform/src/lib/workbench/publication-fixture.ts:20](../../../apps/platform/src/lib/workbench/publication-fixture.ts#L20) | `createPublicationFixture/mutate` | 22 |
| [packages/data-execution/src/candidate-validation.ts:24](../../../packages/data-execution/src/candidate-validation.ts#L24) | `createCandidateValidator/selection` | 22 |
| [packages/data-execution/src/filter-candidates.ts:13](../../../packages/data-execution/src/filter-candidates.ts#L13) | `filterCandidatesRequest` | 22 |
| [packages/engine/runtime-ui/src/report-pdf-worker-entry.ts:12](../../../packages/engine/runtime-ui/src/report-pdf-worker-entry.ts#L12) | `port.onmessage` | 22 |
| [packages/engine/runtime/src/orchestrator.ts:125](../../../packages/engine/runtime/src/orchestrator.ts#L125) | `orchestrate/start/<anonymous@125:44>` | 22 |
| [packages/page/src/filter.ts:416](../../../packages/page/src/filter.ts#L416) | `parseCalendarValue` | 22 |
| [packages/ui/src/components/date-picker/calendar.ts:73](../../../packages/ui/src/components/date-picker/calendar.ts#L73) | `calendarValueError` | 22 |
| [tools/design-facts/src/html-scan.ts:77](../../../tools/design-facts/src/html-scan.ts#L77) | `scanElements` | 22 |
| [tools/dqe-sim/src/execute.ts:1017](../../../tools/dqe-sim/src/execute.ts#L1017) | `executeSalesAnalytics` | 22 |
| [apps/platform/src/lib/workbench/component-selection.ts:144](../../../apps/platform/src/lib/workbench/component-selection.ts#L144) | `hardGateReasons` | 21 |
| [packages/data-execution/src/paged-join/export.ts:9](../../../packages/data-execution/src/paged-join/export.ts#L9) | `exportPagedJoin` | 21 |
| [packages/page/src/chart-option.ts:22](../../../packages/page/src/chart-option.ts#L22) | `jsonErrors` | 21 |
| [packages/page/src/filter-text-value.ts:18](../../../packages/page/src/filter-text-value.ts#L18) | `initialFilterTextValues` | 21 |
| [packages/page/src/query.ts:287](../../../packages/page/src/query.ts#L287) | `initializeQueryParams` | 21 |
| [tools/scripts/page-reference.ts:101](../../../tools/scripts/page-reference.ts#L101) | `referenceNodes/walk` | 21 |
| [apps/playground/src/lib/ioc-header-preview-inputs.ts:37](../../../apps/playground/src/lib/ioc-header-preview-inputs.ts#L37) | `candidates` | 20 |
| [tools/dqe-sim/src/semantic-surface-execute.ts:50](../../../tools/dqe-sim/src/semantic-surface-execute.ts#L50) | `runSemanticSurface` | 20 |
| [apps/platform/src/lib/workbench/authoring-publication.ts:67](../../../apps/platform/src/lib/workbench/authoring-publication.ts#L67) | `createAuthoringPublication/consume` | 19 |
| [packages/data-execution/src/compute/time-fill.ts:11](../../../packages/data-execution/src/compute/time-fill.ts#L11) | `timeFill` | 19 |
| [packages/engine/runtime-ui/src/ai-summary/markdown.ts:18](../../../packages/engine/runtime-ui/src/ai-summary/markdown.ts#L18) | `parseSafeMarkdown` | 19 |
| [packages/engine/runtime-ui/src/filter-text.ts:14](../../../packages/engine/runtime-ui/src/filter-text.ts#L14) | `filterText` | 19 |
| [packages/engine/runtime-ui/src/filters/time-controls.ts:4](../../../packages/engine/runtime-ui/src/filters/time-controls.ts#L4) | `timeControlLimits` | 19 |
| [packages/engine/widgets/src/components/bar-chart/options.ts:26](../../../packages/engine/widgets/src/components/bar-chart/options.ts#L26) | `barOption` | 19 |
| [packages/page/src/metric-before.ts:12](../../../packages/page/src/metric-before.ts#L12) | `metricBeforeErrors/<anonymous@12:36>` | 19 |
| [packages/page/src/navigate.ts:78](../../../packages/page/src/navigate.ts#L78) | `filterURLKeys` | 19 |
| [packages/page/src/page-param.ts:304](../../../packages/page/src/page-param.ts#L304) | `matchesParamDeclaration` | 19 |
| [packages/page/src/presentation-edit.ts:43](../../../packages/page/src/presentation-edit.ts#L43) | `presentationTargets/<anonymous@43:34>` | 19 |
| [packages/page/src/text-value.ts:54](../../../packages/page/src/text-value.ts#L54) | `resolveTexts` | 19 |
| [packages/ui/src/components/date-picker/calendar.ts:61](../../../packages/ui/src/components/date-picker/calendar.ts#L61) | `calendarDraft` | 19 |
| [tools/dqe-sim/src/execute.ts:184](../../../tools/dqe-sim/src/execute.ts#L184) | `executeExactScenarios` | 19 |
| [tools/scripts/page-reference.ts:152](../../../tools/scripts/page-reference.ts#L152) | `minimalExample` | 19 |
| [apps/platform/src/lib/workbench/report-date-edit.ts:13](../../../apps/platform/src/lib/workbench/report-date-edit.ts#L13) | `dateBindingChoices/<anonymous@13:58>` | 18 |
| [packages/data-execution/src/paged-join/plan.ts:8](../../../packages/data-execution/src/paged-join/plan.ts#L8) | `compilePagedJoin` | 18 |
| [packages/engine/runtime-ui/src/report-capture-view.ts:6](../../../packages/engine/runtime-ui/src/report-capture-view.ts#L6) | `copyPdfView` | 18 |
| [packages/engine/runtime/src/filter-state.ts:428](../../../packages/engine/runtime/src/filter-state.ts#L428) | `validShape` | 18 |
| [packages/page/src/amount-validation.ts:41](../../../packages/page/src/amount-validation.ts#L41) | `moneyComputeErrors` | 18 |
| [packages/page/src/materialize.ts:105](../../../packages/page/src/materialize.ts#L105) | `queryRowIssueError` | 18 |
| [packages/page/src/query-result-where.ts:20](../../../packages/page/src/query-result-where.ts#L20) | `queryResultWhereErrors/visit` | 18 |
| [packages/page/src/query-result-where.ts:67](../../../packages/page/src/query-result-where.ts#L67) | `filterQueryResultRows/match` | 18 |
| [tools/dqe-sim/src/chart-local-filter.ts:5](../../../tools/dqe-sim/src/chart-local-filter.ts#L5) | `executeChartLocalFilter` | 18 |
| [tools/dqe-sim/src/execute.ts:532](../../../tools/dqe-sim/src/execute.ts#L532) | `executeIocOpportunityList` | 18 |
| [tools/scripts/page-reference.ts:226](../../../tools/scripts/page-reference.ts#L226) | `branchWitnesses/visit` | 18 |
| [apps/platform/src/lib/workbench/document-edit.ts:284](../../../apps/platform/src/lib/workbench/document-edit.ts#L284) | `authoringSectionsOf` | 17 |
| [apps/platform/src/lib/workbench/work-session.ts:40](../../../apps/platform/src/lib/workbench/work-session.ts#L40) | `createWorkSession/restore` | 17 |
| [packages/data-execution/src/filter-candidates.ts:28](../../../packages/data-execution/src/filter-candidates.ts#L28) | `validFilterCandidates` | 17 |
| [packages/engine/runtime-ui/src/report-capture-view.ts:74](../../../packages/engine/runtime-ui/src/report-capture-view.ts#L74) | `freezeGradientText` | 17 |
| [packages/engine/runtime-ui/src/report-pdf-client.ts:29](../../../packages/engine/runtime-ui/src/report-pdf-client.ts#L29) | `encodeReport` | 17 |
| [packages/engine/runtime/src/filter-state.ts:55](../../../packages/engine/runtime/src/filter-state.ts#L55) | `createFilterState` | 17 |
| [packages/engine/runtime/src/filter-state.ts:447](../../../packages/engine/runtime/src/filter-state.ts#L447) | `matchesDeclaration` | 17 |
| [packages/engine/runtime/src/navigate.ts:34](../../../packages/engine/runtime/src/navigate.ts#L34) | `filterPart` | 17 |
| [packages/engine/runtime/src/orchestrator.ts:89](../../../packages/engine/runtime/src/orchestrator.ts#L89) | `orchestrate/start/refetch` | 17 |
| [packages/metric-canvas/src/authoring-layout.ts:35](../../../packages/metric-canvas/src/authoring-layout.ts#L35) | `resolveAuthoringSections` | 17 |
| [packages/page/src/amount-filter.ts:4](../../../packages/page/src/amount-filter.ts#L4) | `numberRangeIssue` | 17 |
| [packages/page/src/condition.ts:61](../../../packages/page/src/condition.ts#L61) | `conditionTestTypeError` | 17 |
| [packages/page/src/text-value.ts:83](../../../packages/page/src/text-value.ts#L83) | `resolveTexts/visit` | 17 |
| [tools/dqe-sim/src/execute.ts:696](../../../tools/dqe-sim/src/execute.ts#L696) | `executeInspectionDetail` | 17 |
| [apps/platform/src/lib/workbench/parameter-instance.ts:29](../../../apps/platform/src/lib/workbench/parameter-instance.ts#L29) | `createParameterInstanceSession/open` | 16 |
| [packages/data-execution/src/dqe/dqe.ts:805](../../../packages/data-execution/src/dqe/dqe.ts#L805) | `gatewayNormalizationError` | 16 |
| [packages/data-execution/src/filter-values.ts:66](../../../packages/data-execution/src/filter-values.ts#L66) | `initialFilterValues` | 16 |
| [packages/data-execution/src/paged-join/execute.ts:9](../../../packages/data-execution/src/paged-join/execute.ts#L9) | `executePagedJoin` | 16 |
| [packages/embed/tests/browser/presentation.spec.ts:92](../../../packages/embed/tests/browser/presentation.spec.ts#L92) | `inaccessibleText/<anonymous@92:55>/<anonymous@92:78>` | 16 |
| [packages/engine/runtime-ui/src/ai-summary/session.ts:50](../../../packages/engine/runtime-ui/src/ai-summary/session.ts#L50) | `createAiSummarySession/start/<anonymous@50:11>` | 16 |
| [packages/engine/runtime/src/presentation.ts:25](../../../packages/engine/runtime/src/presentation.ts#L25) | `compilePresentation/evaluate/component` | 16 |
| [packages/engine/widgets/src/shared/chart-presentation.ts:39](../../../packages/engine/widgets/src/shared/chart-presentation.ts#L39) | `cartesianFrame` | 16 |
| [packages/metric-canvas/src/selection-actions.ts:9](../../../packages/metric-canvas/src/selection-actions.ts#L9) | `observeSelectionActions/update` | 16 |
| [packages/page/src/legacy-compatibility.ts:54](../../../packages/page/src/legacy-compatibility.ts#L54) | `adaptTarget` | 16 |
| [packages/page/src/page.ts:330](../../../packages/page/src/page.ts#L330) | `derivePageCapabilities` | 16 |
| [packages/page/src/query-param-references.ts:94](../../../packages/page/src/query-param-references.ts#L94) | `resolveQueryParamReferences` | 16 |
| [packages/page/src/resolve-page-params.ts:113](../../../packages/page/src/resolve-page-params.ts#L113) | `changedParamSourceIds` | 16 |
| [packages/page/src/time-param.ts:25](../../../packages/page/src/time-param.ts#L25) | `resolveTimeWindow` | 16 |
| [tools/dqe-sim/src/execute.ts:795](../../../tools/dqe-sim/src/execute.ts#L795) | `executeCustomerActivityRisk` | 16 |

## 全部 259 条原始条目对照

“当前/内部最大”分别是匹配函数自身 CC 和其函数族内最大自身 CC。原报告 CC 只用于追溯，不与本地口径直接相减。同名定位只确认当前代码存在；不能据此推定历史迁移含义。缺失条目继续待核。

| # | 原文件 | 原函数 | 原报告 CC | 当前/内部最大 | 状态 |
|---:|---|---|---:|---|---|
| 1 | [apps/platform/src/lib/workbench/authoring-coordinator.ts:56](../../../apps/platform/src/lib/workbench/authoring-coordinator.ts#L56) | `createAuthoringCoordinator` | 338 | 1 / 15 | 当前范围达标 |
| 2 | [apps/platform/src/lib/workbench/authoring-sync.ts:56](../../../apps/platform/src/lib/workbench/authoring-sync.ts#L56) | `createAuthoringSync` | 177 | 7 / 15 | 当前范围达标 |
| 3 | [packages/page/src/validate.ts:1322](../../../packages/page/src/validate.ts#L1322) | `componentErrors` | 138 | 4 / 15 | 当前范围达标 |
| 4 | [apps/platform/src/lib/workbench/authoring-language.ts:56](../../../apps/platform/src/lib/workbench/authoring-language.ts#L56) | `createAuthoringLanguage` | 127 | 1 / 15 | 当前范围达标 |
| 5 | [packages/engine/runtime/src/filter-state.ts:55](../../../packages/engine/runtime/src/filter-state.ts#L55) | `createFilterState` | 120 | 17 / 42 | 仍超限 |
| 6 | [apps/platform/src/lib/workbench/authoring-language-recovery.ts:34](../../../apps/platform/src/lib/workbench/authoring-language-recovery.ts#L34) | `createAuthoringLanguageRecovery` | 104 | 1 / 13 | 当前范围达标 |
| 7 | [packages/page/src/validate-paged-join.ts:18](../../../packages/page/src/validate-paged-join.ts#L18) | `pagedJoinErrors` | 103 | 3 / 3 | 当前范围达标 |
| 8 | [packages/page/src/extract-page-params.ts:40](../../../packages/page/src/extract-page-params.ts#L40) | `applyPageParamSelection` | 103 | 1 / 1 | 当前范围达标 |
| 9 | [packages/data-execution/src/source-program/session.ts:51](../../../packages/data-execution/src/source-program/session.ts#L51) | `createSourceProgram` | 101 | 10 / 15 | 当前范围达标 |
| 10 | [packages/page/src/report-date-filters.ts:17](../../../packages/page/src/report-date-filters.ts#L17) | `reportDateFilterErrors` | 100 | 8 / 8 | 当前范围达标 |
| 11 | [packages/engine/runtime/src/orchestrator.ts:30](../../../packages/engine/runtime/src/orchestrator.ts#L30) | `orchestrate` | 95 | 5 / 26 | 仍超限 |
| 12 | [packages/data-execution/src/effective-query.ts:22](../../../packages/data-execution/src/effective-query.ts#L22) | `composeEffectiveQuery` | 94 | 10 / 10 | 当前范围达标 |
| 13 | [packages/page/src/validate.ts:1040](../../../packages/page/src/validate.ts#L1040) | `computeErrors` | 90 | 7 / 14 | 当前范围达标 |
| 14 | [packages/engine/runtime/src/execution.ts:50](../../../packages/engine/runtime/src/execution.ts#L50) | `prepareExecution` | 88 | 6 / 6 | 当前范围达标 |
| 15 | [packages/page/src/validate.ts:301](../../../packages/page/src/validate.ts#L301) | `invariantErrors` | 84 | 15 / 15 | 当前范围达标 |
| 16 | [apps/platform/src/lib/workbench/property-edit.ts:92](../../../apps/platform/src/lib/workbench/property-edit.ts#L92) | `editProperty` | 81 | 15 / 15 | 当前范围达标 |
| 17 | [packages/page/src/param-bindings.ts:13](../../../packages/page/src/param-bindings.ts#L13) | `paramBindingErrors` | 81 | 7 / 7 | 当前范围达标 |
| 18 | [packages/engine/runtime/src/filter-state.ts:235](../../../packages/engine/runtime/src/filter-state.ts#L235) | `normalize` | 80 | 10 / 10 | 当前范围达标 |
| 19 | [packages/page/src/validate-compute-dependencies.ts:16](../../../packages/page/src/validate-compute-dependencies.ts#L16) | `crossSourceComputeErrors` | 79 | 2 / 3 | 当前范围达标 |
| 20 | [packages/page/src/time-extension-validation.ts:6](../../../packages/page/src/time-extension-validation.ts#L6) | `timeExtensionErrors` | 75 | 97 / 97 | 仍超限 |
| 21 | [apps/platform/src/lib/page-assets/java-adapter.ts:55](../../../apps/platform/src/lib/page-assets/java-adapter.ts#L55) | `createPageAssetsClient` | 74 | 1 / 15 | 当前范围达标 |
| 22 | [metriccanvas-authoring/contracts/authored/publication-contract.ts:153](../../../metriccanvas-authoring/contracts/authored/publication-contract.ts#L153) | `validateCandidateRelations` | 72 | 11 / 13 | 当前范围达标 |
| 23 | [packages/page/src/presentation-policy.ts:64](../../../packages/page/src/presentation-policy.ts#L64) | `presentationPolicyErrors` | 66 | 29 / 34 | 仍超限 |
| 24 | [packages/data-execution/src/dqe/dqe.ts:157](../../../packages/data-execution/src/dqe/dqe.ts#L157) | `createDqeGateway` | 65 | 1 / 12 | 当前范围达标 |
| 25 | [tools/scripts/page-reference.ts:245](../../../tools/scripts/page-reference.ts#L245) | `buildPageReference` | 65 | 60 / 60 | 仍超限 |
| 26 | [apps/platform/src/lib/workbench/authoring-publication.ts:38](../../../apps/platform/src/lib/workbench/authoring-publication.ts#L38) | `createAuthoringPublication` | 65 | 1 / 19 | 仍超限 |
| 27 | [apps/platform/src/lib/workbench/authoring-recovery.ts:21](../../../apps/platform/src/lib/workbench/authoring-recovery.ts#L21) | `validateAuthoringRecord` | 64 | 14 / 14 | 当前范围达标 |
| 28 | [packages/page/src/query-param-references.ts:14](../../../packages/page/src/query-param-references.ts#L14) | `queryParamReferenceErrors` | 64 | 30 / 30 | 仍超限 |
| 29 | [packages/page/src/extract-page-params.ts:32](../../../packages/page/src/extract-page-params.ts#L32) | `extractPageParams` | 60 | 3 / 3 | 当前范围达标 |
| 30 | [packages/engine/widgets/src/components/bar-chart/options.ts:26](../../../packages/engine/widgets/src/components/bar-chart/options.ts#L26) | `barOption` | 60 | 19 / 28 | 仍超限 |
| 31 | [tools/dqe-sim/src/query-result-where.ts:9](../../../tools/dqe-sim/src/query-result-where.ts#L9) | `executeQueryResultWhere` | 58 | 51 / 51 | 仍超限 |
| 32 | [packages/page/src/chart-option.ts:43](../../../packages/page/src/chart-option.ts#L43) | `chartOptionErrorsFor` | 55 | 23 / 27 | 仍超限 |
| 33 | [packages/engine/runtime-ui/src/table-controller.ts:22](../../../packages/engine/runtime-ui/src/table-controller.ts#L22) | `createTableController` | 52 | 1 / 9 | 当前范围达标 |
| 34 | [apps/platform/src/lib/workbench/report-date-edit.ts:24](../../../apps/platform/src/lib/workbench/report-date-edit.ts#L24) | `editReportDate` | 49 | 50 / 50 | 仍超限 |
| 35 | [packages/page/src/validate-query-results.ts:12](../../../packages/page/src/validate-query-results.ts#L12) | `queryResultBindingErrors` | 48 | 9 / 12 | 当前范围达标 |
| 36 | [apps/platform/src/lib/workbench/property-edit.ts:35](../../../apps/platform/src/lib/workbench/property-edit.ts#L35) | `propertyControls` | 48 | 13 / 13 | 当前范围达标 |
| 37 | [tools/scripts/export-authoring-contracts.ts:578](../../../tools/scripts/export-authoring-contracts.ts#L578) | `buildSkillProjections` | 47 | 53 / 53 | 仍超限 |
| 38 | [packages/engine/runtime/src/detail-view.ts:7](../../../packages/engine/runtime/src/detail-view.ts#L7) | `detailViewInput` | 47 | 5 / 5 | 当前范围达标 |
| 39 | [apps/platform/src/lib/integration/navigation.ts:6](../../../apps/platform/src/lib/integration/navigation.ts#L6) | `createPlatformNavigation` | 46 | 1 / 13 | 当前范围达标 |
| 40 | [packages/engine/runtime/src/dimension-values.ts:61](../../../packages/engine/runtime/src/dimension-values.ts#L61) | `createDimensionValuesLoader` | 45 | 1 / 23 | 仍超限 |
| 41 | `packages/page/src/chart-filter.ts` | `chartFilterErrors` | 45 | — | 文件不存在 |
| 42 | [packages/data-execution/src/candidate-validation.ts:8](../../../packages/data-execution/src/candidate-validation.ts#L8) | `createCandidateValidator` | 44 | 2 / 30 | 仍超限 |
| 43 | [tools/dqe-sim/src/multi-query-table.ts:11](../../../tools/dqe-sim/src/multi-query-table.ts#L11) | `executeMultiQueryTable` | 43 | 49 / 49 | 仍超限 |
| 44 | [apps/platform/scripts/dev-page-assets.ts:97](../../../apps/platform/scripts/dev-page-assets.ts#L97) | `handle` | 42 | 41 / 41 | 仍超限 |
| 45 | [packages/data-execution/src/compute/time-fill.ts:11](../../../packages/data-execution/src/compute/time-fill.ts#L11) | `timeFill` | 41 | 19 / 19 | 仍超限 |
| 46 | [packages/page/src/validate.ts:1967](../../../packages/page/src/validate.ts#L1967) | `queryPaginationErrors` | 41 | 5 / 13 | 当前范围达标 |
| 47 | [packages/engine/runtime/src/filter-state.ts:325](../../../packages/engine/runtime/src/filter-state.ts#L325) | `parseFilterSearch` | 41 | 10 / 10 | 当前范围达标 |
| 48 | [metriccanvas-authoring/contracts/authored/authoring-turn-contract.ts:17](../../../metriccanvas-authoring/contracts/authored/authoring-turn-contract.ts#L17) | `matches` | 40 | 38 / 38 | 仍超限 |
| 49 | [tools/design-facts/src/extract.ts:179](../../../tools/design-facts/src/extract.ts#L179) | `extractDesignFacts` | 40 | 41 / 41 | 仍超限 |
| 50 | [packages/page/src/resolve-page-params.ts:25](../../../packages/page/src/resolve-page-params.ts#L25) | `resolvePageParams` | 39 | 35 / 35 | 仍超限 |
| 51 | [apps/platform/src/lib/workbench/work-session.ts:6](../../../apps/platform/src/lib/workbench/work-session.ts#L6) | `createWorkSession` | 39 | 2 / 17 | 仍超限 |
| 52 | [packages/data-execution/src/source-program/range-policy.ts:55](../../../packages/data-execution/src/source-program/range-policy.ts#L55) | `fetchComplete` | 39 | 13 / 13 | 当前范围达标 |
| 53 | [packages/engine/runtime/src/page-params.ts:12](../../../packages/engine/runtime/src/page-params.ts#L12) | `resolvePageParams` | 39 | 40 / 40 | 仍超限 |
| 54 | [packages/page/src/validate.ts:780](../../../packages/page/src/validate.ts#L780) | `queryContractErrors` | 39 | 9 / 14 | 当前范围达标 |
| 55 | [packages/page/src/amount-validation.ts:5](../../../packages/page/src/amount-validation.ts#L5) | `amountErrors` | 39 | 40 / 40 | 仍超限 |
| 56 | [tools/dqe-sim/src/business-sdt.ts:14](../../../tools/dqe-sim/src/business-sdt.ts#L14) | `executeBusinessSdt` | 39 | 38 / 38 | 仍超限 |
| 57 | [packages/engine/widgets/src/shared/semantic-html.ts:72](../../../packages/engine/widgets/src/shared/semantic-html.ts#L72) | `parseSemanticHtml` | 38 | 35 / 35 | 仍超限 |
| 58 | [packages/data-execution/src/query-result-inputs.ts:18](../../../packages/data-execution/src/query-result-inputs.ts#L18) | `resolveQueryResultInputs` | 38 | 11 / 11 | 当前范围达标 |
| 59 | [packages/page/src/navigate.ts:18](../../../packages/page/src/navigate.ts#L18) | `navigationErrors` | 36 | 3 / 31 | 仍超限 |
| 60 | [packages/data-execution/src/paged-join/plan.ts:8](../../../packages/data-execution/src/paged-join/plan.ts#L8) | `compilePagedJoin` | 36 | 18 / 18 | 仍超限 |
| 61 | [tools/dqe-sim/src/table-search-options.ts:10](../../../tools/dqe-sim/src/table-search-options.ts#L10) | `executeTableSearchOptions` | 36 | 27 / 27 | 仍超限 |
| 62 | [tools/scripts/audit-page-presentation.ts:31](../../../tools/scripts/audit-page-presentation.ts#L31) | `auditPresentation` | 36 | 8 / 9 | 当前范围达标 |
| 63 | [packages/page/src/text-value.ts:54](../../../packages/page/src/text-value.ts#L54) | `resolveTexts` | 35 | 19 / 19 | 仍超限 |
| 64 | [packages/engine/widgets/src/components/map-chart/options.ts:65](../../../packages/engine/widgets/src/components/map-chart/options.ts#L65) | `mapOption` | 34 | 27 / 27 | 仍超限 |
| 65 | [packages/page/src/page-param.ts:217](../../../packages/page/src/page-param.ts#L217) | `pageParamErrors` | 34 | 13 / 13 | 当前范围达标 |
| 66 | [apps/platform/src/lib/page-assets/management.ts:9](../../../apps/platform/src/lib/page-assets/management.ts#L9) | `createAssetManagement` | 34 | 1 / 23 | 仍超限 |
| 67 | [packages/data-execution/src/page-params.ts:15](../../../packages/data-execution/src/page-params.ts#L15) | `seedPageParamFilters` | 33 | 30 / 30 | 仍超限 |
| 68 | [apps/platform/src/lib/integration/routes.ts:19](../../../apps/platform/src/lib/integration/routes.ts#L19) | `resolvePlatformRoute` | 32 | 39 / 39 | 仍超限 |
| 69 | [packages/data-execution/src/compute/snapshots.ts:8](../../../packages/data-execution/src/compute/snapshots.ts#L8) | `computedSnapshots` | 32 | 2 / 27 | 仍超限 |
| 70 | [packages/page/src/filter-dependencies.ts:21](../../../packages/page/src/filter-dependencies.ts#L21) | `filterExtensionErrors` | 32 | 28 / 28 | 仍超限 |
| 71 | [tools/package-build/surface.ts:62](../../../tools/package-build/surface.ts#L62) | `exportedNames` | 32 | 30 / 30 | 仍超限 |
| 72 | [tools/scripts/verify-paged-join-real.ts:8](../../../tools/scripts/verify-paged-join-real.ts#L8) | `main` | 30 | 46 / 46 | 仍超限 |
| 73 | [packages/page/src/validate.ts:545](../../../packages/page/src/validate.ts#L545) | `filterDeclarationErrors` | 30 | 5 / 10 | 当前范围达标 |
| 74 | [packages/page/src/period-facts.ts:6](../../../packages/page/src/period-facts.ts#L6) | `periodFact` | 30 | 34 / 34 | 仍超限 |
| 75 | [packages/data-execution/src/filter-values.ts:86](../../../packages/data-execution/src/filter-values.ts#L86) | `initialValue` | 29 | 28 / 28 | 仍超限 |
| 76 | [packages/page/src/migrate-param-bindings.ts:10](../../../packages/page/src/migrate-param-bindings.ts#L10) | `migrateParamBindings` | 29 | 43 / 43 | 仍超限 |
| 77 | [packages/page/src/validate.ts:2348](../../../packages/page/src/validate.ts#L2348) | `actionErrors` | 29 | 4 / 13 | 当前范围达标 |
| 78 | [apps/platform/src/lib/dialogue/port.ts:47](../../../apps/platform/src/lib/dialogue/port.ts#L47) | `listenForSavedDrafts` | 28 | 1 / 11 | 当前范围达标 |
| 79 | [tools/dqe-sim/src/execute.ts:453](../../../tools/dqe-sim/src/execute.ts#L453) | `executeFlowAnalysisReport` | 28 | 39 / 39 | 仍超限 |
| 80 | [packages/engine/widgets/src/shared/value-format.ts:12](../../../packages/engine/widgets/src/shared/value-format.ts#L12) | `formatValue` | 28 | 32 / 32 | 仍超限 |
| 81 | [packages/engine/runtime-ui/src/ai-summary/session.ts:18](../../../packages/engine/runtime-ui/src/ai-summary/session.ts#L18) | `createAiSummarySession` | 27 | 1 / 16 | 仍超限 |
| 82 | [packages/engine/runtime-ui/src/table-workbook.ts:33](../../../packages/engine/runtime-ui/src/table-workbook.ts#L33) | `encodeTableWorkbook` | 27 | 5 / 11 | 当前范围达标 |
| 83 | [tools/dqe-sim/src/execute.ts:1017](../../../tools/dqe-sim/src/execute.ts#L1017) | `executeSalesAnalytics` | 27 | 22 / 22 | 仍超限 |
| 84 | [tools/scripts/migrate-url-navigation.ts:8](../../../tools/scripts/migrate-url-navigation.ts#L8) | `migrateURLNavigation` | 27 | 3 / 15 | 当前范围达标 |
| 85 | [tools/scripts/page-reference.ts:92](../../../tools/scripts/page-reference.ts#L92) | `referenceNodes` | 27 | 6 / 21 | 仍超限 |
| 86 | [packages/page/src/resolve-page-params.ts:70](../../../packages/page/src/resolve-page-params.ts#L70) | `materializePageParams` | 27 | 27 / 27 | 仍超限 |
| 87 | [packages/data-execution/src/paged-join/rows.ts:7](../../../packages/data-execution/src/paged-join/rows.ts#L7) | `memberRows` | 26 | 10 / 10 | 当前范围达标 |
| 88 | [packages/data-execution/src/query-runner.ts:13](../../../packages/data-execution/src/query-runner.ts#L13) | `createQueryRunner` | 26 | 1 / 11 | 当前范围达标 |
| 89 | [packages/engine/runtime-ui/src/ioc-header/model.ts:10](../../../packages/engine/runtime-ui/src/ioc-header/model.ts#L10) | `resolvedIocHeader` | 26 | 9 / 9 | 当前范围达标 |
| 90 | [tools/scripts/page-reference.ts:152](../../../tools/scripts/page-reference.ts#L152) | `minimalExample` | 26 | 19 / 19 | 仍超限 |
| 91 | [apps/platform/src/lib/workbench/inline-parameter-publication.ts:14](../../../apps/platform/src/lib/workbench/inline-parameter-publication.ts#L14) | `createInlineParameterPublication` | 25 | 1 / 14 | 当前范围达标 |
| 92 | [packages/page/src/validate.ts:103](../../../packages/page/src/validate.ts#L103) | `parsePage` | 25 | 32 / 32 | 仍超限 |
| 93 | [apps/platform/src/lib/workbench/application-modal.ts:2](../../../apps/platform/src/lib/workbench/application-modal.ts#L2) | `activateApplicationModal` | 25 | 10 / 10 | 当前范围达标 |
| 94 | [packages/engine/widgets/src/shared/chart-presentation.ts:39](../../../packages/engine/widgets/src/shared/chart-presentation.ts#L39) | `cartesianFrame` | 25 | 16 / 16 | 仍超限 |
| 95 | [packages/engine/runtime-ui/src/report-pdf-png.ts:10](../../../packages/engine/runtime-ui/src/report-pdf-png.ts#L10) | `opaquePngStream` | 25 | 25 / 25 | 仍超限 |
| 96 | [packages/page/src/query-rows.ts:62](../../../packages/page/src/query-rows.ts#L62) | `normalizeQueryRows` | 24 | 4 / 13 | 当前范围达标 |
| 97 | [packages/data-execution/src/paged-join/export.ts:9](../../../packages/data-execution/src/paged-join/export.ts#L9) | `exportPagedJoin` | 24 | 21 / 21 | 仍超限 |
| 98 | [tools/dqe-sim/src/semantic-surface-execute.ts:50](../../../tools/dqe-sim/src/semantic-surface-execute.ts#L50) | `runSemanticSurface` | 24 | 20 / 20 | 仍超限 |
| 99 | [packages/engine/runtime/src/navigate.ts:7](../../../packages/engine/runtime/src/navigate.ts#L7) | `navigationHref` | 23 | 24 / 24 | 仍超限 |
| 100 | [packages/page/src/presentation-policy.ts:13](../../../packages/page/src/presentation-policy.ts#L13) | `presentationPolicies` | 23 | 1 / 12 | 当前范围达标 |
| 101 | [packages/engine/runtime/src/navigate.ts:47](../../../packages/engine/runtime/src/navigate.ts#L47) | `resolveNavigationTarget` | 23 | 31 / 31 | 仍超限 |
| 102 | [packages/page/src/period-facts.ts:21](../../../packages/page/src/period-facts.ts#L21) | `timeAvailabilityIssue` | 23 | 36 / 36 | 仍超限 |
| 103 | [packages/page/src/period-filter.ts:18](../../../packages/page/src/period-filter.ts#L18) | `resolvePeriodSelection` | 23 | 25 / 25 | 仍超限 |
| 104 | [tools/design-facts/src/html-scan.ts:77](../../../tools/design-facts/src/html-scan.ts#L77) | `scanElements` | 23 | 22 / 22 | 仍超限 |
| 105 | [tools/scripts/local-authoring-projection.ts:54](../../../tools/scripts/local-authoring-projection.ts#L54) | `localValidatorOutputs` | 23 | 13 / 13 | 当前范围达标 |
| 106 | [packages/page/src/filter-text-value.ts:18](../../../packages/page/src/filter-text-value.ts#L18) | `initialFilterTextValues` | 23 | 21 / 21 | 仍超限 |
| 107 | [packages/metric-canvas/src/authoring-layout.ts:35](../../../packages/metric-canvas/src/authoring-layout.ts#L35) | `resolveAuthoringSections` | 22 | 17 / 17 | 仍超限 |
| 108 | [packages/metric-canvas/src/selection-actions.ts:2](../../../packages/metric-canvas/src/selection-actions.ts#L2) | `observeSelectionActions` | 22 | 3 / 16 | 仍超限 |
| 109 | [packages/page/src/filter.ts:416](../../../packages/page/src/filter.ts#L416) | `parseCalendarValue` | 22 | 22 / 22 | 仍超限 |
| 110 | [packages/page/src/chart-option.ts:22](../../../packages/page/src/chart-option.ts#L22) | `jsonErrors` | 22 | 21 / 21 | 仍超限 |
| 111 | [tools/scripts/export-authoring-contracts.ts:81](../../../tools/scripts/export-authoring-contracts.ts#L81) | `buildProductOutputs` | 22 | 15 / 15 | 当前范围达标 |
| 112 | [packages/data-execution/src/paged-join/execute.ts:9](../../../packages/data-execution/src/paged-join/execute.ts#L9) | `executePagedJoin` | 21 | 16 / 16 | 仍超限 |
| 113 | [packages/engine/runtime-ui/src/report-pdf-client.ts:29](../../../packages/engine/runtime-ui/src/report-pdf-client.ts#L29) | `encodeReport` | 21 | 17 / 17 | 仍超限 |
| 114 | [apps/platform/src/lib/workbench/parameter-instance.ts:16](../../../apps/platform/src/lib/workbench/parameter-instance.ts#L16) | `createParameterInstanceSession` | 21 | 2 / 16 | 仍超限 |
| 115 | [metriccanvas-authoring/contracts/authored/publication-contract.ts:264](../../../metriccanvas-authoring/contracts/authored/publication-contract.ts#L264) | `validateResultRelations` | 21 | 9 / 12 | 当前范围达标 |
| 116 | [tools/dqe-sim/src/execute.ts:532](../../../tools/dqe-sim/src/execute.ts#L532) | `executeIocOpportunityList` | 21 | 18 / 18 | 仍超限 |
| 117 | [apps/platform/src/lib/workbench/publication-fixture.ts:8](../../../apps/platform/src/lib/workbench/publication-fixture.ts#L8) | `createPublicationFixture` | 21 | 1 / 22 | 仍超限 |
| 118 | [packages/engine/widgets/src/components/table/filter-popover.ts:2](../../../packages/engine/widgets/src/components/table/filter-popover.ts#L2) | `tableFilterPopover` | 21 | 1 / 10 | 当前范围达标 |
| 119 | [packages/engine/runtime-ui/src/report-pdf-worker-entry.ts:12](../../../packages/engine/runtime-ui/src/report-pdf-worker-entry.ts#L12) | `port.onmessage` | 21 | 22 / 22 | 仍超限 |
| 120 | [packages/engine/widgets/src/components/line-chart/options.ts:16](../../../packages/engine/widgets/src/components/line-chart/options.ts#L16) | `lineOption` | 20 | 7 / 11 | 当前范围达标 |
| 121 | [packages/page/src/query-param-references.ts:94](../../../packages/page/src/query-param-references.ts#L94) | `resolveQueryParamReferences` | 20 | 16 / 16 | 仍超限 |
| 122 | [packages/page/src/query-result-where.ts:12](../../../packages/page/src/query-result-where.ts#L12) | `queryResultWhereErrors` | 20 | 2 / 18 | 仍超限 |
| 123 | [packages/page/src/field-selection.ts:52](../../../packages/page/src/field-selection.ts#L52) | `fieldSelectionErrors` | 20 | 1 / 15 | 当前范围达标 |
| 124 | [packages/page/src/metric-before.ts:9](../../../packages/page/src/metric-before.ts#L9) | `metricBeforeErrors` | 20 | 2 / 19 | 仍超限 |
| 125 | [packages/page/src/ioc-header.ts:6](../../../packages/page/src/ioc-header.ts#L6) | `iocHeaderErrors` | 20 | 7 / 7 | 当前范围达标 |
| 126 | [tools/dqe-sim/src/execute.ts:696](../../../tools/dqe-sim/src/execute.ts#L696) | `executeInspectionDetail` | 20 | 17 / 17 | 仍超限 |
| 127 | [apps/playground/src/lib/ioc-header-preview-inputs.ts:37](../../../apps/playground/src/lib/ioc-header-preview-inputs.ts#L37) | `candidates` | 20 | 20 / 20 | 仍超限 |
| 128 | [packages/engine/runtime-ui/src/report-capture-view.ts:74](../../../packages/engine/runtime-ui/src/report-capture-view.ts#L74) | `freezeGradientText` | 19 | 17 / 17 | 仍超限 |
| 129 | [tools/dqe-sim/src/execute.ts:184](../../../tools/dqe-sim/src/execute.ts#L184) | `executeExactScenarios` | 19 | 19 / 19 | 仍超限 |
| 130 | [apps/platform/src/lib/workbench/document-edit.ts:379](../../../apps/platform/src/lib/workbench/document-edit.ts#L379) | `clearBrokenMetricConnections` | 19 | 8 / 8 | 当前范围达标 |
| 131 | [packages/engine/runtime-ui/src/export-render-state.ts:39](../../../packages/engine/runtime-ui/src/export-render-state.ts#L39) | `exportComponentData` | 19 | 23 / 23 | 仍超限 |
| 132 | [tools/dqe-sim/src/chart-local-filter.ts:5](../../../tools/dqe-sim/src/chart-local-filter.ts#L5) | `executeChartLocalFilter` | 19 | 18 / 18 | 仍超限 |
| 133 | [packages/engine/runtime-ui/src/ai-summary/markdown.ts:18](../../../packages/engine/runtime-ui/src/ai-summary/markdown.ts#L18) | `parseSafeMarkdown` | 19 | 19 / 19 | 仍超限 |
| 134 | [packages/page/src/field-selection.ts:21](../../../packages/page/src/field-selection.ts#L21) | `projectComponentFields` | 19 | 3 / 30 | 仍超限 |
| 135 | [apps/platform/src/lib/page-assets.ts:10](../../../apps/platform/src/lib/page-assets.ts#L10) | `createPageAssetServices` | 19 | 2 / 8 | 当前范围达标 |
| 136 | [packages/page/src/materialize.ts:33](../../../packages/page/src/materialize.ts#L33) | `materializePageDocument` | 19 | 12 / 12 | 当前范围达标 |
| 137 | [packages/page/src/query.ts:287](../../../packages/page/src/query.ts#L287) | `initializeQueryParams` | 19 | 21 / 21 | 仍超限 |
| 138 | [tools/dqe-sim/src/execute.ts:312](../../../tools/dqe-sim/src/execute.ts#L312) | `applyDqeSort` | 18 | 11 / 11 | 当前范围达标 |
| 139 | [packages/page/src/validate.ts:2272](../../../packages/page/src/validate.ts#L2272) | `mapHierarchyErrors` | 18 | 15 / 15 | 当前范围达标 |
| 140 | [apps/platform/src/lib/dialogue/runtime.ts](../../../apps/platform/src/lib/dialogue/runtime.ts) | `panguChatOption` | 18 | — | 同名函数未找到 |
| 141 | [packages/data-execution/src/compute/join-aggregate.ts:8](../../../packages/data-execution/src/compute/join-aggregate.ts#L8) | `joinAggregate` | 18 | 13 / 13 | 当前范围达标 |
| 142 | [packages/engine/widgets/src/components/table/table-geometry.ts:2](../../../packages/engine/widgets/src/components/table/table-geometry.ts#L2) | `tableGeometry` | 18 | 1 / 15 | 当前范围达标 |
| 143 | [packages/data-execution/src/source-program/range-policy.ts:23](../../../packages/data-execution/src/source-program/range-policy.ts#L23) | `checkOrdinaryRange` | 18 | 13 / 13 | 当前范围达标 |
| 144 | [packages/engine/runtime/src/filter-state.ts:403](../../../packages/engine/runtime/src/filter-state.ts#L403) | `filterSearch` | 18 | 14 / 14 | 当前范围达标 |
| 145 | [apps/platform/src/lib/integration/session.ts:6](../../../apps/platform/src/lib/integration/session.ts#L6) | `createPlatformSession` | 17 | 3 / 9 | 当前范围达标 |
| 146 | [apps/platform/src/lib/workbench/component-selection.ts:144](../../../apps/platform/src/lib/workbench/component-selection.ts#L144) | `hardGateReasons` | 17 | 21 / 21 | 仍超限 |
| 147 | [packages/embed/tests/browser/presentation-fixtures.ts:10](../../../packages/embed/tests/browser/presentation-fixtures.ts#L10) | `presentationFixtures` | 17 | 1 / 14 | 当前范围达标 |
| 148 | [packages/engine/runtime-ui/src/report-png-encoder.ts:36](../../../packages/engine/runtime-ui/src/report-png-encoder.ts#L36) | `createPngEncoder` | 17 | 1 / 12 | 当前范围达标 |
| 149 | [packages/page/src/amount-filter.ts:4](../../../packages/page/src/amount-filter.ts#L4) | `numberRangeIssue` | 17 | 17 / 17 | 仍超限 |
| 150 | [packages/page/src/time-filter-boundary.ts:19](../../../packages/page/src/time-filter-boundary.ts#L19) | `timeFilterBoundaryError` | 17 | 25 / 25 | 仍超限 |
| 151 | [packages/data-execution/src/source-program/table-pagination.ts:8](../../../packages/data-execution/src/source-program/table-pagination.ts#L8) | `automaticQueryTableSources` | 17 | 6 / 8 | 当前范围达标 |
| 152 | [packages/engine/widgets/src/components/bar-chart/options.ts:279](../../../packages/engine/widgets/src/components/bar-chart/options.ts#L279) | `mixedOption` | 17 | 3 / 8 | 当前范围达标 |
| 153 | [packages/page/src/condition.ts:34](../../../packages/page/src/condition.ts#L34) | `filterInput` | 17 | 13 / 13 | 当前范围达标 |
| 154 | [packages/engine/runtime-ui/src/report-capture-view.ts:6](../../../packages/engine/runtime-ui/src/report-capture-view.ts#L6) | `copyPdfView` | 17 | 18 / 18 | 仍超限 |
| 155 | [packages/page/src/presentation-edit.ts:39](../../../packages/page/src/presentation-edit.ts#L39) | `presentationTargets` | 17 | 4 / 19 | 仍超限 |
| 156 | [apps/platform/src/lib/workbench/document-edit.ts:284](../../../apps/platform/src/lib/workbench/document-edit.ts#L284) | `authoringSectionsOf` | 17 | 17 / 17 | 仍超限 |
| 157 | [packages/ui/src/components/date-picker/calendar.ts:61](../../../packages/ui/src/components/date-picker/calendar.ts#L61) | `calendarDraft` | 17 | 19 / 19 | 仍超限 |
| 158 | [packages/data-execution/src/source-program/range-policy.ts:13](../../../packages/data-execution/src/source-program/range-policy.ts#L13) | `reusableInitialSnapshot` | 17 | 13 / 13 | 当前范围达标 |
| 159 | [packages/page/src/time-param.ts:25](../../../packages/page/src/time-param.ts#L25) | `resolveTimeWindow` | 16 | 16 / 16 | 仍超限 |
| 160 | [packages/page/src/navigate.ts:78](../../../packages/page/src/navigate.ts#L78) | `filterURLKeys` | 16 | 19 / 19 | 仍超限 |
| 161 | [tools/dqe-sim/src/execute.ts:795](../../../tools/dqe-sim/src/execute.ts#L795) | `executeCustomerActivityRisk` | 16 | 16 / 16 | 仍超限 |
| 162 | [packages/engine/runtime/src/filter-state.ts:290](../../../packages/engine/runtime/src/filter-state.ts#L290) | `sameValue` | 16 | 10 / 10 | 当前范围达标 |
| 163 | [packages/page/src/resolve-page-params.ts:113](../../../packages/page/src/resolve-page-params.ts#L113) | `changedParamSourceIds` | 16 | 16 / 16 | 仍超限 |
| 164 | [packages/ui/src/components/date-picker/calendar.ts:73](../../../packages/ui/src/components/date-picker/calendar.ts#L73) | `calendarValueError` | 16 | 22 / 22 | 仍超限 |
| 165 | [tools/scripts/local-authoring-validator.ts:31](../../../tools/scripts/local-authoring-validator.ts#L31) | `main` | 16 | 14 / 14 | 当前范围达标 |
| 166 | [apps/platform/src/lib/workbench/document-edit.ts:71](../../../apps/platform/src/lib/workbench/document-edit.ts#L71) | `unitOfDataSource` | 15 | 11 / 11 | 当前范围达标 |
| 167 | [apps/platform/src/lib/workbench/transient-page.ts:54](../../../apps/platform/src/lib/workbench/transient-page.ts#L54) | `workbenchPageViewModel` | 15 | 6 / 8 | 当前范围达标 |
| 168 | [metriccanvas-authoring/contracts/authored/publication-contract.ts:128](../../../metriccanvas-authoring/contracts/authored/publication-contract.ts#L128) | `parameterTargets` | 15 | 10 / 10 | 当前范围达标 |
| 169 | [packages/engine/runtime-ui/src/ai-summary/assemble-request.ts:27](../../../packages/engine/runtime-ui/src/ai-summary/assemble-request.ts#L27) | `assembleAiSummaryRequest` | 15 | 5 / 5 | 当前范围达标 |
| 170 | [packages/engine/runtime-ui/src/report-png-worker-entry.ts:9](../../../packages/engine/runtime-ui/src/report-png-worker-entry.ts#L9) | `port.onmessage` | 15 | 13 / 13 | 当前范围达标 |
| 171 | [packages/engine/runtime/src/presentation.ts:18](../../../packages/engine/runtime/src/presentation.ts#L18) | `compilePresentation` | 15 | 1 / 16 | 仍超限 |
| 172 | [apps/playground/src/lib/ioc-header-preview-inputs.ts:10](../../../apps/playground/src/lib/ioc-header-preview-inputs.ts#L10) | `currencyRows` | 15 | 11 / 11 | 当前范围达标 |
| 173 | [apps/playground/src/lib/ioc-header-preview-inputs.ts:65](../../../apps/playground/src/lib/ioc-header-preview-inputs.ts#L65) | `createIocHeaderPreview` | 15 | 1 / 8 | 当前范围达标 |
| 174 | `apps/playground/src/lib/page-catalog.ts` | `describePage` | 15 | — | 文件不存在 |
| 175 | [packages/page/src/legacy-compatibility.ts:54](../../../packages/page/src/legacy-compatibility.ts#L54) | `adaptTarget` | 15 | 16 / 16 | 仍超限 |
| 176 | [tools/scripts/page-reference.ts:220](../../../tools/scripts/page-reference.ts#L220) | `branchWitnesses` | 15 | 2 / 18 | 仍超限 |
| 177 | [packages/page/src/filter.ts:476](../../../packages/page/src/filter.ts#L476) | `validateTimePointValue` | 15 | 14 / 14 | 当前范围达标 |
| 178 | [packages/page/src/query-result-where.ts:51](../../../packages/page/src/query-result-where.ts#L51) | `filterQueryResultRows` | 15 | 6 / 18 | 仍超限 |
| 179 | [packages/engine/runtime/src/navigate.ts:34](../../../packages/engine/runtime/src/navigate.ts#L34) | `filterPart` | 15 | 17 / 17 | 仍超限 |
| 180 | [packages/page/src/materialize.ts:105](../../../packages/page/src/materialize.ts#L105) | `queryRowIssueError` | 15 | 18 / 18 | 仍超限 |
| 181 | [tools/scripts/local-authoring-projection.ts:12](../../../tools/scripts/local-authoring-projection.ts#L12) | `localPageReference` | 15 | 15 / 15 | 当前范围达标 |
| 182 | [packages/engine/runtime-ui/src/map-hierarchy.ts:54](../../../packages/engine/runtime-ui/src/map-hierarchy.ts#L54) | `filterMapRows` | 15 | 5 / 14 | 当前范围达标 |
| 183 | [packages/engine/runtime-ui/src/row-alignment.ts:28](../../../packages/engine/runtime-ui/src/row-alignment.ts#L28) | `alignRowTracks` | 14 | 11 / 11 | 当前范围达标 |
| 184 | [packages/page/src/condition.ts:47](../../../packages/page/src/condition.ts#L47) | `resolveInput` | 14 | 14 / 14 | 当前范围达标 |
| 185 | [packages/page/src/page.ts:368](../../../packages/page/src/page.ts#L368) | `deriveComponentCapabilities` | 14 | 25 / 25 | 仍超限 |
| 186 | [packages/data-execution/src/dqe/dqe.ts:805](../../../packages/data-execution/src/dqe/dqe.ts#L805) | `gatewayNormalizationError` | 14 | 16 / 16 | 仍超限 |
| 187 | [packages/page/src/version.ts:1100](../../../packages/page/src/version.ts#L1100) | `presentationCapabilityPaths` | 14 | 4 / 7 | 当前范围达标 |
| 188 | [tools/dqe-sim/src/execute.ts:659](../../../tools/dqe-sim/src/execute.ts#L659) | `executeInspectionProgress` | 14 | 14 / 14 | 当前范围达标 |
| 189 | [packages/data-execution/src/filter-candidates.ts:28](../../../packages/data-execution/src/filter-candidates.ts#L28) | `validFilterCandidates` | 14 | 17 / 17 | 仍超限 |
| 190 | [packages/engine/runtime-ui/src/table-state.ts:14](../../../packages/engine/runtime-ui/src/table-state.ts#L14) | `resetFilteredTablePages` | 14 | 10 / 10 | 当前范围达标 |
| 191 | [tools/dqe-sim/src/execute.ts:255](../../../tools/dqe-sim/src/execute.ts#L255) | `executeDimensionValuesQuery` | 14 | 14 / 14 | 当前范围达标 |
| 192 | [packages/engine/runtime-ui/src/filter-text.ts:14](../../../packages/engine/runtime-ui/src/filter-text.ts#L14) | `filterText` | 14 | 19 / 19 | 仍超限 |
| 193 | [packages/engine/runtime-ui/src/filters/time-controls.ts:4](../../../packages/engine/runtime-ui/src/filters/time-controls.ts#L4) | `timeControlLimits` | 14 | 19 / 19 | 仍超限 |
| 194 | [packages/engine/runtime-ui/src/table-export.ts:29](../../../packages/engine/runtime-ui/src/table-export.ts#L29) | `detailExportData` | 14 | 1 / 12 | 当前范围达标 |
| 195 | [packages/page/src/presentation-operation.ts:11](../../../packages/page/src/presentation-operation.ts#L11) | `applyPresentationOperation` | 14 | 14 / 14 | 当前范围达标 |
| 196 | [packages/page/src/condition.ts:91](../../../packages/page/src/condition.ts#L91) | `evaluateCondition` | 14 | 10 / 10 | 当前范围达标 |
| 197 | [packages/page/src/validate.ts:712](../../../packages/page/src/validate.ts#L712) | `rowContractError` | 14 | 14 / 14 | 当前范围达标 |
| 198 | [apps/platform/src/lib/workbench/component-building.ts:71](../../../apps/platform/src/lib/workbench/component-building.ts#L71) | `buildComponent` | 13 | 14 / 14 | 当前范围达标 |
| 199 | [apps/platform/src/lib/workbench/transient-page.ts:98](../../../apps/platform/src/lib/workbench/transient-page.ts#L98) | `adHocFormulasOf` | 13 | 13 / 13 | 当前范围达标 |
| 200 | [packages/embed/tests/browser/presentation.spec.ts:91](../../../packages/embed/tests/browser/presentation.spec.ts#L91) | `inaccessibleText` | 13 | 1 / 16 | 仍超限 |
| 201 | [packages/engine/runtime-ui/src/backdrop-safe-area.ts:51](../../../packages/engine/runtime-ui/src/backdrop-safe-area.ts#L51) | `backdropSafeArea` | 13 | 13 / 13 | 当前范围达标 |
| 202 | [packages/page/src/condition.ts:61](../../../packages/page/src/condition.ts#L61) | `conditionTestTypeError` | 13 | 17 / 17 | 仍超限 |
| 203 | [packages/data-execution/src/paged-join/member-query.ts:13](../../../packages/data-execution/src/paged-join/member-query.ts#L13) | `restrictKeys` | 13 | 12 / 12 | 当前范围达标 |
| 204 | [packages/engine/runtime-ui/src/filters/tree.ts:19](../../../packages/engine/runtime-ui/src/filters/tree.ts#L19) | `buildFilterTree` | 13 | 10 / 10 | 当前范围达标 |
| 205 | [packages/engine/widgets/src/components/table/rows.ts:14](../../../packages/engine/widgets/src/components/table/rows.ts#L14) | `alignTableRows` | 13 | 9 / 9 | 当前范围达标 |
| 206 | [packages/page/src/version.ts:1061](../../../packages/page/src/version.ts#L1061) | `namedFormatPaths` | 13 | 6 / 7 | 当前范围达标 |
| 207 | [tools/dqe-sim/src/execute.ts:152](../../../tools/dqe-sim/src/execute.ts#L152) | `executeDqeItem` | 13 | 15 / 15 | 当前范围达标 |
| 208 | [packages/data-execution/src/filter-values.ts:66](../../../packages/data-execution/src/filter-values.ts#L66) | `initialFilterValues` | 13 | 16 / 16 | 仍超限 |
| 209 | [packages/page/src/amount-validation.ts:41](../../../packages/page/src/amount-validation.ts#L41) | `moneyComputeErrors` | 13 | 18 / 18 | 仍超限 |
| 210 | [packages/data-execution/src/source-program/export-diagnostics.ts:23](../../../packages/data-execution/src/source-program/export-diagnostics.ts#L23) | `describeExportSource` | 13 | 1 / 14 | 当前范围达标 |
| 211 | [packages/page/src/validate.ts:2103](../../../packages/page/src/validate.ts#L2103) | `tableErrors` | 13 | 1 / 12 | 当前范围达标 |
| 212 | [apps/platform/src/lib/workbench/report-date-edit.ts:11](../../../apps/platform/src/lib/workbench/report-date-edit.ts#L11) | `dateBindingChoices` | 13 | 2 / 18 | 仍超限 |
| 213 | [packages/data-execution/src/execute.ts:11](../../../packages/data-execution/src/execute.ts#L11) | `createPageDataExecutor` | 13 | 1 / 15 | 当前范围达标 |
| 214 | [packages/engine/runtime-ui/src/widget-host-state.ts:109](../../../packages/engine/runtime-ui/src/widget-host-state.ts#L109) | `partialDataNotices` | 13 | 12 / 12 | 当前范围达标 |
| 215 | [apps/platform/src/lib/workbench/authoring-storage.ts:12](../../../apps/platform/src/lib/workbench/authoring-storage.ts#L12) | `createIndexedAuthoringStorage` | 12 | 1 / 3 | 当前范围达标 |
| 216 | [packages/engine/runtime/src/filter-state.ts:447](../../../packages/engine/runtime/src/filter-state.ts#L447) | `matchesDeclaration` | 12 | 17 / 17 | 仍超限 |
| 217 | [packages/page/src/parameter-program.ts:10](../../../packages/page/src/parameter-program.ts#L10) | `runPageParameterProgram` | 12 | 8 / 8 | 当前范围达标 |
| 218 | [packages/page/src/presentation-policy.ts:56](../../../packages/page/src/presentation-policy.ts#L56) | `filterSample` | 12 | 14 / 14 | 当前范围达标 |
| 219 | [packages/page/src/result-field-contract.ts:147](../../../packages/page/src/result-field-contract.ts#L147) | `recordListViolations` | 12 | 5 / 8 | 当前范围达标 |
| 220 | [tools/dqe-sim/src/execute.ts:361](../../../tools/dqe-sim/src/execute.ts#L361) | `applyMetricRangeFilters` | 12 | 12 / 12 | 当前范围达标 |
| 221 | [tools/dqe-sim/src/server.ts:34](../../../tools/dqe-sim/src/server.ts#L34) | `createDqeSimServer` | 12 | 5 / 5 | 当前范围达标 |
| 222 | [apps/platform/src/lib/page-assets/java-adapter.ts:375](../../../apps/platform/src/lib/page-assets/java-adapter.ts#L375) | `providerError` | 12 | 7 / 7 | 当前范围达标 |
| 223 | [packages/data-execution/src/dqe/dqe.ts:645](../../../packages/data-execution/src/dqe/dqe.ts#L645) | `encodedDqeItem` | 12 | 13 / 13 | 当前范围达标 |
| 224 | [packages/page/src/filter-dependencies.ts:11](../../../packages/page/src/filter-dependencies.ts#L11) | `dimensionSelectionIssue` | 12 | 11 / 11 | 当前范围达标 |
| 225 | [packages/page/src/page-param.ts:33](../../../packages/page/src/page-param.ts#L33) | `pageParamDeclarations` | 12 | 6 / 6 | 当前范围达标 |
| 226 | [tools/scripts/export-authoring-contracts.ts:692](../../../tools/scripts/export-authoring-contracts.ts#L692) | `assertCurrent` | 12 | 15 / 15 | 当前范围达标 |
| 227 | [packages/data-execution/src/compute/index.ts:40](../../../packages/data-execution/src/compute/index.ts#L40) | `applyOperator` | 12 | 8 / 8 | 当前范围达标 |
| 228 | [packages/engine/runtime/src/navigation-inputs.ts:19](../../../packages/engine/runtime/src/navigation-inputs.ts#L19) | `navigationInputIssue` | 12 | 12 / 12 | 当前范围达标 |
| 229 | [packages/page/src/validate.ts:219](../../../packages/page/src/validate.ts#L219) | `compositeCardStructureErrors` | 12 | 1 / 6 | 当前范围达标 |
| 230 | [tools/scripts/page-reference.ts:45](../../../tools/scripts/page-reference.ts#L45) | `excerptAt` | 12 | 11 / 11 | 当前范围达标 |
| 231 | [apps/platform/src/microfrontend/portal-config.ts:16](../../../apps/platform/src/microfrontend/portal-config.ts#L16) | `connectPortal` | 12 | 12 / 12 | 当前范围达标 |
| 232 | `apps/playground/src/lib/page-catalog.ts` | `filterPageCatalog` | 12 | — | 文件不存在 |
| 233 | [packages/data-execution/src/compute/index.ts:163](../../../packages/data-execution/src/compute/index.ts#L163) | `pivot` | 12 | 8 / 8 | 当前范围达标 |
| 234 | [packages/engine/widgets/src/components/pie-chart/options.ts:20](../../../packages/engine/widgets/src/components/pie-chart/options.ts#L20) | `pieOption` | 12 | 9 / 9 | 当前范围达标 |
| 235 | [packages/page/src/navigate.ts:108](../../../packages/page/src/navigate.ts#L108) | `declaredNavigationTargets` | 12 | 1 / 10 | 当前范围达标 |
| 236 | [apps/platform/src/lib/workbench/apply-page.ts:10](../../../apps/platform/src/lib/workbench/apply-page.ts#L10) | `listenForApplyPage` | 12 | 1 / 9 | 当前范围达标 |
| 237 | [packages/page/src/filter-text-value.ts:95](../../../packages/page/src/filter-text-value.ts#L95) | `applyFilterTextValues` | 12 | 6 / 6 | 当前范围达标 |
| 238 | [tools/scripts/export-authoring-contracts.ts:318](../../../tools/scripts/export-authoring-contracts.ts#L318) | `buildPageConformance` | 12 | 11 / 11 | 当前范围达标 |
| 239 | [packages/data-execution/src/dqe/dqe.ts:546](../../../packages/data-execution/src/dqe/dqe.ts#L546) | `dedupedDimensionValues` | 12 | 2 / 11 | 当前范围达标 |
| 240 | [packages/data-execution/src/filter-candidates.ts:13](../../../packages/data-execution/src/filter-candidates.ts#L13) | `filterCandidatesRequest` | 11 | 22 / 22 | 仍超限 |
| 241 | [packages/engine/runtime-ui/src/ai-summary/markdown.ts:84](../../../packages/engine/runtime-ui/src/ai-summary/markdown.ts#L84) | `parseInline` | 11 | 10 / 10 | 当前范围达标 |
| 242 | [packages/engine/runtime-ui/src/filters/tree.ts:85](../../../packages/engine/runtime-ui/src/filters/tree.ts#L85) | `buildExplicitTree` | 11 | 6 / 6 | 当前范围达标 |
| 243 | [tools/scripts/audit-page-presentation.ts:16](../../../tools/scripts/audit-page-presentation.ts#L16) | `extractPreview` | 11 | 5 / 6 | 当前范围达标 |
| 244 | [packages/engine/runtime-ui/src/report-png-client.ts:12](../../../packages/engine/runtime-ui/src/report-png-client.ts#L12) | `generateReportPng` | 11 | 9 / 9 | 当前范围达标 |
| 245 | [packages/engine/runtime-ui/src/report-view.ts:13](../../../packages/engine/runtime-ui/src/report-view.ts#L13) | `withReportView` | 11 | 13 / 13 | 当前范围达标 |
| 246 | [packages/page/src/filter-text-value.ts:55](../../../packages/page/src/filter-text-value.ts#L55) | `collectFilterTextValueReferences` | 11 | 1 / 11 | 当前范围达标 |
| 247 | [packages/page/src/legacy-compatibility.ts:8](../../../packages/page/src/legacy-compatibility.ts#L8) | `adaptLegacyPageDocument` | 11 | 11 / 11 | 当前范围达标 |
| 248 | [packages/page/src/navigate.ts:85](../../../packages/page/src/navigate.ts#L85) | `urlInputErrors` | 11 | 3 / 6 | 当前范围达标 |
| 249 | [tools/design-facts/src/class-tokens.ts:155](../../../tools/design-facts/src/class-tokens.ts#L155) | `categorizeArbitraryValue` | 11 | 11 / 11 | 当前范围达标 |
| 250 | [packages/application-runtime/src/runtime-config.ts:72](../../../packages/application-runtime/src/runtime-config.ts#L72) | `readPageAssetsRuntimeConfig` | 11 | 9 / 9 | 当前范围达标 |
| 251 | [packages/data-execution/src/program.ts:6](../../../packages/data-execution/src/program.ts#L6) | `gatewayConfig` | 11 | 11 / 11 | 当前范围达标 |
| 252 | [packages/embed/tests/browser/chart-echarts-option.spec.ts:9](../../../packages/embed/tests/browser/chart-echarts-option.spec.ts#L9) | `failText` | 11 | 1 / 8 | 当前范围达标 |
| 253 | [packages/data-execution/src/source-program/compiler.ts:4](../../../packages/data-execution/src/source-program/compiler.ts#L4) | `compileSources` | 11 | 7 / 7 | 当前范围达标 |
| 254 | [apps/platform/src/lib/page-assets/java-adapter.ts:30](../../../apps/platform/src/lib/page-assets/java-adapter.ts#L30) | `supportedFieldsOf` | 11 | 9 / 10 | 当前范围达标 |
| 255 | [apps/platform/src/lib/workbench/report-date-edit.ts:75](../../../apps/platform/src/lib/workbench/report-date-edit.ts#L75) | `pruneOwnedTimeParam` | 11 | 6 / 11 | 当前范围达标 |
| 256 | [packages/page/tests/hierarchy-binding-zero-usage.test.ts:54](../../../packages/page/tests/hierarchy-binding-zero-usage.test.ts#L54) | `flatBindingsOnHierarchy` | 11 | 5 / 5 | 当前范围达标 |
| 257 | [packages/application-runtime/src/runtime-config.ts:55](../../../packages/application-runtime/src/runtime-config.ts#L55) | `readRuntimeConfig` | 11 | 9 / 9 | 当前范围达标 |
| 258 | [packages/data-execution/src/source-program/range-policy.ts:47](../../../packages/data-execution/src/source-program/range-policy.ts#L47) | `correctedPageIndex` | 11 | 11 / 11 | 当前范围达标 |
| 259 | [packages/engine/runtime/src/filter-history.ts:13](../../../packages/engine/runtime/src/filter-history.ts#L13) | `createLastFilterRecorder` | 11 | 2 / 4 | 当前范围达标 |
