import { expect, it } from 'vitest';
import { createLastFilterRecorder, type LastFilterRequest, type LastFilterStatus, type FilterValues } from '../src';
const values = (v: string): FilterValues => new Map([['region',{type:'dimension',dimension:'region',values:[v]}]]);
const context = {actorId:'alice',workspaceId:'workspace',targetMetadata:'metadata',clientId:'instance-a'};
const flush = () => new Promise(r=>setTimeout(r,0));
it('每次变更记录固定归属/独立操作键，乱序回执不覆盖最新状态，失败不改筛选', async () => {
  const requests: LastFilterRequest[] = [], status: LastFilterStatus[] = [];
  const pending: Array<(r:unknown)=>void> = [];
  const recorder = createLastFilterRecorder(context,{recordLastFilters:r=>{requests.push(r);return new Promise(resolve=>pending.push(resolve));}},s=>status.push(s));
  const first = values('EU'), second = values('NA');
  recorder.record(first);recorder.record(second);await flush();
  expect(requests.map(r=>r.clientSequence)).toEqual([1,2]);
  expect(requests[0].operationId).not.toBe(requests[1].operationId);
  expect(requests.every(r=>r.actorId==='alice' && r.targetMetadata==='metadata')).toBe(true);
  pending[1]({status:'recorded',operationId:requests[1].operationId,clientSequence:2});await flush();
  pending[0]({status:'recorded',operationId:requests[0].operationId,clientSequence:1});await flush();
  expect(status).toEqual([{clientSequence:2,status:'recorded'}]);
  recorder.record(second);await flush();pending[2]({status:'recorded',operationId:'wrong',clientSequence:3});await flush();
  expect(status.at(-1)).toEqual({clientSequence:3,status:'failed'});
  expect(second).toEqual(values('NA'));recorder.dispose();
});
it('身份/实例切换隔离序列，卸载取消且迟到结果不通知新身份', async () => {
  const requests: LastFilterRequest[] = [], signals: AbortSignal[] = [], statuses: LastFilterStatus[] = [];
  let resolve!: (r: unknown)=>void;
  const old = createLastFilterRecorder(context,{recordLastFilters:(r,signal)=>{requests.push(r);signals.push(signal!);return new Promise(done=>{resolve=done;});}},s=>statuses.push(s));
  old.record(values('EU'));await flush();old.dispose();old.record(values('IGNORED'));
  const next = createLastFilterRecorder({...context,actorId:'bob',clientId:'instance-b'},{recordLastFilters:async r=>{requests.push(r);return {status:'recorded',operationId:r.operationId,clientSequence:r.clientSequence};}},s=>statuses.push(s));
  next.record(values('NA'));await flush();resolve({status:'recorded',operationId:requests[0].operationId,clientSequence:1});await flush();
  expect(signals[0].aborted).toBe(true);
  expect(requests.map(r=>[r.actorId,r.clientId,r.clientSequence])).toEqual([['alice','instance-a',1],['bob','instance-b',1]]);
  expect(statuses).toEqual([{clientSequence:1,status:'recorded'}]);next.dispose();
});
it('默认无历史能力如实报告，不重试/回滚；同步端口异常也隔离', async () => {
  const status: LastFilterStatus[]=[];
  const missing = createLastFilterRecorder(context,undefined,s=>status.push(s));missing.record(values('EU'));
  const failure = createLastFilterRecorder(context,{recordLastFilters(){throw new Error('offline');}},s=>status.push(s));failure.record(values('NA'));await flush();
  expect(status.map(s=>s.status)).toEqual(['unavailable','failed']);missing.dispose();failure.dispose();
});
