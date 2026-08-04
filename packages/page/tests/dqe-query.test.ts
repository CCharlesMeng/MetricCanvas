import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';

function rawPage(): any {
  return {
    schemaVersion: '4.0',
    id: 'dqe-page',
    filters: [
      {
        id: 'region-filter',
        type: 'dimension',
        dimension: 'region',
        default: ['cn']
      }
    ],
    dataSources: {
      overview: {
        fields: {
          level: {
            queryField: '客户级别',
            type: 'string',
            role: 'dimension'
          },
          count: {
            queryField: 'NA客户数',
            type: 'number',
            role: 'measure'
          }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: {
              dsl_list: [
                {
                  output_dims: ['客户级别'],
                  output_metrics: ['NA客户数'],
                  filter: { dims: [], metrics: [] },
                  order: {}
                }
              ]
            },
            filterBindings: {
              'region-filter': { target: 'dimension', queryField: '地区部' }
            }
          }
        }
      }
    },
    sections: [
      {
        id: 'main',
        layout: { type: 'grid', columns: 12 },
        components: [
          {
            id: 'card',
            type: 'metricCard',
            layout: { span: 4 },
            data: { main: 'overview' },
            props: {
              rows: [
                {
                  label: '卓越',
                  valueField: {
                    data: 'main',
                    field: 'count',
                    match: { field: 'level', equals: '卓越NA' }
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

describe('raw DQE 页面查询', () => {
  it('显式结果字段映射、筛选绑定与标量行匹配通过校验', () => {
    expect(validate(rawPage())).toEqual([]);
  });

  it('拒绝隐式字段映射与未覆盖的 DQE 输出', () => {
    const page = rawPage();
    delete page.dataSources.overview.fields.count.queryField;
    expect(validate(page)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining('/fields/count')
        })
      ])
    );
  });

  it('拒绝多个页面字段映射同一个 DQE 字段', () => {
    const page = rawPage();
    page.dataSources.overview.fields.duplicate = {
      queryField: 'NA客户数',
      type: 'number',
      role: 'measure'
    };
    expect(validate(page)).toContainEqual(
      expect.objectContaining({
        path: '/dataSources/overview/fields/duplicate/queryField'
      })
    );
  });

  it('使用公式指标的 alias 作为 DQE 响应字段', () => {
    const page = rawPage();
    page.dataSources.overview.source.query.body.dsl_list[0].output_metrics = [
      { formula: 'COUNT(*)', alias: '数量' }
    ];
    page.dataSources.overview.fields.count.queryField = '数量';

    expect(validate(page)).toEqual([]);
  });
});
