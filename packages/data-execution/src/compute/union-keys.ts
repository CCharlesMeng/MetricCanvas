import type {DataRow, UnionKeysOperator} from '@metriccanvas/page/internal';
import {ComputationError} from './error';
import {keyRows, type ComputationDiagnostics} from './key-rows';

/** 依来源及行的首次出现顺序投影；跨来源去重，同一来源重复键明确失败。 */
export function unionKeys(operator: UnionKeysOperator, dependencies: ReadonlyMap<string, readonly DataRow[]>, diagnostics?: ComputationDiagnostics): DataRow[] {
  const union = new Map<string, DataRow>();
  for (const source of operator.sources) {
    const rows = dependencies.get(source);
    if (!rows) throw new ComputationError('并集依赖尚未完成');
    const seen = new Set<string>();
    for (const row of keyRows(rows, operator.keys, source, diagnostics)) {
      const projected = Object.fromEntries(operator.keys.map(key => [key, row[key]]));
      const identity = JSON.stringify(operator.keys.map(key => projected[key]));
      if (seen.has(identity)) throw new ComputationError('并集源存在重复组合键');
      seen.add(identity);
      if (!union.has(identity)) union.set(identity, projected);
    }
  }
  return [...union.values()];
}
