import {describe,it,expect} from 'vitest';
import {createFilterState,type FilterValue} from '../src/filter-state';
import type {FilterDeclaration} from '@metriccanvas/page/internal';
import {filterCandidatesRequest,validFilterCandidates,candidateContextKey} from '../src/filter-candidates';
const dim=(dimension:string,...values:string[]):FilterValue=>({type:'dimension',dimension,values});
describe('business selection and dependencies share coordinator',()=>{
  it('rejects an entire group for a disabled enum or invalid single/required choice',()=>{
    const defs:FilterDeclaration[]=[{id:'choice',type:'dimension',dimension:'kind',options:[{value:'1',label:'是'},{value:'0',label:'否',disabled:true}],selection:{mode:'single',required:true}},{id:'note',type:'search'}];
    const state=createFilterState(new Map([['choice',dim('kind','1')]]),defs);let calls=0;state.subscribe(()=>calls++);
    state.writeMany([['note',{type:'search',query:'changed'}],['choice',dim('kind','0')]]);expect(calls).toBe(1);expect(state.toURL()).not.toContain('changed');
    state.write('choice',null);state.write('choice',dim('kind','1','0'));expect(calls).toBe(1);
    expect(()=>createFilterState(new Map([['choice',dim('kind','0')]]),defs)).toThrow();
  });
  it('intersects only a current complete ready receipt; empty intersection stays gated until explicit clear',()=>{
    const defs:FilterDeclaration[]=[{id:'month',type:'timePoint',granularity:'month',disableFuture:false},{id:'model',type:'dimension',dimension:'model',candidateContext:{filterIds:['month'],reconcile:'intersection'}}];
    const state=createFilterState(new Map([['month',{type:'timePoint',granularity:'month',value:'2026-08'}],['model',dim('model','A','B')]]),defs,new Map(),{candidates:true});
    state.candidate('model','ready',['A','B']);expect([...state.blocked()]).toEqual([]);
    state.write('month',{type:'timePoint',granularity:'month',value:'2026-09'});expect(state.blocked().has('model')).toBe(true);
    state.candidate('model','denied');expect(state.toURL()).toContain('A');
    state.candidate('model','ready',['B','C']);expect(state.toURL()).not.toContain('model=A');expect(state.toURL()).toContain('model=B');expect([...state.blocked()]).toEqual([]);
    state.write('month',{type:'timePoint',granularity:'month',value:'2026-10'});state.candidate('model','ready',['C']);expect(state.blocked().has('model')).toBe(true);
    state.candidate('model','ready',['C']);expect(state.blocked().has('model')).toBe(true);
    state.write('model',null);expect([...state.blocked()]).toEqual([]);
  });
  it('keeps a target empty level for the explicit structure tree',()=>{
    const defs:FilterDeclaration[]=[{id:'tree',type:'dimension',dimension:'department',display:'tree',treeSelection:'level',hierarchy:[{id:'d',dimension:'department'},{id:'o',dimension:'office'}]}];
    const state=createFilterState(undefined,defs);state.write('tree',{type:'dimension',dimension:'office',level:'o',values:[]});expect(state.toURL()).toContain('tree.level=o');
  });
  it('projects actual month/range and full ancestry identity without parsing business codes',()=>{
    const defs:FilterDeclaration[]=[{id:'month',type:'timePoint',granularity:'month'},{id:'region',type:'dimension',dimension:'geo'},{id:'model',type:'dimension',dimension:'model',candidateContext:{filterIds:['month','region'],reconcile:'clear'}}];
    const model=defs[2];if(model.type!=='dimension')throw Error();
    const values=new Map([['month',{type:'timePoint',granularity:'month',value:'2026-09'}],['region',dim('geo','CN')]] as Array<[string,FilterValue]>);
    expect(filterCandidatesRequest(model,defs,values).constraints).toEqual({dimensions:{geo:['CN']},times:{month:{from:'2026-09',to:'2026-09'}}});
    const old=candidateContextKey(model,defs,values);values.set('month',{type:'timePoint',granularity:'month',value:'2026-08'});expect(candidateContextKey(model,defs,values)).not.toBe(old);
    expect(validFilterCandidates([{level:'d',value:'same',label:'部门'},{level:'o',value:'same',label:'代表处',parent:{level:'d',value:'same'}}],['d','o'])).toBe(true);
    expect(validFilterCandidates([{level:'d',value:'bad',label:'坏',parent:{level:'d',value:'bad'}}],['d','o'])).toBe(false);
  });
});

it('a ready descendant cannot run before its intersection ancestor becomes trustworthy',()=>{
  const defs:FilterDeclaration[]=[{id:'month',type:'timePoint',granularity:'month',disableFuture:false},{id:'a',type:'dimension',dimension:'a',candidateContext:{filterIds:['month'],reconcile:'intersection'}},{id:'b',type:'dimension',dimension:'b',candidateContext:{filterIds:['a'],reconcile:'intersection'}}];
  const state=createFilterState(new Map([['month',{type:'timePoint',granularity:'month',value:'2026-08'}],['a',dim('a','A')],['b',dim('b','B')]]),defs,new Map(),{candidates:true});
  state.candidate('a','ready',['A']);state.candidate('b','ready',['B']);expect([...state.blocked()]).toEqual([]);
  state.write('month',{type:'timePoint',granularity:'month',value:'2026-09'});state.candidate('b','ready',['B']);expect(state.blocked().has('b')).toBe(true);state.candidate('a','denied');expect(state.blocked().has('b')).toBe(true);
  state.candidate('a','ready',['A']);expect([...state.blocked()]).toEqual([]);
});
