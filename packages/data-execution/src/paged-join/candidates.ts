import {hasQueryFieldMapping,pagedJoinCandidateView,selectQuerySource,tableHeaders,type Page,type PagedJoinDataSource,type QueryDataSource} from '@metriccanvas/page/internal';
import type {ColumnCandidatesRead} from '../source-program/column-candidates';
import type {QueryRunner} from '../query-runner';
import type {ColumnCandidatesPage} from '../ports';
import {composeEffectiveQuery} from '../effective-query';

/** Read only the owning member, including idle preloads; never mutate ordinary snapshots. */
export async function queryJoinCandidates(page:Page,data:PagedJoinDataSource,request:ColumnCandidatesRead,runner:QueryRunner,scope:string,signal?:AbortSignal):Promise<ColumnCandidatesPage>{
  const projection=data.source.projection[request.field],owner=projection?.member,member=data.source.members[owner];
  if(!member?.canSelectPage||data.source.records&&owner!==data.source.domainMember)return {kind:'unavailable'};
  const source=page.dataSources[member.source];
  if(source.source.type!=='query')return {kind:'unavailable'};
  const selected=selectQuerySource(source as QueryDataSource,request.conditions),field=selected.fields[projection.field];
  if(!hasQueryFieldMapping(field))return {kind:'unavailable'};
  const view=pagedJoinCandidateView(data,request.view,request.field);
  const predicates=view.predicates.map(rule=>({...rule,field:data.source.projection[rule.field].field}));
  const query=composeEffectiveQuery({displayInputs:request.displayInputs,filterRevision:request.filterRevision,now:request.now,page:page,filters:page.filters,dataSource:selected},request.conditions,0,[],tableHeaders(predicates));
  return runner.runCandidates({query,field:projection.field,queryField:field.queryField,search:request.candidateSearch??'',offset:request.offset??0,limit:request.pageSize??50},
    {pageId:page.id,dataSourceIds:[request.sourceId,member.source]},scope,signal);
}
