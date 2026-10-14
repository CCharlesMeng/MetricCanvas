import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { DataRow, EffectiveQuery } from '@metriccanvas/page/internal';
import type { PageDocument } from '@metriccanvas/page';
import { createPageDataExecutor, type DataGateway } from '../src';
const input = (): PageDocument => JSON.parse(readFileSync(new URL('../../page/fixtures/contract-valid/query-result-where-page.json',import.meta.url),'utf8'));
const project = (id:string, amount:number, status='进行中'):DataRow=>({'project-id':id,status,amount,enabled:false,duration:0,day:'2026-10-01',at:'2026-10-01T00:00:00Z'});
it('one-shot metadata execution keeps all A initial rows and uses B/C filtered raw inputs',async()=>{
  const document=input(),before=structuredClone(document);
  const received:Array<{id:string;query:EffectiveQuery}>=[];
  const gateway:DataGateway={async fetchData(query,context){const id=context!.dataSourceIds![0];received.push({id,query});return id==='projects'?{rows:[project('HIGH',2e6),project('LOW',0),project('CLOSED',3e6,'结束')],totalCount:3}:{rows:[{'project-id':id==='details-high'?'HIGH':'LOW',score:1}],totalCount:1};}};
  const result=await createPageDataExecutor({gateway}).execute(document);
  expect(received.map(c=>c.id)).toEqual(['projects','details-high','details-low']);
  expect(received[1].query.filterValues).toEqual([{target:'dimension',queryField:'项目编号',values:['HIGH']}]);
  expect(received[2].query.filterValues).toEqual([{target:'dimension',queryField:'项目编号',values:['LOW']}]);
  expect(result.dataSources.projects.source).toMatchObject({initial:{totalCount:3,rows:[{'项目编号':'HIGH','金额':2e6},{'项目编号':'LOW','金额':0},{'项目编号':'CLOSED','金额':3e6}]}});
  expect(document).toEqual(before);expect(result.sections).toEqual(document.sections);
});
it('one-shot empty filtered B writes empty initial while retaining full A and executing C',async()=>{
  const received:string[]=[];
  const gateway:DataGateway={async fetchData(_query,context){const id=context!.dataSourceIds![0];received.push(id);return id==='projects'?{rows:[project('LOW',0)],totalCount:1}:{rows:[{'project-id':'LOW',score:1}],totalCount:1};}};
  const result=await createPageDataExecutor({gateway}).execute(input());
  expect(received).toEqual(['projects','details-low']);
  expect(result.dataSources['details-high'].source).toMatchObject({initial:{rows:[],totalCount:0}});
  expect(result.dataSources.projects.source).toMatchObject({initial:{totalCount:1,rows:[{'项目编号':'LOW'}]}});
});
it('one-shot execution consumes the first declared page and sends only selected identifiers to downstream queries',async()=>{
  const document:PageDocument=JSON.parse(readFileSync(new URL('../../page/fixtures/contract-valid/query-result-page-window-page.json',import.meta.url),'utf8'));
  const window:DataRow[]=Array.from({length:10},(_,i)=>({...project(`ID-${i}`,i%2?4e6:2e6),'project-name':`项目${i}`}));
  const calls:Array<{id:string;query:EffectiveQuery}>=[];
  const gateway:DataGateway={async fetchData(query,context){
    const id=context!.dataSourceIds![0];calls.push({id,query});
    return id==='projects'?{rows:window,totalCount:80}:{rows:query.filterValues.flatMap(value=>value.target==='dimension'?value.values.map(id=>({'project-id':id,'project-name':`项目${id}`,score:1,amount:1})):[]),totalCount:5};
  }};
  const result=await createPageDataExecutor({gateway}).execute(document);
  expect(calls).toHaveLength(3);expect(calls[0].query.pagination).toEqual({offset:0,limit:10});
  expect(calls.find(c=>c.id==='details-high')?.query.filterValues[0]).toMatchObject({values:['ID-1','ID-3','ID-5','ID-7','ID-9']});
  expect(calls.find(c=>c.id==='details-low')?.query.filterValues[0]).toMatchObject({values:['ID-0','ID-2','ID-4','ID-6','ID-8']});
  for(const call of calls.slice(1))expect(call.query.pagination).toBeUndefined();
  expect(result.dataSources.projects.source).toMatchObject({initial:{totalCount:80,rows:window.map(row=>({'项目编号':row['project-id']}))}});
});
