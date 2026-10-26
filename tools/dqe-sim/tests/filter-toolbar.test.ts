import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {executeDqeItem} from '../src/execute';

it('combines the actual toolbar page metric, region and channel predicates for trend and total', () => {
  const page = JSON.parse(readFileSync('pages/capabilities/filters/filter-group-parallel-selects.json','utf8'));
  for (const [metric,region,channel,total] of [
    ['revenue','all','all',1710], ['revenue','east','all',951],
    ['revenue','east','direct',571], ['orders','east','direct',1857], ['orders','east','partner',1238]
  ] as const) {
    const dims = [
      {dim_name:page.filters[0].dimension,dim_value_list:[metric]},
      {dim_name:page.filters[1].dimension,dim_value_list:[region]},
      {dim_name:page.filters[2].dimension,dim_value_list:[channel]}
    ];
    const trend = structuredClone(page.dataSources['trend-data'].source.query.body.dsl_list[0]);
    const summary = structuredClone(page.dataSources['summary-data'].source.query.body.dsl_list[0]);
    trend.filter.dims = dims; summary.filter.dims = dims;
    const result = executeDqeItem(trend);
    expect(result.code).toBe('SUCCESS');
    expect(result.data).toHaveLength(6);
    expect(result.data.reduce((sum:number,row:any)=>sum+row.toolbar_parallel_value,0)).toBe(total);
    expect(executeDqeItem(summary)).toMatchObject({code:'SUCCESS',data:[{toolbar_parallel_total:total}]});
  }
});
