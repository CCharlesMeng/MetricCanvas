import type { DataSnapshot, Row } from '@metriccanvas/page/internal';

/** Query and embedded initial rows enter the same raw snapshot graph. */
export function rawSnapshot(rows: readonly Row[], totalCount?: number): DataSnapshot {
  const count = totalCount === undefined ? {} : { totalCount };
  return rows.length ? { status: 'ready', rows: [...rows], ...count } : { status: 'empty', ...count };
}
