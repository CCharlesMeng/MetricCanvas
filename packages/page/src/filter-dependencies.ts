import type { FilterDeclaration, DimensionFilterDeclaration } from './filter';
import type { TypedError } from './errors';

/** One graph for invalidation; only candidateDependencies contribute candidate constraints. */
export function candidateDependencies(filter: FilterDeclaration): string[] {
  return filter.type === 'dimension' ? [...(filter.dependsOn ? [filter.dependsOn] : []), ...(filter.candidateContext?.filterIds ?? [])] : [];
}
export function filterDependencies(filter: FilterDeclaration): string[] {
  return [...candidateDependencies(filter), ...(filter.clearOnChangeOf ?? [])];
}
export function dimensionSelectionIssue(filter: DimensionFilterDeclaration, values: readonly string[]): string | undefined {
  // Legacy initialParam arrays may seed tabs with several applied values; the next tab click is single.
  // An explicit selection contract always takes precedence over this compatibility case.
  const single = filter.selection?.mode === 'single' || filter.display === 'tabs' && !filter.initialParam;
  if (single && values.length > 1) return '单选筛选器至多选择一个值';
  if (filter.selection?.required && values.length !== 1) return '必选筛选器必须恰好选择一个值';
  if (filter.options && values.some(value => !filter.options!.some(option => option.value === value && !option.disabled))) return '筛选值不在可用封闭枚举中';
  if (filter.selection && new Set(values).size !== values.length) return '筛选值不能重复';
  return undefined;
}
export function filterExtensionErrors(filters: readonly FilterDeclaration[]): TypedError[] {
  const errors: TypedError[] = [], byId = new Map(filters.map(filter => [filter.id,filter]));
  const error=(path:string,message:string)=>errors.push({type:'SCHEMA_ERROR',path,message});
  const mergedGraph=filters.some(filter=>filter.clearOnChangeOf||(filter.type==='dimension'&&filter.candidateContext));
  const visiting=new Set<string>(),cycles=new Map<string,boolean>();
  function cyclic(id:string):boolean {
    if(visiting.has(id))return true;
    if(cycles.has(id))return cycles.get(id)!;
    visiting.add(id);
    const result=(byId.get(id)?filterDependencies(byId.get(id)!):[]).some(parent=>cyclic(parent));
    visiting.delete(id);cycles.set(id,result);return result;
  }
  for(const [i,filter] of filters.entries()) {
    const path=`/filters/${i}`;
    const dependencies=filterDependencies(filter);
    if(mergedGraph){
      if(new Set(dependencies).size!==dependencies.length)error(path,'依赖不可在新旧字段中重复');
      for(const id of dependencies)if(!byId.has(id)||id===filter.id)error(path,'筛选依赖必须引用另一个已声明筛选器');
      if(cyclic(filter.id))error(path,'合并筛选依赖存在循环');
    }
    if(filter.type!=='dimension')continue;
    if(filter.candidateContext?.filterIds.some(id=>!['dimension','timePoint','timeRange'].includes(byId.get(id)?.type??'')))error(path+'/candidateContext','候选依赖只支持维度及已应用期间');
    if(filter.selection?.mode==='multiple'&&filter.display==='tabs')error(path+'/selection','tabs不能声明多选');
    if(filter.treeSelection==='level' && (filter.display!=='tree'||!filter.hierarchy))error(path+'/treeSelection','结构树必须声明tree与hierarchy');
    if(filter.treeSelection && filter.display!=='tree')error(path+'/treeSelection','树选择规则仅用于tree展示');
    if(filter.options) {
      if(filter.dependsOn||filter.candidateContext||filter.hierarchy||filter.treeSelection)error(path+'/options','封闭枚举不能同时声明动态候选或层级');
      if(new Set(filter.options.map(option=>option.value)).size!==filter.options.length)error(path+'/options','封闭枚举值必须唯一');
    }
    if(filter.selection?.allBehavior==='unrestricted'&&(!filter.options||filter.selection.mode!=='multiple'))error(path+'/selection/allBehavior','全选不限只支持显式封闭多选枚举');
    if(filter.default){const issue=dimensionSelectionIssue(filter,filter.default);if(issue)error(path+'/default',issue);}
  }
  return errors;
}

/** New candidate/clear relationships cannot cross a detail view's private input boundary. */
export function filterScopeErrors(page:import('./page').Page):TypedError[] {
  const owner=new Map<string,string>();
  for(const view of page.detailViews??[])for(const id of view.filters??[])owner.set(id,view.id);
  const filters=page.filters??[],byId=new Map(filters.map(filter=>[filter.id,filter])),errors:TypedError[]=[];
  for(const [i,filter]of filters.entries()){
    if(!filter.clearOnChangeOf && !(filter.type==='dimension'&&filter.candidateContext))continue;
    const queue=filterDependencies(filter),seen=new Set<string>();
    for(const id of queue){if(seen.has(id))continue;seen.add(id);
      if(owner.get(id)!==owner.get(filter.id))errors.push({type:'SCHEMA_ERROR',path:`/filters/${i}`,message:'公共筛选与详情私有筛选不能建立跨作用域依赖'});
      const parent=byId.get(id);if(parent)queue.push(...filterDependencies(parent));
    }
  }
  return errors;
}
