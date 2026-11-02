import {expect,it,vi} from 'vitest';
import ExcelJS from 'exceljs';
import document from '../../../../pages/capabilities/table/table-column-enums.json';
import {parsePage} from '@metriccanvas/page';
import {alignedCellText,projectTableRows} from '../../widgets/src/components/table/rows';
import {tableEnumLabel} from '../../widgets/src/components/table/enum-values';
import type {NamedDataSlots} from '../../widgets/src/shared/component-data';
import {encodeTableWorkbook} from '../src/table/export/workbook';
import {createTableController} from '../src/table/controller';
import {orchestrate} from '../../runtime/src/orchestrator';

function fixture(){
  const parsed=parsePage(document);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const table=parsed.page.sections[0].components[0];
  if(table.type!=='table')throw Error('table');
  const source=parsed.page.dataSources.businesses;
  if(source.source.type!=='inline')throw Error('inline');
  const data:NamedDataSlots={main:{fields:source.fields,snapshot:{status:'ready',rows:source.source.rows}}};
  return {page:parsed.page,table,data};
}
it('renders and exports enum labels while preserving unknown, missing and raw values',async()=>{
  const {table,data}=fixture(),before=structuredClone(data),column=table.props.columns[1];
  if(column.kind==='group')throw Error('field');
  const rows=projectTableRows(data,table.props);
  expect(rows.map(row=>alignedCellText(column.field,data,row,column.enumValues))).toEqual(['项目商务框架','项目非框架','9','—']);
  const bytes=await encodeTableWorkbook(table,data,new AbortController().signal);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes.buffer);
  expect([2,3,4,5].map(index=>workbook.worksheets[0].getCell(index,2).value)).toEqual(['项目商务框架','项目非框架','9',null]);
  expect(data).toEqual(before);
  expect(tableEnumLabel(0,[{value:'0',label:'文本零'},{value:0,label:'数字零'}])).toBe('数字零');
  expect(tableEnumLabel(null,column.enumValues)).toBeUndefined();
});
it('does not preload enum candidates and filters with the raw code',async()=>{
  const {page,table}=fixture(),fetchData=vi.fn(async()=>{throw Error('inline must not fetch');});
  const stream=orchestrate(page,{fetchData}),stop=stream.subscribe(()=>{});
  const controller=createTableController(page,()=>stream,()=>{});
  try{
    controller.candidateBinding(table).oncandidatepreloadvisible(true);
    expect(controller.candidateBinding(table).columnCandidates['biz-type']).toBeUndefined();
    controller.header(table,'biz-type',{mode:'select',values:['0']});
    expect(controller.headers(table)['biz-type']).toEqual({mode:'select',values:['0']});
    expect(fetchData).not.toHaveBeenCalled();
  }finally{controller.dispose();stop();}
});
