import type {FilterDeclaration,NumberRangeFilterDeclaration,NumberRangeValue} from './filter';
import type {DqeQueryDefinition} from './query';

export function numberRangeIssue(declaration:NumberRangeFilterDeclaration,range:NumberRangeValue):string|undefined {
  for(const value of [range.from,range.to])if(value!==undefined&&(!Number.isFinite(value)||(!!declaration.units&&value<0)||(declaration.constraints?.min!==undefined&&value<declaration.constraints.min)||(declaration.constraints?.max!==undefined&&value>declaration.constraints.max)))return '数值范围不符合有限数字或声明上下限';
  if(range.from!==undefined&&range.to!==undefined&&((declaration.constraints?.bounds??(declaration.units||declaration.presets?'strict':'inclusive'))==='strict'?range.from>=range.to:range.from>range.to))return '数值范围端点顺序不合法';
  return undefined;
}
export function rangeInBaseUnits(declaration:NumberRangeFilterDeclaration,range:NumberRangeValue,scale:number):NumberRangeValue {
  const result={...(range.from===undefined?{}:{from:range.from*scale}),...(range.to===undefined?{}:{to:range.to*scale})};
  if(!Number.isSafeInteger(scale)||scale<=0||numberRangeIssue(declaration,result))throw new Error('金额范围换算或约束不合法');
  return result;
}
export function enumSelector(filters:readonly FilterDeclaration[],id:string):Extract<FilterDeclaration,{type:'dimension'}>|undefined {
  const filter=filters.find(item=>item.id===id);
  return filter?.type==='dimension'&&filter.selection?.mode==='single'&&filter.selection.required&&filter.options?filter:undefined;
}
export function exhaustiveCases(filters:readonly FilterDeclaration[],id:string,cases:Record<string,unknown>):boolean {
  const selector=enumSelector(filters,id);if(!selector)return false;
  const options=selector.options!.filter(item=>!item.disabled).map(item=>item.value);
  return options.length>0&&options.length===Object.keys(cases).length&&options.every(value=>Object.hasOwn(cases,value));
}
export function selectedCase<T>(cases:Record<string,T>,selected:unknown):T {
  if(!Array.isArray(selected)||selected.length!==1||typeof selected[0]!=='string'||!Object.hasOwn(cases,selected[0]))throw Object.assign(new Error('字段或单位选择未通过封闭枚举校验'),{code:'DQE_QUERY_REJECTED'});
  return cases[selected[0]]!;
}
/** Includes selectors consumed indirectly by metricByFilter. */
export function queryFilterIds(query:Pick<DqeQueryDefinition,'filterBindings'|'timeModes'>):string[]{const bindings=query.timeModes?Object.values(query.timeModes.cases).flatMap(leaf=>Object.entries(leaf.filterBindings)):Object.entries(query.filterBindings??{});return [...new Set([...(query.timeModes?[query.timeModes.filterId]:[]),...bindings.flatMap(([id,binding])=>binding.target==='numberRange'&&binding.metricByFilter?[id,binding.metricByFilter.filterId]:[id])])];}
export function rangeContextIssue(declaration:NumberRangeFilterDeclaration,values:ReadonlyMap<string,{type:string;values?:readonly string[]}>):string|undefined {
 if(!declaration.units)return;
 try{selectedCase(declaration.units.cases,values.get(declaration.units.filterId)?.values);}catch{return '金额单位的币种选择未就绪';}
 return undefined;
}
export function appliedAmountRange(declaration:NumberRangeFilterDeclaration,range:NumberRangeValue,values:ReadonlyMap<string,{type:string;values?:readonly string[]}>):string {
 const unit=declaration.units?selectedCase(declaration.units.cases,values.get(declaration.units.filterId)?.values):undefined;
 const from=range.from===undefined?undefined:range.from/(unit?.scale??1),to=range.to===undefined?undefined:range.to/(unit?.scale??1);
 return from===undefined&&to===undefined?'全部':`${from===undefined?'不限':from}～${to===undefined?'不限':to}${unit?.label??''}`;
}
