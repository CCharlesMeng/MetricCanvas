import {createDqeGateway} from '@metriccanvas/engine/dqe';
import type {DataGateway,RuntimeDataGateway} from '@metriccanvas/engine';
import {parsePage} from '@metriccanvas/page';
import {isQueryDataSource, type EffectiveQuery, type QueryDataSource} from '@metriccanvas/page/internal';
import document from '../../../../pages/temporary/partner-health-union-null-probe/partner-health-union-null-probe.json';
import mock from './mock.json';

type MockRow = {region:string; value:number|string|null};
const parsed = parsePage(document);
if (!parsed.ok) throw new Error('Mock 页面元数据无效');
const sources = parsed.page.dataSources;
const fixtures: Record<string, MockRow[]> = mock.sources;
const overallFixtures: Record<string, Record<string, MockRow['value']>> = mock.overview.scopes;

function responseRows(source: QueryDataSource, rows: readonly MockRow[]): Record<string, unknown>[] {
  return rows.map(row => Object.fromEntries(Object.entries(source.fields).flatMap(([field, mapping]) =>
    'queryField' in mapping ? [[mapping.queryField, field === 'region' || field === 'china-overseas' ? row.region : row.value]] : [])));
}

function overviewRows(prefix: string, query: EffectiveQuery, state: string): MockRow[] {
  const selection = query.filterValues.find(value => value.target === 'dimension' && value.queryField === 'data_site_type');
  if (selection?.target !== 'dimension') throw new Error('整体 Mock 查询必须绑定中国区/海外');
  return selection.values.map(value => {
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
      const values = dimension === 'level' ? ['地区部','代表处'] : dimension === 'china-overseas' ? ['中国区','海外'] : mock.expectedOrganizations;
      return {kind:'values',candidates:values.map(value=>({value,label:value}))};
    },
    async fetchData(query, context, signal) {
    const id = context?.dataSourceIds?.[0] ?? '';
    const source = sources[id];
    if (!source || !isQueryDataSource(source)) throw new Error('Mock 查询源未配置');
    const prefix = id.replace(/-(region|representative|overview)$/, '');
    let rows = id.endsWith('-overview') ? overviewRows(prefix, query, state) : fixtures[prefix] ?? [];
    if (state === 'empty' || (state === 'emptyMain' && prefix === 'voice-closure-score')) rows = [];
    if (state === 'duplicate' && rows.length) rows = [...rows, rows[0]];
    return createDqeGateway({fetchImpl: async (_url, init) => {
      signal?.throwIfAborted();
      requests.push({sourceId:id,body:JSON.parse(String(init?.body))});
      if (state === 'error' && prefix === 'customer-eval-score') throw new Error('合成查询失败');
      const data = responseRows(source, rows);
      return Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',data,
        total_count: responseTotal(state, prefix, data.length)}]});
    }}).fetchData(query, context, signal);
  }};
  return {dataGateway,requests};
}

export function partnerHealthUnionGateway(pageId: string, fallback: DataGateway, state?: string): DataGateway {
  return pageId === 'partner-health-union-null-probe' ? createPartnerHealthUnionPreview(state).dataGateway : fallback;
}
