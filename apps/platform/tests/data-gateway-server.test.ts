import { describe, expect, it } from 'vitest';
import { DEFAULT_DQE_ENDPOINT } from '@metriccanvas/data-gateway';
import type { EffectiveQuery, JsonObject } from '@metriccanvas/page';
import {
  createServerDataGateway,
  dataQueryHttpStatus,
  executeDataQuery,
  resolveDqeEndpoint
} from '../src/lib/server/data-gateway.server';

const dslItem: JsonObject = {
  output_metrics: ['NA客户数'],
  output_dims: ['客户级别'],
  filter: {
    time: { period: 'month', is_aggregate: true, start: '2026-07', end: '2026-07' },
    dims: [],
    metrics: []
  },
  order: {}
};

function effectiveQuery(): EffectiveQuery {
  return {
    language: 'dqe',
    body: { dsl_list: [dslItem] },
    fieldMappings: {
      'customer-level': { queryField: '客户级别', type: 'string', role: 'dimension' },
      'na-customer-count': { queryField: 'NA客户数', type: 'number', role: 'measure' }
    },
    filterValues: []
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

describe('平台服务端取数入口', () => {
  it('DQE_ENDPOINT 未配置时默认指向本机 DQE 仿真', () => {
    expect(resolveDqeEndpoint({})).toBe(`http://127.0.0.1:18228${DEFAULT_DQE_ENDPOINT}`);
    expect(resolveDqeEndpoint({ DQE_ENDPOINT: '  ' })).toBe(
      `http://127.0.0.1:18228${DEFAULT_DQE_ENDPOINT}`
    );
    expect(resolveDqeEndpoint({ DQE_ENDPOINT: 'https://dqe.internal/execute' })).toBe(
      'https://dqe.internal/execute'
    );
  });

  it('成功路径:按服务端端点执行并返回归一化行与总条数', async () => {
    const requests: Array<{ input: string; body: unknown }> = [];
    const gateway = createServerDataGateway({
      environment: {},
      fetchImpl: (async (input, init) => {
        requests.push({ input: String(input), body: JSON.parse(String(init?.body)) });
        return jsonResponse({
          retCode: 'CBC.0000',
          results: [
            {
              code: 'SUCCESS',
              data: [{ 客户级别: '卓越NA', NA客户数: 15 }],
              total_count: 1
            }
          ]
        });
      }) as typeof fetch
    });

    const result = await executeDataQuery(gateway, effectiveQuery());

    expect(requests).toEqual([
      {
        input: `http://127.0.0.1:18228${DEFAULT_DQE_ENDPOINT}`,
        body: { dsl_list: [dslItem] }
      }
    ]);
    expect(result).toEqual({
      ok: true,
      rows: [{ 'customer-level': '卓越NA', 'na-customer-count': 15 }],
      totalCount: 1
    });
    expect(dataQueryHttpStatus(result)).toBe(200);
  });

  it('协议错误:HTTP 失败与信封失败分别透传 DqeGatewayError.code', async () => {
    const httpFailure = await executeDataQuery(
      createServerDataGateway({
        environment: {},
        fetchImpl: (async () => new Response('bad gateway', { status: 502 })) as typeof fetch
      }),
      effectiveQuery()
    );
    expect(httpFailure).toMatchObject({ ok: false, code: 'DQE_TRANSPORT_ERROR' });
    expect(dataQueryHttpStatus(httpFailure)).toBe(502);

    const envelopeFailure = await executeDataQuery(
      createServerDataGateway({
        environment: {},
        fetchImpl: (async () =>
          jsonResponse({ retCode: 'CBC.9999', results: [] })) as typeof fetch
      }),
      effectiveQuery()
    );
    expect(envelopeFailure).toMatchObject({ ok: false, code: 'DQE_ENVELOPE_ERROR' });
    expect(dataQueryHttpStatus(envelopeFailure)).toBe(502);
  });

  it('映射错误:响应缺少查询字段映射声明的字段时返回 DQE_FIELD_MAPPING_ERROR', async () => {
    const gateway = createServerDataGateway({
      environment: {},
      fetchImpl: (async () =>
        jsonResponse({
          retCode: 'CBC.0000',
          results: [
            {
              code: 'SUCCESS',
              data: [{ 客户级别: '卓越NA' }],
              total_count: 1
            }
          ]
        })) as typeof fetch
    });

    const result = await executeDataQuery(gateway, effectiveQuery());

    expect(result).toMatchObject({ ok: false, code: 'DQE_FIELD_MAPPING_ERROR' });
    expect(result.ok === false && result.message).toContain('NA客户数');
    expect(dataQueryHttpStatus(result)).toBe(502);
  });

  it('边界校验:不合法的请求体收敛为 DQE_CONFIG_ERROR 并回 400', async () => {
    const gateway = createServerDataGateway({
      environment: {},
      fetchImpl: (async () => {
        throw new Error('不应发起上游请求');
      }) as typeof fetch
    });

    for (const payload of [
      undefined,
      'not-an-object',
      { language: 'sql' },
      { language: 'dqe', body: { dsl_list: [] }, fieldMappings: {}, filterValues: [] },
      { language: 'dqe', body: { dsl_list: [dslItem] }, filterValues: [] },
      { ...effectiveQuery(), pagination: { offset: -1, limit: 20 } }
    ]) {
      const result = await executeDataQuery(gateway, payload);
      expect(result).toMatchObject({ ok: false, code: 'DQE_CONFIG_ERROR' });
      expect(dataQueryHttpStatus(result)).toBe(400);
    }
  });
});
