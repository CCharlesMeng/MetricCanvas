import {expect,it,vi} from 'vitest';
import {createPlatformSession} from '../../src/lib/integration/session';
import {platformFilterCandidates} from '../../src/lib/integration/filter-candidates';
const config={operatorId:'a',workspaceId:'w',dqeEndpoint:'https://example.com/dqe',pageMetadataBaseUrl:'https://example.com/pages',authToken:'token'};
const request={filterId:'model',dimension:'model',constraints:{dimensions:{},times:{}}};
it('rejects malformed ports and forwards the canonical request',async()=>{
 const session=createPlatformSession({readConfig:()=>config});expect(()=>platformFilterCandidates({},session)).toThrow();
 const fetchFilterCandidates=vi.fn(async()=>({kind:'unconfigured' as const}));await platformFilterCandidates({fetchFilterCandidates},session)!.fetchFilterCandidates(request,{signal:new AbortController().signal});expect(fetchFilterCandidates.mock.calls).toHaveLength(1);session.destroy();
});
it('cancels and rejects a late receipt after identity invalidation',async()=>{
 let current=config;const session=createPlatformSession({readConfig:()=>current});let release!:(value:{kind:'unconfigured'})=>void;let signal:AbortSignal|undefined;
 const pending=platformFilterCandidates({fetchFilterCandidates:(_request:unknown,options:{signal:AbortSignal})=>{signal=options.signal;return new Promise(resolve=>release=resolve);}},session)!.fetchFilterCandidates(request,{signal:new AbortController().signal});
 current={...config,operatorId:'b'};session.readConfig();expect(signal?.aborted).toBe(true);release({kind:'unconfigured'});await expect(pending).rejects.toThrow('失效');session.destroy();
});
