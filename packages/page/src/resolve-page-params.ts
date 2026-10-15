import { validateTimePointValue } from './filter';
import { affectedSourceIds } from './data-source-references';
import { matchesParamDeclaration, pageParamDeclarations, type PageParamValue } from './page-param';
import { initializeQueryParams } from './query';
import { parsePage } from './validate';
import type { Page } from './page';
import type { PageDocument } from './page-document';
import type { TypedError } from './errors';
import { applyFilterTextValues, collectFilterTextValueReferences, initialFilterTextValues } from './filter-text-value';
import { resolveFilterTextValue, resolveParamTextValues } from './text-value';
import { canonicalizeJson } from './canonical-json';
import { queryResultDependencies } from './query-dependencies';
import { computeDependencies } from './compute';

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
  for (const id of changedParamSourceIds(structural.page, values)) {
    const source = document.dataSources[id]?.source;
    if (source && source.type !== 'inline') delete source.initial;
  }
  const parsed=parsePage(document,{textValues:{values}});
  if(!parsed.ok)return {ok:false,issues:parsed.errors.map(e=>issue(e,'INVALID_MATERIALIZATION'))};
  let resolvedPage:Page;
  try {
    resolvedPage=materializePageParams(parsed.page,values);
    const filterValues = initialFilterTextValues(resolvedPage.filters ?? []);
    resolvedPage = applyFilterTextValues(resolvedPage, collectFilterTextValueReferences(resolveParamTextValues(document, { values })),
      reference => resolveFilterTextValue(reference, { values, filterValues }));
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
  const changed = changedParamSourceIds(page, values);
  for(const [id, source] of Object.entries(resolved.dataSources))if(source.source.type==='query') {
    source.source.query=initializeQueryParams(source.source.query,values);
    if (changed.has(id)) delete source.source.initial;
  }
  for (const id of changed) { const source = resolved.dataSources[id]?.source; if (source && source.type !== 'inline') delete source.initial; }
  for (const filter of resolved.filters ?? []) {
    if (filter.type !== 'timePoint' && filter.type !== 'timeRange') continue;
    if (!filter.initialParam) continue;
    const value = values.get(filter.initialParam);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (filter.type === 'timePoint') {
        const error = validateTimePointValue(value.start, filter.granularity, filter.min);
        if (error) throw new Error(`筛选器 ${filter.id}: ${error}`);
        filter.default = value.start;
      }
      else filter.default = { from: value.start, to: value.end };
    }
  }
  return resolved;
}
function issue(e:TypedError,code:ParamResolutionIssue['code']='INVALID_PAGE'):ParamResolutionIssue{return {code,path:e.path,message:e.message};}

/** Invalidate only queries whose parameter conditions changed, then their dependants. */
function changedParamSourceIds(page: Page, values: ReadonlyMap<string, PageParamValue>): Set<string> {
  const saved = new Map<string, PageParamValue>();
  for (const param of page.params ?? []) {
    const value = param.value ?? param.default;
    if (value !== undefined) saved.set(param.id, value);
  }
  const changed = new Set<string>();
  for (const [id, source] of Object.entries(page.dataSources)) {
    if (source.source.type !== 'query') continue;
    const query = source.source.query;
    try {
      if (canonicalizeJson(initializeQueryParams(query, saved)) !== canonicalizeJson(initializeQueryParams(query, values))) changed.add(id);
    } catch { changed.add(id); }
    for (const filterId of Object.keys(query.filterBindings ?? {})) {
      const filter = page.filters?.find(filter => filter.id === filterId);
      const paramId = filter && 'initialParam' in filter ? filter.initialParam : undefined;
      if (paramId && canonicalizeJson(saved.get(paramId) ?? null) !== canonicalizeJson(values.get(paramId) ?? null)) changed.add(id);
    }
  }
  return affectedSourceIds(page.dataSources, changed);
}
