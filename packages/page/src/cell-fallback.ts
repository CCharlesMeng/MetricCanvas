import type { Row } from './snapshot';

export interface ScalarDisplayFallback {
  raw: string | number | boolean;
  reason: 'TYPE_MISMATCH' | 'INVALID_NUMERIC_VALUE';
}
export type RowCellFallbacks = Record<string, ScalarDisplayFallback>;
export type CellFallbacks = Record<number, RowCellFallbacks>;

// Transient row transport only. Every snapshot/serialization boundary also emits cellFallbacks.
const evidence = new WeakMap<Row, RowCellFallbacks>();

export function setRowCellFallbacks(row: Row, cells: RowCellFallbacks): void {
  if (Object.keys(cells).length) evidence.set(row, cells);
}
export function rowCellFallback(row: Row | undefined, field: string): ScalarDisplayFallback | undefined {
  return row && evidence.get(row)?.[field];
}
export function restoreCellFallbacks(rows: readonly Row[], cells?: CellFallbacks): void {
  if (!cells) return;
  for (const [index, fields] of Object.entries(cells)) {
    const row = rows[Number(index)];
    if (row) setRowCellFallbacks(row, fields);
  }
}
export function snapshotCellFallbacks(rows: readonly Row[]): { cellFallbacks?: CellFallbacks } {
  const cells: CellFallbacks = {};
  rows.forEach((row, index) => {
    const fields = evidence.get(row);
    if (fields) cells[index] = fields;
  });
  return Object.keys(cells).length ? { cellFallbacks: cells } : {};
}
export function copyRowFallbacks(source: Row, target: Row): Row {
  const fields = evidence.get(source);
  if (fields) setRowCellFallbacks(target, { ...fields });
  return target;
}
export function copyFieldFallback(source: Row | undefined, from: string, target: Row, to: string): void {
  const fallback = rowCellFallback(source, from);
  const fields = { ...evidence.get(target) };
  delete fields[to];
  if (fallback) fields[to] = fallback;
  evidence.delete(target);
  setRowCellFallbacks(target, fields);
}

/** Attach runtime evidence after document structure/invariants have been validated. */
export function attachInitialFallbacks(page: Pick<import('./page').Page, 'dataSources'>, cells?: Record<string, CellFallbacks>, warnings?: Record<string, import('./query-rows').QueryRowNormalizationWarning[]>): void {
  const ids = new Set([...Object.keys(cells ?? {}), ...Object.keys(warnings ?? {})]);
  for (const id of ids) {
    const source = page.dataSources[id];
    if (source?.source.type !== 'query' || !source.source.initial) continue;
    if (cells?.[id]) source.source.initial.cellFallbacks = cells[id];
    if (warnings?.[id]) source.source.initial.warnings = warnings[id];
  }
}

/** Re-index serializable evidence whenever a ready snapshot selects or reorders rows. */
export function projectSnapshotRows(snapshot: Extract<import('./snapshot').DataSnapshot, {status:'ready'}>, rows: readonly Row[]): Extract<import('./snapshot').DataSnapshot, {status:'ready'}> {
  restoreCellFallbacks(snapshot.rows, snapshot.cellFallbacks);
  return {...snapshot,rows:[...rows],cellFallbacks:snapshotCellFallbacks(rows).cellFallbacks};
}
