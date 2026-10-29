import { expect, it } from 'vitest';
import { createColumnCandidatesSession } from '../src/table/column-candidates';
import type { ColumnCandidatesPage } from '@metriccanvas/data-execution';

function setup() {
  const idle = new Set<() => void>(), calls: Array<{ field: string; signal: AbortSignal; resolve(page: ColumnCandidatesPage): void; reject(cause: unknown): void }> = [];
  let context = 'one';
  const session = createColumnCandidatesSession((field, _search, _offset, signal) => new Promise((resolve, reject) => calls.push({ field, signal, resolve, reject })),
    () => context, () => {}, { fields: () => ['office', 'region'], schedule: work => { idle.add(work); return () => { idle.delete(work); }; } });
  return { session, calls, idle, context(value: string) { context = value; }, runIdle() { const work = [...idle][0]; idle.delete(work); work?.(); } };
}

it('defers until visible and idle, serially preloads, and reuses the in-flight and ready results on open', async () => {
  const test = setup();
  try {
    expect(test.calls).toHaveLength(0);
    test.session.preloadVisible(true); expect(test.calls).toHaveLength(0);
    test.runIdle(); expect(test.calls.map(call => call.field)).toEqual(['office']);
    test.session.open('office'); expect(test.calls).toHaveLength(1);
    test.calls[0].resolve({ kind: 'values', candidates: [{ value: 'A', label: 'A' }], totalCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 0));
    test.session.close('office'); test.session.open('office'); expect(test.calls).toHaveLength(1);
    test.runIdle(); expect(test.calls[1].field).toBe('region');
    test.calls[1].resolve({ kind: 'values', candidates: [], totalCount: 0 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(test.idle.size).toBe(0);
  } finally { test.session.dispose(); }
});

it('cancels hidden preloads, discards late results, invalidates conditions, and leaves failures for explicit retry', async () => {
  const test = setup();
  try {
    test.session.preloadVisible(true); test.runIdle(); test.session.preloadVisible(false);
    expect(test.calls[0].signal.aborted).toBe(true);
    test.calls[0].resolve({ kind: 'values', candidates: [{ value: 'old', label: 'old' }], totalCount: 1 });
    await Promise.resolve(); expect(test.session.snapshots().office.status).toBe('idle');
    test.context('two'); test.session.sync(); test.session.preloadVisible(true); test.runIdle();
    test.calls[1].reject(Error('failed'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(test.session.snapshots().office.status).toBe('error');
    test.runIdle(); expect(test.calls[2].field).toBe('region');
    test.session.open('office'); expect(test.calls[3].field).toBe('office');
  } finally { test.session.dispose(); }
});

it('returns cancellation to idle so the next idle period can resume after a foreground query', async () => {
  const test = setup();
  try {
    test.session.preloadVisible(true); test.runIdle();
    test.calls[0].reject(Object.assign(new Error('preempted'), { code: 'DQE_CANCELLED' }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(test.session.snapshots().office.status).toBe('idle');
    test.runIdle(); expect(test.calls[1].field).toBe('office');
  } finally { test.session.dispose(); }
});
