import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { executeDqeItem } from '../src/execute';
import { componentCatalog, flattenPageComponents } from '../../../packages/page/src/internal';

const page = JSON.parse(readFileSync(new URL('../../../pages/capabilities/layout/loading-structure-demo.json', import.meta.url), 'utf8'));

it('covers every product component across the two legal review surfaces', () => {
  const report = JSON.parse(readFileSync(new URL('../../../pages/capabilities/layout/loading-ai-summary-demo.json', import.meta.url), 'utf8'));
  const types = new Set([...flattenPageComponents(page), ...flattenPageComponents(report)].map(component => component.type));
  expect([...types].sort()).toEqual(componentCatalog.map(component => component.type).sort());
  expect(page.iocHeader).toBeDefined();
});

it('replays all declared query sources with a new review-round identity', () => {
  for (const source of Object.values(page.dataSources) as any[]) {
    const item = structuredClone(source.source.query.body.dsl_list[0]);
    item.filter.dims = [{ dim_name: 'loading_demo_round', dim_value_list: ['2'] }];
    expect(executeDqeItem(item).code).toBe('SUCCESS');
    item.filter.dims[0].dim_value_list = ['unknown'];
    expect(executeDqeItem(item).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  }
});
it('executes every query declared by the loading demo, including its paginated child', () => {
  for (const [id, source] of Object.entries(page.dataSources) as [string, any][]) {
    const item = structuredClone(source.source.query.body.dsl_list[0]);
    item.filter.dims = [{ dim_name: 'chart_demo_region', dim_value_list: ['CN'] }];
    if (id === 'children') item.filter.dims.push({ dim_name: 'chart_demo_category', dim_value_list: ['合成类别1'] });
    const result = executeDqeItem(item);
    expect(result.code, id).toBe('SUCCESS');
    expect(result.data.length, id).toBeGreaterThan(0);
    if (id === 'entries') {
      expect(result.total_count).toBeGreaterThan(item.order.limit);
      item.order.offset = item.order.limit;
      const next = executeDqeItem(item);
      expect(next.code).toBe('SUCCESS');
      expect(next.data[0]).not.toEqual(result.data[0]);
    }
  }
});

it('rejects unknown predicates in the named synthetic scope', () => {
  const item = structuredClone(page.dataSources.entries.source.query.body.dsl_list[0]);
  item.filter.dims = [{ dim_name: 'unknown', dim_value_list: ['CN'] }];
  expect(executeDqeItem(item).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
});
