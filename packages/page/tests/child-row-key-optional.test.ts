import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { stableRowQuery } from '../src/table/expansion';
import type { EffectiveQuery } from '../src/query';

function document(kind = 'query') {
  const page = JSON.parse(readFileSync(new URL(`../fixtures/contract-valid/table-row-expansion-${kind}.json`, import.meta.url), 'utf8'));
  page.schemaVersion = '6.105';
  delete page.sections[0].components[0].props.rowExpansion.table.rowKey;
  if (kind === 'query') Object.assign(page.dataSources['orders-default'].source.query.body.dsl_list[0].order, { order_by_field: 'row_order_id', type: 'asc' });
  return page;
}
it.each(['query', 'inline'])('allows omitted child rowKey in 6.105: %s', kind => {
  const input = document(kind), original = structuredClone(input);
  expect(parsePage(input).ok).toBe(true);
  expect(input).toEqual(original);
  input.schemaVersion = '6.104';
  expect(parsePage(input)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('6.105') })]) });
});
it('keeps the parent key required and validates a declared child key', () => {
  const input = document();
  delete input.sections[0].components[0].props.rowKey;
  expect(parsePage(input).ok).toBe(false);
  const declared = document(); declared.sections[0].components[0].props.rowExpansion.table.rowKey = 'missing';
  expect(parsePage(declared).ok).toBe(false);
});
it('requires explicit source ordering for a keyless query child', () => {
  const input = document(), order = input.dataSources['orders-default'].source.query.body.dsl_list[0].order;
  delete order.order_by_field; delete order.type;
  expect(parsePage(input)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('必须显式声明查询默认排序') })]) });
});
it('uses query order rather than inventing identity, and restores it after clearing sort', () => {
  const query: EffectiveQuery = { language: 'dqe', filterValues: [], fieldMappings: {},
    body: { dsl_list: [{ output_dims: ['office'], output_metrics: [], order: { offset: 0, limit: 10, order_by_field: 'office', type: 'asc' } }] } };
  const before = structuredClone(query);
  expect(stableRowQuery(query).sort).toEqual([{ queryField: 'office', direction: 'asc' }]);
  expect(stableRowQuery({ ...query, sort: [] }).sort).toEqual([{ queryField: 'office', direction: 'asc' }]);
  expect(stableRowQuery({ ...query, sort: [{ queryField: 'office', direction: 'desc' }] }).sort).toEqual([{ queryField: 'office', direction: 'desc' }]);
  expect(query).toEqual(before);
  query.body.dsl_list[0]!.order = {};
  expect(() => stableRowQuery(query)).toThrow('必须声明查询默认排序');
});
