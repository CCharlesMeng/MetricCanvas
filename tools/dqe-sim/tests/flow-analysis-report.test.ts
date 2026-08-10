import { describe, expect, it } from 'vitest';
import flowFixtureJson from '../fixtures/flow-analysis-report.json';
import { executeDqeItem } from '../src/execute';

interface FlowQueryFixture {
  output_dims: string[];
  output_metrics: string[];
  time: {
    period: string;
    is_aggregate: boolean;
    start: string;
    end: string;
  };
  rows: Array<Record<string, unknown>>;
}

const fixture = flowFixtureJson as {
  capturedAt: string;
  queries: Record<string, FlowQueryFixture>;
};

const expectedQueryIds = [
  'flow-kpis',
  'overall-monthly-trend',
  'region-monthly-trend',
  'customer-growth-top',
  'customer-decline-top',
  'customer-yoy-drop-top',
  'customer-risk-top',
  'track-analysis',
  'industry-analysis'
];

describe('流水分析报告 DQE fixture', () => {
  it('九类查询严格匹配并返回全部声明字段', () => {
    expect(Object.keys(fixture.queries)).toEqual(expectedQueryIds);

    for (const [id, query] of Object.entries(fixture.queries)) {
      const result = executeDqeItem(dqeItem(query));
      expect(result.code, id).toBe('SUCCESS');
      expect(result.data, id).toEqual(query.rows);
      expect(result.data.length, id).toBeGreaterThan(0);
      const expectedFields = [...query.output_dims, ...query.output_metrics].sort();
      for (const row of result.data) {
        expect(Object.keys(row).sort(), id).toEqual(expectedFields);
      }
    }
  });

  it('两张趋势固定十二行并保持 actual/forecast 空值互斥和确定性公式', () => {
    const overall = fixture.queries['overall-monthly-trend']!.rows;
    const region = fixture.queries['region-monthly-trend']!.rows;

    expect(overall).toHaveLength(12);
    expect(region).toHaveLength(12);
    overall.forEach((row, index) => {
      const month = index + 1;
      expect(row.month).toBe(`${month}月`);
      expect(row['core-actual']).toBe(month <= 2 ? 8_000_000 + month * 200_000 : null);
      expect(row['communication-actual']).toBe(
        month <= 2 ? 3_000_000 + month * 100_000 : null
      );
      expect(row['core-forecast']).toBe(month >= 3 ? 8_000_000 + month * 200_000 : null);
      expect(row['communication-forecast']).toBe(
        month >= 3 ? 3_000_000 + month * 100_000 : null
      );
    });
    region.forEach((row, index) => {
      const month = index + 1;
      expect(row['stable-actual']).toBe(month <= 2 ? 5_800_000 + month * 150_000 : null);
      expect(row['one-off-actual']).toBe(month <= 2 ? 1_800_000 + month * 120_000 : null);
      expect(row['stable-forecast']).toBe(month >= 3 ? 5_800_000 + month * 150_000 : null);
      expect(row['one-off-forecast']).toBe(month >= 3 ? 1_800_000 + month * 120_000 : null);
    });
  });

  it('所有非空金额均为元的有限数字，客户金额按查询行序严格递减', () => {
    const amountFields = new Set([
      'annual-total',
      'current-month',
      'annual-projection',
      'core-actual',
      'communication-actual',
      'core-forecast',
      'communication-forecast',
      'stable-actual',
      'one-off-actual',
      'stable-forecast',
      'one-off-forecast',
      'amount',
      'drop-difference',
      'monthly-average',
      'january-amount',
      'previous-month-amount',
      'current-month-amount',
      'annual-target',
      'flow-amount',
      'public-region-amount',
      'current-month-amount',
      'annual-projection',
      'projection-growth'
    ]);

    for (const query of Object.values(fixture.queries)) {
      for (const row of query.rows) {
        for (const [field, value] of Object.entries(row)) {
          if (!amountFields.has(field) || value === null) continue;
          expect(typeof value, field).toBe('number');
          expect(Number.isFinite(value), field).toBe(true);
        }
      }
    }

    for (const id of [
      'customer-growth-top',
      'customer-decline-top',
      'customer-yoy-drop-top',
      'customer-risk-top'
    ]) {
      const rows = fixture.queries[id]!.rows;
      const field = id === 'customer-yoy-drop-top'
        ? 'drop-difference'
        : id === 'customer-risk-top'
          ? 'current-month-amount'
          : 'amount';
      const values = rows.map((row) => Number(row[field]));
      expect(values.every((value, index) => index === 0 || values[index - 1]! > value), id)
        .toBe(true);
    }
  });

  it('严格拒绝同字段但时间范围不匹配的查询', () => {
    const query = fixture.queries['flow-kpis']!;
    const item = dqeItem(query);
    item.filter.time.end = '2026-03';

    expect(executeDqeItem(item)).toMatchObject({
      code: 'DQE_SIM_UNSUPPORTED_QUERY',
      data: []
    });
  });
});

function dqeItem(query: FlowQueryFixture) {
  return {
    output_dims: query.output_dims,
    output_metrics: query.output_metrics,
    filter: {
      time: { ...query.time },
      dims: [],
      metrics: []
    },
    order: {}
  };
}
