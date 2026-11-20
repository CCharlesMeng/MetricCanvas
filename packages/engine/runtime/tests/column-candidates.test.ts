import { expect, it } from 'vitest';
import { createColumnCandidatesSession } from '../src/table/column-candidates';
import type { ColumnCandidateProgress, ColumnCandidatesPage } from '@metriccanvas/data-execution';
it('ignores old successes and failures when an adapter ignores abort, and keeps search separate', async () => {
  const calls: { resolve: (page: ColumnCandidatesPage) => void; reject: (cause: unknown) => void; search: string; publish?: ColumnCandidateProgress }[] = [];
  let context = 'N';
  const session = createColumnCandidatesSession((_field, search, _offset, _signal, _preload, publish) => new Promise((resolve, reject) => calls.push({ resolve, reject, search, publish })), () => context, () => {});
  session.open('office');
  calls[0].publish?.([{ value: 'early', label: '旧条件' }]);
  context = 'S'; session.sync();
  calls[0].publish?.([{ value: 'late', label: '迟到旧值' }]);
  expect(session.snapshots().office.candidates).toEqual([]);
  calls[0].resolve({ kind: 'values', candidates: [{ value: 'old', label: '旧值' }], totalCount: 1 });
  await Promise.resolve(); expect(session.snapshots().office.status).toBe('loading');
  calls[1].resolve({ kind: 'values', candidates: [{ value: 1, label: '南区' }], totalCount: 1 });
  await Promise.resolve(); expect(session.snapshots().office.candidates[0].value).toBe(1);
  context = 'E'; session.sync(); context = 'W'; session.sync();
  calls[2].reject(Error('old error')); await Promise.resolve(); await Promise.resolve();
  expect(session.snapshots().office.status).toBe('loading');
  calls[3].resolve({ kind: 'values', candidates: [], totalCount: 0 }); await Promise.resolve();
  session.search('office', '天津'); expect(calls[4].search).toBe('天津');
  session.dispose(); calls[4].resolve({ kind: 'values', candidates: [{ value: 2, label: 'late' }], totalCount: 1 });
  await Promise.resolve(); expect(session.snapshots()).toEqual({});
});

it('coalesces repeated bottom-scroll continuations while loading and stops after the final page', async () => {
  const offsets: number[] = [];
  const pending: Array<(page: ColumnCandidatesPage) => void> = [];
  const session = createColumnCandidatesSession((_field, _search, offset) => {
    offsets.push(offset);
    return new Promise(resolve => pending.push(resolve));
  }, () => 'same-context', () => {});
  session.open('office');
  pending[0]({ kind: 'values', candidates: [{ value: 'A', label: 'A' }], totalCount: 2 });
  await Promise.resolve();
  session.more('office');
  session.more('office');
  session.more('office');
  expect(offsets).toEqual([0, 1]);
  pending[1]({ kind: 'values', candidates: [{ value: 'B', label: 'B' }], totalCount: 2 });
  await Promise.resolve();
  session.more('office');
  expect(offsets).toEqual([0, 1]);
  expect(session.snapshots().office.candidates.map(candidate => candidate.value)).toEqual(['A', 'B']);
  session.dispose();
});

it('keeps visible progress in order and serves later candidate pages from the same completed read', async () => {
  const calls: Array<{ publish?: ColumnCandidateProgress; finish: (page: ColumnCandidatesPage) => void }> = [];
  const session = createColumnCandidatesSession((_field, _search, _offset, _signal, _preload, publish) =>
    new Promise(finish => calls.push({ publish, finish })), () => 'same', () => {}, { pageSize: 2 });
  const a = { value: 'A', label: 'A' }, b = { value: 'B', label: 'B' }, c = { value: 'C', label: 'C' };
  session.open('office');
  calls[0].publish?.([c]);
  expect(session.snapshots().office).toEqual({ status: 'loading', candidates: [c], search: '' });
  calls[0].publish?.([c, b, a]);
  calls[0].finish({ kind: 'values', candidates: [a, b], totalCount: 3 });
  await Promise.resolve();
  expect(session.snapshots().office.candidates).toEqual([c, b]);
  session.more('office');
  expect(session.snapshots().office.candidates).toEqual([c, b, a]);
  expect(calls).toHaveLength(1);
  session.close('office');
  expect(session.snapshots().office.candidates).toEqual([a, b, c]);
  session.dispose();
});
