import { editDateQueryBindings, inferredPeriodPolicy, periodBindable, queryTime, type EditableDateBinding } from './report-date-bindings';
import { parsePage, versionPolicy } from '@metriccanvas/page';
import { flattenPageComponents, type FilterDeclaration, type DqeFilterBinding, type TimeWindow } from '@metriccanvas/page/internal';
import { projectCanvasDraft, type CanvasAuthoringDraft, type ComponentLocator, type DocumentEditResult } from './document-edit';
export interface ReportDateEdit {
  filterId: string;
  declaration?: Extract<FilterDeclaration,{type:'timePoint'|'timeRange'}>;
  bindings?: EditableDateBinding[];
  remove?: boolean;
}
export interface DateBindingChoice { id:string;dataSourceId:string;label:string;binding:DqeFilterBinding }
export function dateBindingChoices(draft:CanvasAuthoringDraft,granularity:'month'|'date',range:boolean,window:TimeWindow,period=false):DateBindingChoice[] {
  const parsed=parsePage(draft.pageDocument);if(!parsed.ok)return [];
  return Object.entries(parsed.page.dataSources).flatMap(([id,source])=>dateSourceChoices(id,source,granularity,range,window,period));
}
function dateSourceChoices(id:string,source:import('@metriccanvas/page/internal').DataSource,granularity:'month'|'date',range:boolean,window:TimeWindow,period:boolean):DateBindingChoice[]{
    if(source.source.type!=='query')return [];
    const query=source.source.query;
    if(period)return periodChoices(id,query);
    if(query.timeModes||!query.body)return [];
    const choices:DateBindingChoice[]=[],time=queryTime(query);
    if(time?.period===(granularity==='month'?'month':'day'))choices.push({id:`${id}:time`,dataSourceId:id,label:`${id} · 查询时间`,binding:range?{target:'time'}:{target:'time',window}});
    if(!range)for(const field of Object.values(source.fields))if('queryField' in field&&typeof field.queryField==='string'&&field.role==='dimension')choices.push({id:`${id}:${field.queryField}`,dataSourceId:id,label:`${id} · ${field.queryField}`,binding:{target:'timePoint',queryField:field.queryField,valueFormat:'iso'}});
    return choices;
}
function periodChoices(id:string,query:import('@metriccanvas/page/internal').DqeQueryDefinition):DateBindingChoice[]{
  if(!periodBindable(query))return [];
  const periodPolicy=inferredPeriodPolicy(query);
  return [{id:`${id}:time`,dataSourceId:id,label:`${id} · 查询时间`,binding:{target:'time',...(periodPolicy?{periodPolicy}:{})}}];
}
/** Atomic manual configuration; the same Page contract rejects mismatched precision/ownership. */
export function editReportDate(draft:CanvasAuthoringDraft,locator:ComponentLocator|null,edit:ReportDateEdit):DocumentEditResult {
  const document=JSON.parse(JSON.stringify(draft.canvasDocument));
  const parsed=parsePage(document);if(!parsed.ok)return {ok:false,message:'页面基线无效'};
  const header=locator ? document.sections.find((s:{id:string})=>s.id===locator.sectionId)?.components.find((c:{id:string})=>c.id===locator.componentId) : undefined;
  if(!locator && parsed.page.layout!=='dashboard')return {ok:false,message:'页面级日期配置仅支持 Dashboard'};
  if(locator && header?.type!=='reportHeader')return {ok:false,message:'请选择报告页头'};
  const existing=(document.filters??[]).find((f:FilterDeclaration)=>f.id===edit.filterId);
  if(existing&&!['timePoint','timeRange'].includes(existing.type))return {ok:false,message:'筛选器 ID 已被其他类型占用'};
  if(Object.values(parsed.page.dataSources).some(source=>source.source.type==='query'&&source.source.query.timeModes?.filterId===edit.filterId))return {ok:false,message:'时间模式需通过原子时间程序配置同步修改全部查询case'};
  document.schemaVersion=versionPolicy.current;
  if(edit.remove) {
    document.filters=(document.filters??[]).filter((f:FilterDeclaration)=>f.id!==edit.filterId);
    if(document.iocHeader?.filterIds){
      const ids=document.iocHeader.filterIds.filter((id:string)=>id!==edit.filterId);
      if(ids.length)document.iocHeader.filterIds=ids;else delete document.iocHeader.filterIds;
    }
    for(const component of flattenPageComponents(parsed.page)) if(component.type==='reportHeader') {
      const target=document.sections.flatMap((s:any)=>s.components).find((c:any)=>c.id===component.id);
      const ids=(target.props.filterIds??[]).filter((id:string)=>id!==edit.filterId);
      if(ids.length)target.props.filterIds=ids;else delete target.props.filterIds;
    }
  } else {
    if(!edit.declaration||!edit.bindings?.length)return {ok:false,message:'请选择日期形态、初值和至少一个查询目标'};
    if(new Set(edit.bindings.map(b=>b.dataSourceId)).size!==edit.bindings.length)return {ok:false,message:'同一查询只能选择一个日期目标'};
    const declaration={...edit.declaration,id:edit.filterId};
    document.filters=[...(document.filters??[]).filter((f:FilterDeclaration)=>f.id!==edit.filterId),declaration];
    for(const section of document.sections)for(const other of section.components)if(other.type==='reportHeader'&&other!==header){const ids=(other.props.filterIds??[]).filter((id:string)=>id!==edit.filterId);if(ids.length)other.props.filterIds=ids;else delete other.props.filterIds;}
    if(header) {
      header.props.filterIds=[...new Set([...(header.props.filterIds??[]),edit.filterId])];
      if(document.iocHeader?.filterIds){const ids=document.iocHeader.filterIds.filter((id:string)=>id!==edit.filterId);if(ids.length)document.iocHeader.filterIds=ids;else delete document.iocHeader.filterIds;}
    } else if(document.iocHeader)document.iocHeader.filterIds=[...new Set([...(document.iocHeader.filterIds??[]),edit.filterId])];
  }
  for(const [id,source] of Object.entries(document.dataSources) as [string,any][]) {
    if(source.source.type!=='query')continue;
    const binding=edit.remove?undefined:edit.bindings?.find(b=>b.dataSourceId===id);
    if(editDateQueryBindings(source.source.query,edit.filterId,binding))delete source.source.initial;

  }
  if(existing && 'initialParam' in existing && existing.initialParam)pruneOwnedTimeParam(document,existing.initialParam);
  return projectCanvasDraft(document);
}

/** Remove only the replaced filter's initialization declaration when it has no remaining references. */
function pruneOwnedTimeParam(document:any,id:string) {
  function consumes(node:any):boolean {
    if(!node||typeof node!=='object')return false;
    if(Array.isArray(node))return node.some(consumes);
    return node.param===id||node.initialParam===id||node.sectionGroupParam===id||(node.source==='param'&&node.id===id)||Object.hasOwn(node.paramBindings??{},id)||Object.entries(node).some(([key,value])=>key!=='params'&&consumes(value));
  }
  if(consumes(document)||!document.params?.query?.times)return;
  document.params.query.times=document.params.query.times.filter((p:{id:string})=>p.id!==id);
  if(!document.params.query.times.length)delete document.params.query.times;
  if(!Object.keys(document.params.query).length)delete document.params.query;
  if(!Object.keys(document.params).length)delete document.params;
}
