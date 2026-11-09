import {declaredFilterSample} from './filter-condition-sample';
import {conditionDepth,conditionLeaves,conditionTestTypeError} from './condition';
import type {Condition} from './schema/condition';
import type {DqeFilterBinding,DqeQueryDefinition} from './query';
import type {Page} from './page';
import type {TypedError} from './errors';

export function bindingConditionFilterIds(binding:DqeFilterBinding):string[] {
  if(binding.target!=='dimension'||!binding.when)return [];
  return conditionLeaves(binding.when).flatMap(leaf=>'filter' in leaf?[leaf.filter]:[]);
}
export function hasBindingConditions(query:DqeQueryDefinition):boolean {
  return queryBindingSites(query,'').some(site=>Object.values(site.bindings).some(binding=>binding.target==='dimension'&&!!binding.when));
}
function queryBindingSites(query:DqeQueryDefinition,path:string) {
  if(query.queryModes)return Object.entries(query.queryModes.cases).map(([id,leaf])=>({bindings:leaf.filterBindings,path:`${path}/queryModes/cases/${id}/filterBindings`}));
  if(query.timeModes)return Object.entries(query.timeModes.cases).map(([id,leaf])=>({bindings:leaf.filterBindings,path:`${path}/timeModes/cases/${id}/filterBindings`}));
  return [{bindings:query.filterBindings??{},path:`${path}/filterBindings`}];
}
export function queryBindingWhenErrors(page:Page):TypedError[] {
  const errors:TypedError[]=[];
  for(const [id,source] of Object.entries(page.dataSources)){
    if(source.source.type!=='query')continue;
    for(const site of queryBindingSites(source.source.query,`/dataSources/${id}/source/query`)){
      for(const [filterId,binding]of Object.entries(site.bindings)){
        if(binding.target==='dimension'&&binding.when)errors.push(...bindingWhenErrors(binding.when,page,`${site.path}/${filterId}/when`));
      }
    }
  }
  return errors;
}
function bindingWhenErrors(condition:Condition,page:Page,path:string):TypedError[] {
  const errors:TypedError[]=[];
  const fail=(message:string)=>errors.push({type:'SCHEMA_ERROR',path,message});
  if(conditionDepth(condition)>4||conditionLeaves(condition).length>64)fail('条件超过4层或64个叶子');
  for(const leaf of conditionLeaves(condition)){
    if(!('filter' in leaf)){fail('查询绑定生效条件只能引用页面筛选，不能引用权限、事实或行');continue;}
    const filter=page.filters?.find(filter=>filter.id===leaf.filter);
    const sample=filter?declaredFilterSample(filter,leaf.part):undefined;
    if(sample===undefined){fail('条件引用了不存在的筛选器或非法筛选部分');continue;}
    if(conditionTestTypeError(leaf,sample))fail('条件操作或字面量与来源类型不匹配');
    if(unknownModeLiteral(leaf,filter!))fail('条件引用了未声明的层级或期间模式');
  }
  return errors;
}
function unknownModeLiteral(leaf:Extract<Condition,{filter:string}>,filter:NonNullable<Page['filters']>[number]):boolean {
  const values='values' in leaf?leaf.values:'value' in leaf?[leaf.value]:[];
  if(leaf.part==='level'&&filter.type==='dimension')return values.some(value=>!filter.hierarchy?.some(level=>level.id===value));
  return leaf.part==='mode'&&values.some(value=>!['year','quarter','month','last12Months'].includes(String(value)));
}
