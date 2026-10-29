import { officeGateway } from './fixtures/office-gateway';
import { describe, expect, it } from 'vitest';
import fixture from '../../page/fixtures/contract-valid/paged-join-page.json';
import offices from './fixtures/offices.json';
import { parsePage, resolvePageParams } from '@metriccanvas/page';
import type { EffectiveQuery, Row, TableQueryView, DataSnapshot, Page } from '@metriccanvas/page/internal';
import { createSourceProgram, defaultSourceView, initialFilterValues } from '../src/runtime';
import { createPageDataExecutor } from '../src';
import type { DataGateway } from '../src';
import { filterTableRows, sortTableRows } from '../src/table-view';
const root='office-overview';
function parsed():Page {const p=parsePage(fixture);if(!p.ok)throw Error(JSON.stringify(p.errors));return p.page;}
async function read(view?:Partial<TableQueryView>,purpose:'screen'|'complete'='screen',gateway=officeGateway()) {
 const page=parsed(),program=createSourceProgram(page,{gateway});const outputs=new Map<string,DataSnapshot>();
 try {for await(const u of program.read({roots:[root,'office-meeting'],conditions:initialFilterValues(page.filters??[]),views:new Map([[root,{...defaultSourceView(page,root),...view}]]),purpose}))outputs.set(u.sourceId,u.snapshot);}finally{program.dispose();}return outputs;
}
function rows(outputs:Map<string,DataSnapshot>){const s=outputs.get(root);if(s?.status!=='ready')throw Error(JSON.stringify(s));return s.rows;}
describe('SourceProgram pagedJoin behavior',()=>{
 it('retains earlier joined pages after a later query failure in a partial report read',async()=>{
  const page=parsed(),gateway=officeGateway();
  const program=createSourceProgram(page,{gateway:{async fetchData(query){
   if((query.pagination?.offset??0)>0)throw Object.assign(new Error('unavailable'),{code:'DQE_UPSTREAM_ERROR'});
   return gateway.fetchData(query);
  }}});
  const outputs=new Map<string,DataSnapshot>();
  try {
   for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[]),views:new Map([[root,{...defaultSourceView(page,root),sort:[{field:'analysis-meeting-rate',direction:'desc'}]}]]),purpose:'complete',allowPartial:true}))outputs.set(update.sourceId,update.snapshot);
   expect(rows(outputs)).toHaveLength(3);
   expect(outputs.get(root)).toMatchObject({status:'ready',totalCount:3});
  } finally {program.dispose();}
 });
 it('globally switches the first page and preserves independent ordinary result',async()=>{
  expect(rows(await read()).map(r=>r['rep-office-code'])).toEqual(['SH-01','BJ-01','GD-01']);
  const result=await read({sort:[{field:'analysis-meeting-rate',direction:'desc'}]});
  expect(rows(result).map(r=>r['rep-office-code'])).toEqual(['SH-01','SZ-01','BJ-01']);
  expect(result.get(root)).toMatchObject({totalCount:8});expect(result.get('office-meeting')).toMatchObject({status:'ready',rows:expect.any(Array)});
  expect((result.get('office-meeting') as {rows:Row[]}).rows).toHaveLength(8);
 });
 it('pages, generates ordinal and corrects out-of-range views',async()=>{
  const view={sort:[{field:'analysis-meeting-rate',direction:'desc' as const}],pageIndex:1};
  expect(rows(await read(view)).map(r=>[r['rep-office-code'],r.rank])).toEqual([['HZ-01',4],['CD-01',5],['GD-01',6]]);
  expect(rows(await read({...view,pageIndex:99})).map(r=>r.rank)).toEqual([7,8]);
 });
 it('filters the full joined population across sources and searches later rows',async()=>{
  const view={sort:[{field:'analysis-meeting-rate',direction:'desc' as const}],predicates:[{field:'bidding-amount',op:'gte' as const,value:150000000}]};
  expect(rows(await read(view)).map(r=>r['rep-office-code'])).toEqual(['SH-01','BJ-01','GD-01']);
  expect((await read(view)).get(root)).toMatchObject({totalCount:3});
  expect(rows(await read({...view,predicates:[...view.predicates,{field:'analysis-meeting-rate',op:'gte',value:85}]}))).toHaveLength(1);
  expect(rows(await read({search:{fields:['rep-office-name'],query:'天津'}}))[0]['rep-office-code']).toBe('TJ-01');
 });
 it('applies exact matching to the complete joined population and retains it for export',async()=>{
  const search={fields:['rep-office-name'],query:'天津代表处',match:'equals' as const};
  expect(rows(await read({search})).map(row=>row['rep-office-code'])).toEqual(['TJ-01']);
  expect(rows(await read({search},'complete')).map(row=>row['rep-office-code'])).toEqual(['TJ-01']);
  expect((await read({search:{...search,query:'天津'}})).get(root)).toMatchObject({status:'empty',totalCount:0});
 });
 it('exports every matching page with frozen sort and keeps member initial independent',async()=>{
  const result=await read({sort:[{field:'analysis-meeting-rate',direction:'desc'}]},'complete');
  expect(rows(result)).toHaveLength(8);expect(rows(result).map(r=>r.rank)).toEqual([1,2,3,4,5,6,7,8]);
  const resolved=resolvePageParams(fixture);if(!resolved.ok)throw Error('fixture');
 const output=await createPageDataExecutor({gateway:officeGateway()}).execute(resolved.document);
  expect(output.dataSources[root].source).toMatchObject({initial:{rows:expect.any(Array),totalCount:8}});
  const meeting=output.dataSources['office-meeting'].source;if(meeting.type!=='query')throw Error('query');expect(meeting.initial?.rows).toHaveLength(8);
  expect(output.dataSources['office-bidding'].source).not.toHaveProperty('initial');
  expect(parsePage(output).errors).toEqual([]);
 });
 it('recovers truncated, duplicate and extra keys while propagating permission errors',async()=>{
  for(const mode of ['truncated','duplicate','extra','failure']) {
   const gateway=officeGateway();
   const failed=await read({sort:[{field:'analysis-meeting-rate',direction:'desc'}]},'screen',{async fetchData(query){const data=await gateway.fetchData(query);if('bidding-amount' in query.fieldMappings){if(mode==='failure')throw Object.assign(new Error('failed'),{code:'DQE_FORBIDDEN'});if(mode==='truncated')data.totalCount=data.rows.length+1;if(mode==='duplicate')data.rows.push(data.rows[0]);if(mode==='extra')data.rows.push({...data.rows[0],'rep-office-code':'EXTRA'});}return data;}});
   if(mode==='failure')expect(failed.get(root)).toMatchObject({status:'error',error:{code:'DQE_FORBIDDEN'}});
   else expect(failed.get(root)).toMatchObject({status:'ready',warnings:expect.any(Array)});
  }
 });
 it('uses stable key ties and null-last sorting on the complete path; handles missing rows and empty domains',async()=>{
  const page=parsed();const meeting=page.dataSources['office-meeting'];if(meeting.source.type!=='query')throw Error('query');meeting.fields['analysis-meeting-rate'].nullable=true;
  const gateway=officeGateway();
  const modified={async fetchData(query:EffectiveQuery){const result=await gateway.fetchData(query);if('analysis-meeting-rate' in query.fieldMappings)result.rows=result.rows.map(row=>({...row,'analysis-meeting-rate':row['rep-office-code']==='SZ-01'?null:['SH-01','BJ-01'].includes(String(row['rep-office-code']))?91.2:row['analysis-meeting-rate']})).reverse();return result;}};
  const program=createSourceProgram(page,{gateway:modified});
  try{for(const direction of ['asc','desc'] as const){let result:DataSnapshot|undefined;
    for await(const update of program.read({roots:[root],conditions:new Map(),views:new Map([[root,{...defaultSourceView(page,root),pageSize:8,sort:[{field:'analysis-meeting-rate',direction}]}]])}))result=update.snapshot;
    expect(result?.status).toBe('ready');if(result?.status==='ready'){expect(result.rows.at(-1)?.['rep-office-code']).toBe('SZ-01');const tied=result.rows.filter(row=>row['analysis-meeting-rate']===91.2);expect(tied.map(row=>row['rep-office-code'])).toEqual(['BJ-01','SH-01']);}
  }}finally{program.dispose();}
  const emptyCalls:EffectiveQuery[]=[];const empty=await read({search:{fields:['rep-office-name'],query:'any'}},'screen',{async fetchData(query){emptyCalls.push(query);return {rows:[],totalCount:0};}});expect(empty.get(root)).toMatchObject({status:'empty',totalCount:0});expect(emptyCalls.filter(q=>!('analysis-meeting-rate' in q.fieldMappings))).toHaveLength(1);
  const missing=await read({sort:[{field:'analysis-meeting-rate',direction:'desc'}]},'screen',{async fetchData(query){const result=await gateway.fetchData(query);if('support-rate' in query.fieldMappings){result.rows=[];result.totalCount=0;}return result;}});expect(rows(missing).every(row=>row['support-rate']===null)).toBe(true);
 });
 it('rejects fallback limits and warns about changing export totals',async()=>{
  const page=parsed();const source=page.dataSources[root];if(source.source.type!=='pagedJoin')throw Error('join');source.source.fallback.maxRows=7;
  const program=createSourceProgram(page,{gateway:officeGateway()});let result:DataSnapshot|undefined;
  try{for await(const update of program.read({roots:[root],conditions:new Map(),views:new Map([[root,{...defaultSourceView(page,root),search:{fields:['rep-office-name'],query:'上海'}}]])}))result=update.snapshot;}finally{program.dispose();}
  expect(result).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});
  const gateway=officeGateway();const recovered=await read({sort:[{field:'analysis-meeting-rate',direction:'desc'}]},'complete',{async fetchData(query){const result=await gateway.fetchData(query);if((query.pagination?.offset??0)>0)result.totalCount=9;return result;}});expect(recovered.get(root)).toMatchObject({status:'ready',totalCount:8,warnings:expect.any(Array)});
 });

 it('propagates materialized parameter invalidation through definition references into combination initial',async()=>{
  const parsed=resolvePageParams(fixture);if(!parsed.ok)throw Error('fixture');const document=parsed.document;
  document.params={query:{times:[{id:'report-month',granularity:'month',start:'2026-09',end:'2026-09'}]}};
  for(const source of Object.values(document.dataSources))if(source.source.type==='query'){source.source.query.body!.dsl_list[0].filter={time:{period:'month',param:'report-month'},dims:[],metrics:[]};delete source.source.query.filterBindings?.period;}
  document.filters=document.filters?.filter(f=>f.id!=='period');
  const filled=await createPageDataExecutor({gateway:officeGateway()}).execute(document);
  expect(filled.dataSources[root].source).toHaveProperty('initial');
  const changed=resolvePageParams(filled,{'report-month':{start:'2026-10',end:'2026-10'}});if(!changed.ok)throw Error(JSON.stringify(changed.issues));
  expect(changed.document.dataSources[root].source).not.toHaveProperty('initial');expect(changed.document.dataSources['office-meeting'].source).not.toHaveProperty('initial');
 });

 it('SourceProgram owns initial reuse and only offers persistable default-view initial updates',async()=>{
  const resolution=resolvePageParams(fixture);if(!resolution.ok)throw Error('fixture');const filled=await createPageDataExecutor({gateway:officeGateway()}).execute(resolution.document);
  const parsed=parsePage(filled);if(!parsed.ok)throw Error('filled');const page=parsed.page,calls:EffectiveQuery[]=[];const program=createSourceProgram(page,{gateway:officeGateway(calls)});
  try{
   const conditions=new Map(initialFilterValues(page.filters??[]));conditions.set('region',{type:'dimension',dimension:'region-dept-code',values:['X']});
   for await(const update of program.read({roots:[root],conditions,useInitial:true}))if(update.sourceId===root)expect(update.initial).toBeUndefined();
   expect(calls.some(query=>query.filterValues.some(v=>v.target==='dimension'&&v.queryField==='region_dept_code'&&v.values.includes('X')))).toBe(true);
   for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[]),views:new Map([[root,{...defaultSourceView(page,root),sort:[{field:'analysis-meeting-rate',direction:'desc'}]}]])}))if(update.sourceId===root)expect(update.initial).toBeUndefined();
  }finally{program.dispose();}
 });

 it('rejects numeric predicates on dimension text instead of publishing a false empty result',async()=>{expect((await read({predicates:[{field:'rep-office-name',op:'gte',value:1}]})).get(root)).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}});});

});
