import { describe, expect, it, vi } from 'vitest';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { createDqeGateway } from '../../data-gateway/src/dqe';
import type { RuntimeDataGateway } from '../../runtime/src';
import { createAuthRequiredGateway, notifyAuthRequired } from '../src/auth-required';

const query: EffectiveQuery = {
  language: 'dqe', body: { dsl_list: [{ output_dims: [], output_metrics: ['value'], filter: { dims: [], metrics: [] }, order: {} }] },
  fieldMappings: { value: { queryField: 'value', type: 'number', role: 'measure' } }, filterValues: []
};
const filter = { filterId: 'region', dimension: 'region', constraints: { dimensions: {}, times: {} } };
const column = { query, field: 'value', queryField: 'value', search: '', offset: 0, limit: 10 };

describe('page-owned authentication request observation', () => {
  it.each([401, 403, 419])('observes structured HTTP %s before normalization and preserves the error', async status => {
    const observe = vi.fn();
    const base = createDqeGateway({ fetchImpl: async () => new Response(null, { status }) });
    const session = createAuthRequiredGateway(base, observe);
    await expect(session.gateway.fetchData(query)).rejects.toMatchObject({ detail: { status } });
    expect(observe).toHaveBeenCalledExactlyOnceWith({ type: 'auth-required', status });
    session.dispose();
  });

  it.each([400, 404, 429, 500])('leaves HTTP %s alone', async status => {
    const observe = vi.fn();
    const session = createAuthRequiredGateway(createDqeGateway({ fetchImpl: async () => new Response(null, { status }) }), observe);
    await expect(session.gateway.fetchData(query)).rejects.toMatchObject({ code: 'DQE_TRANSPORT_ERROR' });
    expect(observe).not.toHaveBeenCalled();
    session.dispose();
  });

  it('does not infer HTTP status from error messages, result codes or cancellation', async () => {
    const observe = vi.fn();
    for (const error of [new Error('HTTP 419'), Object.assign(new Error('permission'), { code: 'DQE_FORBIDDEN' })]) {
      const session = createAuthRequiredGateway({ fetchData: async () => { throw error; } }, observe);
      await expect(session.gateway.fetchData(query)).rejects.toBe(error);
      session.dispose();
    }
    expect(observe).not.toHaveBeenCalled();
  });

  it('covers every optional request port without mutating the supplied object', async () => {
    const failure = async () => { throw Object.assign(new Error('HTTP rejected'), { detail: { status: 419 } }); };
    const base: RuntimeDataGateway = Object.freeze({ fetchData: failure, fetchDimensionValues: failure, fetchFilterCandidates: failure, fetchColumnCandidates: failure });
    const observe = vi.fn(), session = createAuthRequiredGateway(base, observe);
    const calls = [session.gateway.fetchData(query), session.gateway.fetchDimensionValues!('region'), session.gateway.fetchFilterCandidates!(filter, { signal: new AbortController().signal }), session.gateway.fetchColumnCandidates!(column)];
    await Promise.all(calls.map(call => expect(call).rejects.toHaveProperty('detail.status', 419)));
    expect(observe).toHaveBeenCalledTimes(4);
    expect(base.fetchData).toBe(failure);
    expect(createAuthRequiredGateway({ fetchData: failure }, observe).gateway.fetchDimensionValues).toBeUndefined();
    session.dispose();
  });

  it('isolates page cancellation when two instances share a non-cooperative Adapter', async () => {
    let finish!: (value: { rows: [] }) => void;
    const base: RuntimeDataGateway = { fetchData: () => new Promise(resolve => { finish = resolve; }) };
    const observe = vi.fn(), first = createAuthRequiredGateway(base, observe), second = createAuthRequiredGateway(base, observe);
    const abandoned = first.gateway.fetchData(query).catch(error => error);
    await Promise.resolve();
    first.dispose();
    expect(await abandoned).toHaveProperty('code', 'DQE_CANCELLED');
    finish({ rows: [] });
    const live = second.gateway.fetchData(query);
    await Promise.resolve();
    finish({ rows: [] });
    await expect(live).resolves.toEqual({ rows: [] });
    await expect(first.gateway.fetchData(query)).rejects.toHaveProperty('code', 'DQE_CANCELLED');
    expect(observe).not.toHaveBeenCalled();
    second.dispose();
  });

  it('discards a late 419 after caller cancellation', async () => {
    let fail!: (error: Error) => void;
    const observe = vi.fn(), caller = new AbortController();
    const session = createAuthRequiredGateway({ fetchData: () => new Promise((_resolve, reject) => { fail = reject; }) }, observe);
    const result = session.gateway.fetchData(query, undefined, caller.signal).catch(error => error);
    await Promise.resolve(); caller.abort();
    expect(await result).toHaveProperty('code', 'DQE_CANCELLED');
    fail(Object.assign(new Error('late'), { detail: { status: 419 } }));
    await Promise.resolve();
    expect(observe).not.toHaveBeenCalled();
    session.dispose();
  });

  it('does not send a queued dimension request after page termination', async () => {
    let respond!: (response: Response) => void;
    const transport = vi.fn<typeof fetch>(() => new Promise(resolve => { respond = resolve; }));
    const base = createDqeGateway({ fetchImpl: transport, maxConcurrentBatches: 1 });
    const session = createAuthRequiredGateway(base, () => session.dispose());
    const results = [session.gateway.fetchData(query), session.gateway.fetchDimensionValues!('region')].map(call => call.catch(error => error));
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    respond(new Response(null, { status: 419 }));
    await Promise.all(results);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('contains observer failures including accidentally asynchronous rejection', async () => {
    const event = { type: 'auth-required' as const, status: 419 as const };
    expect(() => notifyAuthRequired(() => { throw Error('application failed'); }, event)).not.toThrow();
    notifyAuthRequired(async () => { throw Error('application failed'); }, event);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});
