import { describe, expect, it } from 'vitest';
import type { QueryErrorCode } from '@metriccanvas/page';
import { DqeGatewayError, createDqeGateway, dimensionValuesDqeItem } from '../src';

/** 敏感哨兵值:候选值属业务数据,错误序列化里检索到即视为泄漏(issue #47)。 */
const VALUE_SENTINEL = '候选哨兵值-客户机密';

function envelope(results: unknown[]): Response {
  return new Response(JSON.stringify({ retCode: 'CBC.0000', retDesc: null, results }));
}

function abortError(): Error {
  return Object.assign(new Error('The operation was aborted.'), {
    name: 'AbortError'
  });
}

describe('DQE 适配器的维度候选值查询(issue #54)', () => {
  it('单项 DQE 执行返回真实去重候选值,数字值归一为字符串', async () => {
    const bodies: unknown[] = [];
    const gateway = createDqeGateway({
      fetchImpl: (async (_input: unknown, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return envelope([
          {
            code: 'SUCCESS',
            data: [
              { 客户级别: '卓越' },
              { 客户级别: '战略' },
              { 客户级别: '卓越' },
              { 客户级别: null },
              { 客户级别: 42 }
            ],
            total_count: 5
          }
        ]);
      }) as typeof fetch
    });

    await expect(gateway.fetchDimensionValues('客户级别')).resolves.toEqual({
      kind: 'values',
      candidates: [
        { value: '卓越', label: '卓越' },
        { value: '战略', label: '战略' },
        { value: '42', label: '42' }
      ]
    });
    expect(bodies).toEqual([{ dsl_list: [dimensionValuesDqeItem('客户级别')] }]);
  });

  it('上游明确拒答候选值查询 → 该维度能力不可用,不伪装成空结果', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        envelope([
          {
            code: 'DQE_SIM_UNSUPPORTED_QUERY',
            retDesc: '不支持的 output_metrics/output_dims 组合',
            data: [],
            total_count: 0
          }
        ])) as typeof fetch
    });

    await expect(gateway.fetchDimensionValues('未知维度')).resolves.toEqual({
      kind: 'unavailable'
    });
  });

  it('查询成功且候选为空 → 空值集合,与不可用可区分', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        envelope([{ code: 'SUCCESS', data: [], total_count: 0 }])) as typeof fetch
    });

    await expect(gateway.fetchDimensionValues('区域')).resolves.toEqual({
      kind: 'values',
      candidates: []
    });
  });

  it('伴随显示名与稳定值成对返回，重复值按首个候选去重', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        envelope([
          {
            code: 'SUCCESS',
            data: [
              { 'geo-pc-code': 'R99', 'geo-pc-code__label': '中国' },
              { 'geo-pc-code': 'R99', 'geo-pc-code__label': '重复中国' },
              { 'geo-pc-code': 'R05', 'geo-pc-code__label': '欧洲' }
            ],
            total_count: 3
          }
        ])) as typeof fetch
    });

    await expect(gateway.fetchDimensionValues('geo-pc-code')).resolves.toEqual({
      kind: 'values',
      candidates: [
        { value: 'R99', label: '中国' },
        { value: 'R05', label: '欧洲' }
      ]
    });
  });

  const failureCases: Array<{
    name: string;
    code: QueryErrorCode;
    timeoutMs?: number;
    fetchImpl: typeof fetch;
  }> = [
    {
      name: 'HTTP 401 → 需要登录',
      code: 'DQE_AUTH_REQUIRED',
      fetchImpl: (async () => new Response('login required', { status: 401 })) as typeof fetch
    },
    {
      name: 'HTTP 403 → 无权限',
      code: 'DQE_FORBIDDEN',
      fetchImpl: (async () => new Response('forbidden', { status: 403 })) as typeof fetch
    },
    {
      name: '网络不可达 → 上游失败(传输)',
      code: 'DQE_TRANSPORT_ERROR',
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch
    },
    {
      name: '网关超时旗标触发的中止 → 超时',
      code: 'DQE_TIMEOUT',
      timeoutMs: 10,
      fetchImpl: ((_input: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(abortError()));
        })) as typeof fetch
    },
    {
      name: '信封 retCode 失败 → 上游失败(信封)',
      code: 'DQE_ENVELOPE_ERROR',
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ retCode: 'CBC.9999', retDesc: `内部错误:${VALUE_SENTINEL}` })
        )) as typeof fetch
    },
    {
      name: 'results 数量不一致 → 上游失败(信封)',
      code: 'DQE_ENVELOPE_ERROR',
      fetchImpl: (async () => envelope([])) as typeof fetch
    },
    {
      name: '候选值结果不是对象 → 上游失败(查询项)',
      code: 'DQE_ITEM_ERROR',
      fetchImpl: (async () => envelope(['not-an-object'])) as typeof fetch
    },
    {
      name: '候选值 data 不是数组 → 上游失败(查询项)',
      code: 'DQE_ITEM_ERROR',
      fetchImpl: (async () =>
        envelope([{ code: 'SUCCESS', data: VALUE_SENTINEL, total_count: 0 }])) as typeof fetch
    },
    {
      name: '候选值行不是对象 → 上游失败(查询项)',
      code: 'DQE_ITEM_ERROR',
      fetchImpl: (async () =>
        envelope([
          { code: 'SUCCESS', data: [VALUE_SENTINEL], total_count: 1 }
        ])) as typeof fetch
    },
    {
      name: '维度值不是标量 → 上游失败(查询项)',
      code: 'DQE_ITEM_ERROR',
      fetchImpl: (async () =>
        envelope([
          {
            code: 'SUCCESS',
            data: [{ 客户级别: { nested: VALUE_SENTINEL } }],
            total_count: 1
          }
        ])) as typeof fetch
    },
    {
      name: '候选显示名不是字符串 → 上游失败(查询项)',
      code: 'DQE_ITEM_ERROR',
      fetchImpl: (async () =>
        envelope([
          {
            code: 'SUCCESS',
            data: [{ 客户级别: '卓越', 客户级别__label: 42 }],
            total_count: 1
          }
        ])) as typeof fetch
    }
  ];

  for (const testCase of failureCases) {
    it(testCase.name, async () => {
      const gateway = createDqeGateway({
        fetchImpl: testCase.fetchImpl,
        ...(testCase.timeoutMs !== undefined ? { timeoutMs: testCase.timeoutMs } : {})
      });

      const caught = await gateway.fetchDimensionValues('客户级别').then(
        () => {
          throw new Error('该场景必须拒绝');
        },
        (cause: unknown) => cause as DqeGatewayError
      );

      expect(caught).toBeInstanceOf(DqeGatewayError);
      expect(caught.code).toBe(testCase.code);
      // 错误序列化不包含候选值或上游响应正文(issue #47 红线)。
      const serialized = JSON.stringify({
        code: caught.code,
        message: caught.message,
        detail: caught.detail
      });
      expect(serialized).not.toContain(VALUE_SENTINEL);
    });
  }

  it('候选值请求经 AbortSignal 取消 → DQE_CANCELLED', async () => {
    const controller = new AbortController();
    const gateway = createDqeGateway({
      fetchImpl: ((_input: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) return reject(abortError());
          init?.signal?.addEventListener('abort', () => reject(abortError()));
        })) as typeof fetch
    });

    const pending = gateway.fetchDimensionValues('客户级别', {
      signal: controller.signal
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'DQE_CANCELLED' });
  });

  it('取消信号已中止时立即拒绝,不发起请求', async () => {
    const controller = new AbortController();
    controller.abort();
    const gateway = createDqeGateway({
      fetchImpl: (async () => {
        throw new Error('不应发起请求');
      }) as typeof fetch
    });

    await expect(
      gateway.fetchDimensionValues('客户级别', { signal: controller.signal })
    ).rejects.toMatchObject({ code: 'DQE_CANCELLED' });
  });
});
