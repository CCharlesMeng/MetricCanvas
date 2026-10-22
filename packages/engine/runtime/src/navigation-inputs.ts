import {parsePage} from '@metriccanvas/page';
import {filterURLKeys,matchesParamDeclaration,type PageParamDeclaration,type FilterDeclaration} from '@metriccanvas/page/internal';
import {resolvePageParams} from './page-params';
import {parseFilterSearch,createFilterState,initialFilterValues,type FilterValues} from './filter-state';

/** Trusted projection supplied by the integrating application; contains no result rows or credentials. */
export interface NavigationInputContract {
  pageId:string;
  params:PageParamDeclaration[];
  filters:FilterDeclaration[];
}
export function projectNavigationInputs(document:unknown):NavigationInputContract {
  const result=parsePage(document);
  if(!result.ok)throw Error('目标页面输入契约无效');
  const privateIds=new Set((result.page.detailViews??[]).flatMap(view=>view.filters??[]));
  const fixed=(result.page.params??[]).some(p=>!p.path&&(p.value!==undefined||p.type==='timeRange'));
  return {pageId:result.page.id,params:structuredClone((result.page.params??[]).filter(p=>p.path||p.value===undefined&&p.type!=='timeRange')),filters:structuredClone(fixed?[]:(result.page.filters??[]).filter(filter=>!privateIds.has(filter.id)))};
}
export function navigationInputIssue(href:string,contract:NavigationInputContract,now=new Date()):string|undefined {
  const query=new URL(href,'https://metriccanvas.invalid/').searchParams;
  const known=new Set(contract.params.map(p=>p.id));
  for(const filter of contract.filters)for(const key of Object.values(filterURLKeys(filter)))known.add(key);
  for(const key of query.keys())if(!known.has(key))return `目标未声明URL输入：${key}`;
  const params=resolvePageParams(query.toString(),contract.params,{strict:true});
  if(params.missing.length)return `目标参数缺失或类型不匹配：${params.missing.join('、')}`;
  for(const declaration of contract.params)if(query.has(declaration.id)){
    if(!declaration.path&&(declaration.value!==undefined||declaration.type==='timeRange'))return `目标参数不接受URL覆盖：${declaration.id}`;
    if(!matchesParamDeclaration(params.values.get(declaration.id),declaration))return `目标参数类型不匹配：${declaration.id}`;
  }
  return filterInputIssue(query.toString(),contract.filters,now);
}

/** Reject explicit malformed inputs instead of silently querying a default/broader scope. */
export function filterInputIssue(search:string,filters:readonly FilterDeclaration[],now=new Date()):string|undefined {
  const query=new URLSearchParams(search);
  let values:FilterValues;
  try{values=parseFilterSearch(query.toString(),filters,now);}catch{return '目标时间模式输入必须为合法完整mode/from/to';}
  for(const filter of filters){
    const keys=filterURLKeys(filter),provided=Object.values(keys).some(key=>query.has(key));
    if(!provided)continue;
    if(Object.values(keys).some(key=>query.getAll(key).some(value=>!value.trim())))return `目标筛选输入为空：${filter.id}`;
    if(Object.entries(keys).some(([part,key])=>query.getAll(key).length>1&&!(filter.type==='dimension'&&part==='value')))return `目标筛选输入重复：${filter.id}`;
    if(!values.has(filter.id))return `目标筛选类型、粒度或层级不匹配：${filter.id}`;
  }
  // Validate only supplied values. Defaults, trusted availability and authorization stay at destination.
  try{const defaults=initialFilterValues(filters.filter(f=>!values.has(f.id)&&!((f.type==='timePoint'||f.type==='timeRange')&&f.availability?.initial)),now);createFilterState(new Map([...defaults,...values]),filters,new Map(),{now:()=>now});}
  catch{return '目标筛选取值不符合声明';}
  return undefined;
}
