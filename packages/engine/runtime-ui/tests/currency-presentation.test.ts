import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {projectFieldSelections,type TableComponent} from '@metriccanvas/page/internal';
import {initialFilterValues} from '../../runtime/src/filter-state';
import {createTableController} from '../src/table-controller';
import {prepareTableExport} from '../src/table-export';
import {encodeTableWorkbook} from '../src/table-workbook';
import ExcelJS from 'exceljs';
function fixture(){const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/ioc-header/scenarios/ioc-header-currency-demo.json','utf8')));if(!parsed.ok)throw Error(JSON.stringify(parsed));return parsed.page;}
it('clears old table sort, headers and search on a presentation-only currency change',()=>{
 const page=fixture(),table=page.sections[0].components[2] as TableComponent;
 const controller=createTableController(page,()=>null,()=>{});
 controller.sort(table,[{field:'base-cny',direction:'desc'}]);controller.header(table,'base-cny',{mode:'numberRange',from:'100',to:''});controller.setSearchDraft(table,'old');
 const previous=initialFilterValues(page.filters??[]),next=new Map(previous).set('currency',{type:'dimension' as const,dimension:'currency_code',values:['USD']});
 controller.reset(table,previous,next);expect(controller.render(table)).toMatchObject({pageIndex:0,sort:[],headerFilters:{}});expect(controller.searchDraft(table)).toBe('');controller.dispose();
});
it('freezes the selected columns, metadata and query filters before async export completes',async()=>{
 const page=fixture();const source=page.dataSources.main;if(source.source.type!=='query')throw Error();
 const filters=initialFilterValues(page.filters??[]);filters.set('currency',{type:'dimension',dimension:'currency_code',values:['USD']});
 const frozen=projectFieldSelections(page,filters),component=frozen.sections[0].components[2] as TableComponent;
 let finish!:()=>void;const pending=new Promise<void>(resolve=>finish=resolve);
 const result=prepareTableExport({page:frozen,component,queries:new Map([['main',{language:'dqe',body:source.source.query.body!,fieldMappings:source.fields,filterValues:[]}]]),state:{filters,tables:{},headerFilters:{},currentYear:2026},controller:new AbortController(),gateway:{async fetchData(){await pending;return {rows:[{project:'甲项目','base-cny':2000000,'fee-cny':200000,'base-usd':300000,'fee-usd':10000,scope:'USD'}],totalCount:1};}}});
 filters.set('currency',{type:'dimension',dimension:'currency_code',values:['RMB']});finish();const data=await result;
 const workbook=new ExcelJS.Workbook();const bytes=await encodeTableWorkbook(component,data,new AbortController().signal);await workbook.xlsx.load(bytes.buffer);const values=JSON.stringify(workbook.worksheets[0].getSheetValues());expect(values).toContain('美元');expect(values).toContain('310000');expect(values).not.toContain('2200000');
});
