import { afterEach, describe, expect, it } from 'vitest';
import type { EffectiveQuery, JsonObject } from '@metriccanvas/page/internal';
import { DqeGatewayError } from '@metriccanvas/engine/dqe';
import {
  MISSING_RUNTIME_CONFIG_MESSAGE,
  createInjectedDqeGateway,
  installRuntimeConfig,
  readRuntimeConfig
} from '../src/lib/runtime-config';

const completeConfig = {
  dqeEndpoint: 'https://dqe.example/rest/cdi/cdinl2databuilderservice/v1/dsl/execute',
  pageAssetsBaseUrl: 'https://pages.example/rest/cdi/pageassets/v1',
  authToken: 'token-1',
  operatorId: 'developer-1',
  workspaceId: 'ws-1'
};

const dslItem: JsonObject = {
  output_metrics: ['NA客户数'],
  output_dims: ['客户级别'],
  filter: { time: { period: 'month', is_aggregate: true, start: '2026-07', end: '2026-07' } },
  order: {}
};

const query: EffectiveQuery = {
  language: 'dqe',
  body: { dsl_list: [dslItem] },
  fieldMappings: {
    'customer-level': { queryField: '客户级别', type: 'string', role: 'dimension' },
    'na-customer-count': { queryField: 'NA客户数', type: 'number', role: 'measure' }
  },
  filterValues: []
};

function successResponse(): Response {
  return new Response(
    JSON.stringify({
      retCode: 'CBC.0000',
      results: [
        {
          code: 'SUCCESS',
          data: [{ 客户级别: '卓越NA', NA客户数: 15 }],
          total_count: 1
        }
      ]
    })
  );
}

afterEach(() => {
  installRuntimeConfig(null);
});

describe('运行配置注入面', () => {
  it('每次读取都现读注入源，不快照', () => {
    expect(readRuntimeConfig()).toBeNull();
    installRuntimeConfig(completeConfig);
    expect(readRuntimeConfig()).toEqual(completeConfig);
    installRuntimeConfig({ ...completeConfig, authToken: 'token-2' });
    expect(readRuntimeConfig()?.authToken).toBe('token-2');
  });

  it('缺任一字段视为未注入', () => {
    installRuntimeConfig({ ...completeConfig, authToken: '   ' });
    expect(readRuntimeConfig()).toBeNull();
  });

  it('DQE 请求带上现读的端点与三个身份头', async () => {
    installRuntimeConfig(completeConfig);
    const requests: Array<{ input: string; headers: Record<string, string> }> = [];
    const gateway = createInjectedDqeGateway((async (input, init) => {
      const headers = new Headers(init?.headers);
      requests.push({
        input: String(input),
        headers: {
          'x-auth-token': headers.get('X-Auth-Token') ?? '',
          'x-operator-id': headers.get('X-Operator-Id') ?? '',
          'x-workspace-id': headers.get('X-Workspace-Id') ?? ''
        }
      });
      return successResponse();
    }) as typeof fetch);

    await gateway.fetchData(query);
    expect(requests).toEqual([
      {
        input: completeConfig.dqeEndpoint,
        headers: {
          'x-auth-token': 'token-1',
          'x-operator-id': 'developer-1',
          'x-workspace-id': 'ws-1'
        }
      }
    ]);
  });

  it('更换 token 后下一次请求带上新值，不必重建网关', async () => {
    installRuntimeConfig(completeConfig);
    const tokens: string[] = [];
    const gateway = createInjectedDqeGateway((async (_input, init) => {
      tokens.push(new Headers(init?.headers).get('X-Auth-Token') ?? '');
      return successResponse();
    }) as typeof fetch);

    await gateway.fetchData(query);
    installRuntimeConfig({ ...completeConfig, authToken: 'token-2' });
    await gateway.fetchData(query);
    expect(tokens).toEqual(['token-1', 'token-2']);
  });

  it('未注入时取数失败明确说是未注入运行配置，不是传输失败', async () => {
    const gateway = createInjectedDqeGateway((async () => {
      throw new Error('should not fetch');
    }) as typeof fetch);

    const caught = await gateway.fetchData(query).then(
      () => {
        throw new Error('expected failure');
      },
      (error: unknown) => error
    );

    expect(caught).toBeInstanceOf(DqeGatewayError);
    expect(caught).toMatchObject({
      code: 'DQE_CONFIG_ERROR',
      message: MISSING_RUNTIME_CONFIG_MESSAGE
    });
    expect(String(caught)).not.toMatch(/不可达|TRANSPORT/i);
  });
});
