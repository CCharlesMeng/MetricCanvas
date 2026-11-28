/**
 * `@metriccanvas/page/internal` — 仓内自用的完整内部契约面，按 5 个子域与共享领域原语分区组织。
 * 对外集成应用只消费 `@metriccanvas/page`（见 `./index.ts`），`@metriccanvas/engine` 与
 * `@metriccanvas/embed` 的公开入口禁止导入或重导出本入口。
 */

// ---------------------------------------------------------------------------
// Shared domain primitives (page, document, field, filter, condition, table, snapshot, version)
// ---------------------------------------------------------------------------
export * from './ai-summary';
export * from './amount-filter';
export * from './bar-forecast-boundary';
export * from './canonical-json';
export * from './cell-fallback';
export * from './chart-option';
export * from './component-catalog';
export * from './component-value';
export {
  flattenPageComponents,
  walkComponents,
  walkDocumentComponents,
  walkPageComponents,
} from './component-walk';
export * from './compute';
export * from './condition';

// ---------------------------------------------------------------------------
// Subdomain: query (`./query/`)
// ---------------------------------------------------------------------------
export * from './data-source';
export * from './data-source-references';
export * from './display-query-rows';
export * from './dqe-object';
// ---------------------------------------------------------------------------
// Subdomain: validate (`./validate/`)
// ---------------------------------------------------------------------------
export * from './errors';
export { independentExclusionFilterIds } from './exclusion-filters';
export * from './field';
export * from './field-resolution';
export * from './field-selection';
export { fileNameErrors } from './file-name';
export * from './filter';
export {
  candidateDependencies,
  dimensionSelectionIssue,
  filterDependencies,
  filterExecutionDependencies,
  matchingDimensionDefault,
} from './filter-dependencies';
export { filterGroupOptions } from './filter-group';
export {
  filterOverrideTargets,
  IOC_KEY_OFFICE_FILTER_IDS,
  overriddenFilterIds,
} from './filter-overrides';
export * from './filter-text-value';
export * from './finalization-default';
// ---------------------------------------------------------------------------
// Subdomain: normalize (`./normalize/`)
// ---------------------------------------------------------------------------
export * from './header-binding';
export { assertNoQueryParamReferences } from './inline-query-params';
export {
  iocHeaderFilterIds,
  iocOfficeNavigation,
  standardIocRegionFilter,
} from './ioc-header-controls';
export * from './ioc-region-policy';
export { metricCardTipAnchor } from './metric-card';
export {
  NATIVE_IOC_SCHEMA_MINOR,
  nativeIocBindingTargets,
  nativeIocFilters,
  nativeIocRuntimePage,
  nativeSourceFilterIds,
  supportsNativePreparation,
} from './native-ioc';
export {
  declaredNavigationTargets,
  filterURLKeys,
  isNavigationHref,
  navigationErrors,
  readLevelURLSelection,
  tableColumnNavigation,
  urlInputErrors,
} from './navigate';
export { basicNumberFormat } from './number-format';
export * from './page';
export * from './page-document';
export * from './page-list-entry';
export * from './page-param';
export * from './paged-join';
export { pagedJoinHasComparison, pagedJoinProjectionFields } from './paged-join-compute';
export * from './paged-join-view';
export type { PagedUnionDataSource, PagedUnionMember, PagedUnionSource } from './paged-union';
export { unionMemberKeyFields, validUnionKeyPart } from './paged-union-identity';
// ---------------------------------------------------------------------------
// Subdomain: edit (`./edit/`)
// ---------------------------------------------------------------------------
export { type ParameterProgramRequest, runPageParameterProgram } from './parameter-program';
export type { PeriodAggregation, PeriodAggregationCase } from './period-aggregation';
export * from './period-comparison';
export * from './period-facts';
export * from './period-filter';
export * from './period-query';
export {
  hasPeriodQueryDefault,
  hasPeriodQueryDefault as hasIocPeriodDefault,
  withPeriodQueryDefaults,
  withPeriodQueryDefaults as withIocPeriodDefaults,
} from './period-query-defaults';
export * from './presentation-edit';
export * from './presentation-operation';
export * from './presentation-policy';
export * from './query';
export * from './query-dependencies';
export * from './query-error';
export { hasQueryParamReferences } from './query-param-references';
export * from './query-result-where';
export * from './query-rows';
export * from './query-selection';
export { normalizeQueryTime, QueryTimeRangeError } from './query-time';
export { reportExportScale } from './report-export';
export * from './resolve-page-params';
export * from './result-field-contract';
// ---------------------------------------------------------------------------
// Subdomain: schema (`./schema/`)
// ---------------------------------------------------------------------------
export { pageSchema } from './schema';
export { compositeCardChildTypes } from './schema/component';
export type { Condition, ConditionScalar } from './schema/condition';
export type { IocHeaderDeclaration } from './schema/ioc-header';
export {
  type MapGeography,
  type MapGeographyEntry,
  mapGeographyEntryZ,
} from './schema/map-geography';
export type { NavigationBinding, NavigationTarget } from './schema/navigation';
export type { CategoryLabels, ColorRule } from './schema/presentation';
export { semanticValueFormat } from './semantic-format';
export * from './snapshot';
export * from './source-candidates';
export * from './tab-state';
export { legacyTableCandidateSearch } from './table/candidate-search';
export * from './table/columns';
export * from './table/expansion';
export {
  hasHeaderDefaults,
  headerDefaultValues,
  tableDefaultsRemote,
} from './table/header-defaults';
export { tableHeaderInputErrors, tableHeaderParamReferences } from './table/header-params';
export * from './table/query-view';
export * from './table/search';
export { normalizeTableSelectValues, normalizeTableSelectView } from './table/select-values';
export * from './table/slot-search';
export * from './table-pinned';
export * from './text-value';
export { currentTimeValue, timeFilterBoundaryError } from './time-filter-boundary';
export * from './time-mode';
export * from './time-param';
export {
  normalizePageDocument,
  type PageParseOptions,
  type PageParseResult,
  parsePage,
  parseRuntimePage,
  validate,
} from './validate';
export * from './version';
