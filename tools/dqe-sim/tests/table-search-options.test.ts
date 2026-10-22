import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { effectiveDqeItem } from '../../../packages/data-execution/src/dqe/dqe';
import { executeDqeItem } from '../src/execute';
import { composeEffectiveQuery } from '../../../packages/data-execution/src/effective-query';
import { parsePage } from '../../../packages/page/src/validate';

it('encodes equality through the real gateway shape, preserves same-field AND, pagination and source immutability', () => {
  const parsed = parsePage(JSON.parse(readFileSync(new URL('../../../pages/capabilities/table/table-search-options-demo.json', import.meta.url), 'utf8')));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const source = parsed.page.dataSources.queried;
  if (source.source.type !== 'query') throw new Error('Expected query');
  const before = JSON.stringify(source);
  const base = composeEffectiveQuery({ dataSource: source as Parameters<typeof composeEffectiveQuery>[0]['dataSource'], pagination: { limit: 2 } },
    new Map(), 0, [{ field: 'amount', direction: 'desc' }], {}, { fields: ['code'], query: '00123', match: 'equals' });
  const item = effectiveDqeItem(base);
  expect(item.filter).toMatchObject({ dims: [{ dim_name: 'search_demo_owner', dim_value_list: ['张三', '李四', '星河项目'] },
    { dim_name: 'search_demo_code', dim_value_list: ['00123'] }] });
  expect(executeDqeItem(item)).toMatchObject({ code: 'SUCCESS', total_count: 1, data: [{ search_demo_code: '00123' }] });
  expect(JSON.stringify(source)).toBe(before);
  const excluded = structuredClone(base);
  excluded.filterValues.push({ target: 'dimension', queryField: 'search_demo_code', values: ['00124'] });
  expect(executeDqeItem(effectiveDqeItem(excluded))).toMatchObject({ code: 'SUCCESS', total_count: 0 });
  const literal = structuredClone(base); literal.search!.query = 'A%_';
  expect(executeDqeItem(effectiveDqeItem(literal))).toMatchObject({ total_count: 1, data: [{ search_demo_code: 'A%_' }] });
  const malformed = structuredClone(item) as any; malformed.filter.dims.push({ dim_name: 'unknown', dim_value_list: ['x'] });
  expect(executeDqeItem(malformed).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
});
