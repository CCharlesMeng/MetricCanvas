import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, JsonObject } from '@metriccanvas/page';
import {
  DqeGatewayError,
  createDqeGateway,
  effectiveDqeItem
} from '../src/dqe';

const fullDslItem: JsonObject = {
  output_metrics: ['NA客户数'],
  output_dims: ['客户级别'],
  filter: {
    time: {
      period: 'month',
      is_aggregate: true,
      start: '2026-07',
      end: '2026-07'
    },
    dims: [
      { dim_name: '地区部', dim_value_list: ['中国地区部'] },
      {
        dim_name: '客户级别',
        dim_value_list: ['卓越NA', '战略NA', '核心NA']
      }
    ],
    metrics: []
  },
  order: {}
};

function dqeQuery(
  item: JsonObject,
  fields: EffectiveQuery['fieldMappings'] = {
    'customer-level': {
      queryField: '客户级别',
      type: 'string',
      role: 'dimension'
    },
    'na-customer-count': {
      queryField: 'NA客户数',
      type: 'number',
      role: 'measure'
    }
  }
): EffectiveQuery {
  return {
    language: 'dqe',
    body: { dsl_list: [item] },
    fieldMappings: fields,
    filterValues: []
  };
}

describe('DQE 数据网关', () => {
  it('完整保留复杂 DQE 项，并把同一轮逻辑查询合并为一个请求', async () => {
    const sent: unknown[] = [];
    const secondItem: JsonObject = {
      ...fullDslItem,
      filter: {
        ...(fullDslItem.filter as JsonObject),
        dims: [
          { dim_name: '地区部', dim_value_list: ['中国地区部'] },
          { dim_name: '客户级别', dim_value_list: ['卓越TOP', '战略TOP'] }
        ]
      }
    };
    const gateway = createDqeGateway({
      endpoint: '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',
      fetchImpl: (async (_input, init) => {
        sent.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            retDesc: null,
            results: [
              {
                code: 'SUCCESS',
                data: [{ 客户级别: '卓越NA', NA客户数: 15 }],
                total_count: 1
              },
              {
                code: 'SUCCESS',
                data: [{ 客户级别: '卓越TOP', NA客户数: 8 }],
                total_count: 1
              }
            ]
          })
        );
      }) as typeof fetch
    });

    const [naRows, topRows] = await Promise.all([
      gateway.fetchData(dqeQuery(fullDslItem)),
      gateway.fetchData(dqeQuery(secondItem))
    ]);

    expect(sent).toEqual([{ dsl_list: [fullDslItem, secondItem] }]);
    expect(naRows).toEqual({
      rows: [{ 'customer-level': '卓越NA', 'na-customer-count': 15 }],
      totalCount: 1
    });
    expect(topRows).toEqual({
      rows: [{ 'customer-level': '卓越TOP', 'na-customer-count': 8 }],
      totalCount: 1
    });
  });

  it('单项失败只拒绝对应逻辑查询', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [
              { code: 'FAILED', data: [], total_count: 'ignored' },
              {
                code: 'SUCCESS',
                data: [{ 客户级别: '卓越NA', NA客户数: 15 }],
                total_count: 1
              }
            ]
          })
        )) as typeof fetch
    });

    const [failed, succeeded] = await Promise.allSettled([
      gateway.fetchData(dqeQuery(fullDslItem)),
      gateway.fetchData(dqeQuery(fullDslItem))
    ]);

    expect(failed.status).toBe('rejected');
    expect(
      failed.status === 'rejected' ? (failed.reason as DqeGatewayError).code : ''
    ).toBe('DQE_ITEM_ERROR');
    expect(succeeded).toEqual({
      status: 'fulfilled',
      value: {
        rows: [{ 'customer-level': '卓越NA', 'na-customer-count': 15 }],
        totalCount: 1
      }
    });
  });

  it('拒绝 results 数量不匹配，避免错位回填', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(JSON.stringify({ retCode: 'CBC.0000', results: [] }))) as typeof fetch
    });

    await expect(gateway.fetchData(dqeQuery(fullDslItem))).rejects.toMatchObject({
      code: 'DQE_ENVELOPE_ERROR'
    });
  });

  it('按显式筛选绑定覆盖副本，不修改页面保存的原始 DQE', () => {
    const query = dqeQuery(fullDslItem);
    query.pagination = { offset: 20, limit: 10 };
    query.filterValues = [
      {
        target: 'dimension',
        queryField: '客户级别',
        values: ['核心NA']
      },
      {
        target: 'time',
        value: { from: '2026-08', to: '2026-08' }
      }
    ];

    const effective = effectiveDqeItem(query);
    expect(
      ((effective.filter as JsonObject).dims as JsonObject[]).find(
        (item) => item.dim_name === '客户级别'
      )?.dim_value_list
    ).toEqual(['核心NA']);
    expect((effective.filter as JsonObject).time).toMatchObject({
      period: 'month',
      is_aggregate: true,
      start: '2026-08',
      end: '2026-08'
    });
    expect(effective.order).toEqual({ offset: 20, limit: 10 });
    expect(fullDslItem.order).toEqual({});
    expect(
      (((fullDslItem.filter as JsonObject).dims as JsonObject[])[1] as JsonObject)
        .dim_value_list
    ).toEqual(['卓越NA', '战略NA', '核心NA']);
  });

  it('按结果字段契约保留百分比字符串和可空日期', async () => {
    const item: JsonObject = {
      output_metrics: ['未考察占比'],
      output_dims: ['最近一次公司考察时间'],
      filter: { dims: [], metrics: [] },
      order: {}
    };
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [
              {
                code: 'SUCCESS',
                data: [{ 未考察占比: '41.67%', 最近一次公司考察时间: null }],
                total_count: 1
              }
            ]
          })
        )) as typeof fetch
    });

    await expect(
      gateway.fetchData(
        dqeQuery(item, {
          'missing-rate': {
            queryField: '未考察占比',
            type: 'string',
            role: 'measure'
          },
          'last-inspection': {
            queryField: '最近一次公司考察时间',
            type: 'date',
            role: 'dimension',
            nullable: true
          }
        })
      )
    ).resolves.toEqual({
      rows: [{ 'missing-rate': '41.67%', 'last-inspection': null }],
      totalCount: 1
    });
  });

  it('按项级查询字段映射归一化嵌套明细', async () => {
    const item: JsonObject = {
      output_metrics: ['流水', '云服务流水归因明细'],
      output_dims: ['客户名称'],
      filter: { dims: [], metrics: [] },
      order: {}
    };
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [{
              code: 'SUCCESS',
              data: [{
                '客户名称': '客户A',
                '流水': 100,
                '云服务流水归因明细': [{
                  '云服务': 'ModelArts',
                  '归因波动金额': -20,
                  '原因': '到期未续订',
                  '未映射的追加字段': '不泄漏到快照'
                }]
              }],
              total_count: 1
            }]
          })
        )) as typeof fetch
    });

    await expect(
      gateway.fetchData(
        dqeQuery(item, {
          customer: {
            queryField: '客户名称',
            type: 'string',
            role: 'dimension'
          },
          revenue: {
            queryField: '流水',
            type: 'number',
            role: 'measure'
          },
          attributions: {
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
                  queryField: '归因波动金额',
                  type: 'number',
                  role: 'measure'
                },
                reason: {
                  queryField: '原因',
                  type: 'string',
                  role: 'dimension'
                }
              }
            }
          }
        })
      )
    ).resolves.toEqual({
      rows: [{
        customer: '客户A',
        revenue: 100,
        attributions: [{ service: 'ModelArts', delta: -20, reason: '到期未续订' }]
      }],
      totalCount: 1
    });
  });

  it('把 DQE 语义 HTML 作为不透明 detail 字符串映射，不在数据网关解释样式', async () => {
    const item: JsonObject = {
      output_metrics: ['流水', '云服务流水归因明细'],
      output_dims: ['客户名称'],
      filter: { dims: [], metrics: [] },
      order: {}
    };
    const semanticHtml =
      '<span class="detail-value tone-negative">-12.0万</span>';
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [{
              code: 'SUCCESS',
              data: [{
                '客户名称': '客户A',
                '流水': 100,
                '云服务流水归因明细': semanticHtml
              }],
              total_count: 1
            }]
          })
        )) as typeof fetch
    });

    await expect(
      gateway.fetchData(
        dqeQuery(item, {
          customer: {
            queryField: '客户名称',
            type: 'string',
            role: 'dimension'
          },
          revenue: {
            queryField: '流水',
            type: 'number',
            role: 'measure'
          },
          attributions: {
            queryField: '云服务流水归因明细',
            type: 'semanticHtml',
            role: 'detail'
          }
        })
      )
    ).resolves.toEqual({
      rows: [{ customer: '客户A', revenue: 100, attributions: semanticHtml }],
      totalCount: 1
    });
  });

  it('下钻覆盖截止日期时保留查询定义中的小于运算符', () => {
    const item: JsonObject = {
      output_metrics: [],
      output_dims: ['最近一次公司考察时间'],
      filter: {
        dims: [
          {
            dim_name: '最近一次公司考察时间',
            dim_value_list: ['2024-01-01'],
            operator: '<'
          }
        ],
        metrics: []
      },
      order: {}
    };
    const query = dqeQuery(item, {
      'last-inspection': {
        queryField: '最近一次公司考察时间',
        type: 'date',
        role: 'dimension',
        nullable: true
      }
    });
    query.filterValues = [
      {
        target: 'dimension',
        queryField: '最近一次公司考察时间',
        values: ['2026-01-01']
      }
    ];

    expect(effectiveDqeItem(query)).toMatchObject({
      filter: {
        dims: [
          {
            dim_name: '最近一次公司考察时间',
            dim_value_list: ['2026-01-01'],
            operator: '<'
          }
        ]
      }
    });
  });

  it('行契约错误只报告行号、字段与预期类型,不回显业务字段值', async () => {
    const sentinel = '机密客户名-绝不入错误信息';
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [
              {
                code: 'SUCCESS',
                data: [{ 客户级别: '卓越NA', NA客户数: sentinel }],
                total_count: 1
              }
            ]
          })
        )) as typeof fetch
    });

    const outcome = await gateway
      .fetchData(dqeQuery(fullDslItem))
      .then(() => {
        throw new Error('行契约违规必须拒绝');
      })
      .catch((error: DqeGatewayError) => error);

    expect(outcome.code).toBe('DQE_ROW_CONTRACT_ERROR');
    expect(outcome.message).toContain('NA客户数');
    expect(outcome.detail).toMatchObject({
      rowIndex: 0,
      fieldId: 'na-customer-count',
      expectedType: 'number'
    });
    expect(
      JSON.stringify({ message: outcome.message, detail: outcome.detail })
    ).not.toContain(sentinel);
  });

  it('nullable=false 的字段在数据网关拒绝 null', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [
              {
                code: 'SUCCESS',
                data: [{ 客户级别: '卓越NA', NA客户数: null }],
                total_count: 1
              }
            ]
          })
        )) as typeof fetch
    });

    await expect(
      gateway.fetchData(
        dqeQuery(fullDslItem, {
          'customer-level': {
            queryField: '客户级别',
            type: 'string',
            role: 'dimension'
          },
          'na-customer-count': {
            queryField: 'NA客户数',
            type: 'number',
            role: 'measure',
            nullable: false
          }
        })
      )
    ).rejects.toMatchObject({
      code: 'DQE_ROW_CONTRACT_ERROR',
      message: expect.stringContaining('nullable=false')
    });
  });

});
