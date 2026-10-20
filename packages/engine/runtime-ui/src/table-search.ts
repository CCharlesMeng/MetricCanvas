import { tableSearchValue, type DataSource, type Row, type TableComponent, type TableQueryView } from '@metriccanvas/page/internal';

/** Complete sources can be searched locally without changing another consumer's snapshot. */
export function remoteTableSearch(source: DataSource | undefined): boolean {
  return source?.source.type === 'pagedJoin' || (source?.source.type === 'query' && source.source.resultScope !== 'complete');
}

import { searchTableRows } from '@metriccanvas/data-execution/runtime';
export { searchTableRows } from '@metriccanvas/data-execution/runtime';

export function applyTableSearch(rows: readonly Row[], component: TableComponent, query?: string, committed?: TableQueryView['search']): Row[] {
  const search = committed ?? tableSearchValue(component.props.toolbar?.search, query ?? '');
  return searchTableRows(rows, search?.fields ?? [], search?.query, search?.match);
}
