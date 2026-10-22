/** Lockstep engine integration; one-shot callers use the root entry. */
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
export * from './compute';
export * from './compute/join-aggregate';
export * from './compute/time-fill';
export * from './compute/snapshots';
export { createSourceProgram, defaultSourceView, type SourceProgram, type SourceRead, type SourceUpdate } from './source-program/session';
export { activeSourceIds, visibleSourceIds, executionSourceIds, compileSources } from './source-program/compiler';
export { reusableInitialSnapshot, SourceRangeError, EXPORT_MAX_ROWS, EXPORT_PREPARATION_TIMEOUT_MS } from './source-program/range-policy';
export { automaticQueryPageSize, automaticQueryTableSources } from './source-program/table-pagination';

export { intersectQueryFilters } from './intersect-filters';
