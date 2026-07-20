import type { CatalogSnapshot, CatalogDimension, CatalogMetric } from '@metriccanvas/page';

/**
 * 聚合方式默认白名单:@function 支持的完整清单待与后端确认(PRD「仍待确认」2),
 * 确认前按宽松默认填充,避免语义校验产生假阳性。
 */
export const DEFAULT_AGGREGATIONS = ['sum', 'avg', 'count'];

export interface SyncCatalogOptions {
  baseUrl: string;
  /** 注入 HTTP 边界,便于测试与后续加请求头(鉴权在 #3 接入) */
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

interface Envelope<T> {
  retCode: string;
  retDesc?: string;
  data: T;
}

/**
 * 元数据快照拼装器("残缺→共建"路线,《中间层分析.md》§4):
 * 指标/维度目录接口缺失,初版由三处拼装——
 * ① services/list 取服务清单;② GraphQL __type 内省取各服务字段(剔除度量列后即维度);
 * ③ MetricBaseInfo resolver 取指标目录。
 * 后端补齐"可用维度/可用聚合"字段前,按宽松默认填充(全维度可用 + DEFAULT_AGGREGATIONS)。
 * 活服务联调(鉴权头、isTest 语义)在切片2(#3)落实。
 */
export async function syncCatalog(options: SyncCatalogOptions): Promise<CatalogSnapshot> {
  const { baseUrl, fetchImpl = fetch, now = () => new Date() } = options;

  const services = await getServices(baseUrl, fetchImpl);

  const fieldNames = new Set<string>();
  for (const serviceCode of services) {
    for (const name of await introspectFields(baseUrl, fetchImpl, serviceCode)) {
      fieldNames.add(name);
    }
  }
  const dimensions: CatalogDimension[] = [...fieldNames]
    .filter((name) => !isMeasureField(name))
    .sort()
    .map((code) => ({
      code,
      // 后端无维度中文名与基数供给(共建中):名称暂用 code,基数用保守默认
      name: code,
      cardinality: 3
    }));

  const dimensionCodes = dimensions.map((d) => d.code);
  const metrics: CatalogMetric[] = (await getMetricBaseInfo(baseUrl, fetchImpl))
    .sort((a, b) => (a.metric_code < b.metric_code ? -1 : 1))
    .map((m) => ({
      code: m.metric_code,
      name: m.metric_name_zh,
      // MetricBaseInfo 无值类型供给:按最不惊讶的 decimal 填充,后端扩展后替换
      valueType: 'decimal' as const,
      availableDimensions: dimensionCodes,
      availableAggregations: DEFAULT_AGGREGATIONS
    }));

  return {
    formatVersion: '1.0',
    syncedAt: now().toISOString(),
    source: baseUrl,
    metrics,
    dimensions
  };
}

/** 度量列不是维度:metric_* 指标列、内置 cnt 计数、*_sum 聚合保留字段 */
function isMeasureField(name: string): boolean {
  return name.startsWith('metric_') || name === 'cnt' || name.endsWith('_sum');
}

async function getServices(baseUrl: string, fetchImpl: typeof fetch): Promise<string[]> {
  const url = `${baseUrl}/rest/cbc/cbcbidataservice/v1/services/list?serviceType=1`;
  const envelope = await unwrap<{ detailData: Array<{ serviceCode: string }> }>(
    await fetchImpl(url, { method: 'GET' })
  );
  return envelope.detailData.map((s) => s.serviceCode);
}

async function introspectFields(
  baseUrl: string,
  fetchImpl: typeof fetch,
  serviceCode: string
): Promise<string[]> {
  // 别名使响应以 serviceCode 为键(《中间层分析.md》§4.3.4 的录制样例即此形状)
  const data = await graphql<Record<string, { fields: Array<{ name: string }> }>>(
    baseUrl,
    fetchImpl,
    `{${serviceCode}:__type(name:"${serviceCode}"){fields{name}}}`
  );
  return (data[serviceCode]?.fields ?? []).map((f) => f.name);
}

async function getMetricBaseInfo(
  baseUrl: string,
  fetchImpl: typeof fetch
): Promise<Array<{ metric_code: string; metric_name_zh: string }>> {
  // request 参数形状按《中间层分析.md》§3.4/§8.7 录制样例保真;不带 metric_code 取全量
  const data = await graphql<{
    restQuery: { MetricBaseInfo: Array<{ metric_code: string; metric_name_zh: string }> };
  }>(
    baseUrl,
    fetchImpl,
    `{restQuery{MetricBaseInfo(request:{metric_type:"element", limit:-1, offset:0}){metric_code metric_name_zh scope}}}`
  );
  return data.restQuery.MetricBaseInfo;
}

/** GraphQL-over-HTTP:非标准协议,查询体包装为 {apiQuery, isTest}(《中间层分析.md》§3.1) */
async function graphql<T>(baseUrl: string, fetchImpl: typeof fetch, apiQuery: string): Promise<T> {
  const response = await fetchImpl(`${baseUrl}/rest/cbc/cbcbidynamicapiservice/v1/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiQuery, isTest: true })
  });
  return unwrap<T>(response);
}

/** 响应信封:retCode "CBC.0000" 为成功,其余抛出带错误码的异常 */
async function unwrap<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as Envelope<T>;
  if (envelope.retCode !== 'CBC.0000') {
    throw new Error(`数据服务返回错误 ${envelope.retCode}:${envelope.retDesc ?? '未知错误'}`);
  }
  return envelope.data;
}
