import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EffectiveQuery, JsonObject, JsonValue } from '@metriccanvas/page/internal';
import { createDqeGateway, createInMemoryDqeDiagnostics } from '../src/index';

/** 敏感哨兵值:任何诊断、日志或错误序列化里检索到它即视为泄漏。 */
const SENTINEL = '哨兵客户机密9F3E';

const consoleSpies = () =>
  (['debug', 'info', 'log', 'warn', 'error'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {})
  );

afterEach(() => {
  vi.restoreAllMocks();
});

function sentinelQuery(): EffectiveQuery {
  const item: JsonObject = {
    output_metrics: ['NA客户数', { formula: 'COUNT(*)', alias: '数量' }],
    output_dims: ['客户名称'],
    filter: {
      time: {
        period: 'month',
        is_aggregate: true,
        start: '2026-07',
        end: '2026-07'
      },
      dims: [{ dim_name: '客户名称', dim_value_list: [SENTINEL] }],
      metrics: []
    },
    order: {}
  };
  return {
    language: 'dqe',
    body: { dsl_list: [item] },
    fieldMappings: {
      customer: { queryField: '客户名称', type: 'string', role: 'dimension' },
      count: { queryField: 'NA客户数', type: 'number', role: 'measure' }
    },
    filterValues: [
      { target: 'dimension', queryField: '客户名称', values: [SENTINEL] }
    ]
  };
}

function successResponse(): Response {
  return new Response(
    JSON.stringify({
      retCode: 'CBC.0000',
      results: [
        {
          code: 'SUCCESS',
          data: [{ 客户名称: SENTINEL, NA客户数: 15 }],
          total_count: 1
        }
      ]
    })
  );
}

describe('查询诊断默认不保留业务数据行(issue #47)', () => {
  it('成功执行恰好落一条封闭形状的诊断记录,只含标识、时间、行数与状态', async () => {
    const spies = consoleSpies();
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({
      diagnostics,
      fetchImpl: (async () => successResponse()) as typeof fetch
    });

    const result = await gateway.fetchData(sentinelQuery(), {
      pageId: 'na-customers',
      pageRevisionId: 'rev-7',
      dataSourceIds: ['na-count', 'na-count-copy']
    });
    expect(result.rows).toEqual([{ customer: SENTINEL, count: 15 }]);

    const records = diagnostics.records();
    expect(records).toHaveLength(1);
    const record = records[0]!;
    // 形状封闭:诊断记录没有任何能容纳数据行或筛选值的字段。
    expect(Object.keys(record).sort()).toEqual([
      'batchId',
      'dataSourceIds',
      'durationMs',
      'executionId',
      'pageId',
      'pageRevisionId',
      'rowCount',
      'startedAt',
      'status',
      'totalCount'
    ]);
    expect(record).toMatchObject({
      pageId: 'na-customers',
      pageRevisionId: 'rev-7',
      dataSourceIds: ['na-count', 'na-count-copy'],
      status: 'success',
      rowCount: 1,
      totalCount: 1
    });
    expect(record.durationMs).toBeGreaterThanOrEqual(0);

    // 守卫断言:序列化诊断与普通日志里检索不到哨兵值。
    expect(JSON.stringify(records)).not.toContain(SENTINEL);
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SENTINEL);
    }
  });

  it('上游携带 x-request-id 时诊断记录保留请求标识', async () => {
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({
      diagnostics,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [{ code: 'SUCCESS', data: [], total_count: 0 }]
          }),
          { headers: { 'x-request-id': 'req-42' } }
        )) as typeof fetch
    });

    await gateway.fetchData(sentinelQuery());
    expect(diagnostics.records()[0]).toMatchObject({
      requestId: 'req-42',
      status: 'success',
      rowCount: 0
    });
  });

  it('查询项失败:上游错误正文与失败数据行不进入诊断记录和错误对象', async () => {
    const spies = consoleSpies();
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({
      diagnostics,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [
              {
                code: 'FAILED',
                message: `执行失败:${SENTINEL}`,
                data: [{ 客户名称: SENTINEL }],
                total_count: 0
              }
            ]
          })
        )) as typeof fetch
    });

    const caught = await gateway
      .fetchData(sentinelQuery(), { pageId: 'na-customers', dataSourceIds: ['na-count'] })
      .then(
        () => undefined,
        (cause: unknown) => cause as { code: string; message: string; detail?: unknown }
      );

    expect(caught).toMatchObject({ code: 'DQE_QUERY_REJECTED' });
    expect(diagnostics.records()).toHaveLength(1);
    expect(diagnostics.records()[0]).toMatchObject({
      pageId: 'na-customers',
      status: 'error',
      errorCode: 'DQE_QUERY_REJECTED'
    });
    expect(JSON.stringify(diagnostics.records())).not.toContain(SENTINEL);
    expect(
      JSON.stringify({ message: caught!.message, detail: caught!.detail })
    ).not.toContain(SENTINEL);
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SENTINEL);
    }
  });

  it('信封失败:信封正文(含 retDesc)不进入诊断与错误 detail', async () => {
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({
      diagnostics,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.9999',
            retDesc: `内部错误:${SENTINEL}`,
            results: []
          })
        )) as typeof fetch
    });

    const caught = await gateway.fetchData(sentinelQuery()).then(
      () => undefined,
      (cause: unknown) => cause as { code: string; message: string; detail?: unknown }
    );
    expect(caught).toMatchObject({
      code: 'DQE_ENVELOPE_ERROR',
      detail: { retCode: 'CBC.9999' }
    });
    expect(diagnostics.records()[0]).toMatchObject({
      status: 'error',
      errorCode: 'DQE_ENVELOPE_ERROR'
    });
    expect(JSON.stringify(diagnostics.records())).not.toContain(SENTINEL);
    expect(
      JSON.stringify({ message: caught!.message, detail: caught!.detail })
    ).not.toContain(SENTINEL);
  });

  it('行契约失败:错误 detail 只描述类型,不回显字段值', async () => {
    const gateway = createDqeGateway({
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            retCode: 'CBC.0000',
            results: [
              {
                code: 'SUCCESS',
                data: [{ 客户名称: SENTINEL, NA客户数: SENTINEL }],
                total_count: 1
              }
            ]
          })
        )) as typeof fetch
    });

    const caught = await gateway.fetchData(sentinelQuery()).then(
      () => undefined,
      (cause: unknown) => cause as { code: string; message: string; detail?: unknown }
    );
    expect(caught).toMatchObject({ code: 'DQE_ROW_CONTRACT_ERROR' });
    expect(
      JSON.stringify({ message: caught!.message, detail: caught!.detail })
    ).not.toContain(SENTINEL);
  });

  it('进入批次前失败(配置错误)也落带错误分类的诊断记录', async () => {
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({
      diagnostics,
      fetchImpl: (async () => {
        throw new Error('不应发起请求');
      }) as typeof fetch
    });
    const query = sentinelQuery();
    // 故意构造违反「恰好一个查询项」约束的请求体。
    query.body = { dsl_list: [] } as unknown as EffectiveQuery['body'];

    await expect(
      gateway.fetchData(query, { pageId: 'na-customers' })
    ).rejects.toMatchObject({ code: 'DQE_CONFIG_ERROR' });
    expect(diagnostics.records()).toHaveLength(1);
    expect(diagnostics.records()[0]).toMatchObject({
      pageId: 'na-customers',
      status: 'error',
      errorCode: 'DQE_CONFIG_ERROR'
    });
    expect(diagnostics.records()[0]!.batchId).toBeUndefined();
  });
});

describe('开发期明细通道的注入点(实现在平台侧,ADR-0071)', () => {
  it('网关把生效 DQE 项原样交给注入的记录器,执行 id 与查询诊断同源', async () => {
    const recorded: { executionId: string; effectiveItem: JsonValue }[] = [];
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({
      diagnostics,
      devDetail: {
        record: (executionId, effectiveItem) => recorded.push({ executionId, effectiveItem })
      },
      fetchImpl: (async () => successResponse()) as typeof fetch
    });

    await gateway.fetchData(sentinelQuery());

    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.executionId).toBe(diagnostics.records()[0]!.executionId);
    // 引擎不脱敏:注入点拿到的是原样生效项,掩码由平台侧实现负责,
    // 因此这里断言哨兵值确实到达了注入点——安全性由 apps/platform 的用例守。
    expect(JSON.stringify(recorded[0]!.effectiveItem)).toContain(SENTINEL);
  });
});
