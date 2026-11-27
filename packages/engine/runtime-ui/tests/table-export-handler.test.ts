import { afterEach, expect, it, vi } from 'vitest';
import type { TableComponent } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import { deliverTableExport, type TableExportHandler } from '../src/table/export/host';
import * as workbook from '../src/table/export/workbook';
import { EXCEL_SHEET_ROWS } from '../src/table/export/workbook-pages';

const component: TableComponent = {
  id: 'summary', type: 'table', layout: {span: 12}, data: {main:'sample', total:'total'},
  props: {rowNumber: {}, pinnedTop: {data:'total'}, columns: [
    {field:'name', title:'客户', pinnedTop:{text:'合计'}},
    {field:{data:'main', field:'amount', format:'compact-wan-1'}, title:'合同额', unit:'万元',
      pinnedTop:{field:{data:'total', field:'amount'}}},
    {field:'note', secondaryField:{data:'main',field:'date',format:{type:'time', pattern:'YYYY-MM-DD HH:mm'}}, badgeField:'label'}
  ]}
};
const data: NamedDataSlots = {
  main: {fields: {
    name:{type:'string', role:'dimension'}, amount:{type:'number',role:'measure'},
    note:{type:'semanticHtml', role:'detail'}, label:{type:'string', role:'dimension'},
    date:{type:'datetime', role:'dimension'}
  }, snapshot:{status:'ready', rows:[
    {name:'A', amount:125000, note:'<p>进度</p><p><data>12</data><br/>已核对</p>', date:'2026-11-01T20:05:00Z', label:'待提交'}
  ]}},
  total:{fields:{amount:{type:'number',role:'measure'}},snapshot:{status:'ready',rows:[{amount:250000}]}}
};

afterEach(() => vi.restoreAllMocks());

it('exports readable markup, local time, expanded fields, pinned rows and display units', async () => {
  const handler = vi.fn<TableExportHandler>().mockResolvedValue({status:'submitted'});
  await deliverTableExport(component, data, new AbortController().signal, 'page', handler);
  const {sheets, meta} = handler.mock.calls[0]![0];
  expect(meta.rowCount).toBe(2);
  expect(sheets[0].header[0]).toEqual(['序号','客户','合同额','note','','']);
  expect(sheets[0].rows[0]?.slice(0,3)).toEqual([null, '合计', '25 万元']);
  expect(sheets[0].rows[1]).toEqual([1,'A','12.5 万元','进度 12\n已核对','2026-11-02 04:05','待提交']);
});

it('routes warnings and over-capacity results to the internal workbook', async () => {
  const download = vi.spyOn(workbook, 'downloadTableWorkbook').mockResolvedValue();
  const handler = vi.fn<TableExportHandler>();
  const signal = new AbortController().signal;
  const source = data.main!;
  await deliverTableExport(component, {main:{...source, snapshot:{status:'ready',rows:[],
    warnings:[{sourceId:'sample', message:'部分值无效', count:1, code:'TABLE_RESULT_RECOVERED'}]}}}, signal, 'page', handler);
  await deliverTableExport(component, {main:{...source, snapshot:{status:'ready',rows:new Array(EXCEL_SHEET_ROWS)}}}, signal, 'page', handler);
  expect(download).toHaveBeenCalledTimes(2);
  expect(handler).not.toHaveBeenCalled();
});
