import {expect,it} from 'vitest';
import {createTableSession} from '../src/table/session';
import { normalizeHeaderDraft } from '../../runtime-ui/src/table/controller';
it('commits once, resets pages on conditions and isolates stale correction',()=>{
 const changes:unknown[]=[];const table=createTableSession({pageIndex:0,pageSize:3,sort:[],predicates:[]},view=>changes.push(view));
 table.setPage(2);const old=table.generation;table.setSort([{field:'rate',direction:'desc'}]);expect(table.snapshot().pageIndex).toBe(0);
 expect(table.correct({...table.snapshot(),pageIndex:9},old)).toBe(false);
 const same=table.generation;table.correct({...table.snapshot(),pageSize:5},same);expect(table.generation).toBe(same);
 const frozen=table.snapshot();frozen.sort.length=0;expect(table.snapshot().sort).toHaveLength(1);
 table.setPageSize(-1);expect(table.snapshot().pageSize).toBe(5);expect(changes).toHaveLength(2);
});
it('keeps nonnumeric and reversed drafts out of committed predicates; accepts a single endpoint',()=>{
 expect(normalizeHeaderDraft({mode:'numberRange',from:'-',to:''})).toBeUndefined();
 expect(normalizeHeaderDraft({mode:'numberRange',from:'Infinity',to:''})).toBeUndefined();
 expect(normalizeHeaderDraft({mode:'numberRange',from:'2',to:'1'})).toBeUndefined();
 expect(normalizeHeaderDraft({mode:'numberRange',from:'1.5',to:''})).toEqual({mode:'numberRange',from:1.5});
});

it('preserves ordinary large local select sets; composition row limits belong to the source recipe',()=>{
 const table=createTableSession({pageIndex:0,pageSize:20,sort:[],predicates:[]});
 expect(table.setHeaders({name:{mode:'select',values:Array.from({length:1200},(_,index)=>String(index))}})).toBe(true);
 const predicate=table.snapshot().predicates[0];expect(predicate.op==='in'&&predicate.values.length).toBe(1200);
});
