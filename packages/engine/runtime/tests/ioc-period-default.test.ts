import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot,EffectiveQuery} from '@metriccanvas/page/internal';
import {createFilterState,initialFilterValues} from '../src/filter-state';
import {executionSourceKey} from '../src/execution';
import {orchestrate} from '../src/orchestrator';

it.each(['iocHeader','legacy-toolbar'])('rejects old execution bootstraps for %s even when the saved source and selected quarter still match',async header=>{
  const input=JSON.parse(readFileSync('pages/capabilities/filters/quarter-query-period.json','utf8'));
  if(header==='legacy-toolbar'){input.sections[0].components.shift();input.dashboardToolbar={variant:'compact'};input.filters[0].precision='month';}
  const parsed=parsePage(input);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,now=new Date(2026,9,15),values=initialFilterValues(page.filters!,now);
  const execution={filters:values,snapshots:new Map<string,DataSnapshot>([['quarter-query',{status:'ready',rows:[{region:'旧月度数据',amount:3}],totalCount:1}]]),sourceKeys:new Map([['quarter-query',executionSourceKey(page.dataSources['quarter-query'])]])};
  const calls:EffectiveQuery[]=[];
  const stream=orchestrate(page,{async fetchData(query){calls.push(query);return {rows:[{region:'新季度数据',amount:30}],totalCount:1};}},createFilterState(values,page.filters),undefined,execution,{now});
  let snapshot:DataSnapshot|undefined;
  const stop=stream.subscribe(values=>snapshot=values.get('quarter-query'));
  try{
    expect(snapshot).toEqual({status:'loading'});
    await vi.waitFor(()=>expect(snapshot).toMatchObject({status:'ready',rows:[{region:'新季度数据',amount:30}]}));
    expect(calls).toHaveLength(1);
    expect(calls[0].filterValues).toEqual([{target:'time',period:'quarter',value:{from:'2026-Q3',to:'2026-Q3'}}]);
  }finally{stop();}
});

it('reports an unsupported quarter without falling back to months or old rows',async()=>{
  const input=JSON.parse(readFileSync('pages/capabilities/filters/quarter-query-period.json','utf8'));
  input.sections[0].components.shift();input.dashboardToolbar={variant:'compact'};input.filters[0].precision='month';
  input.dataSources['quarter-query'].source.initial={capturedAt:'2026-09-30T00:00:00Z',rows:[{'区域':'旧月度数据','Tokens消耗量':3}],totalCount:1};
  const parsed=parsePage(input);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const page=parsed.page,calls:EffectiveQuery[]=[];
  const stream=orchestrate(page,{async fetchData(query){calls.push(query);throw Object.assign(Error('Synthetic unsupported quarter'),{code:'DQE_QUERY_REJECTED'});}},createFilterState(initialFilterValues(page.filters!,new Date(2026,9,15)),page.filters));
  let snapshot:DataSnapshot|undefined;
  const stop=stream.subscribe(values=>snapshot=values.get('quarter-query'));
  try{
    await vi.waitFor(()=>expect(snapshot).toMatchObject({status:'error',error:{code:'DQE_QUERY_REJECTED'}}));
    expect(calls).toHaveLength(1);
    expect(calls[0].filterValues).toEqual([{target:'time',period:'quarter',value:{from:'2026-Q3',to:'2026-Q3'}}]);
    expect(snapshot).not.toHaveProperty('rows');
  }finally{stop();}
});
