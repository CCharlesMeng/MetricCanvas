import type { DataSnapshot, TableComponent } from '@metriccanvas/page/internal';

/** The orchestrator owns query windows; complete snapshots may be sliced locally. */
export function tablePagination(
  component: TableComponent,
  snapshot: DataSnapshot | undefined,
  queryPageSize?: number
): TableComponent['props']['pagination'] {
  if (component.props.pagination) return component.props.pagination;
  if (queryPageSize !== undefined) return { mode: 'query' };
  if (snapshot?.status !== 'ready' || snapshot.rows.length <= 10) return undefined;
  if (snapshot.totalCount !== undefined && snapshot.totalCount !== snapshot.rows.length) return undefined;
  return { mode: 'local', pageSize: 10, numbered: true };
}
