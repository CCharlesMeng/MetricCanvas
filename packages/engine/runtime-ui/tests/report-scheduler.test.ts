import {afterEach,expect,it,vi} from 'vitest';
import {reportScheduler} from '../src/report-scheduler';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

it('periodically allows ordinary tasks to run instead of chaining only boosted continuations',async()=>{
  vi.useFakeTimers();let now=0;
  vi.spyOn(performance,'now').mockImplementation(()=>now);
  const boosted=vi.fn(async()=>{});vi.stubGlobal('scheduler',{yield:boosted});
  const pause=reportScheduler(new AbortController().signal);
  for(let index=0;index<3;index++){now+=7;await pause();}
  expect(boosted).toHaveBeenCalledTimes(3);
  now+=7;const ordinary=pause();
  expect(vi.getTimerCount()).toBe(1);
  await vi.runAllTimersAsync();await ordinary;
  expect(boosted).toHaveBeenCalledTimes(3);
});

it('stops resumed work after instance disposal',async()=>{
  vi.useFakeTimers();let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);vi.stubGlobal('scheduler',undefined);
  const controller=new AbortController(),pause=reportScheduler(controller.signal);
  now=7;const continuation=pause();controller.abort(Error('disposed'));
  const rejected=expect(continuation).rejects.toThrow('disposed');await vi.runAllTimersAsync();await rejected;
});
