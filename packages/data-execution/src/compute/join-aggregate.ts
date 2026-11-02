import { copyRowFallbacks, copyFieldFallback } from '@metriccanvas/page/internal';
import type { DataRow, JoinAggregateOperator } from '@metriccanvas/page/internal';
import {ComputationError} from './error';
import {keyRows, type ComputationDiagnostics} from './key-rows';

export {ComputationError} from './error';

export function joinAggregate(
  operator: JoinAggregateOperator,
  rows: readonly DataRow[],
  dependency: readonly DataRow[],
  diagnostics?: ComputationDiagnostics
): DataRow[] {
  const key = (row: DataRow, fields: string[]) => JSON.stringify(fields.map(field => row[field]));
  const groups = new Map<string, DataRow[]>();
  for (const row of keyRows(dependency, operator.keys.map(k => k.foreign), operator.source, diagnostics)) {
    const id = key(row, operator.keys.map(k => k.foreign));
    const group = groups.get(id) ?? [];
    group.push(row); groups.set(id, group);
  }
  const values = new Map<string, DataRow>();
  for (const [id, group] of groups) {
    const result: DataRow = {};
    for (const binding of operator.values) {
      if (binding.aggregate === 'unique' && group.length !== 1) throw new ComputationError('关联源存在重复组合键');
      result[binding.output] = aggregateValue(group, binding.field);
      if (binding.aggregate === 'unique') copyFieldFallback(group[0], binding.field, result, binding.output);
    }
    values.set(id, result);
  }
  const usable = keyRows(rows, operator.keys.map(k => k.local), diagnostics?.sourceId ?? 'local', diagnostics);
  if (diagnostics && usable.length !== rows.length) diagnostics.rowCountChanged = true;
  return usable.map(row => {
    const joined = values.get(key(row, operator.keys.map(k => k.local)));
    const output = copyRowFallbacks(row, { ...row, ...(joined ?? Object.fromEntries(operator.values.map(binding => [binding.output, binding.onMissing === 'zero' ? 0 : null]))) });
    for (const binding of operator.values) copyFieldFallback(joined, binding.output, output, binding.output);
    return output;
  });
}

/** Explicit null cells remain unknown; only an absent row may be replaced by zero. */
function aggregateValue(group: readonly DataRow[], field: string): number | null {
  let total = 0;
  let seen = false;
  for (const row of group) {
    const value = row[field];
    if (value == null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new ComputationError('关联度量不是有限数值');
    total += value;
    seen = true;
  }
  if (!Number.isFinite(total)) throw new ComputationError('关联聚合数值溢出');
  return seen ? total : null;
}
