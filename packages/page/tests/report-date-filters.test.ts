import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/contract-valid/report-date-filters-page.json';
import { applyPageParamSelection, extractPageParams, parsePage, resolvePageParams } from '../src';
import { runPageParameterProgram } from '../src/parameter-program';
import { validateCalendarTimeRange } from '../src/filter';

const clone = () => structuredClone(fixture) as any;
describe('report date contracts and atomic extraction',()=>{
  it('reads 6.12 without date features and gates new fields at 6.13',()=>{
    expect(parsePage(fixture).ok).toBe(true);
    const old=clone();old.schemaVersion='6.12';expect(parsePage(old).ok).toBe(false);
    delete old.params;delete old.filters;delete old.sections[0].components[0].props.filterIds;
    delete old.dataSources.sales.source.query.filterBindings;expect(parsePage(old).ok).toBe(true);
  });
  it('rejects broken/duplicate/hidden/non-date header references',()=>{
    for(const ids of [['missing'],['period-filter','period-filter']]) {
      const p=clone();p.sections[0].components[0].props.filterIds=ids;expect(parsePage(p).ok).toBe(false);
    }
    const p=clone();p.filters[0].visible=false;expect(parsePage(p).ok).toBe(false);
  });
  it('validates month calendars without converting to a day',()=>{
    expect(validateCalendarTimeRange({from:'2026-01',to:'2026-06'},'month')).toEqual([]);
    for(const pair of [{from:'2026-06',to:'2026-01'},{from:'0000-01',to:'2026-06'},{from:'2026-13',to:'2027-01'}])expect(validateCalendarTimeRange(pair,'month').length).toBeGreaterThan(0);
  });
  it('seeds a month range from the times parameter and keeps the template value-free',()=>{
    const p=clone();delete p.params.query.times[0].start;delete p.params.query.times[0].end;
    const filled=resolvePageParams(p,{period:{start:'2026-02',end:'2026-05'}});
    expect(filled.ok).toBe(true);if(!filled.ok)throw Error(JSON.stringify(filled.issues));
    expect(filled.resolvedPage.filters?.[0].default).toEqual({from:'2026-02',to:'2026-05'});
    expect(p.params.query.times[0].start).toBeUndefined();
  });
  it.each(['month','date'] as const)('extracts fixed %s single and range atomically into mutable filters',granularity=>{
    for(const single of [true,false]) {
      const p=clone();delete p.params;delete p.filters;delete p.sections[0].components[0].props.filterIds;
      const query=p.dataSources.sales.source.query;delete query.filterBindings;
      const start=granularity==='month'?'2026-01':'2026-01-01';
      const end=single?start:granularity==='month'?'2026-06':'2026-06-30';
      query.body.dsl_list[0].filter.time={period:granularity==='month'?'month':'day',is_aggregate:false,start,end};
      const extraction=extractPageParams(p,{baseline:'verified-r1'});if(!extraction.ok)throw Error(JSON.stringify(extraction.issues));
      const candidate=extraction.candidates.find(c=>c.declaration.type==='timeRange')!;
      expect(candidate.dateForm).toBe(`${granularity}${single?'':'Range'}`);
      const applied=applyPageParamSelection(extraction,[candidate.id]);if(!applied.ok)throw Error(JSON.stringify(applied.issues));
      expect(applied.document.schemaVersion).toBe('6.22');
      expect(applied.document.filters?.[0].type).toBe(single?'timePoint':'timeRange');
      expect(applied.document.sections[0].components[0].type).toBe('reportHeader');
      expect(applied.document.filters?.[0].default).toBeUndefined();
      expect(resolvePageParams(applied.document,applied.originalValues).ok).toBe(true);
      expect(p.params).toBeUndefined();
    }
  });
  it('reuses a declared filter and its times parameter without creating duplicates',()=>{
    const extraction=extractPageParams(fixture,{baseline:'verified-r2'});if(!extraction.ok)throw Error(JSON.stringify(extraction.issues));
    const applied=applyPageParamSelection(extraction,['period']);if(!applied.ok)throw Error(JSON.stringify(applied.issues));
    expect(applied.document.filters).toHaveLength(1);
    expect((applied.document.params as any).query.times).toHaveLength(1);
    expect((applied.document.sections[0].components[0].props as any).filterIds).toEqual(['period-filter']);
  });
  it('requires trusted identity before merging independent literal periods',()=>{
    const p=clone();delete p.params;delete p.filters;delete p.sections[0].components[0].props.filterIds;
    const q=p.dataSources.sales.source.query;delete q.filterBindings;q.body.dsl_list[0].filter.time.start='2026-01';q.body.dsl_list[0].filter.time.end='2026-06';
    p.dataSources.other=structuredClone(p.dataSources.sales);
    const e=extractPageParams(p,{baseline:'r3'});expect(e.ok&&e.candidates.length).toBe(2);
    const same=extractPageParams(p,{baseline:'r3',timeIdentities:{sales:'business-period',other:'business-period'}});expect(same.ok&&same.candidates.length).toBe(1);
  });
  it('extracts explicit compact month partition into a single month filter',()=>{
    const p=clone();delete p.params;delete p.filters;delete p.sections[0].components[0].props.filterIds;
    const q=p.dataSources.sales.source.query;delete q.filterBindings;delete q.body.dsl_list[0].filter.time;
    q.body.dsl_list[0].filter.dims=[{dim_name:'month_partition',dim_value_list:['202604']}];
    const e=extractPageParams(p,{baseline:'r4',timePointFields:{sales:{month_partition:{granularity:'month',valueFormat:'compact'}}}});if(!e.ok)throw Error(JSON.stringify(e.issues));
    expect(e.candidates[0].dateForm).toBe('month');
    const result=applyPageParamSelection(e,[e.candidates[0].id]);if(!result.ok)throw Error(JSON.stringify(result.issues));
    expect(result.document.filters?.[0].type).toBe('timePoint');
    expect((result.document.dataSources.sales.source as any).query.filterBindings['report-period-filter']).toEqual({target:'timePoint',queryField:'month_partition',valueFormat:'compact'});
  });
  it('rejects arbitrary structural replacement paths without mutation',()=>{
    const e=extractPageParams(clone(),{baseline:'r6'});if(!e.ok)throw Error('invalid fixture');
    expect(applyPageParamSelection(e,[],{'/sections/0/components/0/props/filterIds/0':'bad'}).ok).toBe(false);
    expect(applyPageParamSelection(e,[],{'/absent/path':'bad'}).ok).toBe(false);
  });
  it('reuses existing scalar date binding without reinserting a literal predicate',()=>{
    const p=clone();p.params.query.times[0].end='2026-01';p.filters[0]={id:'period-filter',type:'timePoint',granularity:'month',required:true,initialParam:'period'};
    const q=p.dataSources.sales.source.query;delete q.body.dsl_list[0].filter.time;q.body.dsl_list[0].filter.dims=[];q.filterBindings={'period-filter':{target:'timePoint',queryField:'entry',valueFormat:'compact'}};
    const e=extractPageParams(p,{baseline:'r7'});if(!e.ok)throw Error(JSON.stringify(e.issues));
    const result=applyPageParamSelection(e,[e.candidates[0].id]);if(!result.ok)throw Error(JSON.stringify(result.issues));
    expect((result.document.dataSources.sales.source as any).query.body.dsl_list[0].filter.dims).toEqual([]);
  });
  it('never treats filter IDs as text replacement slots',()=>{
    const p=clone();p.filters[0].id='2026-01';p.sections[0].components[0].props.filterIds=['2026-01'];p.dataSources.sales.source.query.filterBindings={'2026-01':{target:'time'}};
    const result=runPageParameterProgram({action:'extract',document:p,context:{baseline:'r5'}});
    expect(result.ok).toBe(true);if(!result.ok||!('textSlots' in result))throw Error('failed');
    expect(result.textSlots.some(s=>s.path.includes('filterIds'))).toBe(false);
  });
});
