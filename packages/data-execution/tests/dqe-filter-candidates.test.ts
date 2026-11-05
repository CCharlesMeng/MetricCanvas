import {expect,it,vi} from 'vitest';
import {createDqeGateway} from '../src/dqe/dqe';
import type {FilterCandidatesRequest} from '../src/ports';
const request:FilterCandidatesRequest={filterId:'region',dimension:'region-dept-code',level:'region-dept',constraints:{dimensions:{},times:{}}};
it('loads real HTTP candidates with declared levels and forwards the same endpoint, auth and predicates',async()=>{
 const fetchImpl=vi.fn(async()=>Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',data:[{'region-dept-code':'REAL-DEPT','region-dept-code__label':'真实地区部'}],total_count:1}]}));
 const gateway=createDqeGateway({endpoint:'https://intranet.invalid/execute',headers:{'x-integration-test':'candidate'},credentials:'include',fetchImpl});
 const controller=new AbortController();
 expect(await gateway.fetchFilterCandidates(request,{signal:controller.signal})).toEqual({kind:'values',candidates:[{value:'REAL-DEPT',label:'真实地区部',level:'region-dept'}]});
 expect(fetchImpl.mock.calls[0]).toMatchObject(['https://intranet.invalid/execute',{headers:expect.objectContaining({'x-integration-test':'candidate'}),credentials:'include'}]);
});
it('does not drop unsupported time/boolean dependencies or broaden an empty dimension intersection',async()=>{
 const fetchImpl=vi.fn(async()=>{throw Error('must not send');});
 const gateway=createDqeGateway({fetchImpl});const signal=new AbortController().signal;
 expect(await gateway.fetchFilterCandidates({...request,constraints:{dimensions:{},times:{month:{from:'2026-10',to:'2026-10'}}}},{signal})).toEqual({kind:'unavailable'});
 expect(await gateway.fetchFilterCandidates({...request,constraints:{dimensions:{},times:{},booleans:{key:false}}},{signal})).toEqual({kind:'unavailable'});
 expect(await gateway.fetchFilterCandidates({...request,constraints:{dimensions:{parent:[]},times:{}}},{signal})).toEqual({kind:'values',candidates:[]});
 const controller=new AbortController();controller.abort();
 await expect(gateway.fetchFilterCandidates(request,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
 expect(fetchImpl).not.toHaveBeenCalled();
});
