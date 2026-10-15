import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { executeDqeItem } from '../src/execute';

it('serves the actual acceptance page and refuses unknown demo predicates', () => {
  const page = JSON.parse(readFileSync(new URL('../../../pages/chart-local-filter-page.json', import.meta.url), 'utf8'));
  for (const source of Object.values(page.dataSources) as any[]) {
    const item = structuredClone(source.source.query.body.dsl_list[0]);
    const id = Object.keys(source.source.query.filterBindings ?? {})[0];
    if (id) item.filter.dims = [{dim_name:'chart_demo_region',dim_value_list:page.filters.find((f: any) => f.id === id).default}];
    expect(executeDqeItem(item)).toMatchObject({code:'SUCCESS',total_count:id ? 2 : 6});
    item.filter.dims = [{dim_name:'chart_demo_region',dim_value_list:['EU']}];
    expect(executeDqeItem(item)).toMatchObject({code:'SUCCESS',data:[],total_count:0});
    item.filter.dims = [{dim_name:'unknown',dim_value_list:['CN']}];
    expect(executeDqeItem(item).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  }
});
