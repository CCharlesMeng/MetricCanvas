import { expect, it } from 'vitest';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import type { ColumnCandidatesPage } from '../src/ports';
import { createQueryRunner } from '../src/query-runner';

const query = (id: number): EffectiveQuery => ({ language: 'dqe', body: { dsl_list: [{ id }] }, fieldMappings: {}, filterValues: [] });
const candidate = (id: number) => ({ query: query(id), field: 'office', queryField: 'office', search: '', offset: 0, limit: 50 });

it('preempts a hung candidate at concurrency one and ignores its late receipt without blocking ordinary reads', async () => {
  let release!: (page: ColumnCandidatesPage) => void, signal: AbortSignal | undefined;
  const runner = createQueryRunner({ maxConcurrent: 1, gateway: {
    fetchData: async () => ({ rows: [], totalCount: 0 }),
    fetchColumnCandidates: (_request, _context, current) => { signal = current; return new Promise(resolve => release = resolve); }
  } });
  try {
    const pending = runner.runCandidates(candidate(1), {}, 'session');
    const cancelled = expect(pending).rejects.toMatchObject({ code: 'DQE_CANCELLED' });
    expect(await runner.run(query(2), {}, 'session')).toMatchObject({ status: 'empty' });
    await cancelled; expect(signal?.aborted).toBe(true);
    release({ kind: 'values', candidates: [{ value: 'late', label: 'late' }], totalCount: 1 });
    await Promise.resolve();
    expect(await runner.run(query(3), {}, 'session')).toMatchObject({ status: 'empty' });
  } finally { runner.dispose(); }
});

it('queues candidates after data and scans only one column at a time', async () => {
  let releaseData!: (value: { rows: []; totalCount: number }) => void;
  const releaseCandidates: Array<(value: ColumnCandidatesPage) => void> = [];
  const runner = createQueryRunner({ maxConcurrent: 5, gateway: {
    fetchData: () => new Promise(resolve => releaseData = resolve),
    fetchColumnCandidates: () => new Promise(resolve => releaseCandidates.push(resolve))
  } });
  try {
    const data = runner.run(query(1), {}, 'session');
    const first = runner.runCandidates(candidate(2), {}, 'session', undefined, true), second = runner.runCandidates(candidate(3), {}, 'session', undefined, true);
    expect(releaseCandidates).toHaveLength(0);
    releaseData({ rows: [], totalCount: 0 }); await data;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(releaseCandidates).toHaveLength(1);
    releaseCandidates[0]({ kind: 'values', candidates: [], totalCount: 0 }); await first;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(releaseCandidates).toHaveLength(2);
    releaseCandidates[1]({ kind: 'values', candidates: [], totalCount: 0 }); await second;
  } finally { runner.dispose(); }
});

it('promotes a matching preload in place and lets another explicit menu request preempt other background work', async () => {
  const calls: Array<{ signal?: AbortSignal; resolve(page: ColumnCandidatesPage): void }> = [];
  const runner = createQueryRunner({ maxConcurrent: 1, gateway: {
    fetchData: async () => ({ rows: [], totalCount: 0 }),
    fetchColumnCandidates: (_request, _context, signal) => new Promise(resolve => calls.push({ signal, resolve }))
  } });
  try {
    const first = runner.runCandidates(candidate(1), {}, 'session', undefined, true);
    const promoted = runner.runCandidates(candidate(1), {}, 'session');
    expect(calls).toHaveLength(1); expect(calls[0].signal?.aborted).toBe(false);
    calls[0].resolve({ kind: 'values', candidates: [], totalCount: 0 }); await Promise.all([first, promoted]);
    const background = runner.runCandidates(candidate(2), {}, 'session', undefined, true);
    const cancelled = expect(background).rejects.toMatchObject({ code: 'DQE_CANCELLED' });
    await new Promise(resolve => setTimeout(resolve, 0));
    const demand = runner.runCandidates(candidate(3), {}, 'session');
    await cancelled; expect(calls[1].signal?.aborted).toBe(true);
    calls[2].resolve({ kind: 'values', candidates: [], totalCount: 0 }); await demand;
  } finally { runner.dispose(); }
});
