import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { versionPolicy } from '../src/version';
import { resolvePeriodSelection } from '../src/period-filter';
import { resolvePeriodQuery } from '../src/period-query';
import { evaluateCondition } from '../src/condition';
import {periodCapabilityPaths} from '../src/period-capability';
const now=new Date(2026,9,15);
const document=()=>JSON.parse(readFileSync(new URL('../fixtures/contract-valid/dashboard-period-filter.json',import.meta.url),'utf8'));
export function policyDocument(){
  const page=document();page.schemaVersion=versionPolicy.current;
  const query=page.dataSources.sales.source.query;
  query.filterBindings['period-filter']={target:'time',periodPolicy:{kind:'fixed',period:'month'}};
  delete query.body.dsl_list[0].filter.time.period;
  return page;
}
it.each([
  ['year','2026','month','2026-01','2026-12',false],
  ['quarter','2026-Q2','month','2026-04','2026-06',false],
  ['month','2024-02','day','2024-02-01','2024-02-29',false],
  ['month','2026-10','year','2026','2026',true],
  ['last12Months',undefined,'year','2025','2026',true]
] as const)('resolves %s into fixed %s without changing the selection', (mode,value,period,from,to,expanded)=>{
  const range=resolvePeriodSelection(mode==='last12Months'?{mode}:{mode,value},now,'month'),before=structuredClone(range);
  expect(resolvePeriodQuery(range,{kind:'fixed',period})).toEqual({period,from,to,expanded});
  expect(range).toEqual(before);
});
it('uses applied last twelve months and rejects unsupported selection without fallback',()=>{
  const range=resolvePeriodSelection({mode:'last12Months'},now);
  expect(resolvePeriodQuery(range,{kind:'selection',supportedPeriods:['month']})).toMatchObject({period:'month',from:'2025-10',to:'2026-09'});
  expect(()=>resolvePeriodQuery(range,{kind:'selection',supportedPeriods:['year']})).toThrow('不支持');
  expect(()=>resolvePeriodQuery(resolvePeriodSelection({mode:'quarter',value:'2026-Q1'},now),{kind:'selection',supportedPeriods:['month','year']})).toThrow('季度查询编码');
});
it('keeps legacy documents readable and new policy versioned',()=>{
  expect(parsePage(document()).ok).toBe(true);
  expect(parsePage(policyDocument()).ok).toBe(true);
  const page=policyDocument();page.schemaVersion='6.66';expect(parsePage(page).ok).toBe(false);
});
it.each(['period','start','end','param','window','bodyWindow','object','ordinary','duplicate','unknown'])('rejects ambiguous or invalid policy %s',kind=>{
  const page=policyDocument(),q=page.dataSources.sales.source.query,time=q.body.dsl_list[0].filter.time,b=q.filterBindings['period-filter'];
  if(['period','start','end','param'].includes(kind))time[kind]='bad';
  if(kind==='window')b.window={kind:'period',unit:'month'};
  if(kind==='bodyWindow')time.window={kind:'period',unit:'month'};
  if(kind==='object')q.body.dsl_list[0].query_type='object';
  if(kind==='ordinary')delete page.filters[0].display;
  if(kind==='duplicate')b.periodPolicy={kind:'selection',supportedPeriods:['month','month']};
  if(kind==='unknown')b.periodPolicy={kind:'fixed',period:'quarter'};
  expect(parsePage(page).ok).toBe(false);
});
it('reads applied selection mode, preserves not/pending and rejects non-period references',()=>{
  const declaration=policyDocument().filters[0];
  const condition={filter:'period-filter',part:'mode',op:'eq',value:'month'} as const;
  const range=resolvePeriodSelection({mode:'month',value:'2026-10'},now);
  const context={declarations:[declaration],filters:new Map([['period-filter',{type:'timeRange',...range}]])};
  expect(evaluateCondition(condition,context).status).toBe('allow');
  expect(evaluateCondition({not:condition},{...context,filters:new Map()}).status).toBe('pending');
  expect(evaluateCondition(condition,{...context,declarations:[{...declaration,display:undefined}]}).status).toBe('error');
});
it('validates period conditions on columns, components and sections with a version floor',()=>{
  const page=policyDocument();
  const condition={filter:'period-filter',part:'mode',op:'eq',value:'year'};
  page.sections[0].visibleWhen=condition;
  expect(parsePage(page).ok).toBe(true);
  page.schemaVersion='6.66';expect(parsePage(page).ok).toBe(false);
  page.schemaVersion=versionPolicy.current;condition.value='yeer';expect(parsePage(page).ok).toBe(false);
});
it('does not discover capabilities inside raw query bodies or inline rows',()=>{
  const fake={filter:'period-filter',part:'mode',op:'eq',value:'year'};
  expect(periodCapabilityPaths({dataSources:{a:{source:{type:'query',query:{body:{fake}}}},b:{source:{type:'inline',rows:[fake]}}}})).toEqual([]);
});
