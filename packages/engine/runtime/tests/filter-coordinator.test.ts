import { describe,expect,it,vi } from 'vitest';
import type { FilterDeclaration } from '@metriccanvas/page/internal';
import { createFilterState,type FilterValue,type FilterValues } from '../src/filter-state';
const declarations:FilterDeclaration[]=[{id:'a',type:'dimension',dimension:'a'},{id:'b',type:'dimension',dimension:'b',dependsOn:'a'},{id:'c',type:'dimension',dimension:'c',dependsOn:'b'},{id:'flag',type:'boolean'},{id:'month',type:'timePoint',granularity:'month',required:true,disableFuture:false,default:'2026-09'}];
const dim=(id:string,values=['1']):FilterValue=>({type:'dimension',dimension:id,values});
const initial=()=>new Map<string,FilterValue>([['a',dim('a')],['b',dim('b')],['c',dim('c')],['month',{type:'timePoint',granularity:'month',value:'2026-09'}]]);
describe('shared FilterCoordinator',()=>{
  it('rejects a mixed group including malformed runtime values without changing revision/state or throwing',()=>{
    const state=createFilterState(initial(),declarations),push=vi.fn();state.subscribe(push);
    const invalid=[{type:'boolean',value:'false'},{type:'search',query:0},{type:'dimension',dimension:'x',values:['2']}];
    for(const value of invalid)expect(state.commit({type:'applyDraft',changes:[['a',dim('a',['2'])],['flag',value as FilterValue]]}).ok).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);expect(state.commit({type:'clear',filterId:'month'}).ok).toBe(false);
    expect(()=>createFilterState(new Map([['flag',{type:'boolean',value:'bad'} as unknown as FilterValue]]),declarations)).toThrow();
    expect(state.commit({type:'set',filterId:'flag',value:{type:'boolean',value:false}})).toMatchObject({ok:true,filterRevision:1});
  });
  it('recursively clears in one notification across old write/writeMany and requires explicit confirmation',()=>{
    const state=createFilterState(initial(),declarations);let values:FilterValues=new Map();const push=vi.fn(next=>values=next);state.subscribe(push);
    state.write('a',dim('a',['2']));expect(push).toHaveBeenCalledTimes(2);expect(values.has('b')).toBe(false);expect(values.has('c')).toBe(false);expect([...state.blocked()]).toEqual(['b','c']);
    state.writeMany([['b',null],['c',null]]);expect([...state.blocked()]).toEqual([]);expect(push).toHaveBeenCalledTimes(3);
  });
  it('checks readonly for every user intent while allowing validated restore',()=>{
    const state=createFilterState(initial(),declarations,new Map(),{readOnly:()=>true});const push=vi.fn();state.subscribe(push);
    state.write('a',dim('a',['2']));state.writeMany([['a',null]]);expect(push).toHaveBeenCalledTimes(1);
    expect(state.commit({type:'restore',values:initial()}).ok).toBe(true);
  });
  it('gates selected defaults until complete current candidates and preserves discrete month values',()=>{
    const state=createFilterState(initial(),declarations,new Map(),{candidates:true});expect(state.blocked().has('a')).toBe(true);
    state.candidate('a','ready',['1']);expect(state.blocked().has('a')).toBe(false);state.candidate('a','error');expect(state.blocked().has('a')).toBe(true);
    const months=createFilterState(undefined,[{id:'months',type:'dimension',dimension:'month_code'}]);months.write('months',dim('month_code',['2026-01','2026-03']));expect(months.toURL()).toBe('months=2026-01&months=2026-03');
  });
});
