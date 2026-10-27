import { expect, it } from 'vitest';
import type { DqeQueryDefinition } from '@metriccanvas/page/internal';
import { dateBindingsForFilter, dateQueryLeaves, editDateQueryBindings, inferredPeriodPolicy } from '../../src/lib/workbench/report-date-bindings';
import { periodPolicyPreview, policyFromChoice } from '../../src/lib/workbench/period-policy-edit';
import {filterConditionChoices,basicFilterCondition,basicConditionSelection} from '../../src/lib/workbench/condition-editor';
const leaf=(period:string):import('@metriccanvas/page/internal').DqeQueryCase=>({body:{dsl_list:[{filter:{time:{period,is_aggregate:true}}}]},filterBindings:{period:{target:'time'}}});
function query(kind:'body'|'queryModes'|'timeModes'):DqeQueryDefinition {
  if(kind==='body')return {language:'dqe',...leaf('month')};
  return {language:'dqe',[kind]:{filterId:'selector',cases:{first:leaf('month'),second:leaf('month')}}} as DqeQueryDefinition;
}
it.each(['body','queryModes'] as const)('migrates every %s branch and preserves aggregation',kind=>{
  const q=query(kind);
  expect(inferredPeriodPolicy(q)).toEqual({kind:'fixed',period:'month'});
  editDateQueryBindings(q,'period',{dataSourceId:'test',binding:{target:'time',periodPolicy:{kind:'fixed',period:'day'}}});
  for(const leaf of dateQueryLeaves(q)){
    expect(leaf.body!.dsl_list[0].filter).toEqual({time:{is_aggregate:true}});
    expect(leaf.filterBindings!.period).toEqual({target:'time',periodPolicy:{kind:'fixed',period:'day'}});
  }
  editDateQueryBindings(q,'period',undefined);
  expect(dateQueryLeaves(q).every(leaf=>!leaf.filterBindings)).toBe(true);
});
it('removes a legacy binding from every timeModes leaf',()=>{
  const q=query('timeModes');
  expect(editDateQueryBindings(q,'period',undefined)).toBe(true);
  expect(dateQueryLeaves(q).every(leaf=>!leaf.filterBindings)).toBe(true);
});
it('preserves different per-case legacy declarations until explicit migration',()=>{
  const q=query('queryModes'),leaves=dateQueryLeaves(q);
  leaves[1].body!.dsl_list[0]={filter:{time:{period:'day',is_aggregate:false}}};
  const before=structuredClone(q);
  expect(dateBindingsForFilter({test:{fields:{},source:{type:'query',query:q}}},'period')[0].mixed).toBe(true);
  expect(inferredPeriodPolicy(q)).toBeUndefined();
  expect(editDateQueryBindings(q,'period',{dataSourceId:'test',binding:{target:'time'},preserve:true})).toBe(false);
  expect(q).toEqual(before);
  delete leaves[1].filterBindings!.period;
  const withGap=structuredClone(q);
  editDateQueryBindings(q,'period',{dataSourceId:'test',binding:{target:'time'},preserve:true});
  expect(q).toEqual(withGap);
});
it('previews expansion and unsupported modes and never invents a default',()=>{
  const now=new Date(2026,9,15);
  expect(policyFromChoice('',[])).toBeUndefined();
  expect(periodPolicyPreview('month','2026-10',{kind:'fixed',period:'year'},now)).toContain('已扩大');
  expect(periodPolicyPreview('year','2026',{kind:'selection',supportedPeriods:['month']},now)).toContain('不支持');
});
it('edits period-mode column conditions through the existing basic editor',()=>{
  const choices=filterConditionChoices([{id:'period',type:'timeRange',display:'period',label:'统计期间'}]);
  const quarter=choices.find(choice=>choice.mode==='quarter')!;
  const condition=basicFilterCondition(quarter,true);
  expect(condition).toEqual({filter:'period',part:'mode',op:'eq',value:'quarter'});
  expect(basicConditionSelection(condition,choices)).toEqual({choice:quarter.value,selected:true});
});
