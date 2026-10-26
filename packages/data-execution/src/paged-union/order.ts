import type { Row, TableSortRule } from '@metriccanvas/page/internal';
/** Matches the existing raw Table comparison; null sorts last in both directions. */
export function compareUnionRows(left: Row, right: Row, sort: readonly TableSortRule[]): number {
  for (const rule of sort) {
    const a = left[rule.field], b = right[rule.field];
    if (a == null || b == null) { if (a !== b) return a == null ? 1 : -1; continue; }
    const result = a < b ? -1 : a > b ? 1 : 0;
    if (result) return rule.direction === 'desc' ? -result : result;
  }
  return 0;
}
