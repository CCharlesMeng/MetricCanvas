import type { DataSource, Row, TableComponent } from '@metriccanvas/page/internal';

/** Complete sources can be searched locally without changing another consumer's snapshot. */
export function remoteTableSearch(source: DataSource | undefined): boolean {
  return source?.source.type === 'query' && source.source.resultScope !== 'complete';
}

export function searchTableRows(rows: readonly Row[], fields: readonly string[], query = ''): Row[] {
  const term = query.trim().toLowerCase();
  return term ? rows.filter(row => fields.some(field => typeof row[field] === 'string' && row[field].toLowerCase().includes(term))) : [...rows];
}

export function applyTableSearch(rows: readonly Row[], component: TableComponent, query?: string): Row[] {
  return searchTableRows(rows, component.props.toolbar?.search?.fields ?? [], query);
}
