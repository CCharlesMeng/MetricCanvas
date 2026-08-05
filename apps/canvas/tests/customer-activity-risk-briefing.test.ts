import { describe, expect, it } from 'vitest';
import {
  isDqeQueryDefinition,
  parsePage,
  validate,
  type MetricCardComponent,
  type TableColumn,
  type TableComponent
} from '@metriccanvas/page';
import customerActivityRiskBriefing from '../../../pages/customer-activity-risk-briefing.json';

describe('客户活动风险简报页面文档', () => {
  it('通过当前契约，并声明查询驱动的表格联动', () => {
    expect(validate(customerActivityRiskBriefing)).toEqual([]);
    const parsed = parsePage(customerActivityRiskBriefing);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const page = parsed.page;
    const components = page.sections.flatMap((section) => section.components);
    expect(page.id).toBe('customer-activity-risk-briefing');
    expect(page.sections.some((section) => section.id === 'report-footer')).toBe(false);
    expect(components.filter((component) => component.type === 'table')).toHaveLength(16);
    expect(Object.values(page.dataSources).every((source) => source.source.type === 'query')).toBe(
      true
    );
    expect(page.filters).toHaveLength(9);
    expect(page.filters?.every((filter) => filter.visible === false)).toBe(true);

    const overview = page.sections.find((section) => section.id === 'customer-overviews');
    expect(overview?.components).toHaveLength(2);
    expect(
      overview?.components.map((component) => ({
        span: component.layout.span,
        rows: component.type === 'metricCard' ? component.props.rows.length : 0
      }))
    ).toEqual([
      { span: 6, rows: 3 },
      { span: 6, rows: 3 }
    ]);

    const overviewQueries = ['overview-na', 'overview-top'].map((id) => {
      const source = page.dataSources[id]!.source;
      expect(source.type).toBe('query');
      if (source.type !== 'query') throw new Error(`${id} 不是 query 数据源`);
      return source.query;
    });
    expect(overviewQueries.every(isDqeQueryDefinition)).toBe(true);
    const top100Query = overviewQueries[1]!;
    if (!isDqeQueryDefinition(top100Query)) throw new Error('overview-top 不是 DQE 查询');
    expect(top100Query.body.dsl_list[0]!.output_metrics).toEqual([
      { formula: 'COUNT(*)', alias: '数量' }
    ]);

    const progressTables = components.filter(
      (component): component is TableComponent =>
        component.type === 'table' && component.id.endsWith('-progress-table')
    );
    expect(progressTables).toHaveLength(4);
    for (const progressTable of progressTables) {
      const leafColumns = progressTable.props.columns
        .flatMap((column) =>
          'kind' in column && column.kind === 'group' ? column.children : [column]
        )
        .filter((column): column is TableColumn => column.kind !== 'group');
      expect(leafColumns.some((column) => column.selection !== undefined)).toBe(true);
      expect(
        leafColumns
          .filter((column) => column.title === '26年未开展客户数')
          .every((column) => column.selection === undefined)
      ).toBe(true);
    }

    const riskSummaries = components.filter((component) =>
      component.id.endsWith('-risk-summary')
    );
    expect(riskSummaries.map((component) => component.id)).toEqual([
      'inspection-risk-summary',
      'visit-risk-summary',
      'summit-risk-summary',
      'inactive-risk-summary'
    ]);
    expect(riskSummaries.every((component) => component.type === 'text')).toBe(true);
    for (const riskSummary of riskSummaries) {
      if (riskSummary.type !== 'text') throw new Error(`${riskSummary.id} 不是静态文本`);
      expect(riskSummary.data).toBeUndefined();
      expect(riskSummary.props).toMatchObject({ title: '风险总结', variant: 'insight' });
      expect(riskSummary.props.body?.trim()).not.toBe('');
    }
    expect(components.some((component) => component.type === 'aiSummary')).toBe(false);

    const activityCards = components.filter(
      (component): component is MetricCardComponent =>
        component.type === 'metricCard' && component.props.variant === 'activityProgress'
    );
    expect(
      activityCards.map((component) => ({
        ringPercent: (component.props.progress as { ringPercent?: number } | undefined)?.ringPercent,
        changeUnit:
          component.props.rows[0]?.changes?.[0] &&
          (component.props.rows[0].changes[0] as { unit?: string }).unit
      }))
    ).toEqual([
      { ringPercent: 75, changeUnit: '次' },
      { ringPercent: 75, changeUnit: '次' },
      { ringPercent: 75, changeUnit: '次' }
    ]);

    const tables = components.filter(
      (component): component is TableComponent => component.type === 'table'
    );
    expect(
      tables.every(
        (component) => (component.props as typeof component.props & { fit?: string }).fit === 'container'
      )
    ).toBe(true);
    expect(
      tables
        .filter((component) => component.id.endsWith('-detail-table'))
        .every((component) => component.layout.connectPrevious === true)
    ).toBe(true);

    const detailColumns = tables.flatMap((component) =>
      component.props.columns.flatMap((column) =>
        column.kind === 'group' ? column.children : [column]
      )
    );
    expect(
      detailColumns
        .filter(
          (column): column is TableColumn => column.kind !== 'group' && column.title === '序号'
        )
        .every((column) => column.align === 'left')
    ).toBe(true);
    expect(
      detailColumns
        .filter(
          (column): column is TableColumn =>
            column.kind !== 'group' && column.title?.startsWith('最近一次') === true
        )
        .every((column) => column.align === 'right')
    ).toBe(true);
  });

  it('保留按角色分组的局部显式字段', () => {
    const parsed = parsePage(customerActivityRiskBriefing);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const sourceLength = JSON.stringify(customerActivityRiskBriefing).length;
    const materializedLength = JSON.stringify(parsed.page).length;
    expect(sourceLength).toBeLessThan(materializedLength);
    expect('definitions' in customerActivityRiskBriefing).toBe(false);
    expect(customerActivityRiskBriefing.dataSources['inspection-detail']?.fields).toHaveProperty(
      'dimensions.customer-name',
      { label: '客户名称', queryField: '客户名称', type: 'string' }
    );
  });
});
