import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { versionPolicy, resolvePeriodSelection, type QueryDataSource, type PeriodQueryPolicy } from '@metriccanvas/page/internal';
import { composeEffectiveQuery } from '../src/effective-query';
import { initialFilterValues } from '../src/filter-values';
import { effectiveDqeItem } from '../src/dqe/dqe';
import { intersectQueryFilters } from '../src/intersect-filters';
function fixture(policy:PeriodQueryPolicy) {
  const raw=JSON.parse(readFileSync(new URL('../../page/fixtures/contract-valid/dashboard-period-filter.json',import.meta.url),'utf8'));
  raw.schemaVersion=versionPolicy.current;raw.filters[0].default={mode:'month',value:'2026-10'};
  const q=raw.dataSources.sales.source.query;
  q.filterBindings['period-filter'].periodPolicy=policy;delete q.body.dsl_list[0].filter.time.period;
  const parsed=parsePage(raw);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  return parsed.page;
}
it.each([
  ['day','2026-10-01','2026-10-31'],['month','2026-10','2026-10'],['year','2026','2026']
] as const)('encodes independent fixed %s and retains metric aggregation',(period,start,end)=>{
  const page=fixture({kind:'fixed',period}),values=initialFilterValues(page.filters!,new Date(2026,9,15));
  const source=page.dataSources.sales as QueryDataSource,before=structuredClone(source);
  const query=composeEffectiveQuery({dataSource:source,filters:page.filters},values,0,[],{});
  expect(query.filterValues[0]).toMatchObject({period,value:{from:start,to:end}});
  expect(effectiveDqeItem(query)).toMatchObject({filter:{time:{period,start,end,is_aggregate:false}}});
  expect(source).toEqual(before);
});
it('rejects incompatible intersections instead of comparing mixed encoded boundaries',()=>{
  const page=fixture({kind:'fixed',period:'month'});
  const query=composeEffectiveQuery({dataSource:page.dataSources.sales as QueryDataSource},initialFilterValues(page.filters!),0,[],{});
  query.filterValues.push({target:'time',period:'year',value:{from:'2026',to:'2026'}});
  expect(()=>intersectQueryFilters(query)).toThrow('不同查询粒度');
});
it('missing applied selections are rejected rather than silently sending an unbounded query',()=>{
  const page=fixture({kind:'fixed',period:'month'});
  expect(()=>composeEffectiveQuery({dataSource:page.dataSources.sales as QueryDataSource},new Map(),0,[],{})).toThrow('已应用的期间选择');
});
it('selects each declared query branch before resolving its own period policy',()=>{
  const raw=JSON.parse(readFileSync(new URL('../../page/fixtures/contract-valid/period-query-branches.json',import.meta.url),'utf8'));
  const result=parsePage(raw);if(!result.ok)throw Error(JSON.stringify(result.errors));
  const values=initialFilterValues(result.page.filters!);
  values.set('statistics-period',{type:'timeRange',...resolvePeriodSelection({mode:'year',value:'2026'},new Date(2026,9,15))});
  const source=result.page.dataSources['query-day'] as QueryDataSource;
  const fixed=composeEffectiveQuery({dataSource:source},values,0,[],{});
  expect(effectiveDqeItem(fixed)).toMatchObject({filter:{time:{period:'month',start:'2026-01',end:'2026-12'}}});
  values.set('route',{type:'dimension',dimension:'route',values:['following']});
  const following=composeEffectiveQuery({dataSource:source},values,0,[],{});
  expect(effectiveDqeItem(following)).toMatchObject({filter:{time:{period:'year',start:'2026',end:'2026'}}});
});
