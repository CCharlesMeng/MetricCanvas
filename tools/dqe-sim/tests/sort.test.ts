import { describe, expect, it } from 'vitest';
import { sortDqeRows } from '../src/sort';
import { executeDqeItem } from '../src/execute';

describe('service-compatible synthetic ordering', () => {
  it('rejects by arrays even before an exact fixture handler can consume them', () => {
    expect(sortDqeRows([], { by: [] }, ['amount'])).toBeUndefined();
    expect(executeDqeItem({ output_dims: ['展示样例'], order: { by: [{ field: '展示数值', type: 'desc' }] } }).code).toBe('DQE_SIM_UNSUPPORTED_QUERY');
  });
  it('sorts the population with nulls last and preserves equal-value input order', () => {
    const rows = [{ id: 'Z', amount: 2 }, { id: 'A', amount: 2 }, { id: 'B', amount: null }, { id: 'C', amount: 9 }];
    expect(sortDqeRows(rows, { order_by_field: 'amount', type: 'desc' }, ['amount'])?.map(row => row.id)).toEqual(['C', 'Z', 'A', 'B']);
    expect(sortDqeRows(rows, { order_by_field: 'amount', type: 'asc' }, ['amount'])?.map(row => row.id)).toEqual(['Z', 'A', 'C', 'B']);
    expect(rows.map(row => row.id)).toEqual(['Z', 'A', 'B', 'C']);
  });
  it('validates fields and direction on empty results as well', () => {
    expect(sortDqeRows([], { order_by_field: 'unknown', type: 'asc' }, ['amount'])).toBeUndefined();
    expect(sortDqeRows([], { order_by_field: 'amount', type: 'sideways' }, ['amount'])).toBeUndefined();
    expect(sortDqeRows([], { order_by_field: 'amount', type: 'desc' }, ['amount'])).toEqual([]);
  });
});
