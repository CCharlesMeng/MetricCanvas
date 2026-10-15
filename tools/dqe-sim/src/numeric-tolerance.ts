import fixture from '../fixtures/numeric-tolerance.json';
import type { DqeSimItemResult } from './execute';

/** 固定合成数据场景；保留异常值供实际网关归一化，不在 Sim 内修复。 */
export function executeNumericTolerance(item: unknown): DqeSimItemResult | undefined {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return undefined;
  const record = item as Record<string, unknown>;
  if (JSON.stringify(record.output_dims) !== JSON.stringify(fixture.query.output_dims) ||
    JSON.stringify(record.output_metrics) !== JSON.stringify(fixture.query.output_metrics)) return undefined;
  const valid = JSON.stringify(record.filter) === JSON.stringify(fixture.query.filter) &&
    typeof record.order === 'object' && record.order !== null && Object.keys(record.order).length === 0;
  return {
    code: valid ? 'SUCCESS' : 'DQE_SIM_UNSUPPORTED_QUERY',
    data: valid ? structuredClone(fixture.rows) : [],
    total_count: valid ? fixture.rows.length : 0,
    dqe: { columns: [], orders: [], limit: -1, offset: -1, sql: null }
  };
}
