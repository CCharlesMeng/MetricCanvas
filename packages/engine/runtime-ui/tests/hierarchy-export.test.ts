import {expect,it,vi} from 'vitest';
import ExcelJS from 'exceljs';
import {hierarchyFixture,hierarchySim,choose} from '../../runtime/tests/hierarchy-fixture';
import {prepareHierarchyExport} from '../src/table/export/hierarchy';
import {encodeWorkbookTables} from '../src/table/export/workbook';
function state(filters:ReturnType<typeof choose>){return {filters,currentYear:2026,tables:{'region-office-table':{pageIndex:1,sort:[],headerFilters:{}}},headerFilters:{}};}
it.each([[undefined,4,17],['全球',4,17],['R01',1,5],['O101',1,1]] as const)('exports complete parent and child ranges for %s without any expansion',async(value,parentCount,childCount)=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim(),controller=new AbortController();
 delete table.props.columns[0]!.title;page.dataSources['region-summary']!.fields['region-name']!.label='地区部归属';
 try{
  const selected=choose(filters,value,value==='R01'||value==='全球'?'region-dept':'office');
  const tables=await prepareHierarchyExport({page,component:table,gateway:sim.gateway,state:state(selected),params:new Map(),queries:new Map(),controller});
  const bytes=await encodeWorkbookTables(tables,controller.signal),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes.buffer);
  expect(workbook.worksheets.map(s=>s.name)).toEqual(['父子表格']);
  const sheet=workbook.worksheets[0]!;
  expect(sheet.rowCount).toBe(1+parentCount*2+childCount);
  expect(sheet.getCell('A1').value).toBe('地区部归属');expect(sheet.getCell('A2').value).toBe('华东');
  expect(sheet.getCell('A3').value).toBeNull();expect(sheet.getCell('B3').value).toBe('代表处');
  expect(tables[0]!.children).toHaveLength(parentCount);
  expect(tables[0]!.children!.flatMap(child=>child.data.main!.snapshot.rows)).toHaveLength(childCount);
  if(value==='O101'){expect(sheet.getCell('B2').value).toBe(1200);expect(sheet.getCell('C4').value).toBe(360);}
 }finally{await sim.close();}
});
it('freezes business conditions and parent search while ignoring parent page and child-local state',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim(),controller=new AbortController();
 try{
  const frozen=state(new Map(filters));frozen.tables['region-office-table']={...frozen.tables['region-office-table'],searchQuery:'欧洲'} as any;
  const promise=prepareHierarchyExport({page,component:table,gateway:sim.gateway,state:frozen,params:new Map(),queries:new Map(),controller});
  frozen.filters.set('year',{type:'dimension',dimension:'h_year',values:['2025']});
  const tables=await promise;expect(tables[0]!.data.main!.snapshot.rows).toEqual([expect.objectContaining({'region-name':'欧洲',amount:780})]);
  expect(tables[0]!.children![0]!.data.main!.snapshot.rows).toHaveLength(4);
 }finally{await sim.close();}
});
it('rejects any failed child query and aborts remaining work instead of returning partial tables',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim(),controller=new AbortController();
 const gateway={...sim.gateway,async fetchData(...args:Parameters<typeof sim.gateway.fetchData>){
  if(args[0].filterValues.some(f=>f.target==='dimension'&&f.queryField==='h_region'&&f.values.includes('R02')))throw Error('child failure');
  return sim.gateway.fetchData(...args);
 }};
 try{await expect(prepareHierarchyExport({page,component:table,gateway,state:state(new Map(filters)),params:new Map(),queries:new Map(),controller})).rejects.toThrow();expect(controller.signal.aborted).toBe(true);}finally{await sim.close();}
});
it('rejects hidden parent association columns and ambiguous lookup results',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();
 try{
  table.props.columns[0]!.visibleWhen={filter:'product',part:'values',op:'containsAny',values:['cloud']};
  const run=(value?:string)=>prepareHierarchyExport({page,component:table,gateway:sim.gateway,state:state(choose(filters,value)),params:new Map(),queries:new Map(),controller:new AbortController()});
  await expect(run()).rejects.toThrow('不可见');await expect(run('O-multi')).rejects.toThrow('不唯一');
 }finally{await sim.close();}
});
it('enforces one combined row budget and cancellation',async()=>{
 const {page,table,filters}=hierarchyFixture(),controller=new AbortController();
 const gateway={async fetchData(){return {rows:Array.from({length:10001},()=>({})),totalCount:10001};}};
 await expect(prepareHierarchyExport({page,component:table,gateway,state:state(new Map(filters)),params:new Map(),queries:new Map(),controller})).rejects.toThrow();expect(controller.signal.aborted).toBe(true);
 const cancelled=new AbortController();cancelled.abort();
 await expect(prepareHierarchyExport({page,component:table,gateway,state:state(new Map(filters)),params:new Map(),queries:new Map(),controller:cancelled})).rejects.toThrow();
});
it('allows an empty child and rejects an incomplete child receipt',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();let incomplete=false;
 const gateway={...sim.gateway,async fetchData(...args:Parameters<typeof sim.gateway.fetchData>){
  if(args[0].fieldMappings['office-id'])return {rows:[],totalCount:incomplete?3:0};
  return sim.gateway.fetchData(...args);
 }};
 const run=()=>prepareHierarchyExport({page,component:table,gateway,state:state(new Map(filters)),params:new Map(),queries:new Map(),controller:new AbortController()});
 try{const tables=await run();expect(tables[0]!.data.main!.snapshot.rows).toHaveLength(4);expect(tables[0]!.children!.map(child=>child.data.main!.snapshot.rows)).toEqual([[],[],[],[]]);incomplete=true;await expect(run()).rejects.toThrow();}finally{await sim.close();}
});
it('exports only parent headers for zero parent rows, without resolving irrelevant child columns or queries',async()=>{
 const {page,table,filters}=hierarchyFixture(),sim=await hierarchySim();let childCalls=0;
 for(const column of table.props.rowExpansion!.table.columns)if(column.kind!=='group')column.visibleWhen={filter:'product',part:'values',op:'containsAny',values:['cloud']};
 const gateway={...sim.gateway,async fetchData(...args:Parameters<typeof sim.gateway.fetchData>){
  if(args[0].fieldMappings['row-id'])return {rows:[],totalCount:0};
  childCalls++;return sim.gateway.fetchData(...args);
 }};
 try{
  const controller=new AbortController(),tables=await prepareHierarchyExport({page,component:table,gateway,state:state(new Map(filters)),params:new Map(),queries:new Map(),controller});
  const bytes=await encodeWorkbookTables(tables,controller.signal),book=new ExcelJS.Workbook();await book.xlsx.load(bytes.buffer);
  expect(childCalls).toBe(0);expect(tables[0]!.children).toEqual([]);expect(book.worksheets[0]!.rowCount).toBe(1);
 }finally{await sim.close();}
});
it('keeps the parent page on common changes and resets defaults on a hierarchy identity change',async()=>{
 const {createTableController}=await import('../src/table/controller');
 const {page,table,filters}=hierarchyFixture();const controller=createTableController(page,()=>null,()=>{},()=>filters);
 try{
  controller.page(table,1);controller.reset(table,filters,choose(filters));expect(controller.view(table).pageIndex).toBe(1);
  const next=new Map(filters);next.set('year',{type:'dimension',dimension:'h_year',values:['2025']});controller.reset(table,filters,next);expect(controller.view(table).pageIndex).toBe(1);
  controller.pageSize(table,3);controller.search(table,'华东');controller.reset(table,next,choose(next,'O101'));expect(controller.view(table)).toMatchObject({pageIndex:0,pageSize:2,sort:[],predicates:[]});expect(controller.view(table).search).toBeUndefined();
 }finally{controller.dispose();}
});

it('times out the whole job even when a candidate adapter ignores abort',async()=>{
 const {page,table,filters}=hierarchyFixture(),controller=new AbortController();
 const gateway:import('../../runtime/src').RuntimeDataGateway={async fetchData(){throw Error('unexpected query');},fetchFilterCandidates:()=>new Promise(()=>{})};
 vi.useFakeTimers();
 try{
  const job=prepareHierarchyExport({page,component:table,gateway,state:state(choose(filters,'O101')),params:new Map(),queries:new Map(),controller});
  const rejected=expect(job).rejects.toMatchObject({code:'EXPORT_TIMEOUT',message:'父子导出准备超过 5 分钟'});
  await vi.advanceTimersByTimeAsync(299999);expect(controller.signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);await rejected;expect(controller.signal.aborted).toBe(true);
 }finally{vi.useRealTimers();}
});
