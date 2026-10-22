import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { executeDqeItem } from '../src/execute';

it('serves the actual acceptance page and refuses unknown demo predicates', () => {
  const page = JSON.parse(readFileSync(new URL('../../../pages/chart-local-filter-page.json', import.meta.url), 'utf8'));
  for (const source of Object.values(page.dataSources) as any[]) {
    const item = structuredClone(source.source.query.body!.dsl_list[0]);
    const id = Object.keys(source.source.query.filterBindings ?? {})[0];
    if (id) item.filter.dims = [{dim_name:'chart_demo_region',dim_value_list:page.filters.find((f: any) => f.id === id).default}];
    expect(executeDqeItem(item)).toMatchObject({code:'SUCCESS',total_count:id ? 2 : 6});
    item.filter.dims = [{dim_name:'chart_demo_region',dim_value_list:['EU']}];
    expect(executeDqeItem(item)).toMatchObject({code:'SUCCESS',data:[],total_count:0});
    item.filter.dims = [{dim_name:'unknown',dim_value_list:['CN']}];
    expect(executeDqeItem(item).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  }
});

 it('serves both toolbar predicates and an independently totaled summary',()=>{
  const page=JSON.parse(readFileSync(new URL('../../../pages/filter-group-page.json',import.meta.url),'utf8'));
  for(const [metric,region,total] of [['revenue','all',1710],['orders','all',5579],['orders','east',3095],['revenue','south',759]] as const){
   const dims=[{dim_name:'toolbar_metric',dim_value_list:[metric]},{dim_name:'toolbar_region',dim_value_list:[region]}];
   const trend=structuredClone(page.dataSources['trend-data'].source.query.body.dsl_list[0]);trend.filter.dims=dims;
   const summary=structuredClone(page.dataSources['summary-data'].source.query.body.dsl_list[0]);summary.filter.dims=dims;
   const result=executeDqeItem(trend);expect(result.code).toBe('SUCCESS');expect(result.data).toHaveLength(6);
   expect(result.data.reduce((sum:number,row:any)=>sum+row.toolbar_value,0)).toBe(total);
   expect(executeDqeItem(summary)).toMatchObject({code:'SUCCESS',data:[{toolbar_total:total}]});
  }
 });
