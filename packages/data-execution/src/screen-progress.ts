import { snapshotCellFallbacks, type ComputeOperator, type DataSnapshot, type Row, type TableQueryView } from '@metriccanvas/page/internal';
import { applyComputation } from './compute';

/** Presentation only: never enters execution receipts, initial rows, caches or exports. */
export interface ScreenProgress {
  snapshot: Extract<DataSnapshot, {status: 'ready'}>;
  pendingFields: readonly string[];
  viewCorrection?: TableQueryView;
}
export type ScreenProgressSink = (progress: ScreenProgress) => void;

export function progressSnapshot(rows: Row[], totalCount: number | undefined, pendingFields: Iterable<string>, viewCorrection?: TableQueryView): ScreenProgress {
  return { snapshot: { status: 'ready', rows, totalCount, ...snapshotCellFallbacks(rows) }, pendingFields: [...pendingFields], viewCorrection };
}

export function operationFields(op: ComputeOperator): { inputs: string[]; outputs: string[] } | undefined {
  switch (op.op) {
    case 'delta': return { inputs: [op.minuend, op.subtrahend], outputs: [op.output] };
    case 'ratio': return { inputs: [op.numerator, op.denominator], outputs: [op.output] };
    case 'joinAggregate': return { inputs: op.keys.map(key => key.local), outputs: op.values.map(value => value.output) };
    default: return undefined;
  }
}

/** Keep missing/pending inputs distinct from a declared zero fallback. */
export function progressComputation(rows: Row[], operations: readonly ComputeOperator[], available: Set<string>, dependencies: ReadonlyMap<string, readonly Row[]> = new Map()): Row[] {
  const ready: ComputeOperator[] = [];
  for (const op of operations) {
    const fields = operationFields(op);
    if (!fields) continue;
    const usable = fields.inputs.every(field => available.has(field)) && (op.op !== 'joinAggregate' || dependencies.has(op.source));
    if (usable) { ready.push(op); for (const output of fields.outputs) available.add(output); }
    else for (const row of rows) for (const output of fields.outputs) row[output] = null;
  }
  let computed: Row[];
  try { computed = applyComputation(ready, rows, dependencies); }
  catch {
    // The formal snapshot owns the diagnostic. Keep valid base columns displayable.
    for (const op of operations) for (const output of operationFields(op)?.outputs ?? []) {
      available.delete(output);
      for (const row of rows) row[output] = null;
    }
    return rows;
  }
  return computed;
}
