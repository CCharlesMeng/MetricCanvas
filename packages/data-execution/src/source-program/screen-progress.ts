import { copyRowFallbacks, type DataSource, type DataSnapshot, type Row } from '@metriccanvas/page/internal';
import { keyRows } from '../compute/key-rows';
import { operationFields, progressComputation, progressSnapshot, type ScreenProgress } from '../screen-progress';

/** Only row-preserving operations can expose the already selected raw row domain. */
export function ordinaryScreenProgress(source: DataSource | undefined, raw: DataSnapshot | undefined, snapshots: ReadonlyMap<string, DataSnapshot>): ScreenProgress | undefined {
  if (!source || source.source.type !== 'query' || raw?.status !== 'ready' || !source.compute?.length) return;
  if (source.compute.some(op => !operationFields(op))) return;
  const outputs = new Set(source.compute.flatMap(op => operationFields(op)!.outputs));
  if (!stableRowDomain(source.compute, raw.rows, outputs)) return;
  const dependencies = new Map<string, readonly Row[]>();
  for (const [id, snapshot] of snapshots) {
    const rows = snapshot.status === 'ready' ? snapshot.rows : snapshot.status === 'empty' ? [] : undefined;
    if (!rows) continue;
    const scalar = source.compute.some(op => op.op === 'joinAggregate' && op.source === id && !op.keys.length);
    if (scalar && 'totalCount' in snapshot && snapshot.totalCount !== undefined && snapshot.totalCount !== rows.length) continue;
    dependencies.set(id, rows);
  }
  const available = new Set(Object.keys(source.fields).filter(field => !outputs.has(field)));
  const rows = progressComputation(raw.rows.map(input => copyRowFallbacks(input, {...input})), source.compute, available, dependencies);
  return progressSnapshot(rows, raw.totalCount, [...outputs].filter(field => !available.has(field)));
}

/** Join keys must already prove that the computation preserves every raw main row. */
function stableRowDomain(operations: NonNullable<DataSource['compute']>, rows: Row[], outputs: ReadonlySet<string>): boolean {
  try {
    for (const op of operations) {
      if (op.op !== 'joinAggregate') continue;
      if (op.keys.some(key => outputs.has(key.local))) return false;
      if (keyRows(rows, op.keys.map(key => key.local), 'screen').length !== rows.length) return false;
    }
    return true;
  } catch { return false; }
}
