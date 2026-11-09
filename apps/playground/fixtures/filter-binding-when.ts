import type {RuntimeDataGateway} from '@metriccanvas/engine';
import type {EffectiveQuery} from '@metriccanvas/page/internal';

const records=[
  {geo:'全球',dept:'国内地区部',office:'北京代表处',site:'国内',amount:10},
  {geo:'全球',dept:'海外地区部',office:'巴黎代表处',site:'海外',amount:20}
];
/** Synthetic data only; preserve predicates for browser inspection. */
export function createFilterBindingWhenPreview(state='ready') {
  const requests:EffectiveQuery[]=[];
  const dataGateway:RuntimeDataGateway={
    async fetchFilterCandidates(){return {kind:'values',candidates:[
      {level:'geo',value:'全球',label:'全球'},
      {level:'dept',value:'国内地区部',label:'国内地区部',parent:{level:'geo',value:'全球'}},
      {level:'dept',value:'海外地区部',label:'海外地区部',parent:{level:'geo',value:'全球'}},
      {level:'office',value:'巴黎代表处',label:'巴黎代表处',parent:{level:'dept',value:'海外地区部'}}
    ]};},
    async fetchData(query){
      requests.push(structuredClone(query));
      if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('metriccanvas:binding-when',{detail:query}));
      if(state==='error')throw new Error('合成查询失败');
      if(state==='empty')return {rows:[],totalCount:0};
      const rows=records.filter(row=>query.filterValues.every(predicate=>matches(row,predicate))).map(row=>({office:row.office,amount:row.amount}));
      return {rows,totalCount:rows.length};
    }
  };
  return {dataGateway,requests};
}
function matches(row:typeof records[number],predicate:EffectiveQuery['filterValues'][number]):boolean {
  if(predicate.target!=='dimension')return true;
  if(!['geo','dept','office','site'].includes(predicate.queryField))return true;
  return predicate.values.includes(String(row[predicate.queryField as keyof typeof row]));
}
