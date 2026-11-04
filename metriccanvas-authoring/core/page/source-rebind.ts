import { canonicalizeJson } from '../../../packages/page/src/canonical-json';
import { parsePage } from '../../../packages/page/src/validate';
import { affectedSourceIds } from '../../../packages/page/src/data-source-references';
import { scanPageData, projectDataSources } from './data-scan';
import { scopePageData } from './data-scope';
import { analyzePageData } from './analysis-report';
import { resultAssociationIssues } from './result-association';
import { mappedConsumerIssues, rowKeyIssues, nestedConsumerIssues, pinnedConsumerIssues } from './rebind-consumers';
import { rebindScopeIssues } from './rebind-scope';
import { issue, type Json, type AnalysisInput, type AnalysisReport, type AnalysisIssue } from './analysis-types';
import type { TemporalEvaluation } from '../../../packages/page/src/temporal-evaluation';

export interface RebindInput extends AnalysisInput {
  report:AnalysisReport;sourceId:string;resultRef:string;fieldMap:Record<string,string>;
  baselineScope?:{groupBy:string[];time:Json|null;provenance:{documentSha256:string;sourceId:string;reference:string}};evaluation?:TemporalEvaluation;
}

function sourceIssues(before:Json|undefined,record:Json|undefined):AnalysisIssue[] {
  if(!before || !record?.source)return [issue('REBIND_SOURCE_MISSING','/sourceId','Both the baseline source and the explicit replacement record are required')];
  if(!['inline','query'].includes(before.source?.type) || record.source.source?.type!=='query')return [issue('REBIND_SOURCE_UNSUPPORTED','/sourceId','This operation supports ordinary inline/query sources to an ordinary query source')];
  if(before.compute?.length || record.source.compute?.length)return [issue('REBIND_SOURCE_UNSUPPORTED','/sourceId','Computed source replacement requires materialized evidence and is not inferred')];
  const queries=[before.source.query,record.source.source.query].filter(Boolean);
  if(queries.some(query=>query.language!=='dqe' || query.queryModes || query.timeModes || query.periodComparison || query.periodPolicy))return [issue('REBIND_SOURCE_UNSUPPORTED','/sourceId','Selected query/period branches are not silently treated as an ordinary query')];
  return [];
}

function fieldMapIssues(before:Json,after:Json,fieldMap:Record<string,string>):AnalysisIssue[] {
  const keys=Object.keys(before.fields),issues:AnalysisIssue[]=[];
  if(canonicalizeJson([...keys].sort())!==canonicalizeJson(Object.keys(fieldMap).sort()))issues.push(issue('REBIND_FIELD_MAP_INCOMPLETE','/fieldMap','Every preserved field must have one explicit output mapping'));
  if(new Set(Object.values(fieldMap)).size!==Object.keys(fieldMap).length)issues.push(issue('REBIND_FIELD_MAP_AMBIGUOUS','/fieldMap','Distinct preserved fields require distinct explicit output fields'));
  for(const field of keys)issues.push(...oneFieldIssues(field,before.fields[field],after.fields[fieldMap[field]!],fieldMap[field]));
  return issues;
}

function oneFieldIssues(id:string,before:Json,after:Json|undefined,mapped:string|undefined):AnalysisIssue[] {
  const path=`/fieldMap/${id.replaceAll('~','~0').replaceAll('/','~1')}`;
  if(!mapped || !after)return [issue('REBIND_FIELD_MISSING',path,'A preserved field is absent in the supplied result contract')];
  if(['recordList','semanticHtml'].includes(before.type))return [issue('REBIND_SOURCE_UNSUPPORTED',path,'Nested/rich detail replacement needs explicit detail-context evidence')];
  return ['type','role','unit','currency','nullable'].filter(key=>canonicalizeJson(before[key] ?? null)!==canonicalizeJson(after[key] ?? null))
    .map(key=>issue('REBIND_FIELD_CONTRACT_MISMATCH',path,`Replacement changes preserved ${key}`));
}

function bindingIssues(before:Json,after:Json):AnalysisIssue[] {
  const oldQuery=before.source.query ?? {},newQuery=after.source.query;
  const issues=['filterBindings','paramBindings','resultBindings'].filter(key=>canonicalizeJson(oldQuery[key] ?? null)!==canonicalizeJson(newQuery[key] ?? null))
    .map(key=>issue('REBIND_BINDING_MISMATCH',`/resultRef/${key}`,'Replacing a source cannot silently change its filter, parameter or result dependencies'));
  if(canonicalizeJson(before.source.resultScope ?? null)!==canonicalizeJson(after.source.resultScope ?? null))issues.push(issue('REBIND_RESULT_SCOPE_MISMATCH','/resultRef','A complete-result contract cannot be added, removed or inferred during source replacement'));
  return issues;
}

function replacementSource(before:Json,after:Json,fieldMap:Record<string,string>):Json {
  const source=structuredClone(after.source);delete source.initial;
  const grouped=Object.hasOwn(before.fields,'dimensions') || Object.hasOwn(before.fields,'measures');
  const fields=grouped?Object.fromEntries(Object.entries(before.fields).map(([group,definitions])=>[group,mapFields(definitions as Json,after.fields,fieldMap)]))
    :mapFields(before.fields,after.fields,fieldMap);
  return {...structuredClone(before),fields,source};
}

function mapFields(before:Json,after:Json,fieldMap:Record<string,string>):Json {
  return Object.fromEntries(Object.entries(before).map(([id,field])=>[id,{...(field as Json),queryField:after[fieldMap[id]!].queryField ?? fieldMap[id]}]));
}

function expandedSource(source:Json):Json {
  return {...source,fields:projectDataSources({selected:source}).sources.selected.fields};
}

function impact(document:Json,schema:Json,sourceId:string):Json {
  const scan=scanPageData(document,schema);
  const componentIds=[...new Set(scan.uses.filter(use=>use.source===sourceId && use.componentType!=='page').map(use=>use.componentId))];
  const closure=componentIds.length?scopePageData(document,scan,componentIds):scan;
  return {sourceIds:Object.keys(closure.sources),componentIds:'consumers' in closure?closure.consumers.map((component:Json)=>component.id):[],
    filterIds:(document.filters ?? []).map((filter:Json)=>filter.id),params:structuredClone(document.params ?? []),
    note:'Complete consumer/dependency reading closure; this is not authorization'};
}

function dependentSourceIssues(document:Json,sourceId:string):AnalysisIssue[] {
  return [...affectedSourceIds(document.dataSources,[sourceId])].filter(id=>id!==sourceId)
    .filter(id=>!['inline','query'].includes(document.dataSources[id].source.type) || document.dataSources[id].compute?.length)
    .map(id=>issue('REBIND_DEPENDENT_UNSUPPORTED',`/dataSources/${id}`,'A paged/member/computed consumer requires its own materialized contract evidence; the complete closure is not ignored'));
}

/** Atomic controlled replacement: one source/field mapping, no JSON patch or re-composition. */
export function rebindPageSource(input:RebindInput):{document:Json|null;issues:Array<Json>;impact:Json;execution:'not-run';saveStatus:'not_requested'} {
  const before=input.document.dataSources?.[input.sourceId],record=input.resultRecords?.[input.resultRef];
  const rebuilt=analyzePageData({...input,requirements:input.report.requirements,dataRequests:input.report.dataRequests,links:input.report.links,priorReport:input.report});
  const preliminary=[...rebuilt.issues,...sourceIssues(before,record),...resultAssociationIssues(record,input.context,'/resultRef'),
    ...nestedConsumerIssues(input.document,input.sourceId),...dependentSourceIssues(input.document,input.sourceId)];
  if(record?.resultRef!==input.resultRef)preliminary.push(issue('RESULT_REFERENCE_MISMATCH','/resultRef','The selected record key and resultRef disagree'));
  const failed=(issues:Array<Json>,affected:Json={})=>({document:null,issues,impact:affected,execution:'not-run' as const,saveStatus:'not_requested' as const});
  if(preliminary.length)return failed(preliminary);
  const affected=impact(input.document,input.schema,input.sourceId);
  const normalizedBefore=expandedSource(before),normalizedRecord={...record!,source:expandedSource(record!.source)};
  const issues=[...fieldMapIssues(normalizedBefore,normalizedRecord.source,input.fieldMap),...bindingIssues(before,record!.source),
    ...rebindScopeIssues(normalizedBefore,normalizedRecord,input.fieldMap,input.baselineScope,input.baseline.documentSha256,input.sourceId),...rowKeyIssues(input.document,input.sourceId,normalizedRecord,input.fieldMap),
    ...pinnedConsumerIssues(input.document,input.sourceId,normalizedRecord),
    ...mappedConsumerIssues(rebuilt.report,input.sourceId,input.resultRef,input.fieldMap)];
  if(issues.length)return failed(issues,affected);
  const document=structuredClone(input.document);
  document.dataSources[input.sourceId]=replacementSource(before,normalizedRecord.source,input.fieldMap);
  for(const id of affectedSourceIds(document.dataSources,[input.sourceId]))delete document.dataSources[id]?.source?.initial;
  const parsed=parsePage(document,{evaluation:input.evaluation});
  if(!parsed.ok)return failed(parsed.errors,affected);
  return {document,issues:[],impact:affected,execution:'not-run',saveStatus:'not_requested'};
}
