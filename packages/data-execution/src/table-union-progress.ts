import { projectSnapshotRows } from '@metriccanvas/page/internal';
import type { DataSnapshot, DataSource, Page, Row } from '@metriccanvas/page/internal';
import { applyComputation } from './compute';
import { progressSnapshot, type ScreenProgress } from './screen-progress';
import { tableKeyUnions } from './table-key-union';

function partialUnion(source: DataSource, snapshots: ReadonlyMap<string, DataSnapshot>): ScreenProgress | undefined {
  const [union, ...operators] = source.compute!;
  if (union.op !== 'unionKeys') return;
  const dependencies = new Map<string, readonly Row[]>();
  for (const member of union.sources) {
    const snapshot = snapshots.get(member);
    if (snapshot?.status === 'ready') dependencies.set(member, snapshot.rows);
    if (snapshot?.status === 'empty') dependencies.set(member, []);
  }
  const sources = union.sources.filter(id => dependencies.has(id));
  if (!sources.length) return;
  const pending: string[] = [];
  const ready = operators.filter(op => {
    if (op.op !== 'joinAggregate' || dependencies.has(op.source)) return true;
    pending.push(...op.values.map(value => value.output));
    return false;
  });
  try {
    const rows = applyComputation([{ ...union, sources }, ...ready], [], dependencies);
    if (rows.length) return progressSnapshot(rows, undefined, pending);
  } catch { /* The formal computation reports invalid keys or ambiguous values. */ }
}

function appendRows(rows: Row[], key: string, order: Map<unknown, number>): Row[] {
  for (const row of rows) if (!order.has(row[key])) order.set(row[key], order.size);
  return rows.slice().sort((a, b) => order.get(a[key])! - order.get(b[key])!);
}

/** Only the screen keeps arrival order. Complete reads still use the declared union order. */
export function createTableUnionProgress(page: Page) {
  const plans = tableKeyUnions(page);
  const orders = new Map<string, Map<unknown, number>>();
  function update(sources: ReadonlyMap<string, DataSource>, next: Map<string, DataSnapshot>, progress: Map<string, ScreenProgress>) {
    for (const [id, { key }] of plans) {
      const source = sources.get(id);
      if (!source) continue;
      const state = next.get(id);
      const previous = orders.get(id);
      if (state?.status === 'ready' && previous) next.set(id, projectSnapshotRows(state, appendRows(state.rows, key, previous)));
      if (state?.status !== 'loading') { progress.delete(id); continue; }
      const partial = partialUnion(source, next);
      if (!partial) { progress.delete(id); continue; }
      const order = previous ?? new Map();
      partial.snapshot = projectSnapshotRows(partial.snapshot, appendRows(partial.snapshot.rows, key, order));
      orders.set(id, order);
      progress.set(id, partial);
    }
  }
  return { update, reset: (id: string) => orders.delete(id) };
}
