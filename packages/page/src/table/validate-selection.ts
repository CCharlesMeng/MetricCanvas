import type { Page, TableComponent } from '../page';
import type { NavigationBinding } from '../schema/navigation';
import type { TypedError } from '../errors';
import { resolveDataSourceFields } from '../data-source';
import { sourceFilterIds } from '../data-source-references';
import { queryLeaves } from '../query-selection';
import { queryResultDependencies } from '../query-dependencies';
import { columnMainFields } from './columns';
const issue = (path:string,message:string):TypedError => ({type:'SCHEMA_ERROR',path,message});

function rawString(page:Page,sourceId:string,field:string):boolean {
  const source=page.dataSources[sourceId], definition=source?.fields[field];
  return !!definition && definition.type==='string' && definition.role==='dimension' && 'queryField' in definition;
}
function completeQuery(page:Page,id:string):boolean {
  const source=page.dataSources[id];
  if(source?.source.type!=='query'||source.source.resultScope!=='complete'||source.compute?.length||queryResultDependencies(source).length)return false;
  return queryLeaves(source.source.query).every(q=>{const order=q.body.dsl_list[0].order;return !order||typeof order==='object'&&!Array.isArray(order)&&!('limit' in order)&&!('offset' in order);});
}
function lookupInputs(page:Page,table:TableComponent,path:string,owners:Map<string,string>,inputs:Map<string,string>):TypedError[] {
  const selection=table.props.rowExpansion!.selection!, lookup=selection.parentLookup;
  const errors:TypedError[]=[], source=page.dataSources[lookup.source];
  if(owners.has(lookup.source))errors.push(issue(path+'/source','父级定位查询必须专属当前模板'));
  owners.set(lookup.source,path);
  if(!completeQuery(page,lookup.source)||!rawString(page,lookup.source,lookup.field))errors.push(issue(path+'/source','父级定位必须是无 compute/结果绑定/窗口的 complete 普通查询，输出原始 string 维度'));
  if(lookup.filters.some(id=>!lookup.bindings[id])||Object.keys(lookup.bindings).some(id=>!lookup.filters.includes(id)))errors.push(issue(path+'/bindings','必须且只能绑定定位声明的全部私有输入'));
  const selected=Object.values(lookup.bindings).filter(b=>b.source==='filter'&&b.id===selection.filter&&!b.part);
  if(selected.length!==1)errors.push(issue(path+'/bindings','父级定位必须恰好绑定一次所选子级值'));
  for(const id of lookup.filters)errors.push(...lookupInputErrors(page,lookup,id,path,inputs,source));
  return errors;
}
function lookupInputErrors(page:Page,lookup:NonNullable<NonNullable<TableComponent['props']['rowExpansion']>['selection']>['parentLookup'],id:string,path:string,inputs:Map<string,string>,source:Page['dataSources'][string]):TypedError[]{
  const errors:TypedError[]=[],f=page.filters?.find(f=>f.id===id),b=lookup.bindings[id];
  if(inputs.has(id))errors.push(issue(path+'/filters','定位输入必须专属当前模板'));
  inputs.set(id,lookup.source);
  if(!f||f.type!=='dimension'||f.hierarchy||f.visible!==false)errors.push(issue(path+'/filters','定位私有输入必须是隐藏非层级 dimension'));
  if(!sourceFilterIds(source).includes(id))errors.push(issue(path+'/filters','定位输入必须被查询显式消费'));
  if(!b||!lookupBindingExists(page,b,lookup.filters))errors.push(issue(path+'/bindings','定位绑定必须引用合法公共筛选或页面参数'));
  return errors;
}
function lookupBindingExists(page:Page,b:NavigationBinding,privateIds:string[]):boolean {
  if(b.source==='row')return false;
  if(b.source==='param')return !!page.params?.some(p=>p.id===b.id);
  return !privateIds.includes(b.id)&&!!page.filters?.some(f=>f.id===b.id);
}
/** New invariants are confined to explicitly enabled hierarchy selection. */
export function hierarchySelectionErrors(page:Page,table:TableComponent,path:string,owners:Map<string,string>,inputs:Map<string,string>):TypedError[]{
  const expansion=table.props.rowExpansion!, s=expansion.selection;
  const errors:TypedError[]=[];
  if(expansion.data.type==='query'&&!s&&Object.values(expansion.data.bindings).some(b=>b.source==='selection'))errors.push(issue(path+'/data/bindings','私有 selection 输入要求显式层级联动'));
  if(!s)return errors;
  errors.push(...selectionDeclarationErrors(page,table,path),...childSelectionErrors(page,table,path));
  errors.push(...lookupInputs(page,table,path+'/selection/parentLookup',owners,inputs));
  return errors;
}
function validHierarchyLevels(filter:NonNullable<Page['filters']>[number]|undefined,parent:string,child:string):boolean{
  if(!filter||filter.type!=='dimension')return false;
  return filter.selection?.mode==='single'&&filter.treeSelection==='level'&&filter.hierarchy?.length===2&&filter.hierarchy[0]!.id===parent&&filter.hierarchy[1]!.id===child;
}
function selectionDeclarationErrors(page:Page,table:TableComponent,path:string):TypedError[]{
  const expansion=table.props.rowExpansion!,s=expansion.selection!,errors:TypedError[]=[];
  const f=page.filters?.find(f=>f.id===s.filter);
  if(!validHierarchyLevels(f,s.parentLevel,s.childLevel))errors.push(issue(path+'/selection/filter','层级联动要求显式单选的两层结构树及合法父子层级'));
  if(expansion.data.type!=='query')errors.push(issue(path+'/selection','层级联动仅用于 query 子表格'));
  if(!completeQuery(page,table.data.main)||table.props.pagination?.mode==='query'||!rawString(page,table.data.main,s.parentField))errors.push(issue(path+'/selection/parentField','父表要求完整普通查询、本地视图与原始 string 父级维度'));
  const forbidden=[s.filter,...s.parentLookup.filters,...(expansion.data.type==='query'?expansion.data.filters:[])];
  if(sourceFilterIds(page.dataSources[table.data.main]).some(id=>forbidden.includes(id)))errors.push(issue(path+'/selection','完整父汇总不能绑定层级筛选或私有输入'));
  return errors;
}
function childSelectionErrors(page:Page,table:TableComponent,path:string):TypedError[]{
  const expansion=table.props.rowExpansion!,s=expansion.selection!,errors:TypedError[]=[];
  if(expansion.data.type==='query'){
    const input=expansion.data, bindings=Object.values(input.bindings);
    if(bindings.filter(b=>b.source==='selection').length!==1||!bindings.some(b=>b.source==='row'&&b.field===s.parentField))errors.push(issue(path+'/data/bindings','子表必须绑定父级匹配字段与恰好一个私有 selection 输入'));
    if(sourceFilterIds(page.dataSources[input.source]).includes(s.filter))errors.push(issue(path+'/data/source','子查询不能同时直接绑定层级筛选'));
    for(const id of input.filters)if(input.bindings[id]?.source==='selection'){
      const f=page.filters?.find(f=>f.id===id);
      if(!f||f.type!=='dimension'||f.hierarchy||f.visible!==false)errors.push(issue(path+'/data/bindings','selection 只能绑定隐藏非层级 dimension'));
    }
  }
  return errors;
}
export function hierarchyExportErrors(table:TableComponent,path:string):TypedError[]{
  const config=table.props.toolbar?.export?.rowExpansion;
  if(!config)return [];
  if(!table.props.rowExpansion?.selection)return [issue(path+'/toolbar/export/rowExpansion','完整父子导出要求显式层级联动')];
  const visible=columnMainFields(table.props.columns);
  if(new Set(config.parentFields).size!==config.parentFields.length||config.parentFields.some(id=>!visible.has(id)))return [issue(path+'/toolbar/export/rowExpansion/parentFields','父关联列必须是去重的父表字段列')];
  return [];
}
