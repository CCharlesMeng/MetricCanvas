import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, JsonObject, QueryErrorCode } from '@metriccanvas/page';
import { createDqeGateway, DqeGatewayError } from '../src/dqe';

/** 敏感哨兵值:错误序列化里检索到即视为泄漏(issue #47/#51)。 */
const FILTER_SENTINEL = '筛选哨兵值-华东机密';
const ROW_SENTINEL = '行哨兵值-客户机密';

function sentinelQuery(): EffectiveQuery {
  const item: JsonObject = {
    output_metrics: ['NA客户数'],
    output_dims: ['客户级别'],
    filter: {
      time: { period: 'month', is_aggregate: true, start: '2026-07', end: '2026-07' },
      dims: [{ dim_name: '客户级别', dim_value_list: [FILTER_SENTINEL] }],
      metrics: []
    },
    order: {}
  };
  return {
    language: 'dqe',
    body: { dsl_list: [item] },
    fieldMappings: {
      'customer-level': { queryField: '客户级别', type: 'string', role: 'dimension' },
      'na-customer-count': { queryField: 'NA客户数', type: 'number', role: 'measure' }
    },
    filterValues: [
      { target: 'dimension', queryField: '客户级别', values: [FILTER_SENTINEL] }
    ]
  };
}

function envelope(results: unknown[]): Response {
  return new Response(JSON.stringify({ retCode: 'CBC.0000', retDesc: null, results }));
}

function abortError(): Error {
  return Object.assign(new Error('The operation was aborted.'), {
    name: 'AbortError'
  });
}

interface ClassificationCase {
  name: string;
  code: QueryErrorCode;
  timeoutMs?: number;
  fetchImpl: typeof fetch;
}

/**
 * 数据服务错误信封 / HTTP 状态 / 传输异常 → 稳定查询错误分类(issue #51)。
 * 表覆盖:需要登录、无权限、超时、取消、查询被拒绝、上游失败(传输/信封/
 * 查询项)与结果字段契约不匹配。
 */
const cases: ClassificationCase[] = [
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
    name: 'HTTP 500 → 上游失败(传输)',
    code: 'DQE_TRANSPORT_ERROR',
    fetchImpl: (async () => new Response('upstream broke', { status: 500 })) as typeof fetch
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
    name: '外部中止(非超时)→ 取消',
    code: 'DQE_CANCELLED',
    fetchImpl: (async () => {
      throw abortError();
    }) as typeof fetch
  },
  {
    name: '信封 retCode 失败 → 上游失败(信封)',
    code: 'DQE_ENVELOPE_ERROR',
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({ retCode: 'CBC.9999', retDesc: `内部错误:${ROW_SENTINEL}` })
      )) as typeof fetch
  },
  {
    name: 'results 数量不一致 → 上游失败(信封)',
    code: 'DQE_ENVELOPE_ERROR',
    fetchImpl: (async () => envelope([])) as typeof fetch
  },
  {
    name: '查询项结果不是对象 → 上游失败(查询项)',
    code: 'DQE_ITEM_ERROR',
    fetchImpl: (async () => envelope(['not-an-object'])) as typeof fetch
  },
  {
    name: '查询项 code 非 SUCCESS → 查询被拒绝',
    code: 'DQE_QUERY_REJECTED',
    fetchImpl: (async () =>
      envelope([
        {
          code: 'DQE_SIM_UNSUPPORTED_QUERY',
          retDesc: `仅支持 ${ROW_SENTINEL}`,
          data: [],
          total_count: 0
        }
      ])) as typeof fetch
  },
  {
    name: '成功项 total_count 非法 → 上游失败(查询项)',
    code: 'DQE_ITEM_ERROR',
    fetchImpl: (async () =>
      envelope([
        {
          code: 'SUCCESS',
          data: [{ 客户级别: '卓越NA', NA客户数: 1 }],
          total_count: 'not-a-number'
        }
      ])) as typeof fetch
  },
  {
    name: '响应缺少映射字段 → 结果字段契约不匹配(映射)',
    code: 'DQE_FIELD_MAPPING_ERROR',
    fetchImpl: (async () =>
      envelope([
        { code: 'SUCCESS', data: [{ 客户级别: '卓越NA' }], total_count: 1 }
      ])) as typeof fetch
  },
  {
    name: '字段类型不符合契约 → 结果字段契约不匹配(行)',
    code: 'DQE_ROW_CONTRACT_ERROR',
    fetchImpl: (async () =>
      envelope([
        {
          code: 'SUCCESS',
          data: [{ 客户级别: '卓越NA', NA客户数: ROW_SENTINEL }],
          total_count: 1
        }
      ])) as typeof fetch
  }
];

describe('查询错误分类:上游状况 → 稳定可判别分类(表驱动,issue #51)', () => {
  for (const testCase of cases) {
    it(testCase.name, async () => {
      const gateway = createDqeGateway({
        fetchImpl: testCase.fetchImpl,
        ...(testCase.timeoutMs !== undefined ? { timeoutMs: testCase.timeoutMs } : {})
      });

      const caught = await gateway.fetchData(sentinelQuery()).then(
        () => {
          throw new Error('该场景必须拒绝');
        },
        (cause: unknown) => cause as DqeGatewayError
      );

      expect(caught).toBeInstanceOf(DqeGatewayError);
      expect(caught.code).toBe(testCase.code);
      // 错误序列化不包含查询结果、筛选值或上游响应正文(issue #47 红线)。
      const serialized = JSON.stringify({
        code: caught.code,
        message: caught.message,
        detail: caught.detail
      });
      expect(serialized).not.toContain(FILTER_SENTINEL);
      expect(serialized).not.toContain(ROW_SENTINEL);
    });
  }

  it('执行前失败也有独立分类:非 DQE 生效查询 → DQE_CONFIG_ERROR', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () => {
        throw new Error('不应发起请求');
      }) as typeof fetch
    });
    const query = sentinelQuery();
    (query as { language: string }).language = 'sql';
    await expect(gateway.fetchData(query)).rejects.toMatchObject({
      code: 'DQE_CONFIG_ERROR'
    });
  });

  it('执行前失败也有独立分类:time 绑定缺少 filter.time → DQE_FILTER_BINDING_ERROR', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () => {
        throw new Error('不应发起请求');
      }) as typeof fetch
    });
    const query = sentinelQuery();
    delete ((query.body.dsl_list[0] as JsonObject).filter as JsonObject).time;
    query.filterValues = [
      { target: 'time', value: { from: '2026-01', to: '2026-06' } }
    ];
    await expect(gateway.fetchData(query)).rejects.toMatchObject({
      code: 'DQE_FILTER_BINDING_ERROR'
    });
  });
});
