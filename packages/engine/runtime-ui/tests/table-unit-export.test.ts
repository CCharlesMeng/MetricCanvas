import {expect,it} from 'vitest';
import ExcelJS from 'exceljs';
import {encodeTableWorkbook} from '../src/table/export/workbook';
import type {TableComponent} from '@metriccanvas/page/internal';
import type {NamedDataSlots} from '../../widgets/src/shared/component-data';
it('exports display units without changing numeric values, zero or missing cells',async()=>{
  const component:TableComponent={id:'table',type:'table',layout:{span:12},data:{main:'sample'},props:{columns:[{field:{data:'main',field:'amount',format:'compact-wan-1'},unit:'万元'},{field:'duration',unit:'天'}]}};
  const data:NamedDataSlots={main:{fields:{amount:{type:'number',role:'measure'},duration:{type:'number',role:'measure',defaultFormat:'number-1'}},snapshot:{status:'ready',rows:[{amount:125000,duration:12.5},{amount:0,duration:0},{amount:null,duration:null}]}}};
  const before=structuredClone(data);
  const bytes=await encodeTableWorkbook(component,data,new AbortController().signal);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes.buffer);
  const sheet=workbook.worksheets[0];
  expect(sheet.getCell('A1').value).toBe('amount（万元）');
  expect(sheet.getCell('A2').value).toBe(125000);expect(sheet.getCell('A2').numFmt).toBe('"12.5 万元"');
  expect(sheet.getCell('B2').value).toBe(12.5);expect(sheet.getCell('B2').numFmt).toBe('"12.5 天"');
  expect(sheet.getCell('B3').value).toBe(0);expect(sheet.getCell('B3').numFmt).toBe('"0 天"');
  expect(sheet.getCell('B4').value).toBeNull();expect(data).toEqual(before);
});
