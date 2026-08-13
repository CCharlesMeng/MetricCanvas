import { describe, expect, it } from 'vitest';
import { DqeGatewayError } from '@metriccanvas/data-gateway';
import type { EffectiveQuery, JsonObject } from '@metriccanvas/page';
import {
  PLATFORM_DATA_QUERY_PATH,
  createPlatformDataGateway
} from '../src/lib/platform-data-gateway';

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

describe('数据网关端口的浏览器适配器', () => {
  it('把生效查询原样提交给平台取数入口并返回行与总条数', async () => {
    const requests: Array<{ input: string; init: RequestInit | undefined }> = [];
    const gateway = createPlatformDataGateway({
      fetchImpl: (async (input, init) => {
        requests.push({ input: String(input), init });
        return new Response(
          JSON.stringify({
            ok: true,
            rows: [{ 'customer-level': '卓越NA', 'na-customer-count': 15 }],
            totalCount: 1
          })
        );
      }) as typeof fetch
    });

    const result = await gateway.fetchData(query, {
      pageId: 'na-customers',
      dataSourceIds: ['na-count']
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.input).toBe(PLATFORM_DATA_QUERY_PATH);
    expect(requests[0]!.init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(requests[0]!.init?.body))).toEqual({
      query,
      diagnostics: { pageId: 'na-customers', dataSourceIds: ['na-count'] }
    });
    expect(result).toEqual({
      rows: [{ 'customer-level': '卓越NA', 'na-customer-count': 15 }],
      totalCount: 1
    });
  });

  it('未提供诊断上下文时请求体只包含生效查询', async () => {
    const bodies: unknown[] = [];
    const gateway = createPlatformDataGateway({
      fetchImpl: (async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ ok: true, rows: [] }));
      }) as typeof fetch
    });
    await gateway.fetchData(query);
    expect(bodies).toEqual([{ query }]);
  });

  it('失败响应还原为 DqeGatewayError 并保留透传的 code(表驱动)', async () => {
    for (const [code, message] of [
      ['DQE_FIELD_MAPPING_ERROR', '响应缺少映射字段:NA客户数'],
      ['DQE_AUTH_REQUIRED', '需要登录后才能执行查询(401)'],
      ['DQE_FORBIDDEN', '没有执行该查询的权限(403)'],
      ['DQE_TIMEOUT', 'DQE 请求超过 30000ms 未返回'],
      ['DQE_QUERY_REJECTED', 'DQE 拒绝执行查询项:FAILED']
    ] as const) {
      const gateway = createPlatformDataGateway({
        fetchImpl: (async () =>
          new Response(JSON.stringify({ ok: false, code, message }), {
            status: 502
          })) as typeof fetch
      });

      const failure = await gateway.fetchData(query).catch((cause: unknown) => cause);

      expect(failure).toBeInstanceOf(DqeGatewayError);
      expect(failure).toMatchObject({ code, message });
    }
  });

  it('封闭集之外的 code 视为非契约响应,失败关闭为 DQE_TRANSPORT_ERROR', async () => {
    const gateway = createPlatformDataGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ ok: false, code: 'SOMETHING_ELSE', message: '未知分类' }),
          { status: 502 }
        )) as typeof fetch
    });

    const failure = await gateway.fetchData(query).catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(DqeGatewayError);
    expect(failure).toMatchObject({ code: 'DQE_TRANSPORT_ERROR' });
  });

  it('非契约响应与网络失败都收敛为 DQE_TRANSPORT_ERROR', async () => {
    const nonContract = await createPlatformDataGateway({
      fetchImpl: (async () => new Response('<html>proxy error</html>', { status: 500 })) as typeof fetch
    })
      .fetchData(query)
      .catch((cause: unknown) => cause);
    expect(nonContract).toBeInstanceOf(DqeGatewayError);
    // 非契约响应可能是任意上游错误页,错误 detail 只保留状态码,不携带正文。
    expect(nonContract).toMatchObject({
      code: 'DQE_TRANSPORT_ERROR',
      detail: { status: 500 }
    });
    expect(JSON.stringify((nonContract as DqeGatewayError).detail)).not.toContain(
      'proxy error'
    );

    const unreachable = await createPlatformDataGateway({
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch
    })
      .fetchData(query)
      .catch((cause: unknown) => cause);
    expect(unreachable).toBeInstanceOf(DqeGatewayError);
    expect(unreachable).toMatchObject({ code: 'DQE_TRANSPORT_ERROR' });
  });

  it('取消信号传递到底层网络请求,中止后的拒绝归类为 DQE_CANCELLED(issue #53)', async () => {
    const signals: Array<AbortSignal | null | undefined> = [];
    const gateway = createPlatformDataGateway({
      fetchImpl: ((_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signals.push(init?.signal);
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('请求已中止', 'AbortError'))
          );
        })) as typeof fetch
    });
    const controller = new AbortController();

    const pending = gateway
      .fetchData(query, undefined, controller.signal)
      .then(
        () => {
          throw new Error('该查询必须被取消');
        },
        (cause: unknown) => cause
      );
    controller.abort();
    const failure = await pending;

    // 信号原样进入 fetch:中止即断开与平台取数入口的连接。
    expect(signals).toEqual([controller.signal]);
    expect(failure).toBeInstanceOf(DqeGatewayError);
    expect(failure).toMatchObject({ code: 'DQE_CANCELLED' });
  });

  it('维度候选值查询尚未由平台入口声明,返回空数组', async () => {
    const gateway = createPlatformDataGateway({
      fetchImpl: (async () => {
        throw new Error('不应发起请求');
      }) as typeof fetch
    });
    await expect(gateway.fetchDimensionValues('客户级别')).resolves.toEqual([]);
  });
});
