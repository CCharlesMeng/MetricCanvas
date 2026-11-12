import { expect, it } from 'vitest';
import type { Component, DataSnapshot, Page } from '@metriccanvas/page/internal';
import { createRetainedScreenData } from '../src/retained-screen-data';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';

const component = { id: 'card', type: 'metricCard', data: { main: 'current', compare: 'previous' } } as Component;
const data = (current: number, previous: number): NamedDataSlots => Object.fromEntries([
  ['main', current], ['compare', previous]
].map(([slot, value]) => [slot, { sourceStatus: 'ready', fields: {}, snapshot: { status: 'ready', rows: [{ value }] } }]));
const ready: Extract<DataSnapshot, {status: 'ready'}> = { status: 'ready', rows: [] };
const loading = { status: 'loading' } as const;
const page = (id: string) => ({ id }) as Page;

it('retains a complete component receipt while a supplementary slot loads without seeding execution', () => {
  const cache = createRetainedScreenData(), old = data(10, 5), next = data(20, 0);
  cache.read(component, old, ready);
  const retained = cache.read(component, next, loading);
  expect(retained.retained).toBe(true);
  expect(retained.data.main?.snapshot.rows).toEqual([{ value: 10 }]);
  expect(retained.data.compare?.snapshot.rows).toEqual([{ value: 5 }]);
  expect(retained.data.main?.sourceStatus).toBe('loading');
  expect(old.main?.sourceStatus).toBe('ready');
  expect(next.main?.snapshot.rows).toEqual([{ value: 20 }]);
  expect(cache.read(component, next, ready).data).toBe(next);
  expect(cache.read(component, data(0, 0), loading).data.main?.snapshot.rows).toEqual([{ value: 20 }]);
});

it('empty results replace old rows and errors discard the previous receipt', () => {
  const cache = createRetainedScreenData(), empty = { main: { fields: {}, snapshot: ready }, compare: { fields: {}, snapshot: ready } };
  cache.read(component, data(10, 5), ready);
  cache.read(component, empty, { status: 'empty' });
  expect(cache.read(component, data(0, 0), loading).data.main?.snapshot.rows).toEqual([]);
  cache.read(component, empty, { status: 'error', error: { code: 'DQE_TIMEOUT', message: 'timeout' } });
  expect(cache.read(component, empty, loading).retained).toBe(false);
});

it('never reuses incompatible fields or a different data source mapping', () => {
  const cache = createRetainedScreenData();
  cache.read(component, data(10, 5), ready);
  const changed = data(0, 0);
  changed.main!.fields = { value: { type: 'number', role: 'measure' } };
  expect(cache.read(component, changed, loading).retained).toBe(false);
  expect(cache.read({ ...component, data: { main: 'other' } } as Component, data(0, 0), loading).retained).toBe(false);
});

it('restores display receipts on a same-instance page return, with bounded page history', () => {
  const cache = createRetainedScreenData(), gateway = {};
  cache.select(page('a'), gateway, '1'); cache.read(component, data(10, 5), ready);
  cache.select(page('b'), gateway, '1');
  expect(cache.read(component, data(0, 0), loading).retained).toBe(false);
  cache.select(page('a'), gateway, '1');
  expect(cache.read(component, data(0, 0), loading).retained).toBe(true);
  for (const id of ['b', 'c', 'd', 'e']) cache.select(page(id), gateway, '1');
  cache.select(page('a'), gateway, '1');
  expect(cache.read(component, data(0, 0), loading).retained).toBe(false);
});

it('invalidates display receipts on gateway, document revision or permission invalidation', () => {
  const cache = createRetainedScreenData(), gateway = {};
  cache.select(page('a'), gateway, '1'); cache.read(component, data(10, 5), ready);
  cache.select(page('a'), gateway, '2');
  expect(cache.read(component, data(0, 0), loading).retained).toBe(false);
  cache.select(page('a'), {}, '1');
  expect(cache.read(component, data(0, 0), loading).retained).toBe(false);
  cache.read(component, data(10, 5), ready); cache.clear();
  expect(cache.read(component, data(0, 0), loading).retained).toBe(false);
});

it('supports a page without a revision and bounds retained row references', () => {
  const cache = createRetainedScreenData();
  cache.select(page('unversioned'), {}, undefined);
  const large = data(1, 1);
  large.main!.snapshot.rows = Array.from({ length: 20_001 }, () => ({ value: 1 }));
  cache.read(component, large, ready);
  expect(cache.read(component, data(0, 0), loading).retained).toBe(false);
});
