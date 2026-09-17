import {expect,it,vi} from 'vitest';
import fixture from '../../../../packages/page/fixtures/contract-valid/inline-params-values-page.json';
import {resolvePageParams} from '@metriccanvas/page';
import {createInlineParameterPublication} from '../../src/lib/workbench/inline-parameter-publication';
function setup(status:'queued'|'unknown'|'confirmed'='queued'){
  const r=resolvePageParams(fixture);if(!r.ok)throw Error('fixture');
  const source=structuredClone(r.resolvedPage);delete source.params;
  source.sections[0].components=[{id:'title',type:'text',layout:{span:12},props:{body:'Tokens'}}];
  let key='r1';const save=vi.fn(async(_document:any,_key:string)=>({status}));
  const preview=vi.fn(async(p:unknown)=>p);
  const api=createInlineParameterPublication({sourceKey:()=>key,readVerifiedSource:async()=>({document:source,baseline:key}),preview,save});
  return {api,save,preview,edit:()=>{key='r2';api.invalidate();}};
}
it('requires current preview, saves only the unfilled template once, and does not call queued a publication',async()=>{
  const f=setup();await f.api.prepare();
  f.api.select(f.api.snapshot().extraction!.candidates.map(c=>c.id));
  await f.api.confirmAndPublish();expect(f.save).not.toHaveBeenCalled();
  await f.api.preview();await f.api.confirmAndPublish();await f.api.confirmAndPublish();
  expect(f.save).toHaveBeenCalledTimes(1);expect(f.api.snapshot().phase).toBe('queued');
  expect(f.save.mock.calls[0][0].params.every((p:any)=>!('value'in p)&&!('default'in p))).toBe(true);
});
it('invalidates preview on input, selection and source change',async()=>{
  const f=setup();await f.api.prepare();f.api.select(f.api.snapshot().extraction!.candidates.map(c=>c.id));await f.api.preview();
  f.api.setInputs({wrong:'x'});await f.api.confirmAndPublish();expect(f.save).not.toHaveBeenCalled();
  f.edit();await f.api.preview();expect(f.api.snapshot().phase).toBe('stale');
});
it.each(['unknown','confirmed'] as const)('uses the actual %s result without retrying the save',async status=>{
  const f=setup(status);await f.api.prepare();await f.api.preview();await f.api.confirmAndPublish();
  await f.api.confirmAndPublish();await f.api.prepare();f.api.cancel();
  expect(f.save).toHaveBeenCalledTimes(1);
  expect(f.api.snapshot().phase).toBe(status==='confirmed'?'published':'unknown');
});
it('cancellation discards an in-flight preview and never authorizes saving',async()=>{
  const f=setup();await f.api.prepare();
  let finish!:(p:unknown)=>void;f.preview.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const pending=f.api.preview();f.api.cancel();finish({rows:[]});await pending;
  await f.api.confirmAndPublish();expect(f.save).not.toHaveBeenCalled();expect(f.api.snapshot().phase).toBe('idle');
});
