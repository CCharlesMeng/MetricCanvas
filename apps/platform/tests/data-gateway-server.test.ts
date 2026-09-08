import { describe,expect,it,vi } from 'vitest';
import { DEFAULT_DQE_ENDPOINT,type DqeDiagnosticRecord } from '@metriccanvas/engine/dqe';
import {
  DQE_DEV_DETAIL_MASK,
  type DqeDevDetailRecord
} from '../src/lib/server/dqe-dev-detail';
import type { EffectiveQuery,JsonObject } from '@metriccanvas/page/internal';
import {
  createServerDataGateway as createServerDataGatewayAdapter,
  resolveDqeEndpoint,
  type ServerDataGatewayConfig
} from '../src/lib/server/data-gateway.server';

const TEST_ACTOR={
  actorId: 'data-gateway-test',
  clientId: 'workbench',
  roles: []
} as const;

function createServerDataGateway(config: Omit<ServerDataGatewayConfig,'actor'>) {
  return createServerDataGatewayAdapter({ ...config,actor: TEST_ACTOR });
}

const dslItem: JsonObject={
  output_metrics: ['NA客户数'],
  output_dims: ['客户级别'],
  filter: {
    time: { period: 'month',is_aggregate: true,start: '2026-07',end: '2026-07' },
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
      'customer-level': { queryField: '客户级别',type: 'string',role: 'dimension' },
      'na-customer-count': { queryField: 'NA客户数',type: 'number',role: 'measure' }
    },
    filterValues: []
  };
}

function jsonResponse(payload: unknown,status=200): Response {
  return new Response(JSON.stringify(payload),{ status });
}

describe('创作期服务端数据网关',() => {
  it('DQE_ENDPOINT 未配置时默认指向本机 DQE 仿真',() => {
    expect(resolveDqeEndpoint({})).toBe(`http://127.0.0.1:18228${DEFAULT_DQE_ENDPOINT}`);
    expect(resolveDqeEndpoint({ DQE_ENDPOINT: '  ' })).toBe(
      `http://127.0.0.1:18228${DEFAULT_DQE_ENDPOINT}`
    );
    expect(resolveDqeEndpoint({ DQE_ENDPOINT: 'https://dqe.internal/execute' })).toBe(
      'https://dqe.internal/execute'
    );
  });

  it('成功路径:按服务端端点执行并返回归一化行与总条数',async () => {
    const requests: Array<{ input: string; body: unknown }>=[];
    const gateway=createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: (async (input,init) => {
        requests.push({ input: String(input),body: JSON.parse(String(init?.body)) });
        return jsonResponse({
          retCode: 'CBC.0000',
          results: [
            {
              code: 'SUCCESS',
              data: [{ 客户级别: '卓越NA',NA客户数: 15 }],
              total_count: 1
            }
          ]
        });
      }) as typeof fetch
    });

    const result=await gateway.fetchData(effectiveQuery()).catch((cause: unknown) => cause);

    expect(requests).toEqual([
      {
        input: `http://127.0.0.1:18228${DEFAULT_DQE_ENDPOINT}`,
        body: { dsl_list: [dslItem] }
      }
    ]);
    expect(result).toEqual({
      rows: [{ 'customer-level': '卓越NA','na-customer-count': 15 }],
      totalCount: 1
    });
  });

  it('协议错误:HTTP 失败与信封失败分别透传 DqeGatewayError.code',async () => {
    const httpFailure=await createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: (async () => new Response('bad gateway',{ status: 502 })) as typeof fetch
    }).fetchData(effectiveQuery()).catch((cause: unknown) => cause);
    expect(httpFailure).toMatchObject({ code: 'DQE_TRANSPORT_ERROR' });

    const envelopeFailure=await createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: (async () =>
        jsonResponse({ retCode: 'CBC.9999',results: [] })) as typeof fetch
    }).fetchData(effectiveQuery()).catch((cause: unknown) => cause);
    expect(envelopeFailure).toMatchObject({ code: 'DQE_ENVELOPE_ERROR' });
  });

  it('映射错误:响应缺少查询字段映射声明的字段时返回 DQE_FIELD_MAPPING_ERROR',async () => {
    const gateway=createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
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

    const result=await gateway.fetchData(effectiveQuery()).catch((cause: unknown) => cause);

    expect(result).toMatchObject({ code: 'DQE_FIELD_MAPPING_ERROR' });
    expect(String(result)).toContain('NA客户数');
  });

  it('取消信号贯穿到上游 DQE 请求:中止收敛为 DQE_CANCELLED(issue #53)',async () => {
    const upstreamSignals: Array<AbortSignal|null|undefined>=[];
    const gateway=createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: ((_input: unknown,init?: RequestInit) =>
        new Promise<Response>((_resolve,reject) => {
          upstreamSignals.push(init?.signal);
          init?.signal?.addEventListener('abort',() =>
            reject(new DOMException('请求已中止','AbortError'))
          );
        })) as typeof fetch
    });
    const controller=new AbortController();

    const pending=gateway.fetchData(effectiveQuery(),undefined,controller.signal).catch((cause: unknown) => cause);
    // 等待批次窗口把查询发往上游,再模拟调用方取消。
    await new Promise((resolve) => setTimeout(resolve,0));
    expect(upstreamSignals).toHaveLength(1);
    controller.abort();

    const result=await pending;
    expect(result).toMatchObject({ code: 'DQE_CANCELLED' });
    // 中止真正到达底层网络请求,而不是只丢弃结果。
    expect(upstreamSignals[0]?.aborted).toBe(true);
  });
});

describe('创作期服务端候选值网关(issue #54)',() => {
  it('成功路径:候选值查询按服务端端点执行并返回真实去重候选值',async () => {
    const requests: Array<{ input: string; body: unknown }>=[];
    const gateway=createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: (async (input,init) => {
        requests.push({ input: String(input),body: JSON.parse(String(init?.body)) });
        return jsonResponse({
          retCode: 'CBC.0000',
          results: [
            {
              code: 'SUCCESS',
              data: [{ 客户级别: '卓越' },{ 客户级别: '战略' },{ 客户级别: '卓越' }],
              total_count: 3
            }
          ]
        });
      }) as typeof fetch
    });

    const result=await gateway.fetchDimensionValues('客户级别').catch((cause: unknown) => cause);

    expect(requests).toHaveLength(1);
    expect(requests[0]!.input).toBe(`http://127.0.0.1:18228${DEFAULT_DQE_ENDPOINT}`);
    expect(requests[0]!.body).toEqual({
      dsl_list: [
        {
          output_dims: ['客户级别'],
          output_metrics: [],
          filter: { dims: [],metrics: [] },
          order: {}
        }
      ]
    });
    expect(result).toEqual({
      kind: 'values',
      candidates: [
        { value: '卓越',label: '卓越' },
        { value: '战略',label: '战略' }
      ]
    });
  });

  it('上游拒答候选值查询 → 能力不可用,拒答说明(上游正文)不进入响应',async () => {
    const gateway=createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: (async () =>
        jsonResponse({
          retCode: 'CBC.0000',
          results: [
            {
              code: 'DQE_SIM_UNSUPPORTED_QUERY',
              retDesc: `不支持:${SENTINEL}`,
              data: [],
              total_count: 0
            }
          ]
        })) as typeof fetch
    });

    const result=await gateway.fetchDimensionValues('面外维度').catch((cause: unknown) => cause);

    expect(result).toEqual({ kind: 'unavailable' });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('需要登录与上游失败透传结构化错误分类(超时分类由适配器测试覆盖)',async () => {
    const authFailure=await createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: (async () => new Response('login required',{ status: 401 })) as typeof fetch
    }).fetchDimensionValues('客户级别').catch((cause: unknown) => cause);
    expect(authFailure).toMatchObject({ code: 'DQE_AUTH_REQUIRED' });

    const transportFailure=await createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch
    }).fetchDimensionValues('客户级别').catch((cause: unknown) => cause);
    expect(transportFailure).toMatchObject({ code: 'DQE_TRANSPORT_ERROR' });
  });

  it('请求中止信号透传给候选值端口,取消分类为 DQE_CANCELLED',async () => {
    const signals: Array<AbortSignal|undefined>=[];
    const controller=new AbortController();
    const gateway=createServerDataGateway({
      environment: {},
      diagnosticsSink: () => { },
      fetchImpl: ((_input: unknown,init?: RequestInit) => {
        signals.push(init?.signal??undefined);
        return new Promise((_resolve,reject) => {
          const rejectAborted=() =>
            reject(
              Object.assign(new Error('The operation was aborted.'),{
                name: 'AbortError'
              })
            );
          if(init?.signal?.aborted) return rejectAborted();
          init?.signal?.addEventListener('abort',rejectAborted);
        });
      }) as typeof fetch
    });

    const pending=gateway.fetchDimensionValues('客户级别',{ signal: controller.signal }).catch((cause: unknown) => cause);
    controller.abort();

    const result=await pending;
    expect(result).toMatchObject({ code: 'DQE_CANCELLED' });
    expect(signals[0]?.aborted).toBe(true);
  });
});

/** 敏感哨兵值:诊断、日志或响应里检索到它即视为泄漏(issue #47)。 */
const SENTINEL='哨兵客户机密9F3E';

function sentinelSuccessResponse(): Response {
  return jsonResponse({
    retCode: 'CBC.0000',
    results: [
      {
        code: 'SUCCESS',
        data: [{ 客户级别: SENTINEL,NA客户数: 15 }],
        total_count: 1
      }
    ]
  });
}

describe('生产态查询诊断日志(issue #47)',() => {
  it('每次执行落一条诊断记录:按页面、页面修订、数据源与请求标识定位,检索不到哨兵值',async () => {
    const records: DqeDiagnosticRecord[]=[];
    const gateway=createServerDataGateway({
      environment: {},
      diagnosticsSink: (record) => records.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });

    const result=await gateway.fetchData(effectiveQuery(),{
      pageId: 'na-customers',
      pageRevisionId: 'rev-7',
      dataSourceIds: ['na-count']
    }).catch((cause: unknown) => cause);

    expect(result).toHaveProperty('rows');
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

  it('缺省诊断去向是结构化 console 日志,日志行检索不到哨兵值',async () => {
    const info=vi.spyOn(console,'info').mockImplementation(() => { });
    try {
      const gateway=createServerDataGateway({
        environment: {},
        fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
      });
      await gateway.fetchData(effectiveQuery(),{ pageId: 'na-customers' }).catch((cause: unknown) => cause);

      const diagnosticLogs=info.mock.calls.filter(
        (call) => call[0]==='[query-diagnostics]'
      );
      expect(diagnosticLogs).toHaveLength(1);
      const line=String(diagnosticLogs[0]![1]);
      expect(line).toContain('"pageId":"na-customers"');
      expect(line).toContain('"status":"success"');
      expect(line).not.toContain(SENTINEL);
    } finally {
      info.mockRestore();
    }
  });

  it('上游失败时错误对象与诊断记录都不携带上游错误正文',async () => {
    const records: DqeDiagnosticRecord[]=[];
    const gateway=createServerDataGateway({
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

    const result=await gateway.fetchData(effectiveQuery()).catch((cause: unknown) => cause);

    expect(result).toMatchObject({ code: 'DQE_QUERY_REJECTED' });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
    expect(records[0]).toMatchObject({ status: 'error',errorCode: 'DQE_QUERY_REJECTED' });
    expect(JSON.stringify(records)).not.toContain(SENTINEL);
  });

});

describe('开发期明细的环境闸(issue #47)',() => {
  const devDetailQuery=() => effectiveQuery();

  it('未显式配置 DQE_DEV_DETAIL 时没有明细',async () => {
    const details: DqeDevDetailRecord[]=[];
    const gateway=createServerDataGateway({
      environment: { NODE_ENV: 'development' },
      diagnosticsSink: () => { },
      devDetailSink: (record) => details.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });
    await gateway.fetchData(devDetailQuery()).catch((cause: unknown) => cause);
    expect(details).toEqual([]);
  });

  it('显式启用但环境不是 development 时通道不存在(生产环境失败关闭)',async () => {
    for(const nodeEnv of ['production','test',undefined]) {
      const details: DqeDevDetailRecord[]=[];
      const gateway=createServerDataGateway({
        environment: { DQE_DEV_DETAIL: '1',NODE_ENV: nodeEnv },
        diagnosticsSink: () => { },
        devDetailSink: (record) => details.push(record),
        fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
      });
      await gateway.fetchData(devDetailQuery()).catch((cause: unknown) => cause);
      expect(details).toEqual([]);
    }
  });

  it('显式启用且 development 环境:明细已脱敏,检索不到哨兵筛选值',async () => {
    const details: DqeDevDetailRecord[]=[];
    const gateway=createServerDataGateway({
      environment: { DQE_DEV_DETAIL: '1',NODE_ENV: 'development' },
      diagnosticsSink: () => { },
      devDetailSink: (record) => details.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });

    const query=effectiveQuery();
    query.filterValues=[
      { target: 'dimension',queryField: '客户级别',values: [SENTINEL] }
    ];
    await gateway.fetchData(query).catch((cause: unknown) => cause);

    expect(details).toHaveLength(1);
    const serialized=JSON.stringify(details);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).toContain(DQE_DEV_DETAIL_MASK);
    expect(serialized).toContain('NA客户数');
  });

  it('采样率为 0 时不落明细',async () => {
    const details: DqeDevDetailRecord[]=[];
    const gateway=createServerDataGateway({
      environment: {
        DQE_DEV_DETAIL: '1',
        NODE_ENV: 'development',
        DQE_DEV_DETAIL_SAMPLE_RATE: '0'
      },
      diagnosticsSink: () => { },
      devDetailSink: (record) => details.push(record),
      fetchImpl: (async () => sentinelSuccessResponse()) as typeof fetch
    });
    await gateway.fetchData(devDetailQuery()).catch((cause: unknown) => cause);
    expect(details).toEqual([]);
  });
});
