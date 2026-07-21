import { describe, expect, it } from 'vitest';
import { validate } from '../src';
import inlineReport from '../fixtures/contract-valid/inline-report.json';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';

describe('data source 与 binding 校验', () => {
  it('严格校验 source 判别联合与 inline 行字段/类型', () => {
    const sourceUnion: any = structuredClone(inlineReport);
    sourceUnion.dataSources.overview.source.query = { metrics: ['gmv'] };
    expect(validate(sourceUnion)).toContainEqual(
      expect.objectContaining({ path: '/dataSources/overview/source/query' })
    );

    const document: any = structuredClone(inlineReport);
    document.dataSources.overview.source.rows = [
      { gmv: 'not-number', unexpected: 1 },
      {}
    ];

    const paths = validate(document).map((error) => error.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dataSources/overview/source/rows/0/unexpected',
        '/dataSources/overview/source/rows/0/gmv',
        '/dataSources/overview/source/rows/1/gmv'
      ])
    );
  });

  it('query 输出与字段契约必须完整一致，dimension/metric role 不得互换', () => {
    const document: any = structuredClone(queryDashboard);
    document.dataSources.sales.fields.region.role = 'metric';
    delete document.dataSources.sales.fields.gmv;
    document.dataSources.sales.fields.extra = { type: 'number', role: 'metric' };

    expect(validate(document).map((error) => error.path)).toEqual(
      expect.arrayContaining([
        '/dataSources/sales/fields/region/role',
        '/dataSources/sales/fields/gmv',
        '/dataSources/sales/fields/extra'
      ])
    );
  });

  it('命名槽必须存在并指向数据源，字段必须属于该槽且 role 匹配', () => {
    const document: any = structuredClone(inlineReport);
    document.dataSources.compare = {
      fields: {
        previous: { type: 'number', role: 'metric' }
      },
      source: { type: 'inline', rows: [{ previous: 10 }] }
    };
    const metric = document.sections[0].components[1];
    metric.data.compare = 'compare';
    metric.props.rows[0].changes = [
      { label: '较昨日', field: { data: 'compare', field: 'previous' } }
    ];
    expect(validate(document)).toEqual([]);

    metric.props.rows[0].changes[0].field = { data: 'target', field: 'previous' };
    expect(validate(document)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/1/props/rows/0/changes/0/field'
      })
    );

    metric.props.rows[0].changes[0].field = { data: 'compare', field: 'missing' };
    expect(validate(document)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/1/props/rows/0/changes/0/field'
      })
    );
  });

  it('inline 绑定拒绝 filters、actions 与 paged 远程分页', () => {
    const document: any = structuredClone(queryDashboard);
    document.dataSources.sales.source = {
      type: 'inline',
      rows: [{ region: '华东', gmv: 100 }]
    };

    const paths = validate(document).map((error) => error.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/filters',
        '/sections/0/components/0/props/actions',
        '/sections/0/components/0/props/pagination'
      ])
    );
  });

  it('additionalProperties:false 覆盖字段、数据源、section、layout、data 与 props', () => {
    const document: any = structuredClone(inlineReport);
    document.dataSources.overview.unknown = true;
    document.dataSources.overview.fields.gmv.unknown = true;
    document.sections[0].unknown = true;
    document.sections[0].components[1].layout.x = 0;
    document.sections[0].components[1].data.other = 'overview';
    document.sections[0].components[1].props.unknown = true;

    const paths = validate(document).map((error) => error.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dataSources/overview/unknown',
        '/dataSources/overview/fields/gmv/unknown',
        '/sections/0/unknown',
        '/sections/0/components/1/layout/x',
        '/sections/0/components/1/data/other',
        '/sections/0/components/1/props/unknown'
      ])
    );
  });
});
