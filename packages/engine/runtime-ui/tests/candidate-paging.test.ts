import { expect, it, vi } from 'vitest';
import { candidatePaging, type CandidatePageReader, type CandidatePages } from '../src/filters/candidate-paging';

function requestWindow(key:string) {
  const requests:Array<{offset:number;search:string;signal:AbortSignal;finish:(value:string)=>void}> = [];
  const reader:CandidatePageReader = {
    key, filterId:'service', sourceId:'service-options', limit:1,
    read(offset,search,signal) {
      return new Promise(resolve => requests.push({offset,search,signal,finish:value=> {
        resolve({kind:'values',candidates:[{value,label:value}],totalCount:12});
      }}));
    }
  };
  return {reader,requests};
}

it('ignores late candidate pages after a search or dependency change and deduplicates in-flight requests',async()=>{
  const first = requestWindow('region-a');
  const second = requestWindow('region-b');
  const publish = vi.fn<(page:CandidatePages)=>void>();
  const paging = candidatePaging(publish);
  paging.configure(first.reader);
  paging.setOpen(true);
  paging.more();
  expect(first.requests).toHaveLength(1);
  paging.search('new');
  expect(first.requests[0].signal.aborted).toBe(true);
  expect(first.requests[1]).toMatchObject({offset:0,search:'new'});
  paging.configure(second.reader);
  expect(first.requests[1].signal.aborted).toBe(true);
  expect(second.requests[0]).toMatchObject({offset:0,search:'new'});
  first.requests[0].finish('old');
  first.requests[1].finish('old-search');
  second.requests[0].finish('current');
  await Promise.resolve();
  expect(publish.mock.lastCall?.[0].candidates).toEqual([{value:'current',label:'current'}]);
  paging.more();
  paging.dispose();
  expect(second.requests[1].signal.aborted).toBe(true);
});

it('preloads only the first page and reuses the in-flight read when the menu opens', async () => {
  const {reader,requests} = requestWindow('region-a');
  const publish = vi.fn<(page:CandidatePages)=>void>();
  const idle: Array<() => void> = [];
  const paging = candidatePaging(publish, work => {
    idle.push(work);
    return () => { const index = idle.indexOf(work); if (index >= 0) idle.splice(index,1); };
  });
  paging.configure({...reader,preload:true});
  expect(requests).toHaveLength(0);
  idle.shift()!();
  expect(requests[0]).toMatchObject({offset:0,search:''});
  paging.setOpen(true);
  paging.more();
  expect(requests).toHaveLength(1);
  requests[0].finish('a1');
  await Promise.resolve();
  expect(publish.mock.lastCall?.[0].candidates).toEqual([{value:'a1',label:'a1'}]);
  paging.more();
  expect(requests[1]).toMatchObject({offset:1,search:''});
  paging.setOpen(false);
  const next = requestWindow('region-b');
  paging.configure({...next.reader,preload:true});
  expect(requests[1].signal.aborted).toBe(true);
  idle.shift()!();
  expect(next.requests[0]).toMatchObject({offset:0,search:''});
  requests[1].finish('a2');
  await Promise.resolve();
  expect(publish.mock.lastCall?.[0].candidates).toEqual([]);
  paging.dispose();
  expect(next.requests[0].signal.aborted).toBe(true);
});

it('keeps an open menu idle until its dependencies are ready', () => {
  const {reader,requests} = requestWindow('ready');
  const paging = candidatePaging(() => {});
  paging.configure({...reader,key:'waiting',waiting:true});
  paging.setOpen(true);
  paging.search('model');
  expect(requests).toHaveLength(0);
  paging.configure(reader);
  expect(requests[0]).toMatchObject({offset:0,search:'model'});
  paging.dispose();
});
