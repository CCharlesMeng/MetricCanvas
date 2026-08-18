import { describe, expect, it } from 'vitest';
import flowFixtureJson from '../fixtures/flow-analysis-report.json';
import { executeDqeItem } from '../src/execute';

interface FlowQueryFixture {
  output_dims: string[];
  output_metrics: string[];
  time: {
    period: string;
    is_aggregate?: boolean;
    start: string;
    end: string;
  };
  filter?: {
    dims?: unknown[];
    metrics?: unknown[];
  };
  order?: Record<string, unknown>;
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

  it('所有非空金额均为元的有限数字，客户排行符合各自查询顺序', () => {
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
      const values = id === 'customer-yoy-drop-top'
        ? rows.map((row) => embeddedNumbers(String(row.reason))[0] ?? Number.NaN)
        : rows.map((row) => Number(row[
          id === 'customer-decline-top'
            ? '公有云流水月变化'
            : id === 'customer-risk-top'
              ? 'current-month-amount'
              : 'amount'
        ]));
      expect(
        values.every((value, index) =>
          index === 0 || (
            id === 'customer-decline-top' || id === 'customer-yoy-drop-top'
              ? values[index - 1]! < value
              : values[index - 1]! > value
          )
        ),
        id
      )
        .toBe(true);
    }
  });

  it('下降客户保留真实 Top10，并以语义 HTML 承载完整归因明细', () => {
    const query = fixture.queries['customer-decline-top']!;
    const result = executeDqeItem(dqeItem(query));
    const detailLengths = result.data.map((row) => {
      const details = row['云服务流水归因明细'];
      expect(typeof details).toBe('string');
      if (typeof details !== 'string') return 0;
      expect(details).not.toMatch(/\b(?:style|onclick)=/u);
      return details.match(/<span class="detail-title">/gu)?.length ?? 0;
    });

    expect(result.code).toBe('SUCCESS');
    expect(result.data).toHaveLength(10);
    expect(result.total_count).toBe(10);
    expect(detailLengths).toEqual([7, 1, 2, 1, 6, 1, 2, 1, 1, 1]);
    expect(detailLengths.reduce((total, count) => total + count, 0)).toBe(23);
    expect(detailLengths.every((count) => count > 0)).toBe(true);
    expect(result.data[0]?.['云服务流水归因明细']).toContain('tone-negative');
    expect(result.data[0]?.['云服务流水归因明细']).toContain('tone-positive');
  });

  it('增长客户补齐 Top10，保持金额降序且每行以语义 HTML 承载增长明细', () => {
    const query = fixture.queries['customer-growth-top']!;
    const result = executeDqeItem(dqeItem(query));

    expect(result.code).toBe('SUCCESS');
    expect(result.data).toHaveLength(10);
    expect(result.total_count).toBe(10);
    expect(result.data.map((row) => row['customer-name'])).toEqual(
      Array.from({ length: 10 }, (_, index) => `客户${String.fromCharCode(65 + index)}`)
    );
    for (const row of result.data) {
      const details = row['growth-description'];
      expect(typeof details).toBe('string');
      if (typeof details !== 'string') continue;
      expect(details).toContain('<span class="detail-title">');
      expect(details).toContain('<span class="detail-description">');
      expect(details).toContain('detail-value tone-positive');
      expect(details).not.toMatch(/\b(?:style|onclick)=/u);
    }
  });

  it('同比掉量查询只用 reason 承载负掉量与正月均流水差值', () => {
    const query = fixture.queries['customer-yoy-drop-top']!;
    const rows = query.rows;

    expect(query.output_metrics).toEqual([]);

    for (const row of rows) {
      const reason = row.reason;
      expect(typeof reason).toBe('string');
      if (typeof reason !== 'string') continue;
      expect(reason).not.toMatch(/<data\s/u);
      expect(reason).toContain('月均流水差值');
      expect(row).not.toHaveProperty('drop-difference');
      expect(row).not.toHaveProperty('monthly-average');
      const [dropDifference, monthlyAverage] = embeddedNumbers(reason);
      expect(dropDifference).toBeLessThan(0);
      expect(monthlyAverage).toBeGreaterThan(0);
    }
  });

  it('风险分类返回本月相对 1 月和上月的有符号差值', () => {
    const rows = fixture.queries['customer-risk-top']!.rows;

    for (const row of rows) {
      const riskType = row['risk-type'];
      expect(typeof riskType).toBe('string');
      if (typeof riskType !== 'string') continue;
      expect(riskType).not.toMatch(/<data\s/u);
      expect(embeddedNumbers(riskType)).toEqual([
        Number(row['current-month-amount']) - Number(row['january-amount']),
        Number(row['current-month-amount']) - Number(row['previous-month-amount'])
      ]);
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
      ...(query.filter
        ? {
            ...(Object.hasOwn(query.filter, 'dims') ? { dims: query.filter.dims } : {}),
            ...(Object.hasOwn(query.filter, 'metrics')
              ? { metrics: query.filter.metrics }
              : {})
          }
        : { dims: [], metrics: [] })
    },
    order: query.order ?? {}
  };
}

function embeddedNumbers(source: string): number[] {
  return Array.from(
    source.matchAll(/<data>([+-]?(?:0|[1-9]\d*)(?:\.\d+)?)<\/data>/gu),
    (match) => Number(match[1])
  );
}
