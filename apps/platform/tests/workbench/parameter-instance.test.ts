import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import {resolvePageParams} from '@metriccanvas/page';
import {createParameterInstanceSession,type ParameterInstancePort,type ParameterInstanceScope} from '../../src/lib/workbench/parameter-instance';

const template=JSON.parse(readFileSync('packages/page/fixtures/contract-valid/inline-params-page.json','utf8'));
const result=resolvePageParams(template,{region:'欧洲区','report-period':{start:'2026-07',end:'2026-09',granularity:'month'}});
if(!result.ok)throw Error('fixture invalid');
const document=result.document;
const disposals:Array<()=>void>=[];
afterEach(()=>{disposals.splice(0).forEach(fn=>fn());vi.useRealTimers();});
function fixture() {
  let scope:ParameterInstanceScope={contextRef:'turn',actorId:'alice',workspaceId:'w',pageId:document.id,sourceKey:'r1'};
  const record={ref:'instance-1',kind:'instance' as const,expiresAt:2000,binding:{...scope},payload:{document}};
  const port:ParameterInstancePort={read:vi.fn(async()=>structuredClone(record))};
  const api=createParameterInstanceSession({port,scope:()=>scope,clock:()=>1000});
  disposals.push(()=>api.dispose());
  let state:{document:unknown;error:string;loading:boolean}={document:null,error:'',loading:false};
  api.subscribe(s=>{state=s;});
  return {api,record,port,state:()=>state,change:()=>{scope={...scope,sourceKey:'r2'};}};
}
it('consumes only a trusted matching filled instance without changing the template or saving',async()=>{
  const f=fixture();const before=JSON.stringify(template);
  await f.api.open('instance-1');
  expect(f.state().document).toEqual(document);
  expect(f.port.read).toHaveBeenCalledWith('turn','instance-1',expect.any(AbortSignal));
  expect(JSON.stringify(template)).toBe(before);
  f.api.close();expect(f.state().document).toBeNull();
});
it('rejects wrong identity, ref, expired records and incomplete input before rendering',async()=>{
  for(const change of [
    (r:any)=>{r.binding.actorId='bob';},(r:any)=>{r.ref='other';},
    (r:any)=>{r.expiresAt=999;},(r:any)=>{r.payload.document=template;}
  ]){const f=fixture();change(f.record);await f.api.open('instance-1');expect(f.state().document).toBeNull();expect(f.state().error).not.toBe('');}
});
it('invalidates on source change and drops a late ignored-abort read',async()=>{
  const f=fixture();let finish!:(r:typeof f.record)=>void;
  f.port.read=()=>new Promise(resolve=>{finish=resolve;});
  const pending=f.api.open('instance-1');f.change();f.api.invalidate();finish(f.record);await pending;
  expect(f.state().document).toBeNull();
});
it('removes the displayed instance at expiry',async()=>{
  vi.useFakeTimers();const f=fixture();await f.api.open('instance-1');
  expect(f.state().document).not.toBeNull();vi.advanceTimersByTime(1000001);
  expect(f.state().document).toBeNull();
});
