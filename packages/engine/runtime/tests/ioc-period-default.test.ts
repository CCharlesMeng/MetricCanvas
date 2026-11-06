import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import type {DataSnapshot,EffectiveQuery} from '@metriccanvas/page/internal';
import {createFilterState,initialFilterValues} from '../src/filter-state';
import {executionSourceKey} from '../src/execution';
import {orchestrate} from '../src/orchestrator';

it('rejects old execution bootstraps even when the saved source and selected quarter still match',async()=>{
  const parsed=parsePage(JSON.parse(readFileSync('pages/capabilities/filters/quarter-query-period.json','utf8')));
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
