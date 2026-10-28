import {prepareHierarchyExport} from './hierarchy';
import {encodeWorkbookTables,downloadWorkbookBytes} from './workbook';
import type {Page, TableComponent} from '@metriccanvas/page/internal';
import type {PageSnapshotStream,RuntimeDataGateway} from '../../../../runtime/src';
import {ExportViewError} from '../../../../runtime/src/export-snapshots';
import type {ExportRenderState} from '../../export-render-state';
import type {createExportController} from '../../export-controller';
import {prepareTableExport} from './prepare';
import {downloadTableWorkbook} from './workbook';

type State=Pick<ExportRenderState,'filters'|'tables'|'headerFilters'|'currentYear'|'displaySnapshot'|'filterRevision'|'now'>;
/** The authorized caller supplies one applied-state snapshot; this task freezes it before await. */
export async function exportVisibleTable(input:{page:Page;component:TableComponent;stream:PageSnapshotStream;gateway:RuntimeDataGateway;state:State;params?:import('../../../../runtime/src').PageParamValues;blocked:boolean;controller:ReturnType<typeof createExportController>}):Promise<void>{
 const component=JSON.parse(JSON.stringify(input.component)) as TableComponent;
 if(!component.props.columns.length)return;
 const captured={page:input.page,component,queries:input.stream.captureQueries(),views:input.stream.captureViews(),program:input.stream.getSourceProgram(),gateway:input.gateway,
  state:{...input.state,filters:structuredClone(new Map(input.state.filters)),displaySnapshot:structuredClone(input.state.displaySnapshot),tables:JSON.parse(JSON.stringify(input.state.tables)),headerFilters:JSON.parse(JSON.stringify(input.state.headerFilters))}};
 try{await input.controller.run(component.id,async controller=>{
  if(input.blocked)throw new ExportViewError('EXPORT_NOT_READY','筛选待确认或候选未就绪，暂不能导出该表');
  if(component.props.toolbar?.export?.rowExpansion){
    const tables=await prepareHierarchyExport({...captured,controller,params:input.params??new Map()});
    const bytes=await encodeWorkbookTables(tables,controller.signal);
    await downloadWorkbookBytes(component,bytes,controller.signal);return;
  }
  const data=await prepareTableExport({...captured,controller});controller.signal.throwIfAborted();
  await downloadTableWorkbook(component,data,controller.signal);
 });}catch{/* Task feedback belongs to the existing export controller. */}
}
