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
  fields: NonNullable<EffectiveQuery['dqe']>['fieldMappings'] = {
    'customer-level': {
      queryField: '客户级别',
      type: 'string',
      role: 'dimension'
    },
    'na-customer-count': {
      queryField: 'NA客户数',
      type: 'number',
      role: 'metric'
    }
  }
): EffectiveQuery {
  return {
    metrics: Object.entries(fields)
      .filter(([, field]) => field.role === 'metric')
      .map(([id]) => id),
    dimensions: Object.entries(fields)
      .filter(([, field]) => field.role === 'dimension')
      .map(([id]) => id),
    conditions: [],
    dqe: {
      body: { dsl_list: [item] },
      fieldMappings: fields,
      filterValues: []
    }
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
                data: [{ 客户级别: '卓越NA', NA客户数: 15 }]
              },
              {
                code: 'SUCCESS',
                data: [{ 客户级别: '卓越TOP', NA客户数: 8 }]
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
    expect(naRows).toEqual([
      { 'customer-level': '卓越NA', 'na-customer-count': 15 }
    ]);
    expect(topRows).toEqual([
      { 'customer-level': '卓越TOP', 'na-customer-count': 8 }
    ]);
  });

  it('单项失败只拒绝对应逻辑查询', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [
              { code: 'FAILED', data: [] },
              {
                code: 'SUCCESS',
                data: [{ 客户级别: '卓越NA', NA客户数: 15 }]
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
      value: [{ 'customer-level': '卓越NA', 'na-customer-count': 15 }]
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
    query.dqe!.filterValues = [
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
    expect(
      (((fullDslItem.filter as JsonObject).dims as JsonObject[])[1] as JsonObject)
        .dim_value_list
    ).toEqual(['卓越NA', '战略NA', '核心NA']);
  });

});
