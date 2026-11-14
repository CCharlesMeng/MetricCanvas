import {afterEach,expect,it,vi} from 'vitest';
import type {FilterDeclaration} from '@metriccanvas/page/internal';
import {resolveFinalizationDates,type FinalizationSourceDefinition} from '../src/finalization';
import type {RuntimeDataGateway,DataGatewayResult} from '../src/ports';
import {createAuthRequiredGateway} from '../../engine/runtime-ui/src/auth-required';

const source:FinalizationSourceDefinition={body:{dsl_list:[{output_dims:['名称','日期'],filter:{}}]},nameField:'名称',dateField:'日期'};
const result:DataGatewayResult={rows:[{name:'经营数据',date:'2026-04-18'},{name:'合同数据',date:'2026-03-18'}],totalCount:2};
const now=new Date(2026,10,14,12);
function page(id='first',name='经营数据',schemaVersion='6.120') {
  const filters:FilterDeclaration[]=[{id:'mtime',type:'timePoint',granularity:'date',default:{finalizationName:name}}];
  return {id,schemaVersion,filters};
}
function gateway():RuntimeDataGateway {return {finalizationSource:structuredClone(source),fetchData:vi.fn(async()=>structuredClone(result))};}
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
afterEach(()=>vi.useRealTimers());

it('shares completed results across page names for four hours, then reloads',async()=>{
  vi.useFakeTimers();vi.setSystemTime(now);
  const base=gateway();
  expect((await resolveFinalizationDates(page(),base,now)).get('经营数据')).toBe('2026-04-18');
  expect((await resolveFinalizationDates(page('second','合同数据'),base,now)).get('合同数据')).toBe('2026-03-18');
  expect(base.fetchData).toHaveBeenCalledTimes(1);
  vi.setSystemTime(now.getTime()+4*60*60*1000);
  await resolveFinalizationDates(page(),base,now);expect(base.fetchData).toHaveBeenCalledTimes(2);
});
it('does not merge simultaneous page misses; cancelling one page leaves the other independent',async()=>{
  const first=deferred<DataGatewayResult>(),second=deferred<DataGatewayResult>(),base=gateway(),controller=new AbortController();
  base.fetchData=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const abandoned=resolveFinalizationDates(page(),base,now,controller.signal);
  const live=resolveFinalizationDates(page('second'),base,now);
  expect(base.fetchData).toHaveBeenCalledTimes(2);
  const rejection=expect(abandoned).rejects.toThrow('page disposed');controller.abort(new Error('page disposed'));await rejection;
  second.resolve(result);expect((await live).get('经营数据')).toBe('2026-04-18');
  first.resolve({rows:[{name:'经营数据',date:'2026-01-01'}],totalCount:1});await Promise.resolve();
  expect((await resolveFinalizationDates(page('third'),base,now)).get('经营数据')).toBe('2026-04-18');
  expect(base.fetchData).toHaveBeenCalledTimes(2);
});
it('does not cache failed lookups or the current-date fallback',async()=>{
  const base=gateway();base.fetchData=vi.fn().mockRejectedValueOnce(new Error('transport')).mockResolvedValue(result);
  expect((await resolveFinalizationDates(page(),base,now)).get('经营数据')).toBe('2026-11-14');
  expect((await resolveFinalizationDates(page(),base,now)).get('经营数据')).toBe('2026-04-18');
  expect(base.fetchData).toHaveBeenCalledTimes(2);
});
it('does not cache partial or malformed tables, or a missing business name',async()=>{
  for(const response of [{rows:result.rows,totalCount:3},{rows:[...result.rows,{name:'其他数据',date:'invalid'}],totalCount:3},{rows:[],totalCount:0}]){
    const base=gateway();base.fetchData=vi.fn().mockResolvedValue(response);
    await resolveFinalizationDates(page(),base,now);await resolveFinalizationDates(page(),base,now);
    expect(base.fetchData).toHaveBeenCalledTimes(2);
  }
  const base=gateway();await resolveFinalizationDates(page(),base,now);
  await resolveFinalizationDates(page('missing','未提供的定稿名称'),base,now);expect(base.fetchData).toHaveBeenCalledTimes(2);
});
it('separates gateway sessions and reloads after source configuration changes',async()=>{
  const first=gateway(),second=gateway();
  await resolveFinalizationDates(page(),first,now);await resolveFinalizationDates(page(),second,now);
  expect(first.fetchData).toHaveBeenCalledTimes(1);expect(second.fetchData).toHaveBeenCalledTimes(1);
  first.finalizationSource!.nameField='新的名称字段';
  await resolveFinalizationDates(page(),first,now);expect(first.fetchData).toHaveBeenCalledTimes(2);
});
it('reuses the one session cache through new page wrappers and invalidates it on authentication failure',async()=>{
  const base=gateway(),first=createAuthRequiredGateway(base,()=>{});
  await resolveFinalizationDates(page(),first.gateway,now);first.dispose();
  const second=createAuthRequiredGateway(base,()=>{});
  await resolveFinalizationDates(page('second'),second.gateway,now);expect(base.fetchData).toHaveBeenCalledTimes(1);
  vi.mocked(base.fetchData).mockRejectedValueOnce(Object.assign(new Error('authentication'),{detail:{status:419}}));
  await expect(second.gateway.fetchData({language:'dqe',body:source.body,fieldMappings:{},filterValues:[]})).rejects.toHaveProperty('detail.status',419);
  await resolveFinalizationDates(page('third'),second.gateway,now);expect(base.fetchData).toHaveBeenCalledTimes(3);second.dispose();
});
it('discards an in-flight cache write after session invalidation',async()=>{
  const receipt=deferred<DataGatewayResult>(),base=gateway(),session=createAuthRequiredGateway(base,()=>{});
  base.fetchData=vi.fn().mockReturnValueOnce(receipt.promise).mockRejectedValueOnce(Object.assign(new Error('authentication'),{detail:{status:419}})).mockResolvedValue(result);
  const pending=resolveFinalizationDates(page(),session.gateway,now);
  await Promise.resolve();
  await expect(session.gateway.fetchData({language:'dqe',body:source.body,fieldMappings:{},filterValues:[]})).rejects.toHaveProperty('detail.status',419);
  receipt.resolve(result);await pending;
  await resolveFinalizationDates(page('second'),session.gateway,now);expect(base.fetchData).toHaveBeenCalledTimes(3);session.dispose();
});
it('keeps older pages on their original uncached path',async()=>{
  const base=gateway();
  await resolveFinalizationDates(page('first','经营数据','6.119'),base,now);
  await resolveFinalizationDates(page('second','经营数据','6.119'),base,now);expect(base.fetchData).toHaveBeenCalledTimes(2);
});
