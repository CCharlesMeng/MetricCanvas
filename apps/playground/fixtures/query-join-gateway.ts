import {dqeDefaultSort,type EffectiveQuery,type Row} from '@metriccanvas/page/internal';
import type {DataGateway} from '../../../packages/data-execution/src';
import {sortTableRows,filterTableRows,localColumnCandidates} from '../../../packages/data-execution/src/runtime';

/** All data is synthetic. The request log demonstrates source windows, not real DQE support. */
export function createPagedJoinPreview(count=80,supplementKey='ready',nulls='none'){
  const calls:EffectiveQuery[]=[];
  function matching(query:EffectiveQuery){
    let rows:Row[]=Array.from({length:count},(_,index)=>({
      'project-id':`P${String(index+1).padStart(6,'0')}`,'project-name':`测试项目${index+1}`,
      'approval-count':count-index,'project-status':index%2?'已关闭':'进行中','contract-amount':nulls!=='none'&&index%11===0?null:(index+1)*1000
    }));
    const field=(name:string)=>Object.entries(query.fieldMappings).find(([,value])=>'queryField' in value&&value.queryField===name)?.[0]??'';
    for(const predicate of [...query.filterValues,...(query.tableFilters??[])]){
      if(predicate.target==='dimension')rows=filterTableRows(rows,[{field:field(predicate.queryField),op:'in',values:predicate.values}]);
      if(predicate.target==='metricRange')rows=filterTableRows(rows,[
        ...(predicate.from===undefined?[]:[{field:field(predicate.metric),op:'gte' as const,value:predicate.from}]),
        ...(predicate.to===undefined?[]:[{field:field(predicate.metric),op:'lte' as const,value:predicate.to}])
      ]);
    }
    const sort=(query.sort??dqeDefaultSort(query.body.dsl_list[0])).map(rule=>({field:field(rule.queryField),direction:rule.direction}));
    return previewSort(rows,sort,nulls);
  }
  const dataGateway:DataGateway={
    async fetchData(query){
      calls.push(structuredClone(query));
      if(typeof globalThis.dispatchEvent==='function')globalThis.dispatchEvent(new CustomEvent('metriccanvas:synthetic-paged-join',{detail:query}));
      const rows=matching(query),window=query.pagination;
      const selected=window?rows.slice(window.offset,window.offset+window.limit):rows;
      const result={rows:selected.map(row=>Object.fromEntries(Object.keys(query.fieldMappings).map(field=>[field,row[field]]))),totalCount:rows.length};
      return supplementKeyPreview(query,result,supplementKey);
    },
    async fetchColumnCandidates(request){
      if(typeof globalThis.dispatchEvent==='function')globalThis.dispatchEvent(new CustomEvent('metriccanvas:synthetic-paged-join-candidates',{detail:request}));
      return localColumnCandidates(matching(request.query),request.field,{pageIndex:0,pageSize:request.limit,sort:[],predicates:[]},request.search,request.offset,request.limit);
    }
  };
  return {dataGateway,calls};
}

/** Simulate a backend whose null placement is independent of the local sorter. */
function previewSort(rows:Row[],sort:Parameters<typeof sortTableRows>[1],nulls:string):Row[]{
  const ordered=sortTableRows(rows,sort),field=sort[0]?.field;
  if(nulls!=='first'||!field)return ordered;
  return [...ordered.filter(row=>row[field]===null),...ordered.filter(row=>row[field]!==null)];
}

/** Faults belong to the synthetic page gateway, never to product execution. */
function supplementKeyPreview(query:EffectiveQuery,result:{rows:Row[];totalCount:number},mode:string){
  if(!('project-status' in query.fieldMappings))return result;
  if(mode==='failure')throw Object.assign(new Error('合成补充源无权限'),{code:'DQE_FORBIDDEN'});
  if(mode==='empty'){
    result.rows.push({...result.rows[0],'project-id':null});
    result.totalCount=result.rows.length;
  }
  if(mode==='all-empty')result.rows=result.rows.map(row=>({...row,'project-id':null}));
  if(mode==='truncated')result.rows.pop();
  return result;
}
