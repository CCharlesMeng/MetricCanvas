/**
 * Package-internal runtime entry for `runtime-ui` within `@metriccanvas/engine`.
 * Symbols here are NOT part of the public `@metriccanvas/engine` API contract.
 */
export { detailViewInput } from './detail-view';
export { candidateScopeKey } from './dimension-values';
export { withExportPermission } from './display-inputs';
export { prepareExportSnapshots } from './export-snapshots';
export { requestsRollingFinalization } from './filter-state';
export { filterInputIssue } from './navigation-inputs';
export {
  compilePresentation,
  type Presentation,
  projectPresentationRows,
  resolvePresentationRow,
} from './presentation';
export {
  type IdleSchedule,
  scheduleCandidateIdle,
} from './table/candidate-preload';
export {
  type ColumnCandidatesSnapshot,
  createColumnCandidatesSession,
} from './table/column-candidates';
export {
  createRowExpansionController,
  type RowTableInstance,
  singleExpandableParent,
} from './table/expansion';
export {
  createHierarchySelectionSession,
  type HierarchyContext,
  type HierarchySelection,
  hierarchyRows,
  resolveHierarchySelection,
  rowExpansionFilters,
} from './table/hierarchy-selection';
export { createTableSession, type TableSession } from './table/session';
