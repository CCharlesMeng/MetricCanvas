import { matchesParamDeclaration, pageParamDeclarations, type PageParamValue } from './page-param';
import { initializeQueryParams } from './query';
import { parsePage } from './validate';
import type { Page } from './page';
import type { PageDocument } from './page-document';
import type { TypedError } from './errors';

export interface ParamResolutionIssue { code: 'INVALID_PAGE'|'UNKNOWN_INPUT'|'MISSING_INPUT'|'INVALID_VALUE'|'INVALID_TIME_RULE'|'INVALID_MATERIALIZATION'; path: string; param?: string; message: string; }
export type ResolvePageParamsResult =
  | {ok:true; document:PageDocument; resolvedPage:Page; effectiveInputs:ReadonlyMap<string,PageParamValue>; issues:[]}
  | {ok:false; issues:ParamResolutionIssue[]};

/** Pure public entry: validate, fill a reference document, materialize an execution copy. */
export function resolvePageParams(page:unknown, suppliedValues:Readonly<Record<string,unknown>>={}):ResolvePageParamsResult {
  const structural=parsePage(page);
  if(!structural.ok)return {ok:false,issues:structural.errors.map(e=>issue(e))};
  if(!suppliedValues||typeof suppliedValues!=='object'||Array.isArray(suppliedValues))return {ok:false,issues:[{code:'INVALID_VALUE',path:'/params',message:'输入必须是id到值的映射'}]};
  const document=JSON.parse(JSON.stringify(page)) as PageDocument;
  const declarations=pageParamDeclarations(document.params);
  const byId=new Map(declarations.map(p=>[p.id,p]));
  const issues:ParamResolutionIssue[]=[];
  const values=new Map<string,PageParamValue>();
  for(const id of Object.keys(suppliedValues))if(!byId.has(id))issues.push({code:'UNKNOWN_INPUT',path:'/params',param:id,message:`未知输入:${id}`});
  for(const [i,p] of declarations.entries()) {
    const explicit=Object.hasOwn(suppliedValues,p.id);
    const value=explicit?suppliedValues[p.id]:p.value??p.default;
    if((explicit||value!==undefined)&&!matchesParamDeclaration(value,p))issues.push({code:'INVALID_VALUE',path:p.path ?? `/params/${i}/value`,param:p.id,message:`输入不符合参数类型:${p.id}`});
    else if(value===undefined) {if(p.required!==false)issues.push({code:'MISSING_INPUT',path:p.path ?? `/params/${i}/value`,param:p.id,message:`缺少必需参数:${p.id}`});}
    else {
      values.set(p.id,structuredClone(value));
      if (document.params && !Array.isArray(document.params)) {
        const groups = document.params;
        const dimension = groups.query?.dimensions?.find(d => d.id === p.id);
        const time = groups.query?.times?.find(t => t.id === p.id);
        const scalar = groups.display?.find(s => s.id === p.id);
        if (dimension && Array.isArray(value)) dimension.dim_value_list = [...value];
        else if (time && typeof value === 'object' && !Array.isArray(value)) { time.start = value.start; time.end = value.end; }
        else if (scalar && typeof value !== 'object') scalar.value = value;
      } else if (Array.isArray(document.params) && ['6.5', '6.6'].includes(document.schemaVersion)) { delete p.default; p.value=structuredClone(value); }
    }
  }
  if(issues.length)return {ok:false,issues};
  const parsed=parsePage(document,{textValues:{values}});
  if(!parsed.ok)return {ok:false,issues:parsed.errors.map(e=>issue(e,'INVALID_MATERIALIZATION'))};
  let resolvedPage:Page;
  try {
    resolvedPage=materializePageParams(parsed.page,values);
  } catch(cause) {return {ok:false,issues:[{code:'INVALID_TIME_RULE',path:'/dataSources',message:String(cause)}]};}
  return {ok:true,document,resolvedPage,effectiveInputs:values,issues:[]};
}
/** Internal boundary for an already parsed Page (its text references are no longer present). */
export function materializePageParams(page:Page,values:ReadonlyMap<string,PageParamValue>):Page {
  for(const p of page.params??[]) {
    const value=values.get(p.id);
    if(value===undefined?p.required!==false:!matchesParamDeclaration(value,p))throw Error(`参数取值缺失或类型错误:${p.id}`);
  }
  const resolved=structuredClone(page);
  for(const source of Object.values(resolved.dataSources))if(source.source.type==='query') {
    source.source.query=initializeQueryParams(source.source.query,values);
    if(page.params && (Array.isArray(page.params) ? page.params.length > 0 : Object.keys(page.params).length > 0)) delete source.source.initial;
  }
  return resolved;
}
function issue(e:TypedError,code:ParamResolutionIssue['code']='INVALID_PAGE'):ParamResolutionIssue{return {code,path:e.path,message:e.message};}
