import type { DataSnapshot, TableComponent } from '@metriccanvas/page/internal';

/** Complete, unpaged tables get a navigable window without changing the saved query. */
export function tablePagination(
  component: TableComponent,
  snapshot: DataSnapshot | undefined
): TableComponent['props']['pagination'] {
  if (component.props.pagination) return component.props.pagination;
  if (snapshot?.status !== 'ready' || snapshot.rows.length <= 20) return undefined;
  if (snapshot.totalCount !== undefined && snapshot.totalCount !== snapshot.rows.length) return undefined;
  return { mode: 'local', pageSize: 20, numbered: true };
}
