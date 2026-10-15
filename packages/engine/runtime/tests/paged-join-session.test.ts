import {expect,it} from 'vitest';
import fixture from '../../../page/fixtures/contract-valid/paged-join-page.json';
import {officeGateway} from '../../../data-execution/tests/fixtures/office-gateway';
import {parsePage,resolvePageParams} from '@metriccanvas/page';
import type {DataSnapshot,EffectiveQuery,Page,Row} from '@metriccanvas/page/internal';
import {orchestrate,type PageDataSnapshots} from '../src/orchestrator';
import {createPageDataExecutor} from '@metriccanvas/data-execution';
const root='office-overview';const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function page():Page {const p=parsePage(fixture);if(!p.ok)throw Error(JSON.stringify(p.errors));return p.page;}
function keys(s:DataSnapshot|undefined){return s?.status==='ready'?s.rows.map(row=>row['rep-office-code']):[];}
it('two tables share definitions and requests but commit independent views; ordinary graph stays complete',async()=>{
 const p=page(),clone=structuredClone(p.dataSources[root]);p.dataSources.other=clone;
 const table=p.sections[0].components.find(c=>c.type==='table');if(!table)throw Error('table');p.sections[0].components.push({...structuredClone(table),id:'other-table',data:{main:'other'}});
 expect(parsePage(p).ok).toBe(true);
 const calls:EffectiveQuery[]=[],gateway=officeGateway(calls);let snapshots:PageDataSnapshots=new Map();
 const stream=orchestrate(p,gateway),stop=stream.subscribe(next=>snapshots=next);await flush();
 expect(keys(snapshots.get(root))).toEqual(keys(snapshots.get('other')));
 expect(calls.filter(q=>q.pagination&&'bidding-amount' in q.fieldMappings)).toHaveLength(1);
 stream.setQuerySort(root,[{field:'analysis-meeting-rate',direction:'desc'}]);await flush();
 expect(keys(snapshots.get(root))).toEqual(['SH-01','SZ-01','BJ-01']);expect(keys(snapshots.get('other'))).toEqual(['SH-01','BJ-01','GD-01']);
 expect(keys(snapshots.get('office-meeting'))).toHaveLength(8);
 stream.setQuerySort(root,[]);await flush();expect(stream.getQueryView(root)?.sort).toEqual([{field:'bidding-amount',direction:'desc'}]);expect(keys(snapshots.get(root))).toEqual(['SH-01','BJ-01','GD-01']);
 stream.setQueryPage(root,99);await flush();expect(stream.getQueryView(root)?.pageIndex).toBe(2);expect(keys(snapshots.get(root))).toHaveLength(2);stop();
});
it('late selection error cannot overwrite a newer sort and subsequent page',async()=>{
 const gateway=officeGateway();let resolveOld:(result:{rows:Row[];totalCount:number})=>void=()=>{};let oldSignal:AbortSignal|undefined;
 const slow={fetchData(query:EffectiveQuery,_context:unknown,signal?:AbortSignal){if(query.pagination&&'bidding-amount' in query.fieldMappings){oldSignal=signal;return new Promise<{rows:Row[];totalCount:number}>(resolve=>resolveOld=resolve);}return gateway.fetchData(query);}};
 let snapshots:PageDataSnapshots=new Map();const stream=orchestrate(page(),slow),stop=stream.subscribe(next=>snapshots=next);
 stream.setQuerySort(root,[{field:'analysis-meeting-rate',direction:'desc'}]);await flush();stream.setQueryPage(root,1);await flush();
 expect(oldSignal?.aborted).toBe(true);expect(keys(snapshots.get(root))).toEqual(['HZ-01','CD-01','GD-01']);
 resolveOld({rows:[],totalCount:0});await flush();expect(stream.getQueryView(root)?.pageIndex).toBe(1);expect(keys(snapshots.get(root))).toEqual(['HZ-01','CD-01','GD-01']);stop();
});
it('matching combination initial is consumed even if ordinary member initial is missing',async()=>{
 const resolved=resolvePageParams(fixture);if(!resolved.ok)throw Error('fixture');
 const output=await createPageDataExecutor({gateway:officeGateway()}).execute(resolved.document);
 const member=output.dataSources['office-meeting'].source;if(member.type!=='query')throw Error('query');delete member.initial;
 const parsed=parsePage(output);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
 const calls:EffectiveQuery[]=[];let snapshots:PageDataSnapshots=new Map();const stream=orchestrate(parsed.page,officeGateway(calls)),stop=stream.subscribe(next=>snapshots=next);
 expect(keys(snapshots.get(root))).toEqual(['SH-01','BJ-01','GD-01']);await flush();expect(calls).toHaveLength(1);expect(calls[0].pagination).toBeUndefined();stop();
});
