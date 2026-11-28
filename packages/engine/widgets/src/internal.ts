/**
 * Package-internal pure-TS widgets entry for `runtime-ui` within `@metriccanvas/engine`.
 * Symbols here are NOT part of the public `@metriccanvas/engine/widgets` API contract.
 * Intentionally excludes `.svelte` components (see `./internal-components.ts`) and heavy chart
 * modules (BarChart/LineChart/PieChart/MapChart/Gauge/EChart) to preserve Node testability and
 * Embed code-splitting boundaries.
 */
export {
  type GeographyInput,
  organizationEntries,
  type RegionMapDisplayNames,
} from './components/map-chart/geography';
export type { MapViewport } from './components/map-chart/options';
export { compatibleTableFormat, formatTableCell } from './components/table/cell-presentation';
export { buildTableColumnLayout, type TableColumnLayout } from './components/table/columns';
export { tableEnumLabel } from './components/table/enum-values';
export {
  type AlignedTableRow,
  alignedCellArrow,
  alignedCellText,
  alignedFallback,
  alignedFieldValue,
  projectTableRows,
  tableRowColumn,
} from './components/table/rows';
export {
  shouldApplyTableHeaderFilter,
  type TableHeaderFilterValue,
  type TablePaginationState,
  type TableSelectedCell,
  type TableSortRule,
  type TableViewState,
} from './components/table/view-state';
export { tableDataWarnings } from './components/table/warnings';
export type { TextBlockLink } from './components/text/links';
export { absoluteDisplayText, ratioLimitText } from './shared/absolute-display-limit';
export { CHART_OPTION_PATHS } from './shared/chart-option-extension';
export {
  fieldRow,
  type NamedDataSlots,
  resolveField,
  semanticHtmlFieldPresentation,
} from './shared/component-data';
export { appendDisplayUnit } from './shared/display-unit';
export {
  EXPORT_SCALE_CONTEXT,
  STATIC_EXPORT_CONTEXT,
  TABLE_EXPORT_ALLOWED,
} from './shared/export-context';
export { resolvedUnit } from './shared/field-presentation';
export { percentDigits } from './shared/numeric-presentation';
export { type NumericScale, numericScale } from './shared/numeric-scale';
export {
  parseSemanticHtml,
  type SemanticHtmlNode,
  semanticDataPresentation,
  semanticHtmlInstructions,
} from './shared/semantic-html';
export {
  TABLE_EXPAND_CONTEXT,
  type TableExpandControl,
} from './shared/table-expand-context';
export { tableValueColor } from './shared/value-color';
export { DEFAULT_NULL_TEXT, formatValue, hasDisplayValue } from './shared/value-format';
