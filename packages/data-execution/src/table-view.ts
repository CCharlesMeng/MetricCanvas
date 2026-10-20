import { tablePredicates, type Row, type TableQueryView, type TablePredicate, type TableHeaderFilters, type TableSortRule } from '@metriccanvas/page/internal';

/** Raw comparisons; null and non-finite values sort last in either direction. */
export function sortTableRows(rows: readonly Row[], rules: readonly TableSortRule[]): Row[] {
  const missing = (value: unknown) => value == null || (typeof value === 'number' && !Number.isFinite(value));
  return [...rows].sort((left, right) => {
    for (const rule of rules) {
      const a = left[rule.field], b = right[rule.field];
      if (missing(a) || missing(b)) { if (missing(a) !== missing(b)) return missing(a) ? 1 : -1; continue; }
      const comparison = a! < b! ? -1 : a! > b! ? 1 : 0;
      if (comparison) return rule.direction === 'desc' ? -comparison : comparison;
    }
    return 0;
  });
}
export function filterTableRows(rows: readonly Row[], predicates: readonly TablePredicate[]): Row[] {
  return rows.filter(row => predicates.every(p => {
    const value = row[p.field];
    if (p.op === 'in') return p.values.some(v => String(v) === String(value ?? ''));
    if (value == null) return false;
    if (p.op === 'dateRange') return (!p.from || String(value) >= p.from) && (!p.to || String(value) <= p.to);
    return typeof value === 'number' && Number.isFinite(value) && (p.op === 'gte' ? value >= p.value : value <= p.value);
  }));
}
export function filterTableRowsByHeaders(rows: readonly Row[], filters: TableHeaderFilters): Row[] { return filterTableRows(rows, tablePredicates(filters)); }
export function searchTableRows(rows: readonly Row[], fields: readonly string[], query = '', match?: 'equals'): Row[] {
  const term = query.trim();
  if (!term) return [...rows];
  return rows.filter(row => fields.some(field => typeof row[field] === 'string' &&
    (match === 'equals' ? row[field] === term : row[field].toLowerCase().includes(term.toLowerCase()))));
}
export function evaluateTableView(rows: readonly Row[], view: TableQueryView, complete = false) {
  const matching = sortTableRows(searchTableRows(filterTableRows(rows, view.predicates), view.search?.fields ?? [], view.search?.query, view.search?.match), view.sort);
  const totalCount = matching.length;
  const pageIndex = Math.min(view.pageIndex, Math.max(0, Math.ceil(totalCount / view.pageSize) - 1));
  return { rows: complete ? matching : matching.slice(pageIndex * view.pageSize, (pageIndex + 1) * view.pageSize), totalCount, pageIndex };
}
