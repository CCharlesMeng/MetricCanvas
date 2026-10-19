import { describe, it, expect } from 'vitest';
import { evaluateCondition, type ConditionContext } from '../src/condition';
import { conditionZ } from '../src/schema/condition';
const context: ConditionContext = {declarations:[{id:'org',type:'dimension',dimension:'global',defaultLevel:'global',hierarchy:[{id:'global',dimension:'global'},{id:'department',dimension:'department'}]}],filters:new Map()};
describe('shared presentation conditions',()=>{
 it('uses declared default and explicit empty level',()=>{
  const condition={filter:'org',part:'level',op:'ne',value:'department'} as const;
  expect(evaluateCondition(condition,context).status).toBe('allow');
  expect(evaluateCondition(condition,{...context,filters:new Map([['org',{type:'dimension',level:'department',values:[]}]])}).status).toBe('deny');
 });
 it('validates all inputs before not or any',()=>{
  expect(evaluateCondition({not:{permission:'missing'}},context).status).toBe('error');
  expect(evaluateCondition({any:[{permission:'a'},{permission:'b'}]},{...context,displaySnapshot:{permissionRevision:'a',permissions:{a:{status:'ready',value:true},b:{status:'pending'}},values:{}}}).status).toBe('pending');
 });
 it('rejects mixed types and stale scoped facts',()=>{
  expect(evaluateCondition({row:'x',op:'eq',value:1},{...context,row:{x:'1'}}).status).toBe('error');
  expect(evaluateCondition({fact:'ready',op:'eq',value:true},{...context,filterRevision:2,displaySnapshot:{permissionRevision:'a',permissions:{},values:{ready:{status:'ready',value:true,filterRevision:1}}}}).status).toBe('pending');
 });
 it('keeps condition nodes strict',()=>{
  expect(conditionZ.safeParse({filter:'org',part:'level',op:'eq',value:'department',script:'x'}).success).toBe(false);
  expect(conditionZ.safeParse({all:[]}).success).toBe(false);
 });
});
