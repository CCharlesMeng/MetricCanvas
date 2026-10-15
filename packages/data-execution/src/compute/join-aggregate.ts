import type { DataRow, JoinAggregateOperator } from '@metriccanvas/page/internal';

/** 仅包含脱值原因；不得将组合键值和输入行写进错误。 */
export class ComputationError extends Error {
  constructor(message: string) { super(message); this.name = 'ComputationError'; }
}

export function joinAggregate(
  operator: JoinAggregateOperator,
  rows: readonly DataRow[],
  dependency: readonly DataRow[]
): DataRow[] {
  const key = (row: DataRow, fields: string[]) => JSON.stringify(fields.map(field => {
    const value = row[field];
    if (value == null || !['string', 'number', 'boolean'].includes(typeof value) ||
      (typeof value === 'number' && !Number.isFinite(value))) {
      throw new ComputationError('关联键缺失或类型不合法');
    }
    return value;
  }));
  const groups = new Map<string, DataRow[]>();
  for (const row of dependency) {
    const id = key(row, operator.keys.map(k => k.foreign));
    const group = groups.get(id) ?? [];
    group.push(row); groups.set(id, group);
  }
  const values = new Map<string, DataRow>();
  for (const [id, group] of groups) {
    const result: DataRow = {};
    for (const binding of operator.values) {
      if (binding.aggregate === 'unique' && group.length !== 1) throw new ComputationError('关联源存在重复组合键');
      let total = 0;
      let seen = false;
      for (const row of group) {
        const value = row[binding.field];
        if (value == null) continue;
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new ComputationError('关联度量不是有限数值');
        total += value; seen = true;
      }
      if (!Number.isFinite(total)) throw new ComputationError('关联聚合数值溢出');
      result[binding.output] = seen ? total : null;
    }
    values.set(id, result);
  }
  return rows.map(row => ({
    ...row,
    ...(values.get(key(row, operator.keys.map(k => k.local))) ??
      Object.fromEntries(operator.values.map(binding => [binding.output, null])))
  }));
}
