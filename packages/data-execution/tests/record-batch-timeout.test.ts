import fs from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot,EffectiveQuery} from '@metriccanvas/page/internal';
import type {DataGateway} from '../src/ports';
import {createSourceProgram,initialFilterValues} from '../src/runtime';
import {createRejectionPreview} from '../../../apps/playground/fixtures/rejection-details/gateway';

const document=JSON.parse(fs.readFileSync(new URL('../../../pages/capabilities/table/record-join-batch-timeout.json',import.meta.url),'utf8'));
const root='rejection-overview';
function setup(gateway:DataGateway,timeoutMs=1000){
  const parsed=parsePage(document);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,source=page.dataSources[root].source;
  if(source.type!=='pagedJoin')throw Error('join');
  source.records!.timeoutMs=timeoutMs;
  const program=createSourceProgram(page,{gateway});
  async function read(signal?:AbortSignal){
    let snapshot:DataSnapshot|undefined;
    for await(const update of program.read({roots:[root],conditions:initialFilterValues(page.filters??[]),signal}))if(update.sourceId===root)snapshot=update.snapshot;
    return snapshot;
  }
  return {program,read};
}
function isTarget(query:EffectiveQuery,member:'main'|'supplement'){
  if(member==='main')return 'approval-stage' in query.fieldMappings&&(query.pagination?.offset??0)>=2;
  return !('approval-stage' in query.fieldMappings);
}

describe('records per-batch timeout',()=>{
  it('completes main and supplement batches whose cumulative wait exceeds timeoutMs',async()=>{
    const preview=createRejectionPreview({rows:12,delayMs:250}),test=setup(preview.dataGateway);
    try{
      const start=performance.now();
      expect(await test.read()).toMatchObject({status:'ready',totalCount:12});
      expect(performance.now()-start).toBeGreaterThan(1000);
      expect(preview.calls.filter(query=>'approval-stage' in query.fieldMappings)).toHaveLength(6);
      expect(preview.calls.filter(query=>!('approval-stage' in query.fieldMappings))).toHaveLength(3);
      await test.read();
      expect(preview.calls).toHaveLength(9);
    }finally{test.program.dispose();}
  });

  it.each(['main','supplement'] as const)('rejects a slow %s batch, ignores its late result, and retries from the start',async member=>{
    const preview=createRejectionPreview({rows:12});
    let release!:()=>void,blocked=false,aborted=false;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const gateway:DataGateway={async fetchData(query,context,signal){
      if(!blocked&&isTarget(query,member)){
        blocked=true;
        signal?.addEventListener('abort',()=>{aborted=true;},{once:true});
        await gate; // Intentionally ignores cancellation to exercise late upstream replies.
        return preview.dataGateway.fetchData(query,context);
      }
      return preview.dataGateway.fetchData(query,context,signal);
    }};
    const test=setup(gateway,30);
    try{
      expect(await test.read()).toMatchObject({status:'error',error:{code:'DQE_TIMEOUT'}});
      expect(aborted).toBe(true);
      expect(await test.read()).toMatchObject({status:'ready',totalCount:12});
      expect(preview.calls.filter(query=>'approval-stage' in query.fieldMappings&&query.pagination?.offset===0)).toHaveLength(2);
      release();await gate;await new Promise(resolve=>setTimeout(resolve,0));
      const calls=preview.calls.length;
      expect(await test.read()).toMatchObject({status:'ready',totalCount:12});
      expect(preview.calls).toHaveLength(calls);
    }finally{release();test.program.dispose();}
  });

  it('keeps caller cancellation effective during a supplement request',async()=>{
    const preview=createRejectionPreview({rows:12}),controller=new AbortController();
    const gateway:DataGateway={async fetchData(query,context,signal){
      if(!('approval-stage' in query.fieldMappings))controller.abort();
      return preview.dataGateway.fetchData(query,context,signal);
    }};
    const test=setup(gateway);
    try{await expect(test.read(controller.signal)).rejects.toBeDefined();}
    finally{test.program.dispose();}
  });
});
