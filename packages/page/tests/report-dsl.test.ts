import { describe, expect, it } from 'vitest';
import {
  derivePageCapabilities,
  validate,
  type Page
} from '../src';
import inlineReport from '../fixtures/contract-valid/inline-report.json';
import mixedPage from '../fixtures/contract-valid/mixed-page.json';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';

describe('1.0 data-source 页面契约', () => {
  it('接受 inline、query 与 mixed 三种页面，并精确推导组件能力', () => {
    expect(validate(inlineReport)).toEqual([]);
    expect(validate(queryDashboard)).toEqual([]);
    expect(validate(mixedPage)).toEqual([]);

    const inline = derivePageCapabilities(inlineReport as Page);
    expect(inline).toMatchObject({
      dataMode: 'inline',
      static: true,
      live: false,
      filters: false,
      actions: false,
      remotePagination: false
    });

    const query = derivePageCapabilities(queryDashboard as Page);
    expect(query).toMatchObject({
      dataMode: 'query',
      static: false,
      live: true,
      filters: true,
      actions: true,
      remotePagination: true
    });

    const mixed = derivePageCapabilities(mixedPage as Page);
    expect(mixed).toMatchObject({ dataMode: 'mixed', static: false, live: true });
    expect(mixed.components['target-card']).toMatchObject({
      dataMode: 'inline',
      live: false,
      filters: false
    });
    expect(mixed.components['sales-trend']).toMatchObject({
      dataMode: 'query',
      live: true,
      filters: true
    });
  });

  it('只接受 schemaVersion 与嵌套 components，拒绝旧根字段和组件内 query', () => {
    const oldPage = {
      formatVersion: '1.0',
      id: 'legacy',
      title: '旧页面',
      layout: { type: 'grid', columns: 12 },
      widgets: []
    };
    const oldPaths = validate(oldPage).map((error) => error.path);
    expect(oldPaths).toEqual(
      expect.arrayContaining([
        '/schemaVersion',
        '/formatVersion',
        '/title',
        '/layout',
        '/widgets'
      ])
    );

    const componentQuery: any = structuredClone(queryDashboard);
    componentQuery.sections[0].components[0].query = { metrics: ['gmv'] };
    expect(validate(componentQuery)).toContainEqual(
      expect.objectContaining({
        type: 'SCHEMA_ERROR',
        path: '/sections/0/components/0/query'
      })
    );
  });

  it('组件框架字段严格封闭，无数据组件不得绑定 data', () => {
    const document: any = structuredClone(inlineReport);
    document.sections[0].components[0].data = { main: 'overview' };
    document.sections[0].components[1].position = { x: 0, y: 0, w: 6, h: 2 };

    expect(validate(document).map((error) => error.path)).toEqual(
      expect.arrayContaining([
        '/sections/0/components/0/data',
        '/sections/0/components/1/position'
      ])
    );
  });
});
