import type {RuntimeDataGateway,DisplayInputs} from '@metriccanvas/engine';
import type {EffectiveQuery,Row} from '@metriccanvas/page/internal';
import {filterTableRows,sortTableRows,localColumnCandidates} from '../../../packages/data-execution/src/runtime';
import {comparisonInputs} from './period-comparison';

const monthDates=Array.from({length:37},(_,index)=>{
  const date=new Date(Date.UTC(2023,9+index,28));return date.toISOString().slice(0,10);
});

function monthlyRecord(index:number,date:string):{sales:number|null;rate:number|null}|undefined {
  if(index===3&&date==='2026-09-28')return undefined;
  if(index===1)return {sales:0,rate:0};
  if(date==='2026-10-28')return {sales:120+index*20,rate:index===2?null:50};
  if(date==='2026-09-28')return {sales:index===4?null:index===5?-50:100+index*10,rate:40};
  return date==='2025-10-28'?{sales:80+index*8,rate:30}:{sales:60+index*6,rate:20};
}

function aggregateCustomer(index:number,dates:readonly string[]):Row|undefined {
  const records=dates.flatMap(date=>{const row=monthlyRecord(index,date);return row?[row]:[];});
  if(!records.length)return undefined;
  const sales=records.flatMap(row=>row.sales===null?[]:[row.sales]),rates=records.flatMap(row=>row.rate===null?[]:[row.rate]);
  return {customer:`C${String(index+1).padStart(6,'0')}`,sales:sales.length?sales.reduce((a,b)=>a+b,0):null,
    rate:rates.length?rates.reduce((a,b)=>a+b,0)/rates.length:null};
}

function matchingRows(query:EffectiveQuery,count:number):Row[] {
  const time=query.filterValues.find(value=>value.target==='time');
  if(time?.target!=='time')throw new Error('合成比较查询缺少时间范围');
  const dates=monthDates.filter(date=>date>=time.value.from&&date<=time.value.to);
  const keys=query.filterValues.find(value=>value.target==='dimension'&&value.queryField==='customer');
  const indices=keys?.target==='dimension'?keys.values.map(value=>Number(String(value).slice(1))-1):Array.from({length:count},(_,index)=>index);
  let rows=indices.filter(index=>index>=0&&index<count).flatMap(index=>{const row=aggregateCustomer(index,dates);return row?[row]:[];});
  for(const predicate of query.tableFilters??[]) {
    if(predicate.target==='dimension')rows=filterTableRows(rows,[{field:predicate.queryField,op:'in',values:predicate.values}]);
    if(predicate.target==='metricRange')rows=filterMetric(rows,predicate);
  }
  return sortTableRows(rows,(query.sort??[]).map(rule=>({field:rule.queryField,direction:rule.direction})));
}

function filterMetric(rows:Row[],predicate:Extract<EffectiveQuery['filterValues'][number],{target:'metricRange'}>):Row[] {
  return filterTableRows(rows,[...(predicate.from===undefined?[]:[{field:predicate.metric,op:'gte' as const,value:predicate.from}]),
    ...(predicate.to===undefined?[]:[{field:predicate.metric,op:'lte' as const,value:predicate.to}])]);
}

/** Synthetic monthly observations on the 28th; queries aggregate the actual requested dates. */
export function createQueryComparisonPreview(state='ready',count=state==='large'?100000:23) {
  const calls:EffectiveQuery[]=[];
  let failed=false;
  const displayInputs:DisplayInputs={getSnapshot:()=>comparisonInputs,subscribe(run){run(comparisonInputs);return ()=>{};}};
  const dataGateway:RuntimeDataGateway={async fetchData(query,context,signal){
    signal?.throwIfAborted();calls.push(structuredClone(query));
    if(typeof globalThis.dispatchEvent==='function')globalThis.dispatchEvent(new CustomEvent('metriccanvas:synthetic-comparison-page',{detail:{query,sourceIds:context?.dataSourceIds}}));
    if(context?.dataSourceIds?.includes('year-ago')&&(state==='error'||state==='retry'&&!failed)){failed=true;throw new Error('合成去年同期补查失败');}
    const rows=matchingRows(query,count),window=query.pagination;
    const selected=window?rows.slice(window.offset,window.offset+window.limit):rows;
    if(state==='duplicate'&&context?.dataSourceIds?.includes('previous')&&selected.length)selected.push(selected[0]);
    if(state==='truncated'&&context?.dataSourceIds?.includes('previous'))selected.pop();
    return {rows:selected,totalCount:rows.length};
  },async fetchColumnCandidates(request){
    return localColumnCandidates(matchingRows(request.query,count),request.field,{pageIndex:0,pageSize:request.limit,sort:[],predicates:[]},request.search,request.offset,request.limit);
  }};
  return {dataGateway,displayInputs,calls};
}
