import { expect, it } from 'vitest';
import type { DataSource, DataSnapshot, Row } from '@metriccanvas/page/internal';
import { ordinaryScreenProgress } from '../src/source-program/screen-progress';

const source = {
  source: {type: 'query'},
  fields: {key: {}, amount: {}, first: {}, second: {}},
  compute: [
    {op: 'joinAggregate', source: 'a', keys: [{local: 'key', foreign: 'key'}], values: [{field: 'amount', output: 'first', aggregate: 'unique', onMissing: 'zero'}]},
    {op: 'joinAggregate', source: 'b', keys: [{local: 'key', foreign: 'key'}], values: [{field: 'amount', output: 'second', aggregate: 'unique', onMissing: 'zero'}]}
  ]
} as unknown as DataSource;

it('aggregates each ready dependency once for the entire progressive row set', () => {
  let reads = 0;
  const rows: Row[] = Array.from({length: 200}, (_, key) => ({key, amount: key}));
  const dependency: Row[] = rows.map(row => ({key: row.key, get amount() { reads++; return 10; }}));
  const snapshots = new Map<string, DataSnapshot>([['a', {status: 'ready', rows: dependency}], ['b', {status: 'loading'}]]);
  const progress = ordinaryScreenProgress(source, {status: 'ready', rows}, snapshots)!;
  expect(progress.snapshot.rows).toHaveLength(200);
  expect(progress.snapshot.rows[0]).toMatchObject({first: 10, second: null});
  expect(reads).toBe(200);
  expect(progress.pendingFields).toEqual(['second']);
});

it('defers a raw domain with missing join keys or keys produced by another computation', () => {
  const snapshots = new Map<string, DataSnapshot>();
  expect(ordinaryScreenProgress(source, {status: 'ready', rows: [{key: null}]}, snapshots)).toBeUndefined();
  const derivedKey = structuredClone(source);
  if (derivedKey.compute?.[1].op !== 'joinAggregate') throw Error('join');
  derivedKey.compute[1].keys[0].local = 'first';
  expect(ordinaryScreenProgress(derivedKey, {status: 'ready', rows: [{key: 'A'}]}, snapshots)).toBeUndefined();
});

it('does not compute a scalar from a receipt that fails complete-count validation', () => {
  const scalar = structuredClone(source);
  if (scalar.compute?.[0].op !== 'joinAggregate') throw Error('join');
  scalar.compute[0].keys = [];
  const snapshots = new Map<string, DataSnapshot>([['a', {status: 'ready', rows: [{amount: 10}], totalCount: 2}]]);
  const progress = ordinaryScreenProgress(scalar, {status: 'ready', rows: [{key: 'A'}]}, snapshots)!;
  expect(progress.snapshot.rows[0].first).toBeNull();
});
