import type { DataSource, Row, TableComponent } from '@metriccanvas/page/internal';

/** Complete sources can be searched locally without changing another consumer's snapshot. */
export function remoteTableSearch(source: DataSource | undefined): boolean {
  return source?.source.type === 'pagedJoin' || (source?.source.type === 'query' && source.source.resultScope !== 'complete');
}

import { searchTableRows } from '@metriccanvas/data-execution/runtime';
export { searchTableRows } from '@metriccanvas/data-execution/runtime';

export function applyTableSearch(rows: readonly Row[], component: TableComponent, query?: string): Row[] {
  return searchTableRows(rows, component.props.toolbar?.search?.fields ?? [], query);
}
