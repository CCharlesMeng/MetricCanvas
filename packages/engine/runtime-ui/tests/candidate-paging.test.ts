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
