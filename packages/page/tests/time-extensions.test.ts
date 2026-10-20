import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {validate,isoWeekRange,isoWeekLabel,resolveRelativeTime,periodFact,timeAvailabilityIssue,type DisplayInputsSnapshot} from '../src/internal';
const load=(name='time-modes')=>JSON.parse(readFileSync(`pages/ioc-header-${name}-demo.json`,'utf8'));
const now=new Date(2026,9,19,12);
const facts:DisplayInputsSnapshot={contextRevision:'u1',timeZone:'Asia/Shanghai',periods:{sales:{status:'ready',granularity:'month',latest:'2026-10',latestComplete:'2026-09',missingRanges:[{from:'2026-07',to:'2026-07'}]}}};
describe('B4 static time contracts',()=>{
 it.each(['time-modes','time-presets','availability','calendar-window'])('validates actual %s page',name=>expect(validate(load(name))).toEqual([]));
 it.each(['missing','ordinary','wrong-period','wrong-output','wrong-binding','unknown-mode'])('rejects %s mode program',kind=>{
  const page=load(),query=page.dataSources.bound.source.query;
  if(kind==='missing')delete query.timeModes.cases.month;
  if(kind==='ordinary')query.body=query.timeModes.cases.day.body;
  if(kind==='wrong-period')query.timeModes.cases.isoWeek.body.dsl_list[0].filter.time.period='month';
  if(kind==='wrong-output')query.timeModes.cases.isoWeek.body.dsl_list[0].output_metrics=['different'];
  if(kind==='wrong-binding')query.timeModes.cases.isoWeek.filterBindings.period={target:'timePoint',queryField:'bad'};
  if(kind==='unknown-mode')query.timeModes.cases.fiscal=query.timeModes.cases.day;
  expect(validate(page).length).toBeGreaterThan(0);
 });
 it('validates ISO year across calendar years and leap days without private week codes',()=>{
  expect(isoWeekRange('2021-01-01')).toEqual({from:'2020-12-28',to:'2021-01-03'});expect(isoWeekLabel('2021-01-01')).toBe('2020-W53');
  expect(isoWeekLabel('2027-01-04')).toBe('2027-W01');expect(isoWeekRange('2024-02-29')).toEqual({from:'2024-02-26',to:'2024-03-03'});expect(()=>isoWeekRange('2026-W01')).toThrow();
 });
 it('uses inclusive day and calendar month presets with the explicit anchor',()=>{
  expect(resolveRelativeTime({unit:'day',range:{kind:'lastN',n:3},includeCurrent:true,anchor:'2024-03-01'},now,'date')).toEqual({from:'2024-02-28',to:'2024-03-01'});
  expect(resolveRelativeTime({unit:'month',range:{kind:'lastN',n:12},includeCurrent:false},now,'month')).toEqual({from:'2025-10',to:'2026-09'});
 });
 it('separates latest, complete, missing data policy and strict fact validation',()=>{
  const filter=load('availability').filters[0];expect(timeAvailabilityIssue(filter,{type:'timePoint',value:'2026-10'},facts)).toBeUndefined();expect(timeAvailabilityIssue(filter,{type:'timePoint',value:'2026-11'},facts)).toContain('上限');expect(timeAvailabilityIssue(filter,{type:'timePoint',value:'2026-07'},facts)).toContain('缺数');
  delete filter.availability.blockMissing;expect(timeAvailabilityIssue(filter,{type:'timePoint',value:'2026-07'},facts)).toBeUndefined();
  const corrupt=structuredClone(facts);corrupt.periods={sales:{status:'ready',granularity:'date',latest:'2026-02-30'}};expect(periodFact(corrupt,'sales').status).toBe('error');
  corrupt.periods={sales:{status:'ready',granularity:'date',latest:'2026-02-28',refreshedAt:'2026-02-31T00:00:00Z'}};expect(periodFact(corrupt,'sales').status).toBe('error');
  corrupt.periods={sales:{status:'ready',granularity:'month',latest:'2026-10',filterRevision:4}};expect(periodFact(corrupt,'sales',3).status).toBe('loading');
 });
 it('never truncates a full natural year at an availability maximum',()=>{
  const filter={id:'p',type:'timeRange' as const,display:'period' as const,availability:{fact:'sales',max:'latest' as const}};
  expect(timeAvailabilityIssue(filter,{type:'timeRange',from:'2026-01-01',to:'2026-12-31'},facts)).toContain('上限');
 });
 it('gates new declarations at 6.35 and ignores opaque data with fact-like keys',()=>{
  const page=load();page.schemaVersion='6.34';expect(validate(page).some(e=>e.message.includes('6.35'))).toBe(true);
  const old=JSON.parse(readFileSync('pages/ioc-header-overview-demo.json','utf8'));old.iocHeader.identity.description={text:'fact is just text'};expect(validate(old)).toEqual([]);
 });
});
it('reports an excessive mode product as TypedError instead of throwing',()=>{
 const page=load(),source=page.dataSources.bound,filter=page.filters[0];page.filters=[];page.dataSources={unbound:page.dataSources.unbound};page.iocHeader.filterIds=[];
 for(let i=0;i<8;i++){const id=`period-${i}`,copy=structuredClone(source);copy.source.query.timeModes.filterId=id;for(const leaf of Object.values(copy.source.query.timeModes.cases) as any[]){leaf.filterBindings[id]=leaf.filterBindings.period;delete leaf.filterBindings.period;}page.filters.push({...structuredClone(filter),id});page.iocHeader.filterIds.push(id);page.dataSources[`time-${i}`]=copy;}
 page.sections[0].components[0].data.main='time-0';delete page.iocHeader.identity.facts;expect(()=>validate(page)).not.toThrow();expect(validate(page)).toContainEqual(expect.objectContaining({path:'/dataSources',message:'查询模式组合超过4096'}));
});
it('requires an explicit integration timezone rather than the browser default',()=>{
 const invalid=JSON.parse(JSON.stringify(facts));delete invalid.timeZone;expect(periodFact(invalid,'sales').status).toBe('error');invalid.timeZone='';expect(periodFact(invalid,'sales').status).toBe('error');
});
it('shares the validation budget with static field selection cases',()=>{
 const page=JSON.parse(readFileSync('packages/page/fixtures/contract-valid/time-binding-branches-page.json','utf8')),extra=load();
 for(let i=0;i<7;i++){const id=`extra-${i}`,source=structuredClone(extra.dataSources.bound);source.source.query.timeModes.filterId=id;for(const leaf of Object.values(source.source.query.timeModes.cases) as any[]){leaf.filterBindings[id]=leaf.filterBindings.period;delete leaf.filterBindings.period;}page.filters.push({...structuredClone(extra.filters[0]),id});page.dataSources[id]=source;}
 expect(validate(page)).toContainEqual(expect.objectContaining({path:'/dataSources',message:'查询模式组合超过4096'}));
});
