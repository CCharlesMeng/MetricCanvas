import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '@metriccanvas/page';
import flowReportPageJson from '../../../pages/flow-analysis-report.json';
import flowFixtureJson from '../../../tools/dqe-sim/fixtures/flow-analysis-report.json';

type JsonRow = Record<string, string | number | boolean | null>;

interface RawQuerySource {
  fields: Record<string, { queryField: string }>;
  source: {
    type: string;
    initial?: { capturedAt: string; rows: JsonRow[]; totalCount?: number };
    query: {
      language: string;
      body: { dsl_list: Array<Record<string, unknown>> };
    };
  };
}

interface FixtureQuery {
  output_dims: string[];
  output_metrics: string[];
  time: { period: string; is_aggregate?: boolean; start: string; end: string };
  filter?: { dims?: unknown[]; metrics?: unknown[] };
  order?: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
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
    const growthSource = parsed.page.dataSources['customer-growth-top']?.source;
    expect(growthSource?.type).toBe('query');
    if (growthSource?.type === 'query') {
      expect(growthSource.initial?.rows).toHaveLength(10);
      expect(growthSource.initial?.totalCount).toBe(10);
    }
    expect(parsed.page.dataSources['customer-growth-top']?.fields['growth-description'])
      .toMatchObject({ type: 'semanticHtml', role: 'detail' });
    expect(parsed.page.sections.map((section) => section.id)).toEqual([
      'report-header',
      'flow-overview',
      'public-region-flow',
      'analysis-heading',
      'customer-analysis',
      'track-analysis',
      'industry-analysis'
    ]);
    expect(parsed.page.sections.map((section) => section.variant ?? null)).toEqual([
      null,
      'reportOverview',
      'reportOverview',
      'reportHeading',
      'reportCustomerAnalysis',
      'reportDimensionAnalysis',
      'reportDimensionAnalysis'
    ]);
    const components = parsed.page.sections.flatMap((section) => section.components);
    const growthRanking = components.find((component) => component.id === 'growth-ranking');
    expect(growthRanking?.type).toBe('rankingDetailCard');
    if (growthRanking?.type === 'rankingDetailCard') {
      expect(growthRanking.props.semanticDescriptionField).toBe('growth-description');
      expect(growthRanking.props.descriptionField).toBeUndefined();
    }
    expect(components.filter((component) => component.type === 'barChart')).toHaveLength(2);
    expect(components.filter((component) => component.type === 'metricCard')).toHaveLength(7);
    expect(components.filter((component) => component.type === 'rankingDetailCard')).toHaveLength(2);
    expect(components.filter((component) => component.type === 'table')).toHaveLength(4);
    expect(components.filter((component) => component.type === 'aiSummary')).toHaveLength(0);

    const overviewCards = components.filter(
      (component) => component.type === 'metricCard' && component.props.variant === 'compactSummary'
    );
    const regionCards = components.filter(
      (component) => component.type === 'metricCard' && component.props.variant === 'dualSummary'
    );
    expect(overviewCards).toHaveLength(3);
    expect(regionCards).toHaveLength(4);
    expect(regionCards.map((component) => component.layout.span)).toEqual([4, 4, 4, 12]);
    expect(
      regionCards.map((component) =>
        component.type === 'metricCard' ? (component.props.panelLayout ?? 'stacked') : null
      )
    ).toEqual(['stacked', 'stacked', 'stacked', 'twoColumn']);
    expect(
      regionCards.map((component) =>
        component.type === 'metricCard' ? component.props.secondaryTitle : null
      )
    ).toEqual(['卓越', '战略', '核心', '商业市场']);
    expect(
      components.filter(
        (component) => component.type === 'text' && component.props.variant === 'riskNotice'
      )
    ).toHaveLength(2);
    expect(
      components.filter(
        (component) => component.type === 'barChart' && component.props.variant === 'reportForecast'
      )
    ).toHaveLength(2);
    expect(
      components.filter(
        (component) =>
          component.type === 'text' &&
          ['customer-summary', 'track-summary', 'industry-summary'].includes(component.id) &&
          component.props.variant === 'reportInline'
      )
    ).toHaveLength(3);
    expect(
      components.filter(
        (component) => component.type === 'rankingDetailCard' && component.props.variant === 'report'
      )
    ).toHaveLength(2);
    expect(
      components.filter(
        (component) => component.type === 'table' && component.props.variant === 'reportCompact'
      )
    ).toHaveLength(4);
  });

  it('九个独立 query 均有显式 queryField 和严格 DQE 签名，真实下降查询不用 initial 阻止首查', () => {
    const sources: Record<string, RawQuerySource> = flowReportPageJson.dataSources;
    expect(Object.keys(sources)).toEqual(expectedSourceIds);

    for (const id of expectedSourceIds) {
      const source = sources[id]!;
      const queryFixture = fixture.queries[id]!;
      expect(source.source.type, id).toBe('query');
      if (id === 'customer-decline-top') {
        expect(source.source.initial, id).toBeUndefined();
      } else {
        expect(source.source.initial?.capturedAt, id).toBe(fixture.capturedAt);
        expect(source.source.initial?.rows, id).toEqual(queryFixture.rows);
        expect(source.source.initial?.totalCount, id).toBe(queryFixture.rows.length);
      }
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
          filter: {
            time: queryFixture.time,
            ...(queryFixture.filter
              ? queryFixture.filter
              : { dims: [], metrics: [] })
          },
          order: queryFixture.order ?? {}
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
      const initial = sources[id]!.source.initial;
      if (!initial) throw new Error(`${id} 必须有内嵌初始行`);
      const rows = initial.rows;
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

  it('报告页声明涨跌箭头、可配置堆叠顺序与金额标签，并保持客户表文字中性', () => {
    const parsed = parsePage(flowReportPageJson);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const components = parsed.page.sections.flatMap((section) => section.components);
    const metrics = components.filter((component) => component.type === 'metricCard');
    const charts = components.filter((component) => component.type === 'barChart');
    const customerTableColumns = components.flatMap((component) =>
      component.type === 'table' &&
      (component.id === 'yoy-drop-table' || component.id === 'risk-table')
        ? component.props.columns
        : []
    );

    expect(metrics.every((metric) => metric.props.showTrendArrows === true)).toBe(true);
    expect(charts.every((chart) => chart.props.showSegmentLabels === true)).toBe(true);
    expect(charts.every((chart) => chart.props.showStackTotalLabels === true)).toBe(true);
    expect(
      charts.map((chart) => chart.props.series.map((series) => series.stackOrder))
    ).toEqual([
      [2, 1, 2, 1],
      [2, 1, 2, 1]
    ]);
    expect(
      customerTableColumns.every(
        (column) => !('dangerValues' in column) || column.dangerValues === undefined
      )
    ).toBe(true);
  });

  it('三个摘要由页面文档直接返回受控语义 HTML text 正文，不声明 SSE AI 总结', () => {
    const parsed = parsePage(flowReportPageJson);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const components = parsed.page.sections.flatMap((section) => section.components);
    const summaries = components
      .filter((component) =>
        ['customer-summary', 'track-summary', 'industry-summary'].includes(component.id)
      )
      .map((component) => {
        if (component.type !== 'text') throw new Error(`${component.id} 必须是 text`);
        return component;
      });

    expect(components.some((component) => component.type === 'aiSummary')).toBe(false);
    expect(summaries.every((summary) => summary.props.variant === 'reportInline')).toBe(true);
    expect(summaries.every((summary) => summary.props.title === undefined)).toBe(true);
    expect(summaries.every((summary) => summary.props.bodyFormat === 'semanticHtml')).toBe(true);
    expect(summaries.every((summary) => typeof summary.props.body === 'string')).toBe(true);
    expect(summaries.every((summary) => summary.props.body?.includes('tone-positive'))).toBe(true);
    expect(summaries.every((summary) => summary.props.body?.includes('tone-negative'))).toBe(true);
    expect(summaries.every((summary) => summary.props.body?.startsWith('<span>'))).toBe(true);
    expect(summaries.every((summary) => summary.props.body?.endsWith('</span>'))).toBe(true);
    expect(summaries.every((summary) => !summary.props.body?.includes('<p>'))).toBe(true);
  });
});
