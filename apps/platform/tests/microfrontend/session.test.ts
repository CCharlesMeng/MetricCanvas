import {describe,it,expect,vi} from 'vitest';
import {createPlatformSession} from '../../src/lib/integration/session';
import {createPageAssetServices} from '../../src/lib/page-assets';
import {isPlatformPath,normalizeRouteBase,platformPath} from '../../src/lib/integration/navigation';
const config = {pageMetadataBaseUrl:'/java',dqeEndpoint:'',authToken:'token-1',operatorId:'a',workspaceId:'w'};
describe('platform instance boundary',()=>{
 it('refreshes credentials per request and isolates separate readers without requiring DQE',async()=>{
  let first={...config};const headers:string[]=[];
  const fetchImpl=vi.fn(async (_input:RequestInfo|URL,init?:RequestInit)=>{headers.push(new Headers(init?.headers).get('X-Auth-Token')!);return Response.json({retCode:'CBC.0000',total:0,page_metadata_list:[]});});
  const a=createPlatformSession({readConfig:()=>first,fetchImpl});
  const b=createPlatformSession({readConfig:()=>({...config,authToken:'token-b'}),fetchImpl});
  const aa=createPageAssetServices({readConfig:a.readConfig,fetchImpl:a.fetchImpl});
  const bb=createPageAssetServices({readConfig:b.readConfig,fetchImpl:b.fetchImpl});
  await aa.pageAssets.list({page:1,pageSize:20});first={...first,authToken:'token-2'};await aa.pageAssets.list({page:1,pageSize:20});await bb.pageAssets.list({page:1,pageSize:20});
  expect(headers).toEqual(['token-1','token-2','token-b']);expect(a.isActive()).toBe(true);a.destroy();b.destroy();
 });
 it.each(['operatorId','workspaceId','pageMetadataBaseUrl','dqeEndpoint'] as const)('invalidates on %s before any new send and unsubscribes once',async field=>{
  let current={...config};let changed=()=>{};const off=vi.fn(),event=vi.fn(),fetchImpl=vi.fn();
  const session=createPlatformSession({readConfig:()=>current,fetchImpl,onEvent:event,subscribeConfig:fn=>{changed=fn;return off;}});
  current={...current,[field]:'changed'};changed();
  await expect(session.fetchImpl('/test')).rejects.toThrow('会话不可用');
  expect(fetchImpl).not.toHaveBeenCalled();expect(event).toHaveBeenCalledWith(expect.objectContaining({code:'session-invalidated'}));
  session.destroy();session.destroy();expect(off).toHaveBeenCalledTimes(1);
 });
 it('aborts an outstanding request and never accepts a late response after logout',async()=>{
  let current:typeof config|null={...config};let finish!:(response:Response)=>void;let signal:AbortSignal|undefined|null;
  const session=createPlatformSession({readConfig:()=>current,fetchImpl:async(_input,init)=>{signal=init?.signal;return new Promise(resolve=>{finish=resolve;});}});
  const pending=session.fetchImpl('/java');current=null;expect(session.readConfig()).toBeNull();expect(signal?.aborted).toBe(true);
  finish(Response.json({ok:true}));await expect(pending).rejects.toThrow('旧请求结果不可用');
 });
 it('does not interpret token refresh as an identity change and reports 401 without retry',async()=>{
  const events=vi.fn();const fetchImpl=vi.fn(async()=>new Response(null,{status:401}));
  const session=createPlatformSession({readConfig:()=>config,fetchImpl,onEvent:events});
  expect((await session.fetchImpl('/java')).status).toBe(401);expect(fetchImpl).toHaveBeenCalledTimes(1);expect(events).toHaveBeenCalledWith(expect.objectContaining({code:'login-required'}));session.destroy();
 });
 it('normalizes path prefixes and encodes opaque page identifiers',()=>{
  expect(normalizeRouteBase('/metrics/')).toBe('/metrics');
  expect(isPlatformPath('/metrics-other','/metrics')).toBe(false);
  expect(isPlatformPath('/metrics/manage','/metrics')).toBe(true);
  expect(platformPath('/metrics','/manage/pages/[pageId]',{pageId:'a/b'})).toBe('/metrics/manage/pages/a%2Fb');
  expect(()=>normalizeRouteBase('/metrics/../other')).toThrow();
 });
});
