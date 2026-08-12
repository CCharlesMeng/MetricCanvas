import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '../src/validate';

function rawPage(): any {
  return {
    schemaVersion: '5.0',
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
  it('使用现有查询字段映射归一化内嵌初始行', () => {
    const document = rawPage();
    document.dataSources.overview.source.initial = {
      capturedAt: '2026-08-05T15:32:01+08:00',
      rows: [{ 客户级别: '卓越NA', NA客户数: 15 }],
      totalCount: 1
    };

    const parsed = parsePage(document);

    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors, null, 2));
    const source = parsed.page.dataSources.overview?.source;
    expect(source?.type).toBe('query');
    if (source?.type !== 'query') throw new Error('测试数据源必须为 query');
    expect(source.initial?.rows).toEqual([{ level: '卓越NA', count: 15 }]);
  });

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

  it('递归映射一层对象数组并以 detail 角色交给明细排行卡', () => {
    const page = rawPage();
    page.dataSources.overview.fields.attributions = {
      queryField: '云服务流水归因明细',
      type: 'recordList',
      role: 'detail',
      items: {
        fields: {
          service: {
            queryField: '云服务',
            type: 'string',
            role: 'dimension'
          },
          delta: {
            queryField: '云服务归因波动金额',
            type: 'number',
            role: 'measure'
          },
          reason: {
            queryField: '云服务波动原因',
            type: 'string',
            role: 'dimension'
          }
        }
      }
    };
    page.dataSources.overview.source.query.body.dsl_list[0].output_metrics.push(
      '云服务流水归因明细'
    );
    page.dataSources.overview.source.initial = {
      capturedAt: '2026-08-05T15:32:01+08:00',
      rows: [{
        '客户级别': '卓越NA',
        'NA客户数': 15,
        '云服务流水归因明细': [{
          '云服务': 'ModelArts',
          '云服务归因波动金额': -1200,
          '云服务波动原因': '到期未续订'
        }]
      }],
      totalCount: 1
    };
    page.sections[0].components = [{
      id: 'ranking',
      type: 'rankingDetailCard',
      layout: { span: 12 },
      data: { main: 'overview' },
      props: {
        nameField: 'level',
        valueField: 'count',
        details: {
          field: 'attributions',
          titleField: 'service',
          valueField: { field: 'delta', format: 'number-grouped' },
          descriptionField: 'reason'
        }
      }
    }];

    const parsed = parsePage(page);

    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors, null, 2));
    const source = parsed.page.dataSources.overview?.source;
    if (source?.type !== 'query') throw new Error('测试数据源必须为 query');
    expect(source.initial?.rows).toEqual([{
      level: '卓越NA',
      count: 15,
      attributions: [{ service: 'ModelArts', delta: -1200, reason: '到期未续订' }]
    }]);
  });

  it('把嵌套明细类型错误定位到明细项与原始字段', () => {
    const page = rawPage();
    page.dataSources.overview.fields.attributions = {
      queryField: '归因明细',
      type: 'recordList',
      role: 'detail',
      items: {
        fields: {
          delta: {
            queryField: '波动金额',
            type: 'number',
            role: 'measure'
          }
        }
      }
    };
    page.dataSources.overview.source.query.body.dsl_list[0].output_metrics.push('归因明细');
    page.dataSources.overview.source.initial = {
      capturedAt: '2026-08-05T15:32:01+08:00',
      rows: [{ '客户级别': '卓越NA', 'NA客户数': 15, '归因明细': [{ '波动金额': '非数字' }] }]
    };

    expect(validate(page)).toContainEqual(
      expect.objectContaining({
        path: '/dataSources/overview/source/initial/rows/0/归因明细/0/波动金额'
      })
    );
  });

  it('把 DQE 语义 HTML 映射为受控 detail 字段', () => {
    const page = rawPage();
    page.dataSources.overview.fields.attributions = {
      queryField: '归因明细HTML',
      type: 'semanticHtml',
      role: 'detail'
    };
    page.dataSources.overview.source.query.body.dsl_list[0].output_metrics.push(
      '归因明细HTML'
    );
    page.dataSources.overview.source.initial = {
      capturedAt: '2026-08-05T15:32:01+08:00',
      rows: [{
        '客户级别': '卓越NA',
        'NA客户数': 15,
        '归因明细HTML': '<span class="tone-negative">-12.0万</span>'
      }]
    };
    page.sections[0].components = [{
      id: 'ranking',
      type: 'rankingDetailCard',
      layout: { span: 12 },
      data: { main: 'overview' },
      props: {
        nameField: 'level',
        valueField: 'count',
        semanticDescriptionField: 'attributions'
      }
    }];

    const parsed = parsePage(page);

    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors, null, 2));
    const source = parsed.page.dataSources.overview?.source;
    if (source?.type !== 'query') throw new Error('测试数据源必须为 query');
    expect(source.initial?.rows[0]?.attributions).toBe(
      '<span class="tone-negative">-12.0万</span>'
    );
  });

  it('拒绝超过上限的 DQE 语义 HTML', () => {
    const page = rawPage();
    page.dataSources.overview.fields.attributions = {
      queryField: '归因明细HTML',
      type: 'semanticHtml',
      role: 'detail'
    };
    page.dataSources.overview.source.query.body.dsl_list[0].output_metrics.push(
      '归因明细HTML'
    );
    page.dataSources.overview.source.initial = {
      capturedAt: '2026-08-05T15:32:01+08:00',
      rows: [{
        '客户级别': '卓越NA',
        'NA客户数': 15,
        '归因明细HTML': 'x'.repeat(64_001)
      }]
    };

    expect(validate(page)).toContainEqual(
      expect.objectContaining({
        path: '/dataSources/overview/source/initial/rows/0/归因明细HTML'
      })
    );
  });

  it('多数据槽表格要求所有数据槽声明同类型维度 rowKey', () => {
    const page = rawPage();
    page.dataSources.compare = structuredClone(page.dataSources.overview);
    page.sections[0].components = [
      {
        id: 'table',
        type: 'table',
        layout: { span: 12 },
        data: { main: 'overview', compare: 'compare' },
        props: {
          rowKey: 'level',
          columns: [
            { field: 'count' },
            { field: { data: 'compare', field: 'count' } }
          ],
          pagination: { mode: 'none' }
        }
      }
    ];

    expect(validate(page)).toEqual([]);

    delete page.sections[0].components[0].props.rowKey;
    expect(validate(page)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/0/props/rowKey'
      })
    );
  });
});
