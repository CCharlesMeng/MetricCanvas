import {dqeRecord,type EffectiveQuery} from '@metriccanvas/page/internal';
import {localColumnCandidates} from '../column-candidates';
import type {ColumnCandidatesPage,ColumnCandidatesQuery,DataGateway,QueryDiagnosticContext} from '../ports';

/** Only the candidate field is projected; filters still address the original object. */
function projectedQuery(request:ColumnCandidatesQuery,maxRows?:number):EffectiveQuery|undefined {
  const query=structuredClone(request.query),item=query.body.dsl_list[0];
  const order=dqeRecord(item.order);
  // A declared TopN is a business selection, not a disposable table page.
  if(order.limit!==undefined&&order.offset===undefined)return;
  item.output_fields=[request.queryField];
  item.order={};
  query.fieldMappings={[request.field]:query.fieldMappings[request.field]};
  query.sort=undefined;
  query.pagination=undefined;
  if(maxRows!==undefined){
    if(!Number.isSafeInteger(maxRows)||maxRows<1)throw Object.assign(new Error('对象候选查询上限必须为正安全整数'),{code:'DQE_CONFIG_ERROR'});
    item.order={offset:0,limit:maxRows};
  }
  return query;
}

function assertActive(signal?:AbortSignal):void {
  if(signal?.aborted)throw Object.assign(new Error('列候选读取已取消'),{code:'DQE_CANCELLED'});
}

/** Object projection is not DISTINCT: only candidate values are deduplicated locally. */
export async function objectColumnCandidates(request:ColumnCandidatesQuery,fetchData:DataGateway['fetchData'],context?:QueryDiagnosticContext,signal?:AbortSignal,maxRows?:number):Promise<ColumnCandidatesPage> {
  assertActive(signal);
  const query=projectedQuery(request,maxRows);
  if(!query)return {kind:'unavailable'};
  const result=await fetchData(query,context,signal);
  assertActive(signal);
  if(maxRows!==undefined&&result.totalCount!==undefined&&result.totalCount>maxRows)throw Object.assign(
    new Error(`候选数据超过${maxRows}条查询上限，无法提供完整选项；请缩小筛选范围，或联系管理员显式提高上限。`),{code:'DQE_CANDIDATE_LIMIT_EXCEEDED'});
  if(result.totalCount!==result.rows.length)throw Object.assign(
    new Error('对象候选结果不完整，请检查服务返回总数及默认截断；不能使用部分选项。'),{code:'DQE_ROW_CONTRACT_ERROR'});
  return localColumnCandidates(result.rows,request.field,
    {pageIndex:0,pageSize:request.limit,sort:[],predicates:[]},request.search,request.offset,request.limit);
}
