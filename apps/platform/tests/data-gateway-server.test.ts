import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DQE_ENDPOINT,
  DQE_DEV_DETAIL_MASK,
  type DqeDevDetailRecord,
  type DqeDiagnosticRecord
} from '@metriccanvas/data-gateway';
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
      diagnosticsSink: () => {},
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

    const result = await executeDataQuery(gateway, { query: effectiveQuery() });

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
        diagnosticsSink: () => {},
        fetchImpl: (async () => new Response('bad gateway', { status: 502 })) as typeof fetch
      }),
      { query: effectiveQuery() }
    );
    expect(httpFailure).toMatchObject({ ok: false, code: 'DQE_TRANSPORT_ERROR' });
    expect(dataQueryHttpStatus(httpFailure)).toBe(502);

    const envelopeFailure = await executeDataQuery(
      createServerDataGateway({
        environment: {},
        diagnosticsSink: () => {},
        fetchImpl: (async () =>
          jsonResponse({ retCode: 'CBC.9999', results: [] })) as typeof fetch
      }),
      { query: effectiveQuery() }
    );
    expect(envelopeFailure).toMatchObject({ ok: false, code: 'DQE_ENVELOPE_ERROR' });
    expect(dataQueryHttpStatus(envelopeFailure)).toBe(502);
  });

  it('映射错误:响应缺少查询字段映射声明的字段时返回 DQE_FIELD_MAPPING_ERROR', async () => {
    const gateway = createServerDataGateway({
      environment: {},
      diagnosticsSink: () => {},
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

    const result = await executeDataQuery(gateway, { query: effectiveQuery() });

    expect(result).toMatchObject({ ok: false, code: 'DQE_FIELD_MAPPING_ERROR' });
    expect(result.ok === false && result.message).toContain('NA客户数');
    expect(dataQueryHttpStatus(result)).toBe(502);
  });

  it('边界校验:不合法的请求体收敛为 DQE_CONFIG_ERROR 并回 400', async () => {
    const gateway = createServerDataGateway({
      environment: {},
      diagnosticsSink: () => {},
      fetchImpl: (async () => {
        throw new Error('不应发起上游请求');
      }) as typeof fetch
    });

    for (const payload of [
      undefined,
      'not-an-object',
      {},
      { query: 'not-an-object' },
      { query: { language: 'sql' } },
      { query: { language: 'dqe', body: { dsl_list: [] }, fieldMappings: {}, filterValues: [] } },
      { query: { language: 'dqe', body: { dsl_list: [dslItem] }, filterValues: [] } },
      { query: { ...effectiveQuery(), pagination: { offset: -1, limit: 20 } } }
    ]) {
      const result = await executeDataQuery(gateway, payload);
      expect(result).toMatchObject({ ok: false, code: 'DQE_CONFIG_ERROR' });
      expect(dataQueryHttpStatus(result)).toBe(400);
    }
  });
});

/** 敏感哨兵值:诊断、日志或响应里检索到它即视为泄漏(issue #47)。 */
const SENTINEL = '哨兵客户机密9F3E';

function sentinelSuccessResponse(): Response {
  return jsonResponse({
    retCode: 'CBC.0000',
    results: [
      {
        code: 'SUCCESS',
        data: [{ 客户级别: SENTINEL, NA客户数: 15 }],
        total_count: 1
      }
    ]
  });
}

describe('生产态查询诊断日志(issue #47)', () => {
  it('每次执行落一条诊断记录:按页面、页面修订、数据源与请求标识定位,检索不到哨兵值', async () => {
    const records: DqeDiagnosticRecord[] = [];
    const gateway = createServerDataGateway({
      environment: {},
      diagnosticsSink: (record) => records.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });

    const result = await executeDataQuery(gateway, {
      query: effectiveQuery(),
      diagnostics: {
        pageId: 'na-customers',
        pageRevisionId: 'rev-7',
        dataSourceIds: ['na-count']
      }
    });

    expect(result.ok).toBe(true);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      executionId: expect.stringMatching(/^dqe-exec-/),
      pageId: 'na-customers',
      pageRevisionId: 'rev-7',
      dataSourceIds: ['na-count'],
      status: 'success',
      rowCount: 1,
      totalCount: 1
    });
    expect(records[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(records)).not.toContain(SENTINEL);
  });

  it('缺省诊断去向是结构化 console 日志,日志行检索不到哨兵值', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const gateway = createServerDataGateway({
        environment: {},
        fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
      });
      await executeDataQuery(gateway, {
        query: effectiveQuery(),
        diagnostics: { pageId: 'na-customers' }
      });

      const diagnosticLogs = info.mock.calls.filter(
        (call) => call[0] === '[query-diagnostics]'
      );
      expect(diagnosticLogs).toHaveLength(1);
      const line = String(diagnosticLogs[0]![1]);
      expect(line).toContain('"pageId":"na-customers"');
      expect(line).toContain('"status":"success"');
      expect(line).not.toContain(SENTINEL);
    } finally {
      info.mockRestore();
    }
  });

  it('上游失败时响应契约(页面输出面)与诊断记录都不携带上游错误正文', async () => {
    const records: DqeDiagnosticRecord[] = [];
    const gateway = createServerDataGateway({
      environment: {},
      diagnosticsSink: (record) => records.push(record),
      fetchImpl: (async () =>
        jsonResponse({
          retCode: 'CBC.0000',
          results: [
            {
              code: 'FAILED',
              message: `执行失败:${SENTINEL}`,
              data: [{ 客户级别: SENTINEL }],
              total_count: 0
            }
          ]
        })) as typeof fetch
    });

    const result = await executeDataQuery(gateway, { query: effectiveQuery() });

    expect(result).toMatchObject({ ok: false, code: 'DQE_QUERY_REJECTED' });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
    expect(records[0]).toMatchObject({ status: 'error', errorCode: 'DQE_QUERY_REJECTED' });
    expect(JSON.stringify(records)).not.toContain(SENTINEL);
  });

  it('诊断上下文是不可信输入:非字符串标识与超限内容被丢弃,不阻塞取数', async () => {
    const records: DqeDiagnosticRecord[] = [];
    const gateway = createServerDataGateway({
      environment: {},
      diagnosticsSink: (record) => records.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });

    const result = await executeDataQuery(gateway, {
      query: effectiveQuery(),
      diagnostics: {
        pageId: { nested: 'object' },
        pageRevisionId: 42,
        dataSourceIds: ['ok-id', 7, { bad: true }, 'x'.repeat(300)]
      }
    });

    expect(result.ok).toBe(true);
    expect(records[0]!.pageId).toBeUndefined();
    expect(records[0]!.pageRevisionId).toBeUndefined();
    expect(records[0]!.dataSourceIds).toEqual(['ok-id']);
  });
});

describe('开发期明细的环境闸(issue #47)', () => {
  const devDetailQuery = () => ({ query: effectiveQuery() });

  it('未显式配置 DQE_DEV_DETAIL 时没有明细', async () => {
    const details: DqeDevDetailRecord[] = [];
    const gateway = createServerDataGateway({
      environment: { NODE_ENV: 'development' },
      diagnosticsSink: () => {},
      devDetailSink: (record) => details.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });
    await executeDataQuery(gateway, devDetailQuery());
    expect(details).toEqual([]);
  });

  it('显式启用但环境不是 development 时通道不存在(生产环境失败关闭)', async () => {
    for (const nodeEnv of ['production', 'test', undefined]) {
      const details: DqeDevDetailRecord[] = [];
      const gateway = createServerDataGateway({
        environment: { DQE_DEV_DETAIL: '1', NODE_ENV: nodeEnv },
        diagnosticsSink: () => {},
        devDetailSink: (record) => details.push(record),
        fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
      });
      await executeDataQuery(gateway, devDetailQuery());
      expect(details).toEqual([]);
    }
  });

  it('显式启用且 development 环境:明细已脱敏,检索不到哨兵筛选值', async () => {
    const details: DqeDevDetailRecord[] = [];
    const gateway = createServerDataGateway({
      environment: { DQE_DEV_DETAIL: '1', NODE_ENV: 'development' },
      diagnosticsSink: () => {},
      devDetailSink: (record) => details.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });

    const query = effectiveQuery();
    query.filterValues = [
      { target: 'dimension', queryField: '客户级别', values: [SENTINEL] }
    ];
    await executeDataQuery(gateway, { query });

    expect(details).toHaveLength(1);
    const serialized = JSON.stringify(details);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).toContain(DQE_DEV_DETAIL_MASK);
    expect(serialized).toContain('NA客户数');
  });

  it('采样率为 0 时不落明细', async () => {
    const details: DqeDevDetailRecord[] = [];
    const gateway = createServerDataGateway({
      environment: {
        DQE_DEV_DETAIL: '1',
        NODE_ENV: 'development',
        DQE_DEV_DETAIL_SAMPLE_RATE: '0'
      },
      diagnosticsSink: () => {},
      devDetailSink: (record) => details.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });
    await executeDataQuery(gateway, devDetailQuery());
    expect(details).toEqual([]);
  });
});
