import { describe, expect, it } from 'vitest';
import type { ComputeOperator } from '@metriccanvas/page/internal';
import { applyComputation } from '../src/compute';
import fixture from './fixtures/ioc-customer-finance.json';

// Report customer-detail B3/B4/C3. Target missing-match behavior follows the
// confirmed user decision; this does not verify the REST adapter or the whole page.
const operators: ComputeOperator[] = [
  { op: 'joinAggregate', source: 'forecast', keys: [
    { local: 'party_number', foreign: 'party_number' },
    { local: 'mtime', foreign: 'mtime' }
  ], values: [
    { field: 'annual_target_amt_sum', output: 'annual_target_amt_sum', aggregate: 'unique' },
    { field: 'stock_forecast_revenue_amt_sum', output: 'stock_forecast_revenue_amt_sum', aggregate: 'unique' }
  ], onMissing: 'null' },
  { op: 'sumFields', fields: ['rev_ytd_amt', 'stock_forecast_revenue_amt_sum'], output: 'annual_forecast_revenue', onMissing: 'null' },
  { op: 'delta', minuend: 'annual_forecast_revenue', subtrahend: 'annual_target_amt_sum', output: 'forecast_target_gap' },
  { op: 'ratio', numerator: 'rev_ytd_amt', denominator: 'annual_target_amt_sum', output: 'target_completion_rate', onZeroDenominator: 'null', scale: 100 },
  { op: 'ratio', numerator: 'sgp_ytd_amt', denominator: 'rev_ytd_amt', output: 'gross_profit_rate', onZeroDenominator: 'null', scale: 100 }
];

describe('客户详情：经营进展消费者契约', () => {
  it.each(fixture.expected)('$party_number：按客户与月份关联，保留负收入和缺匹配行', expected => {
    const rows = applyComputation(operators, fixture.finance, new Map([['forecast', fixture.forecast]]));
    expect(rows).toHaveLength(fixture.finance.length);
    expect(rows.find(row => row.party_number === expected.party_number)).toMatchObject(expected);
  });
});
