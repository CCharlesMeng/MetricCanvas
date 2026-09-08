import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { DqeGatewayError,dimensionValuesDqeItem } from '@metriccanvas/engine/dqe';
import type { EffectiveQuery,JsonObject } from '@metriccanvas/page/internal';
import {
  createInjectedDqeGateway,
  installRuntimeConfig,
  MISSING_RUNTIME_CONFIG_MESSAGE
} from '../src/lib/runtime-config';
import { createWorkbenchDqeGateway } from '../src/lib/workbench/data-gateway';

const config={
  dqeEndpoint: '/dqe/execute',
  pageAssetsBaseUrl: '/page-assets',
  authToken: 'user-token-1',
  operatorId: 'operator-1',
  workspaceId: 'workspace-1'
};

beforeEach(() => installRuntimeConfig(config));
afterEach(() => {
  installRuntimeConfig(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const dslItem: JsonObject={
  output_metrics: ['NA客户数'],
  output_dims: ['客户级别'],
  filter: { time: { period: 'month',is_aggregate: true,start: '2026-07',end: '2026-07' } },
  order: {}
};

const query: EffectiveQuery={
  language: 'dqe',
  body: { dsl_list: [dslItem] },
  fieldMappings: {
    'customer-level': { queryField: '客户级别',type: 'string',role: 'dimension' },
    'na-customer-count': { queryField: 'NA客户数',type: 'number',role: 'measure' }
  },
  filterValues: []
};

function response(data: unknown[]=[{ 客户级别: '卓越NA',NA客户数: 15 }]): Response {
  return Response.json({
    retCode: 'CBC.0000',results: [
      { code: 'SUCCESS',data,total_count: data.length }
    ]
  });
}

describe('平台浏览器直连 DQE',() => {
  it('工作台开发明细显式启用后可用，业务取值、身份与结果不进入记录', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_DQE_DEV_DETAIL', '1');
    vi.stubEnv('VITE_DQE_DEV_DETAIL_SAMPLE_RATE', '1');
    const sink = vi.spyOn(console, 'debug').mockImplementation(() => {});
    await createWorkbenchDqeGateway(async () => response()).fetchData(query);
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0]?.[1]).toMatchObject({
      executionId: expect.any(String),
      effectiveItem: { output_metrics: ['NA客户数'], filter: { time: { start: '«已脱敏»', end: '«已脱敏»' } } }
    });
    const serialized = JSON.stringify(sink.mock.calls);
    for (const value of ['2026-07', '卓越NA', config.authToken, config.operatorId, config.workspaceId]) {
      expect(serialized).not.toContain(value);
    }
  });

  it.each([
    { dev: false, enabled: '1', rate: '1' },
    { dev: true, enabled: '', rate: '1' },
    { dev: true, enabled: '1', rate: '0' },
    { dev: true, enabled: '1', rate: 'invalid' }
  ])('工作台明细闸门失败关闭：%j', async ({ dev, enabled, rate }) => {
    vi.stubEnv('DEV', dev);
    vi.stubEnv('VITE_DQE_DEV_DETAIL', enabled);
    vi.stubEnv('VITE_DQE_DEV_DETAIL_SAMPLE_RATE', rate);
    const sink = vi.spyOn(console, 'debug').mockImplementation(() => {});
    await createWorkbenchDqeGateway(async () => response()).fetchData(query);
    expect(sink).not.toHaveBeenCalled();
  });

  it('正式渲染网关不消费工作台开发明细开关', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_DQE_DEV_DETAIL', '1');
    const sink = vi.spyOn(console, 'debug').mockImplementation(() => {});
    await createInjectedDqeGateway(async () => response()).fetchData(query);
    expect(sink).not.toHaveBeenCalled();
  });
  it('查询与候选值走同一个注入端点，带上三个身份头并归一化结果',async () => {
    const requests: Array<{ input: string; init?: RequestInit }>=[];
    const gateway=createInjectedDqeGateway(async (input,init) => {
      requests.push({ input: String(input),init });
      return response();
    });
    await expect(gateway.fetchData(query)).resolves.toEqual({
      rows: [{ 'customer-level': '卓越NA','na-customer-count': 15 }],totalCount: 1
    });
    await expect(gateway.fetchDimensionValues('客户级别')).resolves.toEqual({
      kind: 'values',candidates: [{ value: '卓越NA',label: '卓越NA' }]
    });
    expect(requests).toHaveLength(2);
    for(const request of requests) {
      expect(request.input).toBe(config.dqeEndpoint);
      expect(request.init?.method).toBe('POST');
      const headers=new Headers(request.init?.headers);
      expect(headers.get('X-Auth-Token')).toBe(config.authToken);
      expect(headers.get('X-Operator-Id')).toBe(config.operatorId);
      expect(headers.get('X-Workspace-Id')).toBe(config.workspaceId);
    }
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual(query.body);
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
      dsl_list: [dimensionValuesDqeItem('客户级别')]
    });
  });

  it('相对地址改成跨源地址并更换身份后，两种请求均使用新配置',async () => {
    const requests: Array<{ url: string; token: string|null; actor: string|null; workspace: string|null }>=[];
    const gateway=createInjectedDqeGateway(async (input,init) => {
      const headers=new Headers(init?.headers);
      requests.push({
        url: String(input),token: headers.get('X-Auth-Token'),
        actor: headers.get('X-Operator-Id'),workspace: headers.get('X-Workspace-Id')
      });
      return response();
    });
    await gateway.fetchData(query);
    installRuntimeConfig({
      ...config,dqeEndpoint: 'https://dqe.example/execute',
      authToken: 'user-token-2',operatorId: 'operator-2',workspaceId: 'workspace-2'
    });
    await gateway.fetchData(query);
    await gateway.fetchDimensionValues('客户级别');
    expect(requests[0]).toEqual({
      url: config.dqeEndpoint,token: config.authToken,
      actor: config.operatorId,workspace: config.workspaceId
    });
    expect(requests.slice(1)).toEqual(Array(2).fill({
      url: 'https://dqe.example/execute',
      token: 'user-token-2',actor: 'operator-2',workspace: 'workspace-2'
    }));
  });

  it.each(['absent','incomplete'] as const)('%s 配置不阻止创建网关，但取数明确报告配置缺失',async (kind) => {
    installRuntimeConfig(kind==='absent'? null:{ ...config,authToken: ' ' });
    const fetchImpl=vi.fn<typeof fetch>();
    const gateway=createInjectedDqeGateway(fetchImpl);
    for(const pending of [gateway.fetchData(query),gateway.fetchDimensionValues('客户级别')]) {
      await expect(pending).rejects.toMatchObject({
        code: 'DQE_CONFIG_ERROR',message: MISSING_RUNTIME_CONFIG_MESSAGE
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([401,403])('HTTP %s 沿用引擎身份错误，401 提示需要登录',async (status) => {
    const gateway=createInjectedDqeGateway(async () => new Response('upstream',{ status }));
    for(const pending of [gateway.fetchData(query),gateway.fetchDimensionValues('客户级别')]) {
      const error=await pending.catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(DqeGatewayError);
      expect(error).toMatchObject({ code: status===401? 'DQE_AUTH_REQUIRED':'DQE_FORBIDDEN' });
      if(status===401) expect(String(error)).toContain('需要登录');
      expect(String(error)).not.toContain('upstream');
    }
  });

  it('网络失败保留传输分类，与配置缺失可区分',async () => {
    const gateway=createInjectedDqeGateway(async () => { throw new TypeError('fetch failed'); });
    await expect(gateway.fetchData(query)).rejects.toMatchObject({ code: 'DQE_TRANSPORT_ERROR' });
  });

  it.each(['query','dimension'] as const)('%s 的取消信号到达实际 DQE 请求',async (kind) => {
    let started!: () => void;
    const sent=new Promise<void>((resolve) => { started=resolve; });
    let upstreamSignal: AbortSignal|null|undefined;
    const gateway=createInjectedDqeGateway((_input,init) => new Promise<Response>((_resolve,reject) => {
      upstreamSignal=init?.signal;
      upstreamSignal?.addEventListener('abort',() => reject(new DOMException('aborted','AbortError')),{ once: true });
      started();
    }));
    const controller=new AbortController();
    const pending=kind==='query'
      ? gateway.fetchData(query,undefined,controller.signal)
      :gateway.fetchDimensionValues('客户级别',{ signal: controller.signal });
    await sent;
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'DQE_CANCELLED' });
    expect(upstreamSignal?.aborted).toBe(true);
  });
});
