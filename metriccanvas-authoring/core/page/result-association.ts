import { canonicalizeJson } from '../../../packages/page/src/canonical-json';
import { issue, type Json, type AnalysisIssue } from './analysis-types';
import {projectDataSources} from './data-scan';

/** Only compare supplied provenance facts; authorization and actual record lookup belong to Relay. */
export function resultAssociationIssues(record:Json|undefined,context:Json|undefined,path:string):AnalysisIssue[] {
  if(!record)return [issue('ANALYSIS_RESULT_MISSING',path,'The referenced existing result record was not supplied')];
  if(!context)return [issue('ANALYSIS_CONTEXT_MISSING',path,'Result association requires explicit current binding, dataContextVersion and validationPolicy')];
  const checks:Array<[string,string]>= [['binding','RESULT_SCOPE_MISMATCH'],['dataContextVersion','RESULT_VERSION_STALE'],['validationPolicy','RESULT_VALIDATION_POLICY_CHANGED']];
  const issues=checks.filter(([field])=>context[field]===undefined || canonicalizeJson(record[field] ?? null)!==canonicalizeJson(context[field]))
    .map(([field,code])=>issue(code,`${path}/${field}`,'Supplied result provenance does not match the current explicit context'));
  if(!['ready','empty'].includes(record.status))issues.push(issue('RESULT_NOT_READY',path,'A pending/failed result cannot attest the association'));
  return issues;
}

export function requestScope(request:Json):Json {
  return Object.fromEntries(['dataSourceId','businessDomain','metrics','groupBy','filters','time'].filter(key=>Object.hasOwn(request,key)).map(key=>[key,structuredClone(request[key])]));
}

/** No rows, source.initial, query body or caller-defined extensions enter the report. */
export function resultReference(record:Json):Json {
  const fields=record.source?projectDataSources({result:record.source}).sources.result.fields:{};
  return {resultRef:record.resultRef,status:record.status,binding:structuredClone(record.binding ?? null),
    dataContextVersion:record.dataContextVersion ?? null,validationPolicy:record.validationPolicy ?? null,
    request:requestScope(record.request ?? {}),capturedAt:record.capturedAt ?? null,
    returnedCount:record.returnedCount ?? null,totalCount:record.totalCount ?? null,
    fields:Object.fromEntries(Object.entries(fields).map(([id,field])=>[id,projectField(field as Json)]))};
}

function projectField(field:Json):Json {
  return Object.fromEntries(['type','role','label','unit','currency','nullable','queryField','defaultFormat'].filter(key=>Object.hasOwn(field,key)).map(key=>[key,structuredClone(field[key])]));
}
