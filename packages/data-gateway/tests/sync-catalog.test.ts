import { describe, expect, it } from 'vitest';
import { syncCatalog } from '../src/sync-catalog';

import servicesList from '../fixtures/services-list.json';
import introspect from '../fixtures/introspect.json';
import metricBaseInfo from '../fixtures/metric-base-info.json';
import errorEnvelope from '../fixtures/error-envelope.json';

const BASE_URL = 'https://data-service.example';

/** mock 在系统边界(HTTP):按请求内容路由到录制/构造的 fixture 响应 */
function fakeFetch(responses?: { graphql?: (apiQuery: string) => unknown }) {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method: init?.method ?? 'GET', body });

    let payload: unknown;
    if (url.includes('/services/list')) {
      payload = servicesList;
    } else {
      const apiQuery = (body as { apiQuery: string }).apiQuery;
      payload = responses?.graphql
        ? responses.graphql(apiQuery)
        : apiQuery.includes('MetricBaseInfo')
          ? metricBaseInfo
          : introspect;
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
  return { requests, fetchImpl };
}

describe('sync-catalog 拼装器(services/list + __type 内省 + MetricBaseInfo)', () => {
  it('三类请求打到正确端点,GraphQL 查询体包装为 {apiQuery, isTest}', async () => {
    const { requests, fetchImpl } = fakeFetch();
    await syncCatalog({ baseUrl: BASE_URL, fetchImpl });

    const [list, ...graphql] = requests;
    expect(list.url).toBe(`${BASE_URL}/rest/cbc/cbcbidataservice/v1/services/list?serviceType=1`);
    expect(list.method).toBe('GET');

    for (const req of graphql) {
      expect(req.url).toBe(`${BASE_URL}/rest/cbc/cbcbidynamicapiservice/v1/graphql`);
      expect(req.method).toBe('POST');
      expect(req.body).toEqual({ apiQuery: expect.any(String), isTest: true });
    }

    // 内省查询的别名形状与 MetricBaseInfo 的 request 参数按《中间层分析.md》§4.3.4/§3.4 录制样例保真
    const queries = graphql.map((r) => (r.body as { apiQuery: string }).apiQuery);
    expect(queries.some((q) => q.includes('F34_ioc:__type(name:"F34_ioc"){fields{name}}'))).toBe(true);
    expect(
      queries.some((q) =>
        q.includes('P001_ADS_T_IOC_SPD_METRIC_ACC_D:__type(name:"P001_ADS_T_IOC_SPD_METRIC_ACC_D")')
      )
    ).toBe(true);
    expect(
      queries.some((q) => q.includes('MetricBaseInfo(request:{metric_type:"element", limit:-1, offset:0})'))
    ).toBe(true);
  });

  it('指标来自 MetricBaseInfo,维度来自内省字段(剔除度量列),快照按 code 排序、diff 可读', async () => {
    const { fetchImpl } = fakeFetch();
    const snapshot = await syncCatalog({
      baseUrl: BASE_URL,
      fetchImpl,
      now: () => new Date('2026-07-20T08:00:00.000Z')
    });

    // 期望值按 fixture 手工推得:剔除 metric_* 度量列、内置 cnt 与 *_sum 聚合字段
    const expectedDimensions = ['cal2', 'dim', 'dim_value', 'mtime', 'region'];
    expect(snapshot.dimensions.map((d) => d.code)).toEqual(expectedDimensions);

    expect(snapshot.metrics.map((m) => ({ code: m.code, name: m.name }))).toEqual([
      { code: 'contribution-profit_hc', name: '贡献利润' },
      { code: 'revenue-external_customer', name: '外部客户收入' }
    ]);

    // 后端尚未提供"可用维度/可用聚合"(共建中):初版按宽松默认填充(独立事实:PRD 待确认清单前的约定值)
    for (const metric of snapshot.metrics) {
      expect(metric.availableDimensions).toEqual(expectedDimensions);
      expect(metric.availableAggregations).toEqual(['sum', 'avg', 'count']);
    }

    expect(snapshot.formatVersion).toBe('1.0');
    expect(snapshot.syncedAt).toBe('2026-07-20T08:00:00.000Z');
    expect(snapshot.source).toBe(BASE_URL);
  });

  it('非 CBC.0000 响应信封抛出带错误码的异常', async () => {
    const { fetchImpl } = fakeFetch({ graphql: () => errorEnvelope });
    await expect(syncCatalog({ baseUrl: BASE_URL, fetchImpl })).rejects.toThrow('CBC.9004');
  });
});
