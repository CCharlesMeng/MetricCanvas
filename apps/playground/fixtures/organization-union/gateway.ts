import {createDqeGateway} from '@metriccanvas/engine/dqe';
import type {DataGateway,RuntimeDataGateway} from '@metriccanvas/engine';
import {parsePage} from '@metriccanvas/page';
import {isQueryDataSource, type EffectiveQuery, type QueryDataSource} from '@metriccanvas/page/internal';
import document from '../../../../pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json';
import mock from './mock.json';
import {dqeDimensionConditions, dqeRecord} from '../../../../packages/page/src/dqe-object';
import {organizationDimensionValues, selectOrganizationRows} from './organizations';

type MockRow = {region:string; value:number|string|null};
const parsed = parsePage(document);
if (!parsed.ok) throw new Error('Mock 页面元数据无效');
const sources = parsed.page.dataSources;
const fixtures: Record<string, MockRow[]> = mock.sources;
const representativeFixtures: Record<string, MockRow[]> = mock.representative.sources;
const overallFixtures: Record<string, Record<string, MockRow['value']>> = mock.overview.scopes;

function responseRows(source: QueryDataSource, rows: readonly MockRow[], scope: unknown): Record<string, unknown>[] {
  return rows.map(row => Object.fromEntries(Object.entries(source.fields).flatMap(([field, mapping]) =>
    'queryField' in mapping ? [[mapping.queryField, field === 'domestic-overseas' ? scope : field === 'region' || field === 'china-overseas' ? row.region : row.value]] : [])));
}

function overviewRows(prefix: string, query: EffectiveQuery, state: string): MockRow[] {
  const selection = dqeDimensionConditions(dqeRecord(query.body.dsl_list[0])).find(value => value.dim_name === '国内或海外');
  const values = selection?.dim_value_list;
  if (!Array.isArray(values)) throw new Error('整体 Mock 查询必须声明国内/海外范围');
  return values.map(value => {
    const scope = overallFixtures[String(value)];
    if (!scope || !Object.hasOwn(scope, prefix)) throw new Error('整体 Mock 范围或子项未配置');
    const score = state === 'overviewMissing' ? null : state === 'overviewZero' ? 0 : scope[prefix];
    return {region:String(value),value:score};
  });
}

function responseTotal(state: string, prefix: string, count: number): number {
  if (state === 'zeroTotal') return 0;
  return state === 'truncated' && prefix === 'voice-closure-score' ? 15 : count;
}

/** Only the explicit Mock page uses synthetic HTTP receipts; production partner-health never matches. */
export function createPartnerHealthUnionPreview(state = 'ready') {
  const requests: {sourceId:string;body:unknown}[] = [];
  const dataGateway: RuntimeDataGateway = {
    async fetchDimensionValues(dimension) {
      if (dimension === 'region-dept' || dimension === 'representative') return organizationDimensionValues(dimension);
      const values = dimension === 'level' ? ['地区部','代表处'] : dimension === 'china-overseas' ? ['中国区','海外'] : mock.expectedOrganizations;
      return {kind:'values',candidates:values.map(value=>({value,label:value}))};
    },
    async fetchData(query, context, signal) {
    const id = context?.dataSourceIds?.[0] ?? '';
    const source = sources[id];
    if (!source || !isQueryDataSource(source)) throw new Error('Mock 查询源未配置');
    const prefix = id.replace(/-(region|representative|overview)$/, '');
    const organizationFixtures = id.endsWith('-representative') ? representativeFixtures : fixtures;
    let rows = id.endsWith('-overview') ? overviewRows(prefix, query, state) : organizationFixtures[prefix] ?? [];
    if (state === 'empty' || (state === 'emptyMain' && prefix === 'voice-closure-score')) rows = [];
    return createDqeGateway({fetchImpl: async (_url, init) => {
      signal?.throwIfAborted();
      const body = JSON.parse(String(init?.body));
      requests.push({sourceId:id,body});
      if (state === 'error' && prefix === 'customer-eval-score') throw new Error('合成查询失败');
      const item = body.dsl_list[0];
      let selected = selectOrganizationRows(id, item, rows);
      if (state === 'duplicate' && selected.length) selected = [...selected, selected[0]];
      const scope = dqeDimensionConditions(dqeRecord(item)).find(field => field.dim_name === '国内或海外')?.dim_value_list;
      const data = responseRows(source, selected, Array.isArray(scope) ? scope[0] : null);
      return Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',data,
        total_count: responseTotal(state, prefix, data.length)}]});
    }}).fetchData(query, context, signal);
  }};
  return {dataGateway,requests};
}

export function partnerHealthUnionGateway(pageId: string, fallback: DataGateway, state?: string): DataGateway {
  if (pageId !== 'partner-health-union-null-probe') return fallback;
  const endpoint = `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute?fixture=partner-health&state=${encodeURIComponent(state ?? 'ready')}`;
  const preview = createPartnerHealthUnionPreview(state).dataGateway;
  const gateway: RuntimeDataGateway = {...createDqeGateway({endpoint}),
    fetchDimensionValues: preview.fetchDimensionValues};
  return gateway;
}
