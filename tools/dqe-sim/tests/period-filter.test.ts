import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {executeDqeItem} from '../src/execute';

it('serves the actual period page and keeps the unbound comparison independent',()=>{
  const page=JSON.parse(readFileSync('pages/capabilities/filters/dashboard-period-filter.json','utf8'));
  const sales=page.dataSources.sales.source.query.body.dsl_list[0];
  Object.assign(sales.filter.time,{start:'2024-01-01',end:'2024-12-31'});
  expect(executeDqeItem(sales)).toMatchObject({code:'SUCCESS',data:[{entry:'2024-01-01~2024-12-31',amount:42}]});
  expect(executeDqeItem(page.dataSources.fixed.source.query.body.dsl_list[0])).toMatchObject({code:'SUCCESS',data:[{entry:'2026-01-01~2026-01-31',unbound_amount:42}]});
  sales.filter.dims=[{dim_name:'unknown',dim_value_list:['x']}];
  expect(executeDqeItem(sales).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  delete sales.filter.dims;sales.filter.time.end='2023-12-31';
  expect(executeDqeItem(sales).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
});
