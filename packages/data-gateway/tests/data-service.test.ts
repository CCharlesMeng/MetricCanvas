import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createSimServer } from '@metriccanvas/data-service-sim';
import { createDataServiceGateway, translateQuery, DataServiceError } from '../src/data-service';

const SERVICE = 'P001_ADS_T_IOC_SPD_METRIC_ACC_D';
const AUTH = { 'x-operator-id': 'test-user', tenantId: 't-1', appId: 'metriccanvas', cftk: 'x' };
const BASE_URL = 'https://data-service.example';

function fakeDataService(
  respond: (apiQuery: string, callIndex: number) => Array<Record<string, unknown>>
) {
  const requests: Array<{ url: string; body: { apiQuery: string; isTest: boolean } }> = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { apiQuery: string; isTest: boolean };
    requests.push({ url: String(input), body });
    const rows = respond(body.apiQuery, requests.length - 1);
    return new Response(
      JSON.stringify({ retCode: 'CBC.0000', data: { [SERVICE]: rows } }),
      { status: 200 }
    );
  }) as typeof fetch;
  const gateway = createDataServiceGateway({
    baseUrl: BASE_URL,
    serviceCode: SERVICE,
    fetchImpl,
    retries: 0
  });
  return { gateway, requests };
}

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
    },
    {
      name: '分页:limit/offset 翻译为全局 @limit/@offset',
      query: { metrics: ['gmv'], dimensions: ['region'], conditions: [], limit: 10, offset: 20 },
      apiQuery: `{query @limit(value:10) @offset(value:20){${SERVICE} @where(value:"metric_code in ('gmv')"){region metric_code metric_value_sum}}}`
    },
    {
      name: '多列排序:数组序映射 @order priority,维度列与指标值列各归其位',
      query: {
        metrics: ['gmv'],
        dimensions: ['region', 'channel'],
        conditions: [],
        orderBy: [
          { field: 'gmv', direction: 'desc' },
          { field: 'region', direction: 'asc' }
        ]
      },
      apiQuery: `{query{${SERVICE} @where(value:"metric_code in ('gmv')"){region @order(type:"asc",priority:2) channel metric_code metric_value_sum @order(type:"desc",priority:1)}}}`
    },
    {
      name: '排序与 @function 聚合共存:指令并列挂在 metric_value 上',
      query: {
        metrics: ['target-rate'],
        aggregation: 'avg',
        conditions: [],
        orderBy: [{ field: 'target-rate', direction: 'asc' }]
      },
      apiQuery: `{query{${SERVICE} @where(value:"metric_code in ('target-rate')"){metric_code metric_value @function(value:"avg") @order(type:"asc",priority:1)}}}`
    },
    {
      name: '表头筛选(日期范围模式)以 between 条件并入 @where',
      query: {
        metrics: ['gmv'],
        dimensions: ['mtime', 'region'],
        conditions: [
          { dimension: 'region', operator: 'in', value: ['华东'] },
          { dimension: 'mtime', operator: 'between', value: ['2026-07-14', '2026-07-20'] }
        ],
        limit: 5,
        offset: 0
      },
      apiQuery: `{query @limit(value:5) @offset(value:0){${SERVICE} @where(value:"metric_code in ('gmv') and region in ('华东') and mtime between '2026-07-14' and '2026-07-20'"){mtime region metric_code metric_value_sum}}}`
    }
  ];

  for (const { name, query, apiQuery } of cases) {
    it(name, () => {
      expect(translateQuery(query, { serviceCode: SERVICE, timeColumn: 'mtime' })).toBe(apiQuery);
    });
  }

  it('自由文本先双写 SQL-like 单引号,再统一编码 GraphQL 字符串', () => {
    const apiQuery = translateQuery(
      {
        metrics: ['gmv'],
        conditions: [
          { dimension: 'publisher', operator: 'eq', value: "O'Reilly" },
          { dimension: 'title', operator: 'eq', value: '"quoted"' },
          { dimension: 'path', operator: 'eq', value: 'C:\\reports' },
          { dimension: 'control', operator: 'eq', value: 'line1\nline2\r\tend' }
        ]
      },
      { serviceCode: SERVICE, timeColumn: 'mtime' }
    );

    expect(apiQuery).toBe(
      String.raw`{query{${SERVICE} @where(value:"metric_code in ('gmv') and publisher = 'O''Reilly' and title = '\"quoted\"' and path = 'C:\\reports' and control = 'line1\nline2\r\tend'"){metric_code metric_value_sum}}}`
    );
  });

  it('防注入:列名非标识符、白名单外操作符与聚合方式仍一律拒绝', () => {
    const base = { serviceCode: SERVICE, timeColumn: 'mtime' };
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

  it('分页/排序的注入面同等设防:limit/offset 须非负整数,direction 须 asc/desc', () => {
    const base = { serviceCode: SERVICE, timeColumn: 'mtime' };
    expect(() => translateQuery({ metrics: ['gmv'], conditions: [], limit: 1.5 }, base)).toThrow(
      '非负整数'
    );
    expect(() =>
      translateQuery({ metrics: ['gmv'], conditions: [], limit: 10, offset: -1 }, base)
    ).toThrow('非负整数');
    expect(() =>
      translateQuery(
        {
          metrics: ['gmv'],
          conditions: [],
          orderBy: [{ field: 'gmv', direction: 'desc; drop' as never }]
        },
        base
      )
    ).toThrow('asc/desc');
  });

  it('排序字段须为查询的维度或指标,否则拒绝', () => {
    expect(() =>
      translateQuery(
        {
          metrics: ['gmv'],
          dimensions: ['region'],
          conditions: [],
          orderBy: [{ field: 'channel', direction: 'asc' }]
        },
        { serviceCode: SERVICE, timeColumn: 'mtime' }
      )
    ).toThrow('排序字段不在查询的 dimensions/metrics 中');
  });

  it('多指标查询按指标列排序:按真实原因报错(字段在 metrics 中,而非"不在查询里")', () => {
    expect(() =>
      translateQuery(
        {
          metrics: ['gmv', 'order-count'],
          dimensions: ['region'],
          conditions: [],
          orderBy: [{ field: 'gmv', direction: 'desc' }]
        },
        { serviceCode: SERVICE, timeColumn: 'mtime' }
      )
    ).toThrow('多指标查询不支持按指标列排序');
  });

  it('多指标 + 分页拒绝:行式指标表的透视行会被 @limit 切开,盲翻语义不成立', () => {
    expect(() =>
      translateQuery(
        { metrics: ['gmv', 'order-count'], dimensions: ['region'], conditions: [], limit: 10 },
        { serviceCode: SERVICE, timeColumn: 'mtime' }
      )
    ).toThrow('单指标');
  });
});

describe('适配器多指标宽行策略(fetchImpl 边界测试)', () => {
  it('增长排行按 change desc limit 5 两阶段取数,完整返回 value/change 并恢复首阶段顺序', async () => {
    const firstRows = [
      { product: 'A', metric_code: 'change', metric_value_sum: 50 },
      { product: 'B', metric_code: 'change', metric_value_sum: 40 },
      { product: 'C', metric_code: 'change', metric_value_sum: 30 },
      { product: 'D', metric_code: 'change', metric_value_sum: 20 },
      { product: 'E', metric_code: 'change', metric_value_sum: 10 }
    ];
    const fullRows = [
      { product: 'C', metric_code: 'value', metric_value_sum: 300 },
      { product: 'C', metric_code: 'change', metric_value_sum: 30 },
      { product: 'A', metric_code: 'change', metric_value_sum: 50 },
      { product: 'A', metric_code: 'value', metric_value_sum: 500 },
      { product: 'E', metric_code: 'value', metric_value_sum: 100 },
      { product: 'E', metric_code: 'change', metric_value_sum: 10 },
      { product: 'B', metric_code: 'value', metric_value_sum: 400 },
      { product: 'B', metric_code: 'change', metric_value_sum: 40 },
      { product: 'D', metric_code: 'change', metric_value_sum: 20 },
      { product: 'D', metric_code: 'value', metric_value_sum: 200 }
    ];
    const { gateway, requests } = fakeDataService((_apiQuery, callIndex) =>
      callIndex === 0 ? firstRows : fullRows
    );

    const rows = await gateway.fetchData({
      metrics: ['value', 'change'],
      dimensions: ['product'],
      aggregation: 'sum',
      granularity: 'day',
      conditions: [{ dimension: 'region', operator: 'eq', value: '华东' }],
      timeRange: { from: '2026-07-01', to: '2026-07-20' },
      orderBy: [{ field: 'change', direction: 'desc' }],
      limit: 5,
      offset: 0
    });

    expect(requests.map((request) => request.body.apiQuery)).toEqual([
      `{query @limit(value:5) @offset(value:0){${SERVICE} @where(value:"metric_code in ('change') and region = '华东' and mtime between '2026-07-01' and '2026-07-20'"){product metric_code metric_value_sum @order(type:"desc",priority:1)}}}`,
      `{query{${SERVICE} @where(value:"metric_code in ('value','change') and region = '华东' and product in ('A','B','C','D','E') and mtime between '2026-07-01' and '2026-07-20'"){product metric_code metric_value_sum}}}`
    ]);
    expect(rows).toEqual([
      { product: 'A', change: 50, value: 500 },
      { product: 'B', value: 400, change: 40 },
      { product: 'C', value: 300, change: 30 },
      { product: 'D', change: 20, value: 200 },
      { product: 'E', value: 100, change: 10 }
    ]);
  });

  it('两阶段返回的维度键也经过 SQL-like 与 GraphQL 分层编码', async () => {
    const key = `O'Reilly "East" \\ retail`;
    const { gateway, requests } = fakeDataService((_apiQuery, callIndex) =>
      callIndex === 0
        ? [{ product: key, metric_code: 'change', metric_value_sum: 20 }]
        : [
            { product: key, metric_code: 'value', metric_value_sum: 200 },
            { product: key, metric_code: 'change', metric_value_sum: 20 }
          ]
    );

    const rows = await gateway.fetchData({
      metrics: ['value', 'change'],
      dimensions: ['product'],
      conditions: [],
      orderBy: [{ field: 'change', direction: 'desc' }],
      limit: 1
    });

    expect(requests.map((request) => request.body.apiQuery)).toEqual([
      `{query @limit(value:1){${SERVICE} @where(value:"metric_code in ('change')"){product metric_code metric_value_sum @order(type:"desc",priority:1)}}}`,
      String.raw`{query{${SERVICE} @where(value:"metric_code in ('value','change') and product in ('O''Reilly \"East\" \\ retail')"){product metric_code metric_value_sum}}}`
    ]);
    expect(rows).toEqual([{ product: key, value: 200, change: 20 }]);
  });

  it('首阶段无维度键时直接返回空数组,不发第二次请求', async () => {
    const { gateway, requests } = fakeDataService(() => []);
    await expect(
      gateway.fetchData({
        metrics: ['value', 'change'],
        dimensions: ['product'],
        conditions: [],
        limit: 5
      })
    ).resolves.toEqual([]);
    expect(requests).toHaveLength(1);
    expect(requests[0].body.apiQuery).toBe(
      `{query @limit(value:5){${SERVICE} @where(value:"metric_code in ('value')"){product metric_code metric_value_sum}}}`
    );
  });

  it('无维度多指标查询先完整透视再应用窗口,offset 2 跳过唯一宽行', async () => {
    const { gateway, requests } = fakeDataService(() => [
      { metric_code: 'change', metric_value: 0.25 },
      { metric_code: 'value', metric_value: 120 }
    ]);
    const rows = await gateway.fetchData({
      metrics: ['value', 'change'],
      aggregation: 'avg',
      granularity: 'month',
      conditions: [{ dimension: 'region', operator: 'eq', value: '华东' }],
      timeRange: { from: '2026-07-01', to: '2026-07-20' },
      orderBy: [{ field: 'change', direction: 'desc' }],
      limit: 5,
      offset: 2
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].body.apiQuery).toBe(
      `{query{${SERVICE} @where(value:"metric_code in ('value','change') and region = '华东' and mtime between '2026-07-01' and '2026-07-20'"){metric_code metric_value @function(value:"avg")}}}`
    );
    expect(rows).toEqual([]);
  });

  it('多维度宽行取全量后本地稳定多列排序并应用 offset/limit,与 mock 语义一致', async () => {
    const rawRows = [
      { region: '华东', channel: 'channel-2', metric_code: 'value', metric_value_sum: 12 },
      { region: '华北', channel: 'channel-2', metric_code: 'change', metric_value_sum: 22 },
      { region: '华南', channel: 'channel-1', metric_code: 'change', metric_value_sum: 31 },
      { region: '华东', channel: 'channel-1', metric_code: 'change', metric_value_sum: 11 },
      { region: '华北', channel: 'channel-1', metric_code: 'value', metric_value_sum: 21 },
      { region: '华南', channel: 'channel-2', metric_code: 'value', metric_value_sum: 32 },
      { region: '华东', channel: 'channel-2', metric_code: 'change', metric_value_sum: 12 },
      { region: '华北', channel: 'channel-2', metric_code: 'value', metric_value_sum: 22 },
      { region: '华南', channel: 'channel-1', metric_code: 'value', metric_value_sum: 31 },
      { region: '华东', channel: 'channel-1', metric_code: 'value', metric_value_sum: 11 },
      { region: '华北', channel: 'channel-1', metric_code: 'change', metric_value_sum: 21 },
      { region: '华南', channel: 'channel-2', metric_code: 'change', metric_value_sum: 32 }
    ];
    const { gateway, requests } = fakeDataService(() => rawRows);

    const rows = await gateway.fetchData({
      metrics: ['value', 'change'],
      dimensions: ['region', 'channel'],
      conditions: [],
      orderBy: [
        { field: 'region', direction: 'desc' },
        { field: 'channel', direction: 'asc' }
      ],
      limit: 3,
      offset: 1
    });

    expect(requests.map((request) => request.body.apiQuery)).toEqual([
      `{query{${SERVICE} @where(value:"metric_code in ('value','change')"){region channel metric_code metric_value_sum}}}`
    ]);
    expect(rows).toEqual([
      { region: '华南', channel: 'channel-2', value: 32, change: 32 },
      { region: '华北', channel: 'channel-1', value: 21, change: 21 },
      { region: '华北', channel: 'channel-2', change: 22, value: 22 }
    ]);
  });

  it('orderBy 引用多个指标时取全量后按优先级本地排序', async () => {
    const { gateway, requests } = fakeDataService(() => [
      { product: 'A', metric_code: 'value', metric_value_sum: 100 },
      { product: 'A', metric_code: 'change', metric_value_sum: 10 },
      { product: 'B', metric_code: 'value', metric_value_sum: 100 },
      { product: 'B', metric_code: 'change', metric_value_sum: 20 },
      { product: 'C', metric_code: 'value', metric_value_sum: 90 },
      { product: 'C', metric_code: 'change', metric_value_sum: 30 }
    ]);

    const rows = await gateway.fetchData({
      metrics: ['value', 'change'],
      dimensions: ['product'],
      conditions: [],
      orderBy: [
        { field: 'value', direction: 'desc' },
        { field: 'change', direction: 'desc' }
      ],
      limit: 2
    });

    expect(requests.map((request) => request.body.apiQuery)).toEqual([
      `{query{${SERVICE} @where(value:"metric_code in ('value','change')"){product metric_code metric_value_sum}}}`
    ]);
    expect(rows).toEqual([
      { product: 'B', value: 100, change: 20 },
      { product: 'A', value: 100, change: 10 }
    ]);
  });

  it('宽行策略仍拒绝重复与非法排序字段,不发送请求', async () => {
    const { gateway, requests } = fakeDataService(() => []);
    const base = {
      metrics: ['value', 'change'],
      dimensions: ['product'],
      conditions: []
    };

    await expect(
      gateway.fetchData({
        ...base,
        orderBy: [
          { field: 'change', direction: 'desc' },
          { field: 'change', direction: 'asc' }
        ]
      })
    ).rejects.toThrow('排序字段重复:change');
    await expect(
      gateway.fetchData({
        ...base,
        limit: 5,
        orderBy: [{ field: 'unknown', direction: 'asc' }]
      })
    ).rejects.toThrow('排序字段不在查询的 dimensions/metrics 中:unknown');
    expect(requests).toHaveLength(0);
  });

  it('宽行本地策略仍复用分页数值防线,非法窗口不发送请求', async () => {
    const { gateway, requests } = fakeDataService(() => []);

    await expect(
      gateway.fetchData({
        metrics: ['value', 'change'],
        dimensions: ['region', 'product'],
        conditions: [],
        limit: 1.5,
        offset: -1
      })
    ).rejects.toThrow('非负整数');
    expect(requests).toHaveLength(0);
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

  it('盲翻分页对仿真:按 gmv 降序,limit 2/offset 0 得前两名,offset 2 得末名(7-20 手算:190/135/100)', async () => {
    const paged = (offset: number) =>
      gateway().fetchData({
        metrics: ['gmv'],
        dimensions: ['region'],
        conditions: [],
        timeRange: { from: '2026-07-20', to: '2026-07-20' },
        orderBy: [{ field: 'gmv', direction: 'desc' }],
        limit: 2,
        offset
      });
    expect(await paged(0)).toEqual([
      { region: '华东', gmv: 190 },
      { region: '华北', gmv: 135 }
    ]);
    expect(await paged(2)).toEqual([{ region: '华南', gmv: 100 }]);
  });

  it('表头筛选条件对仿真:region 多选收窄行集,按维度升序返回', async () => {
    const rows = await gateway().fetchData({
      metrics: ['gmv'],
      dimensions: ['region'],
      conditions: [{ dimension: 'region', operator: 'in', value: ['华东', '华南'] }],
      timeRange: { from: '2026-07-20', to: '2026-07-20' },
      orderBy: [{ field: 'gmv', direction: 'asc' }]
    });
    expect(rows).toEqual([
      { region: '华南', gmv: 100 },
      { region: '华东', gmv: 190 }
    ]);
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
