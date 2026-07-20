import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createSimServer } from '@metriccanvas/data-service-sim';
import { createDataServiceGateway, translateQuery, DataServiceError } from '../src/data-service';

const SERVICE = 'P001_ADS_T_IOC_SPD_METRIC_ACC_D';
const AUTH = { 'x-operator-id': 'test-user', tenantId: 't-1', appId: 'metriccanvas', cftk: 'x' };

describe('翻译器:生效查询 → apiQuery(映射表驱动,期望值手写)', () => {
  const cases: Array<{ name: string; query: Parameters<typeof translateQuery>[0]; apiQuery: string }> = [
    {
      name: '单指标无维度:metric_code 过滤 + 默认 sum 保留字段',
      query: { metrics: ['gmv'], conditions: [] },
      apiQuery: `{query{${SERVICE} @where(value:"metric_code in ('gmv')"){metric_code metric_value_sum}}}`
    },
    {
      name: '维度分组 + in 条件',
      query: {
        metrics: ['gmv'],
        dimensions: ['region'],
        conditions: [{ dimension: 'channel', operator: 'in', value: ['线上', '线下'] }]
      },
      apiQuery: `{query{${SERVICE} @where(value:"metric_code in ('gmv') and channel in ('线上','线下')"){region metric_code metric_value_sum}}}`
    },
    {
      name: '时间范围进 between,聚合 avg 走 @function',
      query: {
        metrics: ['target-rate'],
        aggregation: 'avg',
        conditions: [],
        timeRange: { from: '2026-07-14', to: '2026-07-20' }
      },
      apiQuery: `{query{${SERVICE} @where(value:"metric_code in ('target-rate') and mtime between '2026-07-14' and '2026-07-20'"){metric_code metric_value @function(value:"avg")}}}`
    },
    {
      name: 'eq 条件',
      query: {
        metrics: ['gmv'],
        conditions: [{ dimension: 'region', operator: 'eq', value: '华东' }]
      },
      apiQuery: `{query{${SERVICE} @where(value:"metric_code in ('gmv') and region = '华东'"){metric_code metric_value_sum}}}`
    }
  ];

  for (const { name, query, apiQuery } of cases) {
    it(name, () => {
      expect(translateQuery(query, { serviceCode: SERVICE, timeColumn: 'mtime' })).toBe(apiQuery);
    });
  }

  it('防注入:筛选值含单引号、列名非标识符、白名单外操作符,一律拒绝', () => {
    const base = { serviceCode: SERVICE, timeColumn: 'mtime' };
    expect(() =>
      translateQuery(
        { metrics: ['gmv'], conditions: [{ dimension: 'region', operator: 'eq', value: "华东' or '1'='1" }] },
        base
      )
    ).toThrow('防注入');
    expect(() =>
      translateQuery(
        { metrics: ['gmv'], conditions: [{ dimension: "region'--", operator: 'eq', value: 'x' }] },
        base
      )
    ).toThrow('非法列名');
    expect(() =>
      translateQuery(
        {
          metrics: ['gmv'],
          conditions: [{ dimension: 'region', operator: 'like' as never, value: 'x' }]
        },
        base
      )
    ).toThrow('白名单');
    expect(() =>
      translateQuery({ metrics: ['gmv'], aggregation: 'max) @where(value:"1=1', conditions: [] }, base)
    ).toThrow('白名单');
  });
});

describe('适配器对仿真端到端(期望值由种子表手算)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createSimServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  function gateway(headers: Record<string, string> = AUTH) {
    return createDataServiceGateway({
      baseUrl,
      serviceCode: SERVICE,
      headers,
      retries: 0
    });
  }

  it('按区域取 gmv(7-20):华东 190、华北 135、华南 100,行式转列后指标成列', async () => {
    const rows = await gateway().fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [],
      timeRange: { from: '2026-07-20', to: '2026-07-20' }
    });
    expect(rows).toEqual([
      { region: '华东', gmv: 190 },
      { region: '华北', gmv: 135 },
      { region: '华南', gmv: 100 }
    ]);
  });

  it('多指标同查:gmv 与 order-count 铺成同一行的两列(7-20,华东 190/11)', async () => {
    const rows = await gateway().fetchData({
      metrics: ['gmv', 'order-count'],
      dimensions: ['region'],
      conditions: [{ dimension: 'region', operator: 'eq', value: '华东' }],
      timeRange: { from: '2026-07-20', to: '2026-07-20' }
    });
    expect(rows).toEqual([{ region: '华东', gmv: 190, 'order-count': 11 }]);
  });

  it('fetchDimensionValues 去重取值:region → 华东/华北/华南', async () => {
    expect(await gateway().fetchDimensionValues('region')).toEqual(['华东', '华北', '华南']);
  });

  it('鉴权头缺失:未登录信号成为结构化错误(不静默、不重试)', async () => {
    await expect(gateway({}).fetchData({ metrics: ['gmv'], conditions: [] })).rejects.toThrow(
      'ANALYTICS_NOT_LOGIN'
    );
  });

  it('非 CBC.0000 信封抛 DataServiceError(未知服务码)', async () => {
    const bad = createDataServiceGateway({ baseUrl, serviceCode: 'NOT_A_TABLE', headers: AUTH, retries: 0 });
    await expect(bad.fetchData({ metrics: ['gmv'], conditions: [] })).rejects.toBeInstanceOf(
      DataServiceError
    );
  });

  it('网络错误幂等重试:前两次连接失败,第三次成功', async () => {
    let calls = 0;
    const flaky: typeof fetch = async (input, init) => {
      calls++;
      if (calls <= 2) throw new TypeError('fetch failed');
      return fetch(input, init);
    };
    const resilient = createDataServiceGateway({
      baseUrl,
      serviceCode: SERVICE,
      headers: AUTH,
      fetchImpl: flaky,
      retries: 2,
      retryBaseMs: 1
    });
    const rows = await resilient.fetchData({ metrics: ['gmv'], conditions: [] });
    expect(calls).toBe(3);
    // 全表 gmv 总和 785(种子表手算)
    expect(rows).toEqual([{ gmv: 785 }]);
  });
});
