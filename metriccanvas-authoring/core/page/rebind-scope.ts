import { canonicalizeJson } from '../../../packages/page/src/canonical-json';
import { issue, type Json, type AnalysisIssue } from './analysis-types';

function mappedDimensions(dimensions:unknown,fields:Json):string[]|undefined {
  if(!Array.isArray(dimensions))return undefined;
  const result:string[]=[];
  for(const name of dimensions) {
    const matches=Object.entries(fields).filter(([id,field])=>(field.queryField ?? id)===name && field.role==='dimension');
    if(matches.length!==1)return undefined;
    result.push(matches[0]![0]);
  }
  return result.sort();
}

const normalizedTime=(time:Json|null|undefined):Json|null=>time?{
  granularity:time.granularity==='M'?'month':time.granularity,start:time.start,end:time.end
}:null;

function queryScope(source:Json):Json|undefined {
  const query=source.source?.query;
  const leaves=query?.body?.dsl_list;
  if(query?.language!=='dqe' || !Array.isArray(leaves) || leaves.length!==1)return undefined;
  const leaf=leaves[0],groupBy=mappedDimensions(leaf.output_dims,source.fields);
  if(!groupBy)return undefined;
  const time=leaf.filter?.time;
  if(time && (typeof time.start!=='string' || typeof time.end!=='string'))return undefined;
  return {groupBy,time:time?normalizedTime({...time,granularity:time.period}):null,aggregate:time?.is_aggregate ?? null,
    fixedFilters:leaf.filter?.dims ?? [],fixedMetrics:leaf.filter?.metrics ?? []};
}

function declaredScope(record:Json,fieldMap:Record<string,string>):Json|undefined {
  const scope=record.request;
  if(!scope || !Array.isArray(scope.groupBy) || !Array.isArray(scope.filters) || !Object.hasOwn(scope,'time'))return undefined;
  const output=mappedDimensions(scope.groupBy,record.source.fields);
  if(!output)return undefined;
  const inverse=new Map(Object.entries(fieldMap).map(([before,after])=>[after,before]));
  const groupBy=output.map(id=>inverse.get(id));
  if(groupBy.some(id=>id===undefined))return undefined;
  return {groupBy:groupBy.sort(),time:normalizedTime(scope.time)};
}

/** Inline scope must be an attributed fact; observable query scope can never be overridden. */
export function rebindScopeIssues(before:Json,record:Json,fieldMap:Record<string,string>,baselineScope:Json|undefined,documentSha256:string,sourceId:string):AnalysisIssue[] {
  const observed=queryScope(before),after=declaredScope(record,fieldMap);
  const origin=baselineScope?.provenance;
  const supplied=origin?.documentSha256===documentSha256 && origin?.sourceId===sourceId && typeof origin.reference==='string' && origin.reference.trim()
    ?{groupBy:[...baselineScope!.groupBy].sort(),time:normalizedTime(baselineScope!.time)}:undefined;
  if(!after || (!observed && !supplied))return [issue('REBIND_SCOPE_UNPROVEN','/baselineScope','Grain and period require observable query scope or an explicit attributed baseline fact')];
  const expected=observed?{groupBy:observed.groupBy,time:observed.time}:supplied;
  const issues:AnalysisIssue[]=[];
  if(observed && supplied && canonicalizeJson(expected)!==canonicalizeJson(supplied))issues.push(issue('REBIND_SCOPE_MISMATCH','/baselineScope','An attributed fact cannot override the existing observable scope'));
  if(canonicalizeJson(expected)!==canonicalizeJson(after))issues.push(issue('REBIND_SCOPE_MISMATCH','/resultRef','Replacement grain or time window differs from the preserved source scope'));
  const newQuery=queryScope(record.source);
  if(!newQuery)issues.push(issue('REBIND_SCOPE_UNPROVEN','/resultRef','The replacement query scope is unsupported or not fully observable'));
  else issues.push(...replacementScopeIssues(observed,newQuery,after,record,fieldMap));
  return issues;
}

function replacementScopeIssues(before:Json|undefined,query:Json,declared:Json,record:Json,fieldMap:Record<string,string>):AnalysisIssue[] {
  const inverse=new Map(Object.entries(fieldMap).map(([oldId,newId])=>[newId,oldId]));
  const actual={groupBy:query.groupBy.map((id:string)=>inverse.get(id)).sort(),time:query.time};
  const issues=fixedFilterIssues(before,query);
  if(canonicalizeJson(actual)!==canonicalizeJson(declared))issues.push(issue('REBIND_SCOPE_MISMATCH','/resultRef','The supplied record request and its actual query do not describe the same grain or period'));
  if(before && before.aggregate!==query.aggregate)issues.push(issue('REBIND_SCOPE_MISMATCH','/resultRef','Replacement changes the original time aggregation'));
  const filters=record.request.filters.map((filter:Json)=>({dim_name:filter.dimension,dim_value_list:filter.values}));
  if(canonicalizeJson(filters)!==canonicalizeJson(query.fixedFilters))issues.push(issue('REBIND_SCOPE_MISMATCH','/resultRef','The replacement query filters do not match its explicit request evidence'));
  return issues;
}

function fixedFilterIssues(before:Json|undefined,after:Json):AnalysisIssue[] {
  if(!before)return [];
  return ['fixedFilters','fixedMetrics'].filter(key=>canonicalizeJson(before[key])!==canonicalizeJson(after[key]))
    .map(key=>issue('REBIND_SCOPE_MISMATCH','/resultRef',`Replacement changes preserved ${key}`));
}
