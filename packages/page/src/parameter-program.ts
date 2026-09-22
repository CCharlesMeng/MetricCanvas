import {extractPageParams,applyPageParamSelection,type ExtractionContext} from './extract-page-params';
import {resolvePageParams} from './resolve-page-params';
import type {TextValue} from './page-param';

export type ParameterProgramRequest =
  | {action:'resolve';document:unknown;suppliedValues?:Record<string,unknown>}
  | {action:'extract'|'prepare';document:unknown;context:ExtractionContext;selectedIds?:string[];textReplacements?:Record<string,TextValue>};

/** Trusted serializable program interface; no renderer, I/O, storage or model channel. */
export function runPageParameterProgram(request:ParameterProgramRequest) {
  if(request.action==='resolve') {
    const result=resolvePageParams(request.document,request.suppliedValues);
    return result.ok?{...result,effectiveInputs:Object.fromEntries(result.effectiveInputs)}:result;
  }
  const extraction=extractPageParams(request.document,request.context);
  if(!extraction.ok)return extraction;
  if(request.action==='prepare') {
    const selected=request.selectedIds??extraction.candidates.filter(c=>c.defaultSelected).map(c=>c.id);
    const result=applyPageParamSelection(extraction,selected,request.textReplacements);
    return result.ok?{...result,baseline:extraction.baseline,sourceKey:extraction.sourceKey,candidates:extraction.candidates,skipped:extraction.skipped,selectedIds:selected}:result;
  }
  if(request.action!=='extract')throw Error('Unknown parameter program action');
  const textSlots:Array<{id:string;path:string;candidates:string[]}>=[];
  const visit=(value:unknown,path:string)=>{
    if(typeof value==='string') {
      const candidates=extraction.candidates.filter(c=>{
        const original=c.originalValue;
        const terms=typeof original==='string'?[original]:Array.isArray(original)?original:typeof original==='object'?[original.start,original.end]:[];
        return terms.some(term=>value.includes(term));
      }).map(c=>c.id);
      if(candidates.length)textSlots.push({id:`text-${textSlots.length+1}`,path,candidates});
    } else if(Array.isArray(value))value.forEach((v,i)=>visit(v,`${path}/${i}`));
    else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))if(!['id','type','param'].includes(key))visit(v,`${path}/${key.replaceAll('~','~0').replaceAll('/','~1')}`);
  };
  visit(extraction.source.sections,'/sections');visit(extraction.source.meta,'/meta');
  return {...extraction,textSlots};
}
