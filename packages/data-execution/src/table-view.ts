import { rowCellFallback, tablePredicates, type Row, type TableQueryView, type TablePredicate, type TableHeaderFilters, type TableSortRule } from '@metriccanvas/page/internal';

/** Empty groups stay last independently of direction; ties retain stable input order. */
export function sortTableRows(rows: readonly Row[], rules: readonly TableSortRule[]): Row[] {
  return [...rows].sort((left, right) => {
    for (const rule of rules) {
      const compared = compareTableCells(left, right, rule);
      if (compared) return compared;
    }
    return 0;
  });
}
function emptySortValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  return typeof value === 'string' && /^(?:[-–—]+)?$/.test(value.trim());
}
function sortCell(row: Row, field: string) {
  const fallback = rowCellFallback(row, field);
  const value = fallback ? String(fallback.raw) : row[field];
  return { value, group: emptySortValue(value) ? 2 : fallback ? 1 : 0 };
}
function compareTableCells(left: Row, right: Row, rule: TableSortRule): number {
  const a = sortCell(left, rule.field), b = sortCell(right, rule.field);
  if (a.group !== b.group) return a.group - b.group;
  if (a.group === 2) return 0;
  const comparison = a.value! < b.value! ? -1 : a.value! > b.value! ? 1 : 0;
  return rule.direction === 'desc' ? -comparison : comparison;
}
export function filterTableRows(rows: readonly Row[], predicates: readonly TablePredicate[]): Row[] {
  return rows.filter(row => predicates.every(p => {
    const value = row[p.field];
    if(p.op==='isNull')return value==null;
    if (p.op === 'in') return p.values.some(v => v === value);
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
