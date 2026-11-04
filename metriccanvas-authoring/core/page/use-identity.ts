import { walkDocumentComponents } from '../../../packages/page/src/component-walk';
import type { DataUse } from './data-scan';
import { issue, type Json, type StableDataUse, type AnalysisIssue } from './analysis-types';

function componentPaths(document:Json):Map<string,string[]> {
  const paths=new Map<string,string[]>();
  walkDocumentComponents(document,(component,path)=>{
    const id=String(component.id ?? '');paths.set(id,[...paths.get(id) ?? [],path]);
  });
  return paths;
}

function semanticUseId(use:DataUse):string {
  return 'use:'+[
    use.componentId,use.componentType,use.source ?? '',use.slot ?? '',use.field ?? '',use.recordListField ?? '',use.kind
  ].map(encodeURIComponent).join(':');
}

function pointerRole(use:DataUse,paths:Map<string,string[]>):string {
  const locations=paths.get(use.componentId);
  const root=locations?.length===1?locations[0]:'';
  return use.path.slice(root.length).replace(/\/\d+(?=\/|$)/g,'/*');
}

/** Semantic identity survives container/column reorder; pointer remains the current location. */
export function identifyDataUses(document:Json,uses:DataUse[]):{uses:StableDataUse[];diagnostics:AnalysisIssue[]} {
  const paths=componentPaths(document);
  const groups=new Map<string,StableDataUse>();
  const diagnostics:AnalysisIssue[]=[];
  for(const use of uses) {
    const useId=semanticUseId(use),role=pointerRole(use,paths),prior=groups.get(useId);
    if(prior) {
      if(!prior.pointers.includes(use.path))prior.pointers.push(use.path);
      if(!prior.roles.includes(role))prior.roles.push(role);
      if(!prior.labels.includes(use.label))prior.labels.push(use.label);
      continue;
    }
    const ambiguous=(paths.get(use.componentId)?.length ?? 0)>1;
    if(ambiguous)diagnostics.push(issue('ANALYSIS_USE_AMBIGUOUS',use.path,'The component identity resolves to more than one component; array positions cannot disambiguate it'));
    groups.set(useId,{...use,useId,identityAmbiguous:ambiguous,pointers:[use.path],roles:[role],labels:[use.label]});
  }
  return {uses:[...groups.values()],diagnostics};
}
