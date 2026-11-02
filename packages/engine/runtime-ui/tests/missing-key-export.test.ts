import {expect,it} from 'vitest';
import ExcelJS from 'exceljs';
import {parsePage} from '@metriccanvas/page';
import fixture from '../../../../pages/capabilities/data/missing-organization-key.json';
import {prepareTableExport} from '../src/table/export/prepare';
import {encodeTableWorkbook} from '../src/table/export/workbook';

it('空组织键策略在完整导出中生效，保留有效零分与异常说明',async()=>{
  const parsed=parsePage(fixture);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page;
  const component=page.sections[0]!.components[0]!;
  if(component.type!=='table')throw Error('预期表格');
  const data=await prepareTableExport({page,component,queries:new Map(),controller:new AbortController(),
    gateway:{async fetchData(){throw Error('inline 示例不应请求网络');}},
    state:{currentYear:2026,filters:new Map(),tables:{},headerFilters:{}}});
  expect(data.main?.snapshot.rows).toEqual([{org:'甲',a:0,b:null,total:0},{org:'乙',a:null,b:null,total:0},{org:'丙',a:null,b:-2,total:-2}]);
  expect(data.main?.diagnostics?.snapshot).toMatchObject({status:'ready',totalCount:3,
    warnings:[{sourceId:'a',count:2},{sourceId:'b',count:1}]});
  const workbook=new ExcelJS.Workbook();
  const bytes=await encodeTableWorkbook(component,data,new AbortController().signal);
  await workbook.xlsx.load(bytes.buffer);
  expect(workbook.worksheets.map(sheet=>sheet.name)).toEqual(['表格数据','数据异常说明']);
  expect(JSON.stringify(workbook.getWorksheet('数据异常说明')!.getSheetValues())).toContain('已跳过组织键为空的数据行');
  expect(workbook.getWorksheet('表格数据')!.rowCount).toBe(4);
});
