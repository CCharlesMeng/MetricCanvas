import { isObjectDqeItem, objectOutputFields } from './dqe-object';
import {fieldSelectionIds} from './field-selection';
import {enumSelector} from './amount-filter';
import {filterGroupOptions} from './filter-group';
import {querySelection,querySelectors} from './query-selection';
import type {DqeQueryDefinition,DqeQueryCase} from './query';
import type {Page} from './page';
import type {TypedError} from './errors';
import {hasQueryFieldMapping} from './field';
import {computeOutputFields} from './compute';
import type {QueryDataSource} from './data-source';

function issue(path:string,message:string):TypedError {return {type:'SCHEMA_ERROR',path,message};}
function selectorOptions(page:Page,id:string):string[]|undefined {
  const group=filterGroupOptions(page).get(id);
  if(group)return [...group];
  return enumSelector(page.filters??[],id)?.options?.filter(option=>!option.disabled).map(option=>option.value);
}
function projection(leaf:DqeQueryCase, flat=false):string {
  const item=leaf.body.dsl_list[0];
  if(isObjectDqeItem(item))return JSON.stringify(objectOutputFields(item).sort());
  const groups=[captions(item.output_dims),captions(item.output_metrics)];
  return JSON.stringify(flat?groups.flat().sort():groups);
}
function captions(value:unknown):unknown[] {
  if(!Array.isArray(value))return [];
  return value.map(item=>typeof item==='string'?item:alias(item)).sort();
}
function alias(value:unknown):unknown {return value&&typeof value==='object'&&'alias' in value?value.alias:null;}
function caseErrors(query:DqeQueryDefinition,path:string):TypedError[] {
  const selection=querySelection(query)!;
  const errors:TypedError[]=[];
  if(!Object.values(query.queryModes!.cases).some(leaf=>leaf.fieldMappings)){
    const outputs=Object.values(selection.cases).map(leaf=>projection(leaf,hasObjectCase(query)));
    if(new Set(outputs).size>1)errors.push(issue(path,'查询模式case必须输出相同字段/类型/货币映射；不同原始字段名须声明case.fieldMappings'));
  }
  for(const [key,leaf]of Object.entries(selection.cases)){
    const location=`${path}/cases/${key.replaceAll('~','~0').replaceAll('/','~1')}`;
    if(query.queryModes&&Object.hasOwn(leaf.filterBindings,selection.filterId))errors.push(issue(location,'查询模式选择器不能同时作为该case的DQE谓词'));
  }
  return errors;
}
function modeErrors(page:Page,query:DqeQueryDefinition,path:string):TypedError[] {
  const selection=querySelection(query)!;
  const errors:TypedError[]=[];
  const options=selectorOptions(page,selection.filterId);
  if(!options)errors.push(issue(path,'queryModes必须引用固定单选filterGroup或required单选封闭枚举'));
  if(options&&(options.length!==Object.keys(selection.cases).length||options.some(key=>!Object.hasOwn(selection.cases,key))))errors.push(issue(path,'查询case必须穷尽声明模式'));
  return [...errors,...caseErrors(query,path)];
}
function mappingErrors(source:QueryDataSource,path:string):TypedError[] {
  if(!Object.values(source.source.query.queryModes!.cases).some(leaf=>leaf.fieldMappings))return [];
  const errors:TypedError[]=[],produced=new Set(computeOutputFields(source.compute??[]));
  if(Object.values(source.fields).some(hasQueryFieldMapping))errors.push(issue(path,'queryModes的queryField映射只在各case.fieldMappings声明，根fields保留结果字段契约'));
  if(source.source.initial)errors.push(issue(path,'queryModes不接受缺少分支证明的initial'));
  for(const [key,leaf]of Object.entries(source.source.query.queryModes!.cases)){
    const location=`${path}/queryModes/cases/${key}/fieldMappings`;
    if(!leaf.fieldMappings){errors.push(issue(location,'每个case须显式声明完整fieldMappings'));continue;}
    for(const id of Object.keys(leaf.fieldMappings)){
      if(!Object.hasOwn(source.fields,id)||produced.has(id))errors.push(issue(location,`fieldMappings必须引用已声明的外部结果字段:${id}`));
    }
    for(const id of Object.keys(source.fields)){
      if(!produced.has(id)&&!Object.hasOwn(leaf.fieldMappings,id))errors.push(issue(location,`fieldMappings缺少页面字段:${id}`));
    }
  }
  return errors;
}
function shapeErrors(page:Page,query:DqeQueryDefinition,path:string):TypedError[] {
  const errors:TypedError[]=[];
  if([query.body,query.timeModes,query.queryModes].filter(Boolean).length!==1)errors.push(issue(path,'查询必须互斥声明普通body、timeModes或queryModes'));
  if(hasRootBindings(query))errors.push(issue(path,'模式查询与普通body/filterBindings/paramBindings互斥'));
  if(!query.timeModes&&boundTimeModes(page,query))errors.push(issue(path,'模式筛选必须使用显式timeModes完整查询'));
  return errors;
}
function hasRootBindings(query:DqeQueryDefinition):boolean {
  return !!querySelection(query)&&!!(query.body||query.filterBindings||query.paramBindings);
}
function boundTimeModes(page:Page,query:DqeQueryDefinition):boolean {
  // timeModes cannot be nested inside a dimension-selected branch in the first release.
  const leaves=query.queryModes?Object.values(query.queryModes.cases):[query];
  return leaves.some(leaf=>Object.keys(leaf.filterBindings??{}).some(id=>page.filters?.some(f=>f.id===id&&f.type==='timeRange'&&f.display==='modes')));
}
export function queryBudgetErrors(page:Page):TypedError[] {
  const selectors=new Map([...querySelectors(page)].map(([id,values])=>[id,values.length]));
  if(!selectors.size)return [];
  for(const id of fieldSelectionIds(page)){
    const options=selectorOptions(page,id);
    if(options)selectors.set(id,options.length);
  }
  return [...selectors.values()].reduce((total,size)=>total*size,1)>4096?[issue('/dataSources','查询模式组合超过4096')]:[];
}
export function querySelectionErrors(page:Page):TypedError[] {
  const errors:TypedError[]=[];
  for(const [id,source]of Object.entries(page.dataSources)){
    if(source.source.type!=='query'||!source.source.query.queryModes)continue;
    const query=source.source.query,path=`/dataSources/${id}/source/query`;
    errors.push(...shapeErrors(page,query,path));
    errors.push(...mappingErrors(source as QueryDataSource,path));
    if(querySelection(query))errors.push(...modeErrors(page,query,path+(query.queryModes?'/queryModes':'/timeModes')));
  }
  return errors;
}

/** Keep existing timeModes error paths, messages and ordering while sharing selection. */
export function timeQueryErrors(page:Page):TypedError[] {
  const errors:TypedError[]=[];
  for(const [id,source]of Object.entries(page.dataSources)){
    if(source.source.type!=='query'||source.source.query.queryModes)continue;
    const query=source.source.query,path=`/dataSources/${id}/source/query`;
    if(!!query.body===!!query.timeModes)errors.push(issue(path,'查询必须互斥声明普通body或timeModes'));
    if(!query.timeModes&&boundTimeModes(page,query))errors.push(issue(path,'模式筛选必须使用显式timeModes完整查询'));
    if(query.timeModes)errors.push(...timeModeErrors(page,query,path));
  }
  return errors;
}
function timeModeErrors(page:Page,query:DqeQueryDefinition,path:string):TypedError[] {
  const errors:TypedError[]=[],selection=query.timeModes!;
  if(query.body||query.filterBindings||query.paramBindings)errors.push(issue(path,'模式查询与普通body/filterBindings/paramBindings互斥'));
  const filter=page.filters?.find(item=>item.id===selection.filterId);
  if(filter?.type!=='timeRange'||filter.display!=='modes')return [...errors,issue(path,'timeModes必须引用模式范围筛选')];
  const modes=filter.modes?.map(item=>item.id)??[];
  if(modes.length!==Object.keys(selection.cases).length||modes.some(mode=>!Object.hasOwn(selection.cases,mode)))errors.push(issue(path,'查询case必须穷尽声明模式'));
  let previous:string|undefined;
  for(const [mode,leaf]of Object.entries(selection.cases)){
    if(leaf.filterBindings[filter.id]?.target!=='time')errors.push(issue(path,'每个case须显式绑定模式时间范围'));
    const outputs=projection(leaf,hasObjectCase(query));
    if(previous!==undefined&&outputs!==previous)errors.push(issue(path,'模式case必须输出相同字段/类型/货币映射'));
    previous=outputs;
    if(!timePeriodMatches(mode,leaf))errors.push(issue(path,'静态查询period必须匹配显式模式'));
  }
  return errors;
}
function timePeriodMatches(mode:string,leaf:DqeQueryCase):boolean {
  const item=leaf.body.dsl_list[0];
  if(isObjectDqeItem(item))return Object.values(leaf.filterBindings).some(binding=>binding.target==='time'&&!!binding.queryField&&!!binding.valueFormat);
  const filter=item.filter;
  if(!filter||typeof filter!=='object'||Array.isArray(filter))return false;
  const time=filter.time;
  if(!time||typeof time!=='object'||Array.isArray(time))return false;
  return time.period===(mode==='month'?'month':mode==='isoWeek'?'week':'day');
}

function hasObjectCase(query: DqeQueryDefinition): boolean {
  return Object.values(querySelection(query)!.cases).some(leaf=>isObjectDqeItem(leaf.body.dsl_list[0]));
}
