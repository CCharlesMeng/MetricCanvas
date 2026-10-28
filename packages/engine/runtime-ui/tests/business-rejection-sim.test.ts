import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it} from 'vitest';
import ExcelJS from 'exceljs';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot,JsonObject,TableComponent,TableQueryView} from '@metriccanvas/page/internal';
import {createDqeGateway} from '../../../data-execution/src/dqe/dqe';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../../../data-execution/src/runtime';
import {createDqeSimServer,DQE_EXECUTE_PATH} from '../../../../tools/dqe-sim/src/server';
import {prepareTableExport} from '../src/table/export/prepare';
import {encodeTableWorkbook} from '../src/table/export/workbook';

const root='rejection-overview',server=createDqeSimServer({logger:false});
let endpoint='';
beforeAll(async()=>{
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw Error('address');
  endpoint=`http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`;
});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
function setup(){
  const parsed=parsePage(JSON.parse(readFileSync('pages/business-rejection-details.json','utf8')));
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,requests:JsonObject[]=[];
  const component=page.sections[1].components[0] as TableComponent;
  const gateway=createDqeGateway({endpoint,fetchImpl:async(url,init)=>{
    requests.push(...JSON.parse(String(init?.body)).dsl_list);
    return fetch(url,init);
  }});
  const program=createSourceProgram(page,{gateway,now:new Date(2026,9,28)}),conditions=initialFilterValues(page.filters??[]);
  async function read(patch:Partial<TableQueryView>={}){
    let snapshot:DataSnapshot|undefined;
    for await(const update of program.read({roots:[root],conditions,views:new Map([[root,{...defaultSourceView(page,root),...patch}]])}))snapshot=update.snapshot;
    if(!snapshot)throw Error('snapshot');return snapshot;
  }
  async function exportWorkbook(patch:Partial<TableQueryView>={}){
    const controller=new AbortController(),view={...defaultSourceView(page,root),...patch};
    const data=await prepareTableExport({page,component,gateway,program,queries:new Map(),controller,views:new Map([[root,view]]),state:{filters:conditions,tables:{},headerFilters:{},currentYear:2026}});
    const bytes=await encodeTableWorkbook(component,data,controller.signal);
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes.buffer);
    return workbook.worksheets[0];
  }
  return {page,program,conditions,requests,read,exportWorkbook};
}
function rows(snapshot:DataSnapshot){
  if(snapshot.status!=='ready')throw Error(JSON.stringify(snapshot));return snapshot.rows;
}

it('reads the original object metadata over HTTP, keeps approvals and joins owners/status by business ID',async()=>{
  const test=setup();
  try{
    expect(test.page.dataSources['rejection-details'].source).toMatchObject({query:{body:{dsl_list:[{query_type:'object',object_type:'Business/Commercial Review Rejection Details'}]}}});
    expect(await test.read()).toMatchObject({status:'ready',totalCount:1205});
    const first=rows(await test.read()),count=test.requests.length;
    const second=rows(await test.read({pageIndex:1}));
    expect(first).toHaveLength(10);expect(second).toHaveLength(10);
    expect(second.every(row=>first.every(previous=>previous['record-id']!==row['record-id']))).toBe(true);
    expect(rows(await test.read({search:{fields:['biz-code'],query:'SIM-BIZ-00001'}}))).toEqual(expect.arrayContaining([
      expect.objectContaining({'approval-stage':'初审','biz-owner-name':'模拟李四','life-status':'已关闭'}),
      expect.objectContaining({'approval-stage':'复审','biz-owner-name':'模拟李四','life-status':'已关闭'})
    ]));
    const missing=rows(await test.read({search:{fields:['biz-code'],query:'SIM-BIZ-00000'}}));
    expect(missing).toHaveLength(2);expect(missing.every(row=>row['biz-owner-name']===null&&row['life-status']===null)).toBe(true);
    expect(test.requests).toHaveLength(count);
    const main=test.requests.filter(item=>item.query_type==='object');
    expect(main.map(item=>(item.order as JsonObject).offset)).toEqual([0,500,1000]);
    expect(main.every(item=>(item.order as JsonObject).order_by_field==='商务ID')).toBe(true);
  }finally{test.program.dispose();}
});

it('applies owner-side status and approval-side stage filters to the whole joined population',async()=>{
  const test=setup();
  try{
    const predicates=[{field:'life-status',op:'in' as const,values:['已关闭']}];
    expect(await test.read({predicates})).toMatchObject({totalCount:402});
    expect(await test.read({predicates:[...predicates,{field:'approval-stage',op:'in',values:['复审']}]})).toMatchObject({totalCount:201});
    expect(rows(await test.read({sort:[{field:'biz-approve-time',direction:'asc'}]}))[0]['biz-approve-time']).toBe('2026-09-01 12:00:00');
  }finally{test.program.dispose();}
});

it('requeries declared region/time inputs while preserving supplemental current information',async()=>{
  const test=setup();
  try{
    test.conditions.set('region',{type:'dimension',dimension:'geo-pc-code',level:'geo',values:['R99']});
    expect(await test.read()).toMatchObject({totalCount:905});
    test.conditions.set('region',{type:'dimension',dimension:'region-dept-code',level:'region-dept',values:['CN-NORTH']});
    expect(await test.read()).toMatchObject({totalCount:302});
    expect(rows(await test.read()).every(row=>row['rep-office-name']==='模拟北京代表处')).toBe(true);
    test.conditions.set('region',{type:'dimension',dimension:'rep-office-code',level:'office',values:['SH-01']});
    expect(await test.read()).toMatchObject({totalCount:302});
    test.conditions.delete('region');
    test.conditions.set('mtime',{type:'timeRange',from:'2026-10',to:'2026-10'});
    expect(await test.read()).toMatchObject({totalCount:8});
    expect(rows(await test.read()).every(row=>String(row['biz-owner-name']).startsWith('模拟'))).toBe(true);
    test.conditions.set('mtime',{type:'timeRange',from:'2026-08',to:'2026-08'});
    expect(await test.read()).toMatchObject({status:'empty',totalCount:0});
  }finally{test.program.dispose();}
});

it('exports all 1205 approvals and the 402 status-filtered rows with the original eleven columns',async()=>{
  const test=setup();
  try{
    await test.read({pageIndex:1});
    const all=await test.exportWorkbook({pageIndex:1});
    expect(all.rowCount).toBe(1206);expect(all.columnCount).toBe(11);
    expect(all.getRow(1).values).toEqual([undefined,'序号','地区部','代表处','商务编码','商务责任人','商务审批通过时间','生命状态','审批结果','审批意见','评审组织人','审批阶段']);
    expect(all.getCell('A1206').value).toBe(1205);
    const filtered=await test.exportWorkbook({pageIndex:1,predicates:[{field:'life-status',op:'in',values:['已关闭']}]});
    expect(filtered.rowCount).toBe(403);
    expect(filtered.getColumn(7).values.slice(2).every(value=>value==='已关闭')).toBe(true);
    expect(filtered.getColumn(5).values.slice(2).every(value=>String(value).startsWith('模拟'))).toBe(true);
  }finally{test.program.dispose();}
});
