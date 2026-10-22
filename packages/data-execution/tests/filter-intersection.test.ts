import { expect, it, vi } from 'vitest';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { executeQuery } from '../src/effective-query';

const base: EffectiveQuery = { language: 'dqe', body: { dsl_list: [{}] }, fieldMappings: {}, filterValues: [] };
it('intersects public/local values and numeric/time boundaries before gateway encoding', async () => {
  const fetchData = vi.fn(async (_query: EffectiveQuery) => ({ rows: [] }));
  await executeQuery({ ...base, filterValues: [
    { target: 'dimension', queryField: 'region', values: ['CN', 'EU'] },
    { target: 'dimension', queryField: 'region', values: ['CN'] },
    { target: 'time', value: { from: '2026-01', to: '2026-12' } },
    { target: 'time', value: { from: '2026-04', to: '2027-01' } },
    { target: 'metricRange', metric: 'amount', from: 10, to: 100 },
    { target: 'metricRange', metric: 'amount', from: 20 },
    { target: 'dimensionRange', queryField: 'date', from: '2026-01-01', to: '2026-12-31' },
    { target: 'dimensionRange', queryField: 'date', from: '2026-06-01' }
  ] }, { fetchData }, {});
  expect(fetchData.mock.calls[0][0].filterValues).toEqual([
    { target: 'dimension', queryField: 'region', values: ['CN'] },
    { target: 'time', value: { from: '2026-04', to: '2026-12' } },
    { target: 'metricRange', metric: 'amount', from: 20, to: 100 },
    { target: 'dimensionRange', queryField: 'date', from: '2026-06-01', to: '2026-12-31' }
  ]);
});
it.each<EffectiveQuery['filterValues']>([
  [{ target: 'dimension', queryField: 'region', values: ['CN'] }, { target: 'dimension', queryField: 'region', values: ['EU'] }],
  [{ target: 'time', value: { from: '2026-01', to: '2026-02' } }, { target: 'time', value: { from: '2026-03', to: '2026-04' } }],
  [{ target: 'metricRange', metric: 'amount', from: 100 }, { target: 'metricRange', metric: 'amount', to: 20 }]
])('returns empty without querying for contradictory conditions %#', async (...filterValues) => {
  const fetchData = vi.fn();
  expect(await executeQuery({ ...base, filterValues }, { fetchData }, {})).toEqual({ status: 'empty', totalCount: 0 });
  expect(fetchData).not.toHaveBeenCalled();
});
