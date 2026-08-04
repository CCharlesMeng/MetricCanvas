import { describe, expect, it, vi } from 'vitest';
import {
  isDqeQueryDefinition,
  validate,
  type Page
} from '@metriccanvas/page';
import {
  DEFAULT_PREVIEW_PAGE,
  DEFAULT_PREVIEW_JSON,
  parsePreviewDocument
} from '../src/lib/preview-document';

describe('Page JSON 即时预览文档', () => {
  it('内置客户活动风险简报通过当前契约，并声明查询驱动的表格联动', () => {
    const result = parsePreviewDocument(
      DEFAULT_PREVIEW_JSON,
      validate
    );

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;

    const page = result.document as Page;
    const components = page.sections.flatMap((section) => section.components);
    expect(page.id).toBe('customer-activity-risk-briefing');
    expect(components.filter((component) => component.type === 'table')).toHaveLength(16);
    expect(Object.values(page.dataSources).every((source) => source.source.type === 'query')).toBe(
      true
    );
    expect(page.filters).toHaveLength(8);
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
    const progressTable = components.find(
      (component) => component.id === 'inspection-progress-table'
    );
    expect(progressTable?.type).toBe('table');
    if (progressTable?.type === 'table') {
      expect(
        progressTable.props.columns
          .flatMap((column) =>
            'kind' in column && column.kind === 'group' ? column.children : [column]
          )
          .filter((column) => !('kind' in column && column.kind === 'group'))
          .some((column) => column.selection !== undefined)
      ).toBe(true);
    }
  });

  it('默认预览直接使用 pages 中的正式页面文档，并通过 v4 校验', () => {
    expect(DEFAULT_PREVIEW_PAGE.id).toBe('customer-activity-risk-briefing');
    expect(validate(DEFAULT_PREVIEW_PAGE)).toEqual([]);
  });

  it('JSON 解析成功后调用 validator，并返回契约错误', () => {
    const validator = vi.fn(validate);
    const result = parsePreviewDocument('{"schemaVersion":"1.0"}', validator);

    expect(validator).toHaveBeenCalledOnce();
    expect(result.status).toBe('contract-error');
  });

  it('语法错误不会调用 validator，也不会抛出异常', () => {
    const validator = vi.fn(validate);
    const result = parsePreviewDocument('{"schemaVersion":', validator);

    expect(validator).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'syntax-error' });
  });
});
