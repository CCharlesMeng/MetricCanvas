import { restoreCellFallbacks, snapshotCellFallbacks, type CellFallbacks, type DataSnapshot, type Row } from '@metriccanvas/page/internal';

/** Query and embedded initial rows enter the same raw snapshot graph. */
export function rawSnapshot(rows: readonly Row[], totalCount?: number, cellFallbacks?: CellFallbacks): DataSnapshot {
  restoreCellFallbacks(rows, cellFallbacks);
  const count = totalCount === undefined ? {} : { totalCount };
  return rows.length ? { status: 'ready', rows: [...rows], ...snapshotCellFallbacks(rows), ...count } : { status: 'empty', ...count };
}
