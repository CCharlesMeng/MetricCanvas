import fixture from '../fixtures/stored-count-measures.json';
import type { DqeSimItemResult } from './execute';

type JsonRecord = Record<string, unknown>;
function record(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function filteredRows(dims: unknown): JsonRecord[] | undefined {
  if (!Array.isArray(dims)) return;
  let rows: JsonRecord[] = structuredClone(fixture.rows);
  for (const predicate of dims) {
    if (!record(predicate) || predicate.dim_name !== '存量区域' || predicate.operator !== undefined) return;
    const values = predicate.dim_value_list;
    if (!Array.isArray(values) || !values.every(value => typeof value === 'string')) return;
    if (values.length) rows = rows.filter(row => values.some(value => value === row['存量区域']));
  }
  return rows;
}

/** 原样返回现成数值，不实现聚合；仅认领该合成示例的固定投影。 */
export function executeStoredCountMeasures(item: unknown): DqeSimItemResult | undefined {
  if (!record(item)) return;
  if (JSON.stringify(item.output_dims) !== JSON.stringify(fixture.query.output_dims) ||
    JSON.stringify(item.output_metrics) !== '[]') return;
  const filter = item.filter;
  const valid = record(filter) && filter.time === undefined && JSON.stringify(filter.metrics) === '[]' &&
    record(item.order) && Object.keys(item.order).length === 0;
  const rows = valid ? filteredRows(filter.dims) : undefined;
  return {
    code: rows ? 'SUCCESS' : 'DQE_SIM_UNSUPPORTED_QUERY',
    data: rows ?? [], total_count: rows?.length ?? 0,
    dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null }
  };
}
