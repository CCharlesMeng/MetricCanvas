import { rowExpansionPage, stableRowQuery, expansionRowKey, tableColumnLeaves, mainColumnField, type Page, type TableComponent, type Row } from '@metriccanvas/page/internal';
import { createSourceProgram } from '@metriccanvas/data-execution/runtime';
import { resolveHierarchySelection, hierarchyRows, rowExpansionFilters, type HierarchyContext } from '../../../../runtime/src/table/hierarchy-selection';
import { tableColumnPresentation } from '../../../../runtime/src/table/column-presentation';
import { ExportViewError, EXPORT_MAX_ROWS, EXPORT_PREPARATION_TIMEOUT_MS } from '../../../../runtime/src/export-snapshots';
import type { RuntimeDataGateway } from '../../../../runtime/src';
import type { NamedDataSlots } from '../../../../widgets/src/shared/component-data';
import { abortable, prepareTableExport } from './prepare';
export interface WorkbookTable {component:TableComponent;data:NamedDataSlots;name:string;}
/** One frozen job owns timeout, cancellation and a total row budget across all parents. */
export async function prepareHierarchyExport(input:Parameters<typeof prepareTableExport>[0]&{params:HierarchyContext['params']}):Promise<WorkbookTable[]>{
  const page=JSON.parse(JSON.stringify(input.page)) as Page;
  const table=JSON.parse(JSON.stringify(input.component)) as TableComponent;
  const context:HierarchyContext={filters:structuredClone(new Map(input.state.filters)),params:structuredClone(new Map(input.params)),displaySnapshot:structuredClone(input.state.displaySnapshot),filterRevision:input.state.filterRevision};
  const state={...input.state,filters:context.filters,tables:JSON.parse(JSON.stringify(input.state.tables)),headerFilters:JSON.parse(JSON.stringify(input.state.headerFilters))};
  const queries=structuredClone(new Map(input.queries));
  const {signal}=input.controller;
  const timer=setTimeout(()=>input.controller.abort(new ExportViewError('EXPORT_TIMEOUT','父子导出准备超过 60 秒')),EXPORT_PREPARATION_TIMEOUT_MS);
  let count=0;
  const gateway:RuntimeDataGateway={...input.gateway,async fetchData(query,diagnostics,requestSignal){
    const result=await input.gateway.fetchData(query,diagnostics,requestSignal);
    count+=result.rows.length;
    if(count>EXPORT_MAX_ROWS){const error=new ExportViewError('EXPORT_ROW_LIMIT','父子导出合计超过 10000 行');input.controller.abort(error);throw error;}
    return result;
  }};
  try{
    const selection=await abortable(resolveHierarchySelection(page,table,input.gateway,context,signal),signal);
    if(!['selected','unrestricted'].includes(selection.status))throw new ExportViewError('EXPORT_NOT_READY',selection.message??'父级定位未就绪');
    const parent=await prepareTableExport({...input,page,state,queries,component:table,gateway,program:undefined,hierarchy:selection});
    const rows=parent.main?.snapshot.rows??[];
    assertKeys(rows,table.props.rowKey!);
    const child=await collectChildren(page,table,rows,gateway,context,selection,input.controller);
    signal.throwIfAborted();
    return [{component:table,data:parent,name:'父表汇总'},child];
  }finally{clearTimeout(timer);}
}
function assertKeys(rows:Row[],field:string){
  const keys=rows.map(row=>expansionRowKey(row[field]));
  if(keys.some(k=>k===undefined)||new Set(keys).size!==keys.length)throw new ExportViewError('EXPORT_INCOMPLETE_DATA','行键缺失或重复，不能完整导出');
}
async function collectChildren(page:Page,parent:TableComponent,rows:Row[],gateway:RuntimeDataGateway,context:HierarchyContext,selection:Awaited<ReturnType<typeof resolveHierarchySelection>>,controller:AbortController):Promise<WorkbookTable>{
  const scope=rowExpansionPage(page,parent);
  const firstFilters=rows.length?rowExpansionFilters(page,parent,rows[0]!,context,selection):context.filters;
  const model=tableColumnPresentation(scope.page,scope.table,{declarations:page.filters??[],filters:firstFilters,displaySnapshot:context.displaySnapshot,filterRevision:context.filterRevision});
  if(!model.component.props.columns.length)throw new ExportViewError('EXPORT_NOT_READY','子表当前没有可见列');
  const tables=await mapParents(rows,async row=>{
    const filters=rowExpansionFilters(page,parent,row,context,selection);
    const next=tableColumnPresentation(scope.page,scope.table,{declarations:page.filters??[],filters,displaySnapshot:context.displaySnapshot,filterRevision:context.filterRevision});
    if(JSON.stringify(next.component.props.columns)!==JSON.stringify(model.component.props.columns))throw new ExportViewError('EXPORT_NOT_READY','父实例的子表有效列不一致');
    const program=createSourceProgram(scope.page,{gateway:{...gateway,fetchData:(query,diagnostics,signal)=>gateway.fetchData(stableRowQuery(query,scope.table.props.rowKey!),diagnostics,signal)}});
    try{
      const data=await prepareTableExport({page:scope.page,component:next.component,gateway,program,queries:new Map(),state:{...context,filters,tables:{},headerFilters:{},currentYear:new Date().getFullYear()},controller});
      assertKeys(data.main?.snapshot.rows??[],scope.table.props.rowKey!);
      return {row,data};
    }finally{program.dispose();}
  },controller);
  const config=parent.props.toolbar!.export!.rowExpansion!;
  const visible=tableColumnPresentation(page,parent,{declarations:page.filters??[],filters:context.filters,displaySnapshot:context.displaySnapshot,filterRevision:context.filterRevision}).component;
  const associations=config.parentFields.map(field=>{
    const column=tableColumnLeaves(visible.props.columns).find(c=>mainColumnField(c.field)===field);
    if(!column)throw new ExportViewError('EXPORT_NOT_READY','父关联字段当前不可见，不能导出');
    return {...column,field:{...(typeof column.field==='object'?column.field:{}),data:'parent',field},title:column.title,secondaryField:undefined,badgeField:undefined};
  });
  const childRows=tables.flatMap(t=>t.data.main?.snapshot.rows??[]);
  const parentRows=tables.flatMap(t=>(t.data.main?.snapshot.rows??[]).map(()=>t.row));
  const fields=page.dataSources[scope.table.data.main]!.fields;
  return {name:'子表明细',component:{...model.component,data:{...model.component.data,parent:parent.data.main},props:{...model.component.props,rowKey:undefined,columns:[...associations,...model.component.props.columns]}},
    data:{main:{fields,snapshot:{status:'ready',rows:childRows}},parent:{fields:page.dataSources[parent.data.main]!.fields,snapshot:{status:'ready',rows:parentRows}}}};
}
async function mapParents<T>(rows:Row[],read:(row:Row)=>Promise<T>,controller:AbortController):Promise<T[]>{
  let index=0;const result:T[]=[];
  async function worker(){
    while(index<rows.length){controller.signal.throwIfAborted();const i=index++;result[i]=await read(rows[i]!);}
  }
  try{await Promise.all(Array.from({length:Math.min(4,rows.length)},worker));return result;}
  catch(cause){controller.abort(cause);throw cause;}
}
