/** Lockstep engine integration; one-shot callers use the root entry. */
export {inheritFinalizationCache,invalidateFinalizationCache} from './finalization-cache';
export { composeEffectiveQuery, executeQuery } from './effective-query';
export type { QueryHeaderFilters } from './effective-query';
export { resolveQueryResultInputs } from './query-result-inputs';
export { preservedQueryError } from './query-error';
export { initialFilterValues } from './filter-values';
export type {
  FilterValue, FilterValues, DimensionFilterValue, TimeRangeFilterValue,
  TimePointFilterValue, BooleanFilterValue, NumberRangeFilterValue, SearchFilterValue
} from './filter-values';
export { initializePageParams } from './page-params';
export { rawSnapshot } from './snapshots';

export * from './table-view';
export * from './table-presentation';
export * from './chart-series-presentation';
export * from './chart-presentation';
export { presentationQuerySources } from './query-projection';
export * from './table-defaults';
export * from './compute';
export * from './compute/join-aggregate';
export * from './compute/time-fill';
export * from './compute/snapshots';
export { createSourceProgram, defaultSourceView, type SourceProgram, type SourceRead, type SourceUpdate } from './source-program/session';
export { activeSourceIds, visibleSourceIds, executionSourceIds, compileSources } from './source-program/compiler';
export { reusableInitialSnapshot, SourceRangeError, EXPORT_MAX_ROWS, EXPORT_PREPARATION_TIMEOUT_MS } from './source-program/range-policy';
export { automaticQueryPageSize, automaticQueryTableSources } from './source-program/table-pagination';

export { intersectQueryFilters } from './intersect-filters';
export { candidateContextKey, filterCandidatesRequest, validFilterCandidates } from './filter-candidates';
export { createCandidateGatewaySession } from './candidate-session';
export { candidateView, candidateKey, localColumnCandidates } from './column-candidates';
export type { ColumnCandidatesRead } from './source-program/column-candidates';

export { createCandidateValidator } from './candidate-validation';

export { sourceCandidatesGateway, projectSourceCandidates } from './source-candidates';

export {resolveFinalizationDates,type FinalizationSourceDefinition} from './finalization';
export {createFinalizationPreparation} from './finalization-preparation';

export type { ScreenProgress } from './screen-progress';
export { observeQueryHttpError } from './query-http-error';
