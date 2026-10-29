import {rowCellFallback, type DataRow, type UnionKeysOperator} from '@metriccanvas/page/internal';
import {ComputationError} from './join-aggregate';

function projectedKey(row: DataRow, keys: readonly string[]): DataRow {
  return Object.fromEntries(keys.map(key => {
    const value = row[key];
    if (value == null || rowCellFallback(row, key) || !['string','number','boolean'].includes(typeof value) ||
      (typeof value === 'string' && !value.trim()) || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new ComputationError('并集键缺失或类型不合法');
    }
    return [key, value];
  }));
}

/** 依来源及行的首次出现顺序投影；跨来源去重，同一来源重复键明确失败。 */
export function unionKeys(operator: UnionKeysOperator, dependencies: ReadonlyMap<string, readonly DataRow[]>): DataRow[] {
  const union = new Map<string, DataRow>();
  for (const source of operator.sources) {
    const rows = dependencies.get(source);
    if (!rows) throw new ComputationError('并集依赖尚未完成');
    const seen = new Set<string>();
    for (const row of rows) {
      const projected = projectedKey(row, operator.keys);
      const identity = JSON.stringify(operator.keys.map(key => projected[key]));
      if (seen.has(identity)) throw new ComputationError('并集源存在重复组合键');
      seen.add(identity);
      if (!union.has(identity)) union.set(identity, projected);
    }
  }
  return [...union.values()];
}
