import type {RuntimeDataGateway} from '@metriccanvas/engine';
import type {EffectiveQuery} from '@metriccanvas/page/internal';
const candidateRows=[{code:'direct',name:'直营',weight:1},{code:'direct',name:'直营',weight:2},{code:'partner',name:'伙伴',weight:1},{code:'online',name:'线上',weight:1},{code:'partner',name:'伙伴',weight:2}];
const organizations=[['north',100],['shanghai',40],['beijing',60],['south',80],['shenzhen',30]] as const;
function selected(query:EffectiveQuery,field:string):readonly string[]|undefined {
  const item=query.filterValues.find(value=>value.target==='dimension'&&value.queryField===field);
  return item?.target==='dimension'?item.values.map(String):undefined;
}
/** Complete pagination and failures are synthetic; no production DQE or dictionary endpoint. */
export function createSourceCandidatesPreview(state='ready') {
  const requests:EffectiveQuery[]=[];
  const dataGateway:RuntimeDataGateway={async fetchData(query,context,signal){
    signal?.throwIfAborted();requests.push(structuredClone(query));
    if(context?.dataSourceIds?.includes('channel-options')){
      if(state==='error')throw Object.assign(new Error('合成候选查询失败'),{code:'DQE_UPSTREAM_ERROR'});
      const rows=state==='empty'?[]:candidateRows;
      const offset=query.pagination?.offset??0,limit=query.pagination?.limit??rows.length;
      const totalCount=state==='incomplete'&&offset>0?rows.length+1:rows.length;
      return {rows:rows.slice(offset,offset+limit),totalCount};
    }
    const org=selected(query,'org'),channel=selected(query,'channel');
    const multiplier=channel?.includes('partner')?2:channel?.includes('online')?3:1;
    const rows=organizations.filter(([value])=>!org||org.includes(value)).map(([org,amount])=>({org,amount:amount*multiplier}));
    return {rows,totalCount:rows.length};
  }};
  return {dataGateway,requests};
}
