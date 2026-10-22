import {expect,it} from 'vitest';
import fixture from '../../../pages/capabilities/table/multi-query-table.json';
import {parsePage} from '../../../packages/page/src';
import {createDqeGateway} from '../../../packages/data-execution/src/dqe';
import {createSourceProgram,defaultSourceView,initialFilterValues} from '../../../packages/data-execution/src/runtime';
import {createDqeSimServer,DQE_EXECUTE_PATH} from '../src/server';
it('executes selection/fill, complete cross-source filters and complete export through HTTP DQE encoding',async()=>{
 const server=createDqeSimServer({logger:false});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('server');
 const parsed=parsePage(fixture);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));const page=parsed.page;let root='office-overview';
 const program=createSourceProgram(page,{gateway:createDqeGateway({endpoint:`http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`})});
 let view=defaultSourceView(page,root);
 async function read(purpose:'screen'|'complete'='screen'){
  let result:import('../../../packages/page/src/internal').DataSnapshot|undefined;
  for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[]),views:new Map([[root,view]]),purpose,freshness:'refresh'}))if(update.sourceId===root)result=update.snapshot;
  return result;
 }
 try {
  expect(await read()).toMatchObject({status:'ready',totalCount:8,rows:[{'rep-office-code':'SH-01'},{'rep-office-code':'BJ-01'},{'rep-office-code':'GD-01'}]});
  view={...view,sort:[{field:'analysis-meeting-rate',direction:'desc'}]};
  expect(await read()).toMatchObject({status:'ready',totalCount:8,rows:[{'rep-office-code':'SH-01'},{'rep-office-code':'SZ-01'},{'rep-office-code':'BJ-01'}]});
  const full=await read('complete');expect(full?.status==='ready'&&full.rows.length).toBe(8);
  view={...view,predicates:[{field:'bidding-amount',op:'gte',value:150000000}]};expect(await read()).toMatchObject({status:'ready',totalCount:3});
  view={...view,predicates:[{field:'analysis-meeting-rate',op:'gte',value:85}]};expect(await read()).toMatchObject({status:'ready',totalCount:2});
  root='office-overview-fixed-rank';view={...defaultSourceView(page,root),sort:[{field:'analysis-meeting-rate',direction:'desc'}]};
  expect(await read()).toMatchObject({status:'ready',totalCount:8,rows:[{'rep-office-code':'SH-01','bidding-rank':1},{'rep-office-code':'SZ-01','bidding-rank':4},{'rep-office-code':'BJ-01','bidding-rank':2}]});
  view={...view,pageIndex:1};
  expect(await read()).toMatchObject({status:'ready',rows:[{'rep-office-code':'HZ-01','bidding-rank':5},{'rep-office-code':'CD-01','bidding-rank':6},{'rep-office-code':'GD-01','bidding-rank':3}]});
  view={...view,pageIndex:0,predicates:[{field:'analysis-meeting-rate',op:'gte',value:85}]};
  expect(await read()).toMatchObject({status:'ready',totalCount:2,rows:[{'rep-office-code':'SH-01','bidding-rank':1},{'rep-office-code':'SZ-01','bidding-rank':4}]});
  view={...view,predicates:[],search:{query:'天津',fields:['rep-office-name']}};
  expect(await read('complete')).toMatchObject({status:'ready',totalCount:1,rows:[{'rep-office-code':'TJ-01','bidding-rank':8}]});
 }finally{program.dispose();server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

it('the copy-ready real-acceptance CLI mechanics run against Sim without claiming real evidence',async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const server=createDqeSimServer({logger:false});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('server');
 try{const result=await promisify(execFile)(process.execPath,['--import','tsx','tools/scripts/verify-paged-join-real.ts','pages/capabilities/table/multi-query-table.json','office-overview'],{env:{...process.env,METRICCANVAS_DQE_ENDPOINT:`http://127.0.0.1:${address.port}${DQE_EXECUTE_PATH}`,METRICCANVAS_DQE_HEADERS:'{}'},timeout:60000});const receipt=JSON.parse(result.stdout);expect(receipt.status).toBe('PASS');expect(receipt.domainRows).toBe(8);expect(receipt.results.find((v:{case:string})=>v.case==='complete-export')).toMatchObject({rows:8,passed:true});}
 finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
