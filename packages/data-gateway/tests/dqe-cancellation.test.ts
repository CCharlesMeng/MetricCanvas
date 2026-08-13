import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, JsonObject } from '@metriccanvas/page';
import {
  DqeGatewayError,
  createDqeGateway,
  createInMemoryDqeDiagnostics
} from '../src/dqe';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function numberQuery(metric: string): EffectiveQuery {
  return {
    language: 'dqe',
    body: {
      dsl_list: [{
        output_dims: [],
        output_metrics: [metric],
        filter: { dims: [], metrics: [] },
        order: {}
      }]
    },
    fieldMappings: {
      value: { queryField: metric, type: 'number', role: 'measure' }
    },
    filterValues: []
  };
}

function successItem(metric: string, value: number): JsonObject {
  return { code: 'SUCCESS', data: [{ [metric]: value }], total_count: 1 };
}

interface UpstreamRequest {
  dslList: unknown[];
  signal: AbortSignal | undefined;
  respond(results: unknown[]): void;
}

/** 可控挂起的上游:登记每个 HTTP 请求,信号中止即按 AbortError 拒绝。 */
function hangingUpstream(): { fetchImpl: typeof fetch; requests: UpstreamRequest[] } {
  const requests: UpstreamRequest[] = [];
  const fetchImpl = ((_input: unknown, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () =>
        reject(new DOMException('请求已中止', 'AbortError'))
      );
      requests.push({
        dslList: (JSON.parse(String(init?.body)) as { dsl_list: unknown[] })
          .dsl_list,
        signal,
        respond(results) {
          resolve(new Response(JSON.stringify({ retCode: 'CBC.0000', results })));
        }
      });
    })) as typeof fetch;
  return { fetchImpl, requests };
}

/** 把拒绝原因取出来断言,同时避免未处理拒绝。 */
function captured(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('该查询必须被取消');
    },
    (cause: unknown) => cause
  );
}

describe('DQE 数据网关的取消信号(issue #53)', () => {
  it('执行前已中止:立即按 DQE_CANCELLED 拒绝,不进入批次,诊断一条且无 batchId', async () => {
    const { fetchImpl, requests } = hangingUpstream();
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({ fetchImpl, diagnostics });
    const controller = new AbortController();
    controller.abort();

    const failure = await captured(
      gateway.fetchData(numberQuery('金额'), undefined, controller.signal)
    );

    expect(failure).toBeInstanceOf(DqeGatewayError);
    expect(failure).toMatchObject({ code: 'DQE_CANCELLED' });
    await flush();
    expect(requests).toHaveLength(0);
    expect(diagnostics.records()).toHaveLength(1);
    expect(diagnostics.records()[0]).toMatchObject({
      status: 'error',
      errorCode: 'DQE_CANCELLED'
    });
    expect(diagnostics.records()[0]!.batchId).toBeUndefined();
  });

  it('入批前(同一微任务窗口内)取消:不发往上游,诊断无 batchId', async () => {
    const { fetchImpl, requests } = hangingUpstream();
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({ fetchImpl, diagnostics });
    const controller = new AbortController();

    const pending = captured(
      gateway.fetchData(numberQuery('金额'), undefined, controller.signal)
    );
    controller.abort();

    expect(await pending).toMatchObject({ code: 'DQE_CANCELLED' });
    await flush();
    expect(requests).toHaveLength(0);
    expect(diagnostics.records()).toHaveLength(1);
    expect(diagnostics.records()[0]!.batchId).toBeUndefined();
  });

  it('批次中途取消唯一查询:底层 HTTP 请求被中止,诊断恰好一条并携带 batchId', async () => {
    const { fetchImpl, requests } = hangingUpstream();
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({ fetchImpl, diagnostics });
    const controller = new AbortController();

    const pending = captured(
      gateway.fetchData(numberQuery('金额'), undefined, controller.signal)
    );
    await flush();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.signal?.aborted).toBe(false);

    controller.abort();
    expect(await pending).toMatchObject({ code: 'DQE_CANCELLED' });
    // 批次内唯一查询已取消:共享的底层请求随之中止。
    expect(requests[0]!.signal?.aborted).toBe(true);

    // 底层请求中止再走到批次失败分支时,已结算的查询不再落第二条诊断。
    await flush();
    expect(diagnostics.records()).toHaveLength(1);
    expect(diagnostics.records()[0]).toMatchObject({
      status: 'error',
      errorCode: 'DQE_CANCELLED',
      batchId: expect.stringMatching(/^dqe-batch-/)
    });
  });

  it('同批次取消一个查询:共享请求不中止,另一个正常返回,迟到结果不写入已取消查询', async () => {
    const { fetchImpl, requests } = hangingUpstream();
    const diagnostics = createInMemoryDqeDiagnostics();
    const gateway = createDqeGateway({ fetchImpl, diagnostics });
    const controller = new AbortController();

    const cancelled = captured(
      gateway.fetchData(numberQuery('金额'), undefined, controller.signal)
    );
    const surviving = gateway.fetchData(numberQuery('数量'));
    await flush();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.dslList).toHaveLength(2);

    controller.abort();
    expect(await cancelled).toMatchObject({ code: 'DQE_CANCELLED' });
    // 同批次仍有未取消的查询:共享的底层请求不得中止。
    expect(requests[0]!.signal?.aborted).toBe(false);

    // 上游返回整批结果:存活查询正常结算,已取消查询不接收迟到成功结果。
    requests[0]!.respond([successItem('金额', 1), successItem('数量', 7)]);
    await expect(surviving).resolves.toEqual({
      rows: [{ value: 7 }],
      totalCount: 1
    });
    await flush();

    const records = diagnostics.records();
    expect(records).toHaveLength(2);
    const errors = records.filter((record) => record.status === 'error');
    const successes = records.filter((record) => record.status === 'success');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ errorCode: 'DQE_CANCELLED' });
    // 已取消查询没有第二条(成功)诊断:一次执行恰好一条记录。
    expect(successes).toHaveLength(1);
    expect(successes[0]).toMatchObject({ rowCount: 1, totalCount: 1 });
    expect(records[0]!.batchId).toBe(records[1]!.batchId);
  });

  it('同批次全部取消:共享的底层请求被中止', async () => {
    const { fetchImpl, requests } = hangingUpstream();
    const gateway = createDqeGateway({ fetchImpl });
    const first = new AbortController();
    const second = new AbortController();

    const failures = [
      captured(gateway.fetchData(numberQuery('金额'), undefined, first.signal)),
      captured(gateway.fetchData(numberQuery('数量'), undefined, second.signal))
    ];
    await flush();
    expect(requests).toHaveLength(1);

    first.abort();
    expect(requests[0]!.signal?.aborted).toBe(false);
    second.abort();
    expect(requests[0]!.signal?.aborted).toBe(true);
    for (const failure of await Promise.all(failures)) {
      expect(failure).toMatchObject({ code: 'DQE_CANCELLED' });
    }
  });

  it('未携带取消信号的查询行为不变:超时仍归类 DQE_TIMEOUT 而不是取消', async () => {
    const { fetchImpl, requests } = hangingUpstream();
    const gateway = createDqeGateway({ fetchImpl, timeoutMs: 10 });

    const failure = await captured(gateway.fetchData(numberQuery('金额')));

    expect(failure).toBeInstanceOf(DqeGatewayError);
    expect(failure).toMatchObject({ code: 'DQE_TIMEOUT' });
    expect(requests[0]!.signal?.aborted).toBe(true);
  });
});
