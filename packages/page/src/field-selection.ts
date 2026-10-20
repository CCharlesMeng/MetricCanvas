import type {Page,Component,ComponentData} from './page';
import type {FieldBinding,StaticFieldBinding,FieldDefinition} from './field';
import {fieldName} from './field';
import {walkPageComponents} from './component-walk';
import {exhaustiveCases,selectedCase} from './amount-filter';
import type {TypedError} from './errors';
export interface SelectionValue {type:string;values?:readonly string[]}
export type SelectionValues=ReadonlyMap<string,SelectionValue>;
function isSelection(value:unknown):value is Extract<FieldBinding,{byFilter:unknown}>{if(!value||typeof value!=='object'||!('byFilter' in value))return false;const selection=value.byFilter;return !!selection&&typeof selection==='object'&&'filterId' in selection&&typeof selection.filterId==='string'&&'cases' in selection&&!!selection.cases&&typeof selection.cases==='object';}
function visit(value:unknown,fn:(binding:Extract<FieldBinding,{byFilter:unknown}>)=>void):void {
  if(isSelection(value)){fn(value);return;}
  if(Array.isArray(value))for(const item of value)visit(item,fn);
  else if(value&&typeof value==='object')for(const item of Object.values(value))visit(item,fn);
}
export function fieldSelectionIds(value:unknown):string[]{const ids=new Set<string>();const collect=(props:unknown)=>visit(props,binding=>ids.add(binding.byFilter.filterId));if(value&&typeof value==='object'&&'sections' in value){walkPageComponents(value as Page,component=>collect(component.props));}else collect(value);return [...ids];}
function definition(page:Page,component:Component,binding:StaticFieldBinding):FieldDefinition|undefined {
 const slot=typeof binding==='string'?'main':binding.data;return page.dataSources[(component.data as ComponentData|undefined)?.[slot]??'']?.fields[fieldName(binding)];
}
export function projectComponentFields(page:Page,component:Component,values:SelectionValues):Component {
 function project(value:unknown):unknown {
  if(isSelection(value))return selectedCase(value.byFilter.cases,values.get(value.byFilter.filterId)?.values);
  if(Array.isArray(value))return value.map(project);
  if(!value||typeof value!=='object')return value;
  if('props' in value&&'type' in value&&'id' in value)return value;
  const object=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,project(item)]));
  for(const [key,item]of Object.entries(value))if(isSelection(item)){
    const field=definition(page,component,object[key] as StaticFieldBinding);
    if(field){const unit=('unit' in field?field.unit:undefined)??(field.type==='money'?(field.currency==='USD'?'美元':'元'):undefined);const label=field.label??fieldName(object[key] as StaticFieldBinding);
      const leaf=object[key] as StaticFieldBinding;const format=(typeof leaf==='string'?undefined:leaf.format)??('defaultFormat' in field?field.defaultFormat:undefined);
      if('unit'in object || key==='valueField')object.unit=format==='cny-adaptive'||format==='usd-adaptive'?'':unit;
      if(component.type==='table'&&key==='field'&&'title' in object)object.title=unit?`${label}（${unit}）`:label;
    }
  }
  return object;
 }
 return {...component,props:project(component.props)} as Component;
}
/** Pure applied-state projection; no first-case or currency fallback. */
export function projectFieldSelections(page:Page,values:SelectionValues,pending=false):Page {
 if(!fieldSelectionIds(page).length)return page;
 const clone={...page,sections:structuredClone(page.sections),...(page.detailViews?{detailViews:structuredClone(page.detailViews)}:{})};
 walkPageComponents(clone,(component)=>{
  try{Object.assign(component,projectComponentFields(clone,component,values));}
  catch(cause){if(!pending)throw cause;const placeholder={id:component.id,type:'text',layout:component.layout,props:{body:'等待合法币种选择',variant:'plain'}};for(const key of Object.keys(component))delete (component as unknown as Record<string,unknown>)[key];Object.assign(component,placeholder);}
 });
 return clone;
}
export function fieldSelectionErrors(page:Page):TypedError[]{
 const errors:TypedError[]=[];
 walkPageComponents(page,(component,path)=>visit(component.props,binding=>{
  const selection=binding.byFilter;
  if(!exhaustiveCases(page.filters??[],selection.filterId,selection.cases))errors.push({type:'SCHEMA_ERROR',path:path+'/props',message:'字段选择必须穷尽required单选封闭枚举'});
  for(const [value,leaf] of Object.entries(selection.cases)){
   const field=definition(page,component,leaf);
   if(field&&field.type!=='money')errors.push({type:'SCHEMA_ERROR',path:path+'/props',message:`货币字段选择case ${value}需要静态money字段`});
   const range=page.filters?.find(f=>f.type==='numberRange'&&f.units?.filterId===selection.filterId);
   if(field?.type==='money'&&range?.type==='numberRange'&&range.units?.cases[value]?.currency!==field.currency)errors.push({type:'SCHEMA_ERROR',path:path+'/props',message:'字段选择币种与units case不匹配'});
   if(field?.type==='money'&&typeof leaf!=='string'&&((leaf.format==='cny-adaptive'&&field.currency!=='CNY')||(leaf.format==='usd-adaptive'&&field.currency!=='USD')))errors.push({type:'SCHEMA_ERROR',path:path+'/props',message:'金额格式与静态货币不匹配'});
  }
 }));return errors;
}
/** Validate each coherent assignment, including conflicts between simultaneously selected leaves. */
export function* fieldSelectionVariants(page:Page):Generator<Page>{
 const ids=fieldSelectionIds(page);if(!ids.length){yield page;return;}
 let assignments:Map<string,SelectionValue>[]=[new Map()];
 for(const id of ids){const filter=page.filters?.find(f=>f.id===id);if(filter?.type!=='dimension'||!filter.options)throw new Error('字段选择控制器不存在');
  const options=filter.options.filter(option=>!option.disabled);
  if(assignments.length*options.length>4096)throw new Error('字段选择组合超过4096，请拆分独立页面');
  assignments=assignments.flatMap(values=>options.map(option=>new Map(values).set(id,{type:'dimension',values:[option.value]})));
 }
 for(const values of assignments)yield projectFieldSelections(page,values);
}
