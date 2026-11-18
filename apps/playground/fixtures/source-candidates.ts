import type {RuntimeDataGateway} from '@metriccanvas/engine';
import type {EffectiveQuery} from '@metriccanvas/page/internal';
type QueryDiagnosticContext = NonNullable<Parameters<RuntimeDataGateway['fetchData']>[1]>;
const candidateRows=[{code:'direct',name:'直营',weight:1},{code:'direct',name:'直营',weight:2},{code:'partner',name:'伙伴',weight:1},{code:'online',name:'线上',weight:1},{code:'partner',name:'伙伴',weight:2}];
const organizations=[['north',100],['shanghai',40],['beijing',60],['south',80],['shenzhen',30]] as const;
function selected(query:EffectiveQuery,field:string):readonly string[]|undefined {
  const item=query.filterValues.find(value=>value.target==='dimension'&&value.queryField===field);
  return item?.target==='dimension'?item.values.map(String):undefined;
}
/** Complete pagination and failures are synthetic; no production DQE or dictionary endpoint. */
export function createSourceCandidatesPreview(state='ready') {
  const requests:EffectiveQuery[]=[];
  let pageFailed = false;
  const dataGateway:RuntimeDataGateway={async fetchData(query,context,signal){
    signal?.throwIfAborted();requests.push(structuredClone(query));
    if (context?.dataSourceIds?.includes('service-options')) {
      if (state === 'candidate-pending') await untilCancelled(signal);
      if (state === 'candidate-error') throw Object.assign(new Error('合成候选请求失败'), {code:'DQE_UPSTREAM_ERROR'});
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('metriccanvas:source-candidate-window',{detail:context.sourceCandidates}));
      if (state === 'page-failure' && query.pagination?.offset === 10 && !pageFailed) {
        pageFailed = true;
        throw Object.assign(new Error('合成续页失败'), {code:'DQE_UPSTREAM_ERROR'});
      }
      return serviceWindow(query, context, state);
    }
    if(context?.dataSourceIds?.includes('channel-options')){
      if(state==='error')throw Object.assign(new Error('合成候选查询失败'),{code:'DQE_UPSTREAM_ERROR'});
      const rows=state==='empty'?[]:candidateRows;
      const offset=query.pagination?.offset??0,limit=query.pagination?.limit??rows.length;
      const totalCount=state==='incomplete'&&offset>0?rows.length+1:rows.length;
      return {rows:rows.slice(offset,offset+limit),totalCount};
    }
    return organizationRows(query);
  }};
  return {dataGateway,requests};
}

function organizationRows(query:EffectiveQuery) {
  const org=selected(query,'org') ?? selected(query,'office');
  const channel=selected(query,'channel');
  const multiplier=channel?.includes('partner')?2:channel?.includes('online')?3:1;
  const rows=organizations.filter(([value])=>!org||org.includes(value)).map(([org,amount])=>({org,amount:amount*multiplier}));
  return {rows,totalCount:rows.length};
}

function serviceWindow(query:EffectiveQuery, context:QueryDiagnosticContext, state:string) {
  const offset = query.pagination?.offset ?? 0;
  const limit = query.pagination?.limit ?? 10;
  const scope = selected(query,'范围')?.[0] ?? '甲';
  const size = state === 'empty' ? 0 : scope === '乙' ? 12 : 25;
  const values = Array.from({length:size}, (_, index) => `${scope}云服务${String(index + 1).padStart(2,'0')}`);
  const members = query.tableFilters?.find(value => value.target === 'dimension' && value.queryField === '云服务');
  const match = query.search?.query ?? '';
  const rows = values
    .filter(value => value.includes(match) && (members?.target !== 'dimension' || members.values.includes(value)))
    .map(service => ({service}));
  const totalCount = rows.length + Number(state === 'incomplete' && context.sourceCandidates?.kind === 'page' && offset > 0);
  return {rows:rows.slice(offset,offset + limit),totalCount};
}

function untilCancelled(signal:AbortSignal|undefined):Promise<never> {
  return new Promise((_resolve,reject)=>{
    signal?.throwIfAborted();
    signal?.addEventListener('abort',()=>reject(signal.reason),{once:true});
  });
}
