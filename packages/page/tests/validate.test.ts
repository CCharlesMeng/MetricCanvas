import { describe, expect, it } from 'vitest';
import { validate } from '../src';
import inlineReport from '../fixtures/contract-valid/inline-report.json';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';

describe('v4 data source 与 binding 校验', () => {
  it('展示字段绑定允许 format，action 字段引用拒绝 format', () => {
    const display: any = structuredClone(inlineReport);
    display.sections[0].components[1].props.rows[0].valueField = {
      data: 'main',
      field: 'gmv',
      format: 'number-grouped'
    };
    expect(validate(display)).toEqual([]);

    const action: any = structuredClone(queryDashboard);
    action.sections[0].components[0].props.actions[0].field = {
      data: 'main',
      field: 'region',
      format: 'text'
    };
    expect(validate(action)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/0/props/actions/0/field/format'
      })
    );
  });

  it('拒绝旧版本、旧结构化查询和旧字段角色', () => {
    for (const version of ['1.0', '2.0', '3.0']) {
      const oldVersion: any = structuredClone(queryDashboard);
      oldVersion.schemaVersion = version;
      expect(validate(oldVersion)).toContainEqual(
        expect.objectContaining({ path: '/schemaVersion' })
      );
    }

    const oldQuery: any = structuredClone(queryDashboard);
    oldQuery.dataSources.sales.source.query = {
      metrics: ['gmv'],
      dimensions: ['region']
    };
    expect(validate(oldQuery)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining('/dataSources/sales/source/query')
        })
      ])
    );

    const oldRole: any = structuredClone(inlineReport);
    oldRole.dataSources.overview.fields.gmv.role = 'metric';
    expect(validate(oldRole)).toContainEqual(
      expect.objectContaining({
        path: '/dataSources/overview/fields/gmv/role'
      })
    );
  });

  it('严格校验 source 判别联合、inline 行字段、类型与 nullable', () => {
    const sourceUnion: any = structuredClone(inlineReport);
    sourceUnion.dataSources.overview.source.query = {
      language: 'dqe',
      body: { dsl_list: [{}] }
    };
    expect(validate(sourceUnion)).toContainEqual(
      expect.objectContaining({
        path: '/dataSources/overview/source/query'
      })
    );

    const document: any = structuredClone(inlineReport);
    document.dataSources.overview.source.rows = [
      { gmv: 'not-number', unexpected: 1 },
      {},
      { gmv: null }
    ];

    const paths = validate(document).map((error) => error.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/dataSources/overview/source/rows/0/unexpected',
        '/dataSources/overview/source/rows/0/gmv',
        '/dataSources/overview/source/rows/1/gmv',
        '/dataSources/overview/source/rows/2/gmv'
      ])
    );
  });

  it('命名槽必须存在，字段必须属于该槽且 role 匹配', () => {
    const document: any = structuredClone(inlineReport);
    document.dataSources.compare = {
      fields: {
        previous: {
          type: 'number',
          role: 'measure'
        }
      },
      source: {
        type: 'inline',
        rows: [{ previous: 10 }]
      }
    };
    const card = document.sections[0].components[1];
    card.data.compare = 'compare';
    card.props.rows[0].changes = [
      {
        label: '较昨日',
        field: {
          data: 'compare',
          field: 'previous'
        }
      }
    ];
    expect(validate(document)).toEqual([]);

    card.props.rows[0].changes[0].field = {
      data: 'target',
      field: 'previous'
    };
    expect(validate(document)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/1/props/rows/0/changes/0/field'
      })
    );

    card.props.rows[0].changes[0].field = {
      data: 'compare',
      field: 'missing'
    };
    expect(validate(document)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/1/props/rows/0/changes/0/field'
      })
    );
  });

  it('inline 绑定拒绝 filters 与 actions，但允许本地分页', () => {
    const document: any = structuredClone(queryDashboard);
    document.dataSources.sales = {
      fields: {
        region: {
          type: 'string',
          role: 'dimension'
        },
        gmv: {
          type: 'number',
          role: 'measure'
        }
      },
      source: {
        type: 'inline',
        rows: [{ region: '华东', gmv: 100 }]
      }
    };
    document.sections[0].components[0].props.pagination = {
      mode: 'local',
      pageSize: 20
    };

    const paths = validate(document).map((error) => error.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/filters',
        '/sections/0/components/0/props/actions'
      ])
    );
  });

  it('校验内嵌初始行与查询分页完整第一页', () => {
    const valid: any = structuredClone(queryDashboard);
    valid.dataSources.sales.source.initial = {
      capturedAt: '2026-08-04T00:00:00+08:00',
      rows: [{ region: '华东', gmv: 42 }],
      totalCount: 1
    };
    expect(validate(valid)).toEqual([]);

    const invalidRow: any = structuredClone(valid);
    invalidRow.dataSources.sales.source.initial.rows = [{ region: '华东', gmv: '错误' }];
    expect(validate(invalidRow)).toContainEqual(
      expect.objectContaining({
        path: '/dataSources/sales/source/initial/rows/0/gmv'
      })
    );

    const incompletePage: any = structuredClone(valid);
    incompletePage.dataSources.sales.source.initial.totalCount = 30;
    expect(validate(incompletePage)).toContainEqual(
      expect.objectContaining({
        path: '/dataSources/sales/source/initial/rows',
        message: '查询分页的内嵌初始行必须是完整第一页'
      })
    );
  });

  it('查询分页数据源必须独占，且禁止排序与表头筛选', () => {
    const document: any = structuredClone(queryDashboard);
    document.sections[0].components[0].props.columns[0].sortable = true;
    const duplicate = structuredClone(document.sections[0].components[0]);
    duplicate.id = 'sales-table-copy';
    document.sections[0].components.push(duplicate);

    const errors = validate(document);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/sections/0/components/0/props/columns/0/sortable'
        }),
        expect.objectContaining({
          path: '/sections/0/components/0/data/main',
          message: expect.stringContaining('必须独占页面数据源')
        })
      ])
    );
  });

  it('允许通过列 metadata 强调表格数据单元格', () => {
    const document: any = structuredClone(queryDashboard);
    document.sections[0].components[0].props.columns[1].emphasis = 'strong';

    expect(validate(document)).toEqual([]);

    document.sections[0].components[0].props.columns[1].emphasis = 'bold';
    expect(validate(document)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/0/props/columns/1/emphasis'
      })
    );
  });

  it('允许组件布局声明与紧邻前一组件视觉连接', () => {
    const document: any = structuredClone(inlineReport);
    document.sections[0].components[1].layout.connectPrevious = true;

    expect(validate(document)).toEqual([]);

    document.sections[0].components[1].layout.connectPrevious = 'yes';
    expect(validate(document)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/1/layout/connectPrevious'
      })
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
