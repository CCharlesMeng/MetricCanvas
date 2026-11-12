import {iocHeaderDeclaration} from './header-binding';
import type {FilterDeclaration} from './filter';
import type {Page} from './page';
import type {TypedError} from './errors';
import {filterDependencies} from './filter-dependencies';

/** IOC global selection is presentation state; it never narrows an execution scope. */
export function isUnrestrictedIocRegion(page:Page|undefined,filterId:string,value:{type:string;values?:readonly string[]}|undefined):boolean {
  if(!page||filterId!=='region'||value?.type!=='dimension'||value.values?.length!==1||value.values[0]!=='全球')return false;
  return iocHeaderDeclaration(page)?.filterIds?.includes(filterId)===true;
}

type Values = ReadonlyMap<string, {type:string;value?:unknown}>;

/** Standard key-office identifiers always intersect Region, including legacy explicit overrides. */
export function filterOverrideTargets(filter:FilterDeclaration,_filters:readonly FilterDeclaration[]):readonly string[] {
  if(filter.type!=='boolean')return [];
  const explicit=filter.overridesFilters??[];
  if(!['key-office','key-national-only'].includes(filter.id))return explicit;
  return explicit.filter(id=>id!=='region');
}

/** Execution projection only: neither URL state nor stored selections are mutated. */
export function overriddenFilterIds(filters:readonly FilterDeclaration[], values:Values):Set<string> {
  const ids=new Set<string>();
  for(const filter of filters){
    if(filter.type!=='boolean')continue;
    const value=values.get(filter.id);
    if(value?.type==='boolean'&&value.value===true)for(const id of filterOverrideTargets(filter,filters))ids.add(id);
  }
  return ids;
}

function relatedFilterIds(filter:FilterDeclaration, filters:readonly FilterDeclaration[]):Set<string> {
  const ids=new Set<string>(),queue=filterDependencies(filter);
  for(const id of queue){
    if(ids.has(id))continue;
    ids.add(id);
    const parent=filters.find(item=>item.id===id);
    if(parent)queue.push(...filterDependencies(parent));
  }
  return ids;
}

function overrideReferenceErrors(page:Page,filter:Extract<FilterDeclaration,{type:'boolean'}>,index:number):TypedError[] {
  const errors:TypedError[]=[],filters=page.filters??[];
  const owner=(id:string)=>page.detailViews?.find(view=>view.filters?.includes(id))?.id;
  const error=(message:string)=>errors.push({type:'SCHEMA_ERROR',path:`/filters/${index}${filter.overridesFilters?'/overridesFilters':''}`,message});
  const ids=filterOverrideTargets(filter,filters);
  if(new Set(ids).size!==ids.length)error('覆盖筛选引用不能重复');
  for(const id of ids){
    const target=filters.find(item=>item.id===id);
    if(target?.type!=='dimension'){error('覆盖筛选必须引用已声明的维度筛选');continue;}
    if(owner(id)!==owner(filter.id))error('公共筛选与详情私有筛选不能跨作用域覆盖');
    if(relatedFilterIds(target,filters).has(filter.id))error('被覆盖筛选不能依赖覆盖它的布尔筛选，以保留原选择');
  }
  return errors;
}

/** References are static; replacement data may be supplied by the integrating application. */
export function filterOverrideErrors(page:Page):TypedError[] {
  const errors:TypedError[]=[];
  for(const [index,filter]of (page.filters??[]).entries()){
    if(filter.type!=='boolean'||!filterOverrideTargets(filter,page.filters??[]).length)continue;
    errors.push(...overrideReferenceErrors(page,filter,index));
  }
  return errors;
}
