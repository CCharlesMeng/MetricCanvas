import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '@metriccanvas/page';
import flowReportPageJson from '../../../pages/flow-analysis-report.json';
import flowFixtureJson from '../../../tools/dqe-sim/fixtures/flow-analysis-report.json';
import { assembleAiSummaryRequest } from '../../../packages/runtime-ui/src/ai-summary/assemble-request';

type JsonRow = Record<string, string | number | boolean | null>;

interface RawQuerySource {
  fields: Record<string, { queryField: string }>;
  source: {
    type: string;
    initial: { capturedAt: string; rows: JsonRow[]; totalCount?: number };
    query: {
      language: string;
      body: { dsl_list: Array<Record<string, unknown>> };
    };
  };
}

interface FixtureQuery {
  output_dims: string[];
  output_metrics: string[];
  time: { period: string; is_aggregate: boolean; start: string; end: string };
  rows: JsonRow[];
}

const expectedSourceIds = [
  'flow-kpis',
  'overall-monthly-trend',
  'region-monthly-trend',
  'customer-growth-top',
  'customer-decline-top',
  'customer-yoy-drop-top',
  'customer-risk-top',
  'track-analysis',
  'industry-analysis'
] as const;

const fixture = flowFixtureJson as {
  capturedAt: string;
  queries: Record<string, FixtureQuery>;
};

describe('流水分析报告页面文档', () => {
  it('声明七个区块和完整的可见组件组合', () => {
    expect(validate(flowReportPageJson)).toEqual([]);
    const parsed = parsePage(flowReportPageJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.page.id).toBe('flow-analysis-report');
    expect(parsed.page.sections.map((section) => section.id)).toEqual([
      'report-header',
      'flow-overview',
      'public-region-flow',
      'analysis-heading',
      'customer-analysis',
      'track-analysis',
      'industry-analysis'
    ]);
    const components = parsed.page.sections.flatMap((section) => section.components);
    expect(components.filter((component) => component.type === 'barChart')).toHaveLength(2);
    expect(components.filter((component) => component.type === 'metricCard')).toHaveLength(7);
    expect(components.filter((component) => component.type === 'rankingDetailCard')).toHaveLength(2);
    expect(components.filter((component) => component.type === 'table')).toHaveLength(4);
    expect(components.filter((component) => component.type === 'aiSummary')).toHaveLength(3);
  });

  it('九个独立 query 均有显式 queryField、确定性 initial 和严格 DQE 签名', () => {
    const sources: Record<string, RawQuerySource> = flowReportPageJson.dataSources;
    expect(Object.keys(sources)).toEqual(expectedSourceIds);

    for (const id of expectedSourceIds) {
      const source = sources[id]!;
      const queryFixture = fixture.queries[id]!;
      expect(source.source.type, id).toBe('query');
      expect(source.source.initial.capturedAt, id).toBe(fixture.capturedAt);
      expect(source.source.initial.rows, id).toEqual(queryFixture.rows);
      expect(source.source.initial.totalCount, id).toBe(queryFixture.rows.length);
      expect(Object.values(source.fields).every((field) => field.queryField.length > 0), id)
        .toBe(true);
      expect(
        Object.values(source.fields).map((field) => field.queryField).sort(),
        id
      ).toEqual([...queryFixture.output_dims, ...queryFixture.output_metrics].sort());
      expect(source.source.query.body.dsl_list, id).toEqual([
        {
          output_dims: queryFixture.output_dims,
          output_metrics: queryFixture.output_metrics,
          filter: { time: queryFixture.time, dims: [], metrics: [] },
          order: {}
        }
      ]);
    }
  });

  it('两张预测趋势保持实际/预测互斥，组件只声明 Tooltip 和图例能力', () => {
    const sources: Record<string, RawQuerySource> = flowReportPageJson.dataSources;
    for (const [id, actualFields, forecastFields] of [
      ['overall-monthly-trend', ['core-actual', 'communication-actual'], ['core-forecast', 'communication-forecast']],
      ['region-monthly-trend', ['stable-actual', 'one-off-actual'], ['stable-forecast', 'one-off-forecast']]
    ] as const) {
      const rows = sources[id]!.source.initial.rows;
      expect(rows).toHaveLength(12);
      rows.forEach((row, index) => {
        for (const field of index < 2 ? actualFields : forecastFields) {
          expect(typeof row[field], `${id}:${index}:${field}`).toBe('number');
        }
        for (const field of index < 2 ? forecastFields : actualFields) {
          expect(row[field], `${id}:${index}:${field}`).toBeNull();
        }
      });
    }

    const parsed = parsePage(flowReportPageJson);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const charts = parsed.page.sections.flatMap((section) => section.components)
      .filter((component) => component.type === 'barChart');
    expect(charts.every((chart) => chart.props.stacked === true)).toBe(true);
    expect(charts.every((chart) => chart.props.series.length === 4)).toBe(true);
    expect(charts.every((chart) => chart.props.actions === undefined)).toBe(true);
  });

  it('三个 AI 总结只装配各自声明的数据源和字段白名单', () => {
    const parsed = parsePage(flowReportPageJson);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const summaries = parsed.page.sections.flatMap((section) => section.components)
      .filter((component) => component.type === 'aiSummary');
    const snapshots = new Map(
      Object.entries(parsed.page.dataSources).map(([id, source]) => [
        id,
        source.source.type === 'query' && source.source.initial
          ? { status: 'ready' as const, rows: source.source.initial.rows }
          : { status: 'empty' as const }
      ])
    );
    const requests = summaries.map((summary) => assembleAiSummaryRequest(summary.props, snapshots));

    expect(requests.every((request) => request.status === 'ready')).toBe(true);
    expect(requests.map((request) => request.status === 'ready'
      ? request.request.datasets.map((dataset) => dataset.id)
      : [])).toEqual([
      ['growth', 'decline', 'risk'],
      ['tracks'],
      ['industries']
    ]);
    for (const request of requests) {
      if (request.status !== 'ready') continue;
      for (const dataset of request.request.datasets) {
        expect(Object.keys(dataset.data).sort()).toEqual(
          Object.keys(request.request.termMapping)
            .filter((field) => Object.hasOwn(dataset.data, field))
            .sort()
        );
      }
    }
  });
});
