import { canonicalizeJson } from '../../../packages/page/src/canonical-json';
import { scanPageData, useFieldContract, projectDataSources } from './data-scan';
import { scopePageData } from './data-scope';
import { identifyDataUses } from './use-identity';
import { resultAssociationIssues, resultReference, requestScope } from './result-association';
import { issue, type Json, type AnalysisIssue, type AnalysisInput, type AnalysisLink, type AnalysisReport, type StableDataUse } from './analysis-types';

function keyed(items:Json[],key:string,path:string,issues:AnalysisIssue[]):Map<string,Json> {
  const index=new Map<string,Json>();
  for(const [i,item] of items.entries()) {
    if(index.has(item[key]))issues.push(issue('ANALYSIS_ID_DUPLICATE',`${path}/${i}/${key}`,'Association identities must be unique'));
    index.set(item[key],item);
  }
  return index;
}

function priorIssues(input:AnalysisInput,uses:StableDataUse[]):AnalysisIssue[] {
  const prior=input.priorReport;
  if(!prior)return [];
  if(canonicalizeJson(prior.baseline)!==canonicalizeJson(input.baseline))return [issue('ANALYSIS_BASELINE_STALE','/priorReport/baseline','A report cannot be applied to a different raw document, Schema, material, binding or work version')];
  const positions=uses.map(useIdentity);
  const previous=prior.uses.map(useIdentity);
  return canonicalizeJson(positions)===canonicalizeJson(previous)?[]:[issue('ANALYSIS_POSITION_STALE','/priorReport/uses','Report identities or pointers no longer match the complete document')];
}

function useIdentity(use:StableDataUse):Json {
  const keys=['useId','componentId','componentType','source','slot','field','recordListField','kind','pointers','roles','identityAmbiguous'];
  return Object.fromEntries(keys.filter(key=>Object.hasOwn(use,key)).map(key=>[key,(use as unknown as Json)[key]]));
}

function linkIdentityIssues(link:AnalysisLink,location:string,use:StableDataUse|undefined,requirements:Map<string,Json>,units:Map<string,Json>):AnalysisIssue[] {
  const issues:AnalysisIssue[]=[];
  if(!requirements.has(link.requirementId))issues.push(issue('ANALYSIS_REQUIREMENT_UNKNOWN',location+'/requirementId','Unknown requirement identity'));
  if(!units.has(link.dataRequestId))issues.push(issue('ANALYSIS_REQUEST_UNKNOWN',location+'/dataRequestId','Unknown data request unit identity'));
  if(!use || use.identityAmbiguous)issues.push(issue('ANALYSIS_USE_UNKNOWN',location+'/useId','Unknown or ambiguous semantic data-use identity'));
  return issues;
}

function fieldIssues(use:StableDataUse,link:AnalysisLink,sources:Json,record:Json,location:string):AnalysisIssue[] {
  const output=record.source?projectDataSources({result:record.source}).sources.result.fields:{};
  const before=useFieldContract(use,sources),after=output?.[link.outputField];
  if(!before || !after)return [issue('ANALYSIS_OUTPUT_FIELD_UNKNOWN',location+'/outputField','The supplied output field and page use must both have explicit contracts')];
  const incompatible=['type','role','unit','currency'].filter(key=>canonicalizeJson(before[key] ?? null)!==canonicalizeJson(after[key] ?? null));
  return incompatible.map(key=>issue('ANALYSIS_FIELD_CONTRACT_MISMATCH',location+'/outputField',`Explicit field contracts differ at ${key}; no semantic equivalence was inferred`));
}

function linkedResultIssues(link:AnalysisLink,use:StableDataUse,unit:Json,input:AnalysisInput,sources:Json,location:string):AnalysisIssue[] {
  if(!link.resultRef)return [];
  const record=input.resultRecords?.[link.resultRef];
  const issues=resultAssociationIssues(record,input.context,location+'/resultRef');
  if(issues.length || !record)return issues;
  if(record.resultRef!==link.resultRef)issues.push(issue('RESULT_REFERENCE_MISMATCH',location+'/resultRef','Record key and resultRef disagree'));
  if(canonicalizeJson(requestScope(record.request ?? {}))!==canonicalizeJson(requestScope(unit)))issues.push(issue('ANALYSIS_REQUEST_SCOPE_MISMATCH',location+'/dataRequestId','Result request scope differs from the explicit data request unit'));
  return [...issues,...fieldIssues(use,link,sources,record,location)];
}

function associationIssues(input:AnalysisInput,uses:StableDataUse[],sources:Json):AnalysisIssue[] {
  const issues:AnalysisIssue[]=[];
  const requirements=keyed(input.requirements ?? [],'id','/requirements',issues);
  const units=keyed(input.dataRequests ?? [],'dataSourceId','/dataRequests',issues);
  const byUse=new Map(uses.map(use=>[use.useId,use]));
  const seen=new Set<string>();
  for(const [i,link] of (input.links ?? []).entries()) {
    const path=`/links/${i}`,use=byUse.get(link.useId);
    const key=canonicalizeJson(link);
    if(seen.has(key))issues.push(issue('ANALYSIS_LINK_DUPLICATE',path,'The same association cannot be supplied twice'));
    seen.add(key);
    const invalid=linkIdentityIssues(link,path,use,requirements,units);
    issues.push(...invalid);
    if(!invalid.length)issues.push(...linkedResultIssues(link,use!,units.get(link.dataRequestId)!,input,sources,path));
  }
  return issues;
}

function reverseIndexes(links:AnalysisLink[]):Json {
  const indexes:Json={byRequirement:Object.create(null),byDataRequest:Object.create(null),byResult:Object.create(null),byUse:Object.create(null)};
  links.forEach((link,i)=>{
    for(const [name,key] of [['byRequirement','requirementId'],['byDataRequest','dataRequestId'],['byResult','resultRef'],['byUse','useId']]) {
      const id=link[key as keyof AnalysisLink];
      if(id)(indexes[name][id] ??= []).push(i);
    }
  });
  return indexes;
}

function coverageGaps(input:AnalysisInput,uses:StableDataUse[]):Json[] {
  const links=input.links ?? [];
  const useGaps=uses.filter(use=>use.field && !links.some(link=>link.useId===use.useId)).map(use=>({code:'ANALYSIS_USE_UNMAPPED',useId:use.useId,path:use.path}));
  const requirementGaps=(input.requirements ?? []).filter(requirement=>!links.some(link=>link.requirementId===requirement.id)).map(requirement=>({code:'ANALYSIS_REQUIREMENT_UNMAPPED',requirementId:requirement.id}));
  const evidenceGaps=links.filter(link=>!link.resultRef || !input.resultRecords?.[link.resultRef]).map(link=>({code:'ANALYSIS_EXECUTION_EVIDENCE_MISSING',useId:link.useId,dataRequestId:link.dataRequestId}));
  return [...useGaps,...requirementGaps,...evidenceGaps];
}

/** Pure association over the complete working copy; never executes queries or stores rows. */
export function analyzePageData(input:AnalysisInput):{report:AnalysisReport;issues:AnalysisIssue[]} {
  const scan=scanPageData(input.document,input.schema);
  const identified=identifyDataUses(input.document,scan.uses);
  const links=structuredClone(input.links ?? []);
  const issues=[...identified.diagnostics,...materialIssues(input),...priorIssues(input,identified.uses),...associationIssues(input,identified.uses,scan.sources)];
  const reading=input.componentIds?.length?scopePageData(input.document,scan,input.componentIds):scan;
  const references=[...new Set(links.flatMap(link=>link.resultRef?[link.resultRef]:[]))];
  const records=references.flatMap(ref=>input.resultRecords?.[ref]?[resultReference(input.resultRecords[ref])]:[]);
  return {issues,report:{format:'metriccanvas-analysis/1',baseline:structuredClone(input.baseline),execution:'not-run',
    uses:identified.uses,sources:scan.sources,requirements:structuredClone(input.requirements ?? []),
    dataRequests:(input.dataRequests ?? []).map(requestScope),links,results:records,indexes:reverseIndexes(links),
    reading:{requestedComponentIds:input.componentIds ?? [],componentIds:[...new Set(reading.uses.filter(use=>use.componentType!=='page').map(use=>use.componentId))],sourceIds:Object.keys(reading.sources),
      useIds:identified.uses.filter(use=>reading.uses.some(original=>use.pointers.includes(original.path))).map(use=>use.useId),
      note:'Reading scope only; association coverage and diagnostics always include the complete document'},
    diagnostics:[...scan.diagnostics,...issues],gaps:coverageGaps(input,identified.uses)}};
}

function materialIssues(input:AnalysisInput):AnalysisIssue[] {
  const issues:AnalysisIssue[]=[];
  for(const [i,requirement] of (input.requirements ?? []).entries()) {
    const evidence=(requirement as Json).evidence ?? [];
    for(const [j,entry] of evidence.entries()) {
      const lines=input.materialText?.split('\n');
      const valid=lines && entry.from>=1 && entry.to>=entry.from && entry.to<=lines.length;
      if(!valid || !lines!.slice(entry.from-1,entry.to).join('\n').includes(entry.quote))issues.push(issue('ANALYSIS_MATERIAL_EVIDENCE_INVALID',`/requirements/${i}/evidence/${j}`,'Material ranges and quoted text must match the supplied original material'));
    }
  }
  return issues;
}
