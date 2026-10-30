import type {EffectiveQuery,Row} from '@metriccanvas/page/internal';
import type {DataGateway} from '../../../packages/data-execution/src';
import {sortTableRows,filterTableRows,localColumnCandidates} from '../../../packages/data-execution/src/runtime';

/** All data is synthetic. The request log demonstrates source windows, not real DQE support. */
export function createPagedJoinPreview(count=80){
  const calls:EffectiveQuery[]=[];
  function matching(query:EffectiveQuery){
    let rows:Row[]=Array.from({length:count},(_,index)=>({
      'project-id':`P${String(index+1).padStart(6,'0')}`,'project-name':`测试项目${index+1}`,
      'approval-count':count-index,'project-status':index%2?'已关闭':'进行中','contract-amount':(index+1)*1000
    }));
    const field=(name:string)=>Object.entries(query.fieldMappings).find(([,value])=>'queryField' in value&&value.queryField===name)?.[0]??'';
    for(const predicate of [...query.filterValues,...(query.tableFilters??[])]){
      if(predicate.target==='dimension')rows=filterTableRows(rows,[{field:field(predicate.queryField),op:'in',values:predicate.values}]);
      if(predicate.target==='metricRange')rows=filterTableRows(rows,[
        ...(predicate.from===undefined?[]:[{field:field(predicate.metric),op:'gte' as const,value:predicate.from}]),
        ...(predicate.to===undefined?[]:[{field:field(predicate.metric),op:'lte' as const,value:predicate.to}])
      ]);
    }
    return sortTableRows(rows,(query.sort??[]).map(rule=>({field:field(rule.queryField),direction:rule.direction})));
  }
  const dataGateway:DataGateway={
    async fetchData(query){
      calls.push(structuredClone(query));
      if(typeof globalThis.dispatchEvent==='function')globalThis.dispatchEvent(new CustomEvent('metriccanvas:synthetic-paged-join',{detail:query}));
      const rows=matching(query),window=query.pagination;
      const selected=window?rows.slice(window.offset,window.offset+window.limit):rows;
      return {rows:selected.map(row=>Object.fromEntries(Object.keys(query.fieldMappings).map(field=>[field,row[field]]))),totalCount:rows.length};
    },
    async fetchColumnCandidates(request){return localColumnCandidates(matching(request.query),request.field,{pageIndex:0,pageSize:request.limit,sort:[],predicates:[]},request.search,request.offset,request.limit);}
  };
  return {dataGateway,calls};
}
